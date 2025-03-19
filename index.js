require('dotenv').config()
const { Telegraf, Markup } = require('telegraf')
const mongoose = require('mongoose')
const User = require('./models/User')
const { dbConnect } = require('./db/db.config')
const Book = require('./models/Book')
const Author = require('./models/Author')
const Wishlist = require('./models/Wishlist')
const bot = new Telegraf(process.env.BOT_TOKEN)

const adminId = 6445758541
dbConnect()

const channels = ['@BahodirsBlog']

const subscriptionCheckButton = Markup.inlineKeyboard([
	Markup.button.callback("✅ Obunani tekshirish", "check_subscribe")
])

const askContactKeyboard = Markup.keyboard([
	Markup.button.contactRequest('📲 Telefon raqamni yuborish')
]).oneTime().resize()

const checkSubscription = async (ctx) => {
	const userId = ctx.from.id
	let notSubscribed = []

	for (let channel of channels) {
		try {
			const member = await ctx.telegram.getChatMember(channel, userId)
			if (['left', 'kicked'].includes(member.status)) {
				notSubscribed.push(channel)
			}
		} catch (err) {
			notSubscribed.push(channel)
		}
	}

	if (notSubscribed.length > 0) {
		const text = "Botdan foydalanish uchun quyidagi kanallarga obuna bo'ling:"
		const buttons = notSubscribed.map(channel =>
			Markup.button.url(`${channel.replace('@', '')}`, `https://t.me/${channel.replace('@', '')}`)
		)
		await ctx.reply(text, Markup.inlineKeyboard([...buttons, Markup.button.callback("✅ Obunani tekshirish", "check_subscribe"),], { columns: 1 }))
		return false
	}

	return true
}

let contactRequestMessages = {}

bot.start(async (ctx) => {
	const subscriptionPassed = await checkSubscription(ctx)
	if (!subscriptionPassed) return

	const userId = ctx.from.id
	const fullName = `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim()
	const existingUser = await User.findOne({ userId })

	// Agar user oldin ro'yxatdan o'tgan bo'lsa qayta raqam so'ramaymiz
	if (existingUser) {
		return ctx.reply(`👋 Assalomu alaykum ${fullName}! Botga xush kelibsiz.`)
	}

	const sentMsg = await ctx.reply('📱 Telefon raqamingizni yuboring:', askContactKeyboard)
	contactRequestMessages[userId] = sentMsg.message_id
})

bot.action('check_subscribe', async (ctx) => {
	try {
		const subscriptionPassed = await checkSubscription(ctx)
		if (!subscriptionPassed) return

		const userId = ctx.from.id
		const existingUser = await User.findOne({ userId })

		await ctx.deleteMessage()

		if (existingUser) {
			return ctx.reply(`👋 Assalomu alaykum ${existingUser.fullName}. Xush kelibsiz!`)
		}

		const sentMsg = await ctx.reply('📱 Telefon raqamingizni yuboring:', askContactKeyboard)
		contactRequestMessages[userId] = sentMsg.message_id
	} catch (error) {
		console.log('Xatolik:', error)
	}
})


bot.on('contact', async (ctx) => {
	const subscriptionPassed = await checkSubscription(ctx)
	if (!subscriptionPassed) return

	const userId = ctx.from.id
	const fullName = `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim()
	const username = ctx.from.username ? `@${ctx.from.username}` : 'username yo‘q'
	const phone = ctx.message.contact.phone_number

	await User.findOneAndUpdate(
		{ userId },
		{ userId, fullName, username, phone, subscribedChannels: channels },
		{ upsert: true, new: true }
	)

	if (contactRequestMessages[userId]) {
		await ctx.telegram.deleteMessage(ctx.chat.id, contactRequestMessages[userId])
		delete contactRequestMessages[userId]
	}
	await ctx.deleteMessage()

	await ctx.reply('✅ Tabriklaymiz! Barcha shartlarni bajardingiz va botdan to‘liq foydalanishingiz mumkin.')
})



bot.command('profile', async (ctx) => {
	const subscriptionPassed = await checkSubscription(ctx)
	if (!subscriptionPassed) return

	const userId = ctx.from.id
	const user = await User.findOne({ userId })

	if (!user) return ctx.reply(`❌ Siz hali ro'yxatdan o'tmagansiz. /start buyrug'ini bosing.`)

	const profileText = `
👤 Ism: ${user.fullName}
🆔 UserID: ${user.userId}
🔗 Username: ${user.username}
📱 Telefon: ${user.phone}
📌 Obuna bo‘lgan kanallar: ${user.subscribedChannels.join(', ')}
	`

	ctx.reply(profileText)
})

bot.command('users', async (ctx) => {
	const subscriptionPassed = await checkSubscription(ctx)
	if (!subscriptionPassed) return

	if (ctx.from.id !== adminId) return ctx.reply('❌ Bu buyruq faqat admin uchun.')

	const users = await User.find()
	if (!users.length) return ctx.reply(`🚫 Hali hech kim ro'yxatdan o‘tmagan.`)

	let text = `📋 Ro'yxatdan o‘tgan foydalanuvchilar (${users.length} ta):\n\n`
	users.forEach((user, index) => {
		text += `${index + 1}. ${user.fullName} (${user.username})\n`
	})

	ctx.reply(text)
})

