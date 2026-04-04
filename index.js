require('dotenv').config();
const path = require('path');
const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');
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

// ── Webhook（LINE middleware 需要 raw body，必須在 express.json 之前）──
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(event => handleEvent(event, client)))
    .then(() => res.status(200).json({ status: 'ok' }))
    .catch(err => {
      console.error('Webhook error:', err);
      res.status(500).end();
    });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── 健康檢查 ──
app.get('/', (req, res) => {
  res.send('鑫創小助手 LINE Bot 運行中 ✅');
});

// ── LIFF 頁面 ──
app.get('/liff/leave', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'leave-form.html'));
});

// ── 請假表單送出 API ──
app.post('/api/leave/submit', async (req, res) => {
  const { userId, displayName, leaveType, startDate, endDate, reason, agent } = req.body;

  if (!leaveType || !startDate || !endDate || !reason || !agent) {
    return res.status(400).json({ error: '缺少必要欄位' });
  }

  const managerId = process.env.MANAGER_LINE_ID;

  // 推播通知給主管
  if (managerId) {
    const notifyText =
      `📋 新請假申請通知\n` +
      `${'─'.repeat(20)}\n` +
      `👤 申請人：${displayName || '未知'}\n` +
      `📌 假別：${leaveType}\n` +
      `📅 日期：${startDate} ～ ${endDate}\n` +
      `📝 原因：${reason}\n` +
      `👥 代理人：${agent}\n` +
      `${'─'.repeat(20)}\n` +
      `請確認後回覆審核結果`;

    try {
      await axios.post(
        'https://api.line.me/v2/bot/message/push',
        { to: managerId, messages: [{ type: 'text', text: notifyText }] },
        { headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` } }
      );
    } catch (err) {
      console.error('推播主管通知失敗:', err.response?.data || err.message);
    }
  }

  // 回覆申請人確認訊息
  if (userId) {
    try {
      await axios.post(
        'https://api.line.me/v2/bot/message/push',
        {
          to: userId,
          messages: [{
            type: 'text',
            text: `✅ 請假申請已送出！\n假別：${leaveType}\n日期：${startDate} ～ ${endDate}\n\n待主管審核後將通知您結果。`,
          }],
        },
        { headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` } }
      );
    } catch (err) {
      console.error('推播申請人確認失敗:', err.response?.data || err.message);
    }
  }

  res.json({ success: true });
});

// ── 事件路由 ──
async function handleEvent(event, client) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const text = event.message.text.trim();

  if (text.startsWith('假')) return handleLeave(event, client, text);
  if (text.startsWith('報')) return handleQuote(event, client, text);
  if (text.startsWith('款')) return handlePayment(event, client, text);
  if (text.startsWith('市')) return handleMarket(event, client, text);
  if (text.startsWith('進')) return handleProgress(event, client, text);
  if (text.startsWith('雲')) return handleCloud(event, client, text);

  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'text',
      text: '👋 鑫創小助手，請輸入以下關鍵字：\n\n假 → 請假審批\n報 → 報價追蹤\n款 → 請款流程\n市 → 市集管理\n進 → 每日進度匯報\n雲 → 雲端資料夾',
    }],
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`鑫創小助手 LINE Bot 啟動於 port ${PORT}`);
  setupRichMenu().catch(err =>
    console.error('圖文選單初始化失敗:', err.response?.data || err.message)
  );
});
