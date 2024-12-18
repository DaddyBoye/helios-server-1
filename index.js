const express = require('express');
const http = require('http');
require('dotenv').config();
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api'); // Add the Telegram Bot package
const referrals = require('./routes/referrals');
const minerate = require('./routes/minerate');
const { setupSocketIO } = require('./controllers/universalProgressController');

const app = express();
const server = http.createServer(app);

// Configure CORS
const corsOptions = {
  origin: ['https://bamboo-1.vercel.app', 'http://localhost:5173'],
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/api', referrals);
app.use('/api', minerate);

app.get('/', (req, res) => {
  res.send('Node API with Telegram Bot');
});

// Telegram Bot setup
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Handle /start command for Telegram Bot
bot.onText(/\/start(.*)/, (msg, match) => {
  const referralToken = match[1]?.trim();
  const webAppUrl = `https://bamboo-1.vercel.app/?referralToken=${referralToken || ''}`;
  const imageUrl = 'https://i.imgur.com/SLkkAs3.png';

  bot.sendPhoto(msg.chat.id, imageUrl, {
    caption: `🌟 *Join our gamified ecosystem where every mission contributes to real environmental change!*\n\n` +
      `🌱 *Complete daily green missions*\n` +
      `💫 *Earn rewards for climate action*\n` +
      `🌍 *Track your environmental impact*\n` +
      `💎 *Convert actions to carbon credits*\n` +
      `🎁 *Join airdrops and special events*\n\n` +
      `Start your climate hero journey now - every action counts! ⚡️`,
    reply_markup: {
      inline_keyboard: [[
        {
          text: "🌟 Start Saving the Planet 🌍",
          web_app: { url: webAppUrl }
        }
      ]]
    },
    parse_mode: 'Markdown'
  });
});

// Set up Socket.IO connection
setupSocketIO(server);

// Start HTTP server on port 8000
server.listen(8000, () => {
  console.log('Server is running on port 8000');
});