bot.command('stats', async (ctx) => {
	const subscriptionPassed = await checkSubscription(ctx)
	if (!subscriptionPassed) return

	if (ctx.from.id !== adminId) return ctx.reply('❌ Bu buyruq faqat admin uchun.')

	const totalUsers = await User.countDocuments()

	ctx.reply(`📊 Umumiy ro‘yxatdan o‘tgan foydalanuvchilar soni: ${totalUsers} ta`)
})

/* bot.command('file', async (ctx) => {
	await ctx.telegram.sendDocument(
		ctx.chat.id,
		'BQACAgIAAxkBAAO5Z9lkGtDpjifpFuxuhwr4zI1EH24AAm1wAALd-MhKj4JjwLSwGCs2BA', // file_id
		{
			caption: '📖 Kitob nomi: "JavaScript Asoslari"\nYuklab oling va o‘qing!',
		}
	)
}) */


bot.command('search', async (ctx) => {
  const query = ctx.message.text.split(' ').slice(1).join(' ');
  if (!query) return ctx.reply('Qidirish uchun kitob nomini kiriting.\nMisol: /search Oq kema');

  const books = await Book.find({ title: { $regex: query, $options: 'i' } }).populate('author');

  if (books.length === 0) {
		return ctx.reply(
			"Afsuski, siz izlagan kitob topilmadi.\n\n" +
			"📚 Lekin kutubxonamizdagi barcha kitoblarni /books buyrug‘i orqali ko'rishingiz mumkin."
		);
	}
	

  for (const book of books) {
    await ctx.replyWithDocument(book.fileId, {
      caption: `📖 *${book.title}*\n✍️ Muallif: ${book.author?.name || 'Noma\'lum'}\n🗂 Kategoriya: ${book.category}`,
      parse_mode: 'Markdown'
    });
  }
});


bot.command('addbook', async (ctx) => {
  if (ctx.from.id !== adminId) return ctx.reply("⛔ Bu buyruq faqat admin uchun!");

  const msg = ctx.message.text.split('|');

  if (msg.length < 6) {
    return ctx.reply(
      "❗ Format noto‘g‘ri!\n\n" +
      "To‘g‘ri format:\n" +
      "/addbook | Kitob nomi | Tavsif | AuthorID | Category | fileId"
    );
  }

  const [_, title, description, authorId, category, fileId] = msg.map(m => m.trim());

  try {
    const author = await Author.findOne({ customId: Number(authorId) }); // 💪 fix qildim
    if (!author) return ctx.reply("❗ Bunday muallif topilmadi!");

    const newBook = new Book({
      title,
      description,
      author: author._id,  // customId saqlayapsan
      category,
      fileId
    });

    await newBook.save();

    ctx.reply("✅ Kitob muvaffaqiyatli qo‘shildi!");
  } catch (error) {
    console.error(error);
    ctx.reply("❌ Xatolik yuz berdi!");
  }
});



const BOOKS_PER_PAGE = 5;

