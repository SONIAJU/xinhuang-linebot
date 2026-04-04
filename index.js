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

// ── 請假／加班表單送出 API ──
app.post('/api/leave/submit', async (req, res) => {
  const { leaveType, userId, displayName } = req.body;
  if (!leaveType) return res.status(400).json({ error: '缺少 leaveType' });

  const isOvertime = leaveType === '加班申請';
  const managerId  = process.env.MANAGER_LINE_ID;
  const token      = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const pushHeader = { Authorization: `Bearer ${token}` };

  let managerText, userConfirmText, sheetRow;
  const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

  if (isOvertime) {
    // ── 加班申請 ──
    const { overtimeDate, overtimeStart, overtimeEnd, overtimeHours, projectName, overtimeReason } = req.body;
    if (!overtimeDate || !overtimeStart || !overtimeEnd || !overtimeHours || !projectName || !overtimeReason)
      return res.status(400).json({ error: '缺少加班必要欄位' });

    managerText =
      `⏰ 新加班申請通知\n` +
      `${'─'.repeat(20)}\n` +
      `👤 申請人：${displayName || '未知'}\n` +
      `📅 加班日期：${overtimeDate}\n` +
      `🕐 加班時間：${overtimeStart} ～ ${overtimeEnd}\n` +
      `⏱️ 加班時數：${overtimeHours} 小時\n` +
      `📁 案名：${projectName}\n` +
      `📝 原因：${overtimeReason}\n` +
      `${'─'.repeat(20)}\n` +
      `請確認後回覆審核結果`;

    userConfirmText =
      `✅ 加班申請已送出！\n` +
      `日期：${overtimeDate}\n` +
      `時間：${overtimeStart} ～ ${overtimeEnd}（${overtimeHours} 小時）\n` +
      `案名：${projectName}\n\n` +
      `待主管審核後將通知您結果。`;

    // Google Sheets 寫入格式（加班工作表）
    // TODO: 串接後啟用
    // await appendRow('加班紀錄', [now, userId, displayName, overtimeDate, overtimeStart, overtimeEnd, overtimeHours, projectName, overtimeReason, '待審核']);
    sheetRow = [now, userId, displayName, overtimeDate, overtimeStart, overtimeEnd, overtimeHours, projectName, overtimeReason, '待審核'];

  } else {
    // ── 請假申請 ──
    const { startDate, endDate, reason, agent } = req.body;
    if (!startDate || !endDate || !reason || !agent)
      return res.status(400).json({ error: '缺少請假必要欄位' });

    managerText =
      `📋 新請假申請通知\n` +
      `${'─'.repeat(20)}\n` +
      `👤 申請人：${displayName || '未知'}\n` +
      `📌 假別：${leaveType}\n` +
      `📅 日期：${startDate} ～ ${endDate}\n` +
      `📝 原因：${reason}\n` +
      `👥 代理人：${agent}\n` +
      `${'─'.repeat(20)}\n` +
      `請確認後回覆審核結果`;

    userConfirmText =
      `✅ 請假申請已送出！\n` +
      `假別：${leaveType}\n` +
      `日期：${startDate} ～ ${endDate}\n\n` +
      `待主管審核後將通知您結果。`;

    // Google Sheets 寫入格式（請假工作表）
    // TODO: 串接後啟用
    // await appendRow('請假紀錄', [now, userId, displayName, leaveType, startDate, endDate, reason, agent, '待審核']);
    sheetRow = [now, userId, displayName, leaveType, startDate, endDate, reason, agent, '待審核'];
  }

  console.log(`[${isOvertime ? '加班' : '請假'}] 申請人：${displayName}，資料：`, sheetRow);

  // 推播通知主管
  if (managerId) {
    try {
      await axios.post(
        'https://api.line.me/v2/bot/message/push',
        { to: managerId, messages: [{ type: 'text', text: managerText }] },
        { headers: pushHeader }
      );
    } catch (err) {
      console.error('推播主管失敗:', err.response?.data || err.message);
    }
  }

  // 推播確認給申請人
  if (userId) {
    try {
      await axios.post(
        'https://api.line.me/v2/bot/message/push',
        { to: userId, messages: [{ type: 'text', text: userConfirmText }] },
        { headers: pushHeader }
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
