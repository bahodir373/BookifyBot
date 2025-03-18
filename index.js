require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);

const channels = ['@BahodirsBlog'];

bot.start(async (ctx) => {
    await ctx.reply(`Botdan to'liq foydalanish uchun 2 ta shart:
1. Homiy kanallarga obuna bo'ling
2. Telefon raqamingizni yuboring`);

    await ctx.reply('Telefon raqamingizni yuboring:', Markup.keyboard([
        Markup.button.contactRequest('📱 Telefon raqamni yuborish')
    ]).oneTime().resize());
});

bot.on('contact', async (ctx) => {
    const userId = ctx.from.id;
    let check = true;
    let errorChannels = [];

    for (let channel of channels) {
        const member = await ctx.telegram.getChatMember(channel, userId);
        if (['left', 'kicked'].includes(member.status)) {
            check = false;
            errorChannels.push(channel);
        }
    }

    if (!check) {
        return ctx.reply(`Siz hali quyidagi homiy kanallarga obuna bo'lmagansiz:\n${errorChannels.join('\n')}`);
    }
    await ctx.reply('✅ Tabriklayman! Siz barcha shartlarni bajardingiz va botdan foydalanishingiz mumkin.');
});

bot.on('message', (ctx) => {
    ctx.reply('Iltimos, avval telefon raqamingizni yuboring!');
});

bot.launch().then(() => console.log('> Bot is running'));