async function sendBooksPage(ctx, page) {
  const totalBooks = await Book.countDocuments();
  const totalPages = Math.ceil(totalBooks / BOOKS_PER_PAGE);
  const currentPage = Math.max(1, Math.min(page, totalPages));

  const books = await Book.find()
    .populate('author')
    .skip((currentPage - 1) * BOOKS_PER_PAGE)
    .limit(BOOKS_PER_PAGE);

  if (books.length === 0) {
    return ctx.reply("Afsuski, hali kutubxonamiz bo‘sh. Tez orada yangilanadi.");
  }

  let text = "📚 <b>Kitoblar ro‘yxati</b>\n\n";
  const bookButtons = books.map(book => {
    return [{ text: `📖 ${book.title}`, callback_data: `book_one_${book._id}` }];
  });

  const paginationButtons = [
    { text: '⏪', callback_data: `books_page_${currentPage - 1}` },
    { text: `${currentPage}/${totalPages}`, callback_data: 'disabled' },
    { text: '⏩', callback_data: `books_page_${currentPage + 1}` }
  ];

  if (currentPage === 1) paginationButtons[0].callback_data = 'disabled';
  if (currentPage === totalPages) paginationButtons[2].callback_data = 'disabled';

  const inlineKeyboard = [...bookButtons, paginationButtons];

  // Agar callback query bo'lsa edit qilamiz, bo'lmasa reply
  if (ctx.updateType === 'callback_query') {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  } else {
    await ctx.replyWithHTML(text, {
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  }
}

bot.command('books', async (ctx) => {
  sendBooksPage(ctx, 1);
});

bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;

  if (data.startsWith('books_page_')) {
    const page = parseInt(data.split('books_page_')[1]);
    await sendBooksPage(ctx, page);
    return ctx.answerCbQuery();
  }

  const { Markup } = require('telegraf'); // Markup to'g'ri chaqirilganiga ishonch hosil qiling

if (data.startsWith('book_one_')) {
    const bookId = data.split('book_one_')[1];
    const book = await Book.findById(bookId).populate('author');

    if (!book) return ctx.reply("Kitob topilmadi!");

    const caption = `📖 <b>${book.title}</b>\n` +
                    `✍️ <b>Muallif:</b> ${book.author.name}\n` +
                    `📂 <b>Kategoriya:</b> ${book.category}\n` +
                    `📝 <b>Tavsif:</b>\n${book.description}`;

    const buttons = Markup.inlineKeyboard([
        [Markup.button.callback("📚 O'qishni xohlayman", `want_to_read_${bookId}`)],
        [Markup.button.callback("✅ O'qib bo'ldim", `mark_as_read_${bookId}`)]
    ]);

    if (book.fileId) {
        await ctx.sendDocument(book.fileId, {
            caption: caption,
            parse_mode: 'HTML'
        });
        await ctx.sendMessage("Quyidagi tugmalar orqali amalni tanlang:", buttons);
    } else {
        await ctx.sendMessage(caption, { parse_mode: 'HTML', ...buttons });
    }

    return ctx.answerCbQuery();
}



  if (data.startsWith('want_to_read_')) {
    const bookId = data.split('want_to_read_')[1];
    
    const existing = await Wishlist.findOne({ userId, bookId });
    if (!existing) {
      await Wishlist.create({ userId, bookId });
      await ctx.answerCbQuery("✅ Kitob o'qishni xohlash ro'yxatiga qo'shildi!");
    } else {
      await ctx.answerCbQuery("📌 Bu kitob allaqachon ro'yxatda bor!");
    }
  }

  if (data.startsWith('mark_as_read_')) {
    const bookId = data.split('mark_as_read_')[1];

    const existing = await Readlist.findOne({ userId, bookId });
    if (!existing) {
      await Readlist.create({ userId, bookId });
      await Wishlist.deleteOne({ userId, bookId }); // O'qishni xohlash ro'yxatidan o'chirish
      await ctx.answerCbQuery("✅ Kitob o'qilganlar ro'yxatiga qo'shildi!");
    } else {
      await ctx.answerCbQuery("📌 Bu kitob allaqachon o'qilgan!");
    }
  }

  if (data.startsWith('remove_wishlist_')) {
    const bookId = data.split('remove_wishlist_')[1];
    await Wishlist.deleteOne({ userId, bookId });
    await ctx.answerCbQuery("🗑 O'qishni xohlash ro'yxatidan o'chirildi!");
    ctx.deleteMessage();
  }

  if (data.startsWith('remove_readlist_')) {
    const bookId = data.split('remove_readlist_')[1];
    await Readlist.deleteOne({ userId, bookId });
    await ctx.answerCbQuery("🗑 O'qilgan kitoblar ro'yxatidan o'chirildi!");
    ctx.deleteMessage();
  }
});

bot.command('want_to_read', async (ctx) => {
  const userId = ctx.from.id;
  const wishlist = await Wishlist.find({ userId }).populate('bookId');

  if (!wishlist.length) {
    return ctx.reply("📌 Sizning o'qishni xohlash ro'yxatingiz bo'sh.");
  }

  const buttons = wishlist.map(entry => [
    Markup.button.callback(`📖 ${entry.bookId.title}`, `book_one_${entry.bookId._id}`),
    Markup.button.callback("❌ O'chirish", `remove_wishlist_${entry.bookId._id}`)
  ]);

  await ctx.reply("📚 O'qishni xohlash ro'yxatingiz:", Markup.inlineKeyboard(buttons));
});


bot.command('addauthor', async (ctx) => {
  if (ctx.from.id !== adminId) return ctx.reply('Bu buyruq faqat admin uchun!');

  const text = ctx.message.text.split(' ').slice(1).join(' ');
  if (!text) {
    return ctx.reply('Iltimos, muallif nomi va bio kiriting. Misol: /addauthor Muallif Nomi | Bio');
  }
  const [name, bio] = text.split('|').map(str => str.trim());
  if (!name || !bio) {
    return ctx.reply('To‘g‘ri formatda kiriting: /addauthor Muallif Nomi | Bio');
  }

  try {
    const lastAuthor = await Author.findOne().sort({ customId: -1 });
    const customId = lastAuthor ? lastAuthor.customId + 1 : 1;

    const newAuthor = new Author({
      name,
      bio,
      customId
    });

    await newAuthor.save();
    ctx.reply(`✅ Muallif qo‘shildi:\n\n🆔 ID: ${newAuthor.customId}\n📖 Nomi: ${newAuthor.name}\n📝 Bio: ${newAuthor.bio}`);
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Xatolik yuz berdi, keyinroq urinib ko‘ring.');
  }
});



bot.on('document', (ctx) => {
	const fileId = ctx.message.document.file_id;
	ctx.reply(`Sizning fayl ID: ${fileId}`);
});

bot.launch()
console.log('> Bot ishlayapti');


