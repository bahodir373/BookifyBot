require('dotenv').config()
const { Telegraf, Markup } = require('telegraf')
const mongoose = require('mongoose')
const User = require('./models/User')
const { dbConnect } = require('./db/db.config')
const Book = require('./models/Book')
const Author = require('./models/Author')
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
	console.log(msg)
  if (msg.length < 6) {
    return ctx.reply(
      "❗ Format noto‘g‘ri!\n\n" +
      "To‘g‘ri format:\n" +
      "/addbook | Kitob nomi | Tavsif | AuthorID | Category | fileId"
    );
  }

  const [_, title, description, authorId, category, fileId] = msg.map(m => m.trim());

  try {
    const author = await Author.findById(authorId);
    if (!author) return ctx.reply("❗ Bunday muallif topilmadi!");

    const newBook = new Book({
      title,
      description,
      author: author._id,
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

bot.command('books', async (ctx) => {
  sendBooksPage(ctx, 1);
});

bot.action(/books_page_(\d+)/, async (ctx) => {
  const page = parseInt(ctx.match[1]);
  await ctx.deleteMessage(); // Eski ro'yxat o'chadi
  sendBooksPage(ctx, page);
});

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
  books.forEach((book, index) => {
    text += `📖 <b>${book.title}</b>\n✍️ Muallif: ${book.author.name}\n📂 Kategoriya: ${book.category}\n\n`;
  });

  const buttons = [];
  buttons.push([
    { text: '⏪', callback_data: `books_page_${currentPage - 1}` },
    { text: `<<  ${currentPage}/${totalPages}  >>`, callback_data: 'disabled' },
    { text: '⏩', callback_data: `books_page_${currentPage + 1}` },
  ]);

  // Cheklov: orqaga yoki oldinga bosish mumkin emasligini tekshirish
  if (currentPage === 1) buttons[0][0].callback_data = 'disabled';
  if (currentPage === totalPages) buttons[0][2].callback_data = 'disabled';

  await ctx.replyWithHTML(text, {
    reply_markup: { inline_keyboard: buttons }
  });
}

bot.command('addauthor', async (ctx) => {
  if (ctx.from.id !== adminId) return ctx.reply('Bu buyruq faqat admin uchun!');

  const text = ctx.message.text.split(' ').slice(1).join(' ');
  if (!text) {
    return ctx.reply('Iltimos, muallif nomi va bio kiriting. Misol: /addauthor MuallifNomi - Bio');
  }

  const [name, ...bioParts] = text.split('-');
  if (!name || bioParts.length === 0) {
    return ctx.reply('To\'g\'ri formatda kiriting: /addauthor Muallif Nomi - Bio');
  }

  const bio = bioParts.join('-').trim();

  try {
    const newAuthor = new Author({
      name: name.trim(),
      bio
    });
    await newAuthor.save();
    ctx.reply(`✅ Muallif qo‘shildi:\n\n📖 Nomi: ${newAuthor.name}\n📝 Bio: ${newAuthor.bio}`);
  } catch (err) {
    console.error(err);
    ctx.reply('Xatolik yuz berdi, keyinroq urinib ko‘ring.');
  }
});

const ITEMS_PER_PAGE = 5;

// Mualliflarni chiqarish
async function sendAuthors(ctx, page = 1) {
  const userId = ctx.from.id;
  const totalAuthors = await Author.countDocuments();
  const totalPages = Math.ceil(totalAuthors / ITEMS_PER_PAGE);

  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;

  const authors = await Author.find()
    .skip((page - 1) * ITEMS_PER_PAGE)
    .limit(ITEMS_PER_PAGE);

  if (!authors.length) {
    return ctx.reply('Hozircha mualliflar mavjud emas.');
  }

  let text = `<b>📚 Mualliflar (${page}/${totalPages}):</b>\n\n`;
  const buttons = [];

  authors.forEach((author, index) => {
		const authorName = author.name || "Noma'lum Muallif";
		if (userId === adminId) {
			text += `${index + 1}. ${authorName}\n🆔 <code>${author._id}</code>\n\n`;
		}
		buttons.push([{ text: authorName, callback_data: `author_${author._id}` }]);
	});
	

  // Navigatsiya tugmalari
  const navButtons = [];
  if (page > 1) navButtons.push({ text: '⬅️ Oldingi', callback_data: `authors_page_${page - 1}` });
  navButtons.push({ text: `${page}/${totalPages}`, callback_data: 'ignore' });
  if (page < totalPages) navButtons.push({ text: '➡️ Keyingi', callback_data: `authors_page_${page + 1}` });

  buttons.push(navButtons);

  await ctx.replyWithHTML(text, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// /authors komandasi
bot.command('authors', async (ctx) => {
  let page = 1;
  const args = ctx.message.text.split(' ');
  if (args.length > 1) page = parseInt(args[1]) || 1;
  await sendAuthors(ctx, page);
});

// Callback querylarni ushlaymiz
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;

  // Muallif sahifalash
  if (data.startsWith('authors_page_')) {
    const page = parseInt(data.split('_')[2]);
    await ctx.deleteMessage();
    await sendAuthors(ctx, page);
  }

  // Muallif ustiga bosilganda shu muallif kitoblarini chiqarish
  else if (data.startsWith('author_')) {
    const authorId = data.split('_')[1];
    await ctx.deleteMessage();
    const books = await Book.find({ author: authorId });

    if (!books.length) {
      return ctx.reply('Bu muallifda hozircha kitoblar yo‘q.');
    }

    let text = `<b>📖 Ushbu muallif kitoblari:</b>\n\n`;
    books.forEach((book, index) => {
      text += `${index + 1}. ${book.title}\n`;
    });

    await ctx.replyWithHTML(text);
  } else {
    await ctx.answerCbQuery();
  }
});



bot.on('document', (ctx) => {
	const fileId = ctx.message.document.file_id;
	ctx.reply(`Sizning fayl ID: ${fileId}`);
});

bot.launch()
console.log('> Bot ishlayapti');


