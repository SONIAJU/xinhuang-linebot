require('dotenv').config();
const path    = require('path');
const express = require('express');
const line    = require('@line/bot-sdk');
const axios   = require('axios');

const setupRichMenu = require('./scripts/setupRichMenu');
const {
  appendLeaveRow, appendOvertimeRow,
  getAttendRow, updateManagerResult, updateHRResult,
} = require('./utils/sheets');

const handleLeave    = require('./handlers/leave');
const handleQuote    = require('./handlers/quote');
const handlePayment  = require('./handlers/payment');
const handleMarket   = require('./handlers/market');
const handleProgress = require('./handlers/progress');
const handleCloud    = require('./handlers/cloud');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret:      process.env.LINE_CHANNEL_SECRET,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const app = express();

// ════════════════════════════════════════════════════════════
//  Webhook（LINE middleware 需要 raw body，必須在 express.json 前）
// ════════════════════════════════════════════════════════════
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(event => handleEvent(event, client)))
    .then(() => res.status(200).json({ status: 'ok' }))
    .catch(err => { console.error('Webhook error:', err); res.status(500).end(); });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ════════════════════════════════════════════════════════════
//  工具函式
// ════════════════════════════════════════════════════════════

async function pushLine(to, messages) {
  if (!to) return;
  const msgs = Array.isArray(messages) ? messages : [messages];
  await axios.post(
    'https://api.line.me/v2/bot/message/push',
    { to, messages: msgs },
    { headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` } }
  );
}

// Flex Message：一行 label + value
function flexRow(label, value) {
  return {
    type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'sm',
    contents: [
      { type: 'text', text: label,               size: 'sm', color: '#888888', flex: 4 },
      { type: 'text', text: String(value || '-'), size: 'sm', color: '#333333', flex: 6, wrap: true },
    ],
  };
}

/**
 * 建立請假審核 Flex Message
 * rowData 欄位對應 utils/sheets.js 的 COL 索引：
 *   [0]時間 [1]姓名 [2]userId [3]類型 [4]假別
 *   [5]開始日 [6]結束日 [7]開始時 [8]結束時 [9]時數
 *   [10]案名 [11]原因 [12]代理人 [13]主管審核 [14]HR審核
 */
function buildApprovalFlex(title, role, rowData, rowIndex) {
  const [time, name, , , leaveType, startDate, endDate, , , , , reason, agent, managerResult] = rowData;

  const bodyRows = [
    flexRow('👤 申請人', name),
    flexRow('📌 假別',   leaveType),
    flexRow('📅 日期',   `${startDate} ～ ${endDate}`),
    flexRow('📝 原因',   reason),
    flexRow('👥 代理人', agent),
  ];
  if (role === 'hr') bodyRows.push(flexRow('主管審核', `✅ ${managerResult}`));
  bodyRows.push({ type: 'separator', margin: 'lg' });
  bodyRows.push(flexRow('🕐 申請時間', time));

  return {
    type: 'flex',
    altText: title,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical',
        backgroundColor: '#7f77dd', paddingAll: '18px',
        contents: [{ type: 'text', text: title, color: '#ffffff', size: 'lg', weight: 'bold' }],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '18px',
        contents: bodyRows,
      },
      footer: {
        type: 'box', layout: 'horizontal', spacing: 'sm', paddingAll: '16px',
        contents: [
          {
            type: 'button', style: 'primary', color: '#27AE60', flex: 1, height: 'sm',
            action: { type: 'postback', label: '✅ 同意', data: `action=approve&role=${role}&row=${rowIndex}`, displayText: '同意' },
          },
          {
            type: 'button', style: 'primary', color: '#E74C3C', flex: 1, height: 'sm',
            action: { type: 'postback', label: '❌ 拒絕', data: `action=reject&role=${role}&row=${rowIndex}`, displayText: '拒絕' },
          },
        ],
      },
    },
  };
}

// ════════════════════════════════════════════════════════════
//  Postback 處理（主管 / HR 審核按鈕）
// ════════════════════════════════════════════════════════════
async function handlePostback(event, client) {
  const params = new URLSearchParams(event.postback.data);
  const action = params.get('action'); // 'approve' | 'reject'
  const role   = params.get('role');   // 'manager' | 'hr'
  const rowIdx = parseInt(params.get('row'));

  if (!['approve', 'reject'].includes(action)) return;
  if (!['manager', 'hr'].includes(role)) return;
  if (!rowIdx) return;

  const replyToken = event.replyToken;

  // 從 Sheets 讀出該列資料
  let rowData;
  try {
    rowData = await getAttendRow(rowIdx);
  } catch (e) {
    console.error('[Postback] getAttendRow 失敗:', e.message);
    return client.replyMessage({ replyToken, messages: [{ type: 'text', text: '讀取 Sheets 失敗，請聯繫管理員' }] });
  }
  if (!rowData) {
    return client.replyMessage({ replyToken, messages: [{ type: 'text', text: '找不到對應的申請資料' }] });
  }

  // 解構（對應新欄位順序）
  const [, empName, empId, , leaveType, startDate, endDate] = rowData;
  const resultLabel = action === 'approve' ? '核准' : '拒絕';

  try {
    if (role === 'manager') {
      await updateManagerResult(rowIdx, resultLabel);

      if (action === 'approve') {
        const hrId = process.env.HR_LINE_ID;
        if (hrId) {
          await pushLine(hrId, buildApprovalFlex('📋 請假申請 - 待 HR 審核', 'hr', rowData, rowIdx));
        } else {
          console.warn('[Postback] HR_LINE_ID 未設定');
        }
        return client.replyMessage({ replyToken, messages: [{ type: 'text', text: `✅ 已同意 ${empName} 的請假申請，已轉交 HR 審核` }] });
      } else {
        await pushLine(empId, { type: 'text', text: `❌ 您的請假申請已被主管拒絕\n假別：${leaveType}\n日期：${startDate} ～ ${endDate}\n\n如有疑問請洽主管` });
        return client.replyMessage({ replyToken, messages: [{ type: 'text', text: `已拒絕 ${empName} 的請假申請並通知本人` }] });
      }

    } else {
      await updateHRResult(rowIdx, resultLabel);

      if (action === 'approve') {
        await pushLine(empId, { type: 'text', text: `✅ 您的請假申請已核准！\n假別：${leaveType}\n日期：${startDate} ～ ${endDate}\n\n請假愉快！` });
        return client.replyMessage({ replyToken, messages: [{ type: 'text', text: `✅ 已核准 ${empName} 的請假申請並通知本人` }] });
      } else {
        await pushLine(empId, { type: 'text', text: `❌ 您的請假申請已被 HR 拒絕\n假別：${leaveType}\n日期：${startDate} ～ ${endDate}\n\n如有疑問請洽 HR` });
        return client.replyMessage({ replyToken, messages: [{ type: 'text', text: `已拒絕 ${empName} 的請假申請並通知本人` }] });
      }
    }
  } catch (e) {
    console.error('[Postback] 審核處理失敗:', e.message);
    return client.replyMessage({ replyToken, messages: [{ type: 'text', text: '操作失敗，請稍後再試' }] });
  }
}

// ════════════════════════════════════════════════════════════
//  靜態頁面
// ════════════════════════════════════════════════════════════
app.get('/', (req, res) => res.send('鑫創小助手 LINE Bot 運行中 ✅'));

app.get('/liff/leave', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'leave-form.html'))
);

// ════════════════════════════════════════════════════════════
//  請假／加班表單送出 API
// ════════════════════════════════════════════════════════════
app.post('/api/leave/submit', async (req, res) => {
  const { leaveType, userId, displayName } = req.body;
  if (!leaveType) return res.status(400).json({ error: '缺少 leaveType' });

  const isOvertime = leaveType === '加班申請';
  const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

  // ── 加班申請 ──────────────────────────────────────────────
  if (isOvertime) {
    const { overtimeDate, overtimeStart, overtimeEnd, overtimeHours, projectName, overtimeReason } = req.body;
    if (!overtimeDate || !overtimeStart || !overtimeEnd || !overtimeHours || !projectName || !overtimeReason)
      return res.status(400).json({ error: '缺少加班必要欄位' });

    // 寫入 Sheets（淡橘色列）
    try {
      const idx = await appendOvertimeRow({
        time: now, name: displayName || '未知', userId,
        overtimeDate, overtimeStart, overtimeEnd, overtimeHours, projectName, overtimeReason,
      });
      console.log(`[加班] Sheets 寫入成功，列號：${idx}`);
    } catch (e) {
      console.error('[加班] Sheets 寫入失敗:', e.message);
    }

    // 文字通知主管
    const managerText =
      `⏰ 新加班申請通知\n${'─'.repeat(20)}\n` +
      `👤 申請人：${displayName || '未知'}\n` +
      `📅 加班日期：${overtimeDate}\n` +
      `🕐 加班時間：${overtimeStart} ～ ${overtimeEnd}\n` +
      `⏱️ 加班時數：${overtimeHours} 小時\n` +
      `📁 案名：${projectName}\n` +
      `📝 原因：${overtimeReason}\n` +
      `${'─'.repeat(20)}\n請確認後回覆審核結果`;

    try { await pushLine(process.env.MANAGER_LINE_ID, { type: 'text', text: managerText }); } catch (e) {}
    try {
      await pushLine(userId, {
        type: 'text',
        text: `✅ 加班申請已送出！\n日期：${overtimeDate}\n時間：${overtimeStart} ～ ${overtimeEnd}（${overtimeHours} 小時）\n案名：${projectName}\n\n待主管審核後將通知您結果。`,
      });
    } catch (e) {}

    return res.json({ success: true });
  }

  // ── 請假申請（兩階段審核：主管 → HR）─────────────────────
  const { startDate, endDate, reason, agent } = req.body;
  if (!startDate || !endDate || !reason || !agent)
    return res.status(400).json({ error: '缺少請假必要欄位' });

  // 1. 寫入 Sheets（淡黃色列），取得列號
  let rowIndex = null;
  try {
    rowIndex = await appendLeaveRow({
      time: now, name: displayName || '未知', userId,
      leaveType, startDate, endDate, reason, agent,
    });
    console.log(`[請假] Sheets 寫入成功，列號：${rowIndex}`);
  } catch (e) {
    console.error('[請假] Sheets 寫入失敗:', e.message);
  }

  // 2. 推播主管 Flex Message（含同意/拒絕按鈕）
  const managerId = process.env.MANAGER_LINE_ID;
  if (managerId) {
    // 構造與 Sheets 欄位順序一致的 rowData（15欄）
    const rowData = [
      now, displayName || '未知', userId, '請假申請',
      leaveType, startDate, endDate, '', '', '', '', reason, agent,
      '待審核', '待審核',
    ];
    try {
      if (rowIndex) {
        await pushLine(managerId, buildApprovalFlex('📋 新請假申請通知', 'manager', rowData, rowIndex));
      } else {
        await pushLine(managerId, {
          type: 'text',
          text: `📋 新請假申請（⚠️ 審核按鈕暫不可用）\n申請人：${displayName}\n假別：${leaveType}\n日期：${startDate} ～ ${endDate}\n原因：${reason}\n代理人：${agent}`,
        });
      }
    } catch (e) {
      console.error('[請假] 推播主管失敗:', e.message);
    }
  }

  // 3. 回覆申請人確認
  try {
    await pushLine(userId, {
      type: 'text',
      text: `✅ 請假申請已送出！\n假別：${leaveType}\n日期：${startDate} ～ ${endDate}\n\n待主管審核後將通知您結果。`,
    });
  } catch (e) {
    console.error('[請假] 推播申請人失敗:', e.message);
  }

  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  LINE 事件主路由
// ════════════════════════════════════════════════════════════
async function handleEvent(event, client) {
  if (event.type === 'postback') return handlePostback(event, client);
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const text = event.message.text.trim();
  console.log(`[Webhook] 收到訊息 | text="${text}" | userId=${event.source.userId}`);

  if (text.startsWith('假')) {
    console.log('[Webhook] → 路由至 handleLeave');
    return handleLeave(event, client, text);
  }
  if (text.startsWith('報')) return handleQuote(event, client, text);
  if (text.startsWith('款')) return handlePayment(event, client, text);
  if (text.startsWith('市')) return handleMarket(event, client, text);
  if (text.startsWith('進')) return handleProgress(event, client, text);
  if (text.startsWith('雲')) return handleCloud(event, client, text);

  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: 'text', text: '👋 鑫創小助手，請輸入以下關鍵字：\n\n假 → 請假審批\n報 → 報價追蹤\n款 → 請款流程\n市 → 市集管理\n進 → 每日進度匯報\n雲 → 雲端資料夾' }],
  });
}

// ════════════════════════════════════════════════════════════
//  啟動
// ════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`鑫創小助手 LINE Bot 啟動於 port ${PORT}`);
  setupRichMenu().catch(err =>
    console.error('圖文選單初始化失敗:', err.response?.data || err.message)
  );
});
