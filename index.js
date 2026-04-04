require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const setupRichMenu = require('./scripts/setupRichMenu');

const handleLeave = require('./handlers/leave');
const handleQuote = require('./handlers/quote');
const handlePayment = require('./handlers/payment');
const handleMarket = require('./handlers/market');
const handleProgress = require('./handlers/progress');
const handleCloud = require('./handlers/cloud');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const app = express();

// Webhook 路由（必須在 express.json() 之前，LINE SDK 需要 raw body）
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(event => handleEvent(event, client)))
    .then(() => res.status(200).json({ status: 'ok' }))
    .catch(err => {
      console.error('Webhook error:', err);
      res.status(500).end();
    });
});

app.use(express.json());

app.get('/', (req, res) => {
  res.send('鑫創小助手 LINE Bot 運行中 ✅');
});

async function handleEvent(event, client) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const text = event.message.text.trim();
  const replyToken = event.replyToken;

  // 關鍵字路由
  if (text.startsWith('假')) return handleLeave(event, client, text);
  if (text.startsWith('報')) return handleQuote(event, client, text);
  if (text.startsWith('款')) return handlePayment(event, client, text);
  if (text.startsWith('市')) return handleMarket(event, client, text);
  if (text.startsWith('進')) return handleProgress(event, client, text);
  if (text.startsWith('雲')) return handleCloud(event, client, text);

  // 預設選單
  return client.replyMessage({
    replyToken,
    messages: [{
      type: 'text',
      text: '👋 鑫創小助手，請輸入以下關鍵字：\n\n假 → 請假審批\n報 → 報價追蹤\n款 → 請款流程\n市 → 市集管理\n進 → 每日進度匯報\n雲 → 雲端資料夾',
    }],
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`鑫創小助手 LINE Bot 啟動於 port ${PORT}`);
  // 首次啟動時自動建立圖文選單（已存在則跳過）
  setupRichMenu().catch(err =>
    console.error('圖文選單初始化失敗:', err.response?.data || err.message)
  );
});
