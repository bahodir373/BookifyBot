require('dotenv').config();
const { Telegraf } = require('telegraf'); // 4-versiyada destructuring shart

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.command('start', (ctx) => ctx.reply('Something new is coming soon⚡ Stay tuned...'))
bot.launch().then(() => console.log('> Bot is running'));
