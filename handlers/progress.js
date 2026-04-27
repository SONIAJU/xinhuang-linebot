// handlers/progress.js - 每日進度匯報模組
const axios = require('axios');
const { appendProgressRow } = require('../utils/sheets');

// ── 取得員工顯示名稱（1-on-1 或群組皆相容）──────────────────
async function getDisplayName(userId, groupId) {
  try {
    const url = groupId
      ? `https://api.line.me/v2/bot/group/${groupId}/member/${userId}`
      : `https://api.line.me/v2/bot/profile/${userId}`;
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    });
    return res.data.displayName || '員工';
  } catch (e) {
    console.error('[Progress] getDisplayName 失敗:', e.message);
    return '員工';
  }
}

// ── 解析【已定案】/【未定案】/【結案】格式 ──────────────────────
function parseBlocks(text) {
  const blocks = [];
  let current = null;
  for (const line of text.split('\n')) {
    const m = line.match(/^【(已定案|未定案|結案)】(.+)/);
    if (m) {
      if (current) blocks.push(current);
      current = { status: m[1], projectName: m[2].trim(), items: [] };
    } else if (current && line.trim()) {
      current.items.push(line.trim());
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

// ── 建立主管 Flex Message ──────────────────────────────────────
const STATUS_ICON = { '已定案': '✅', '未定案': '◆', '結案': '🏁' };

function buildManagerFlex(name, date, blocks) {
  const bodyContents = [];
  for (const block of blocks) {
    const icon = STATUS_ICON[block.status] || '◆';
    bodyContents.push({
      type: 'text',
      text: `${icon} ${block.projectName}`,
      weight: 'bold', size: 'sm', color: '#333333', margin: 'md', wrap: true,
    });
    for (const item of block.items) {
      bodyContents.push({
        type: 'text', text: `  ${item}`,
        size: 'sm', color: '#555555', wrap: true,
      });
    }
  }

  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  if (sheetsId) {
    bodyContents.push({ type: 'separator', margin: 'lg' });
    bodyContents.push({
      type: 'button', style: 'link', height: 'sm', margin: 'sm',
      action: {
        type: 'uri',
        label: '查看完整進度表',
        uri: `https://docs.google.com/spreadsheets/d/${sheetsId}`,
      },
    });
  }

  return {
    type: 'flex',
    altText: `📊 ${date} 進度回報 - ${name}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical',
        backgroundColor: '#3D5A99', paddingAll: '16px',
        contents: [
          { type: 'text', text: `📊 ${date} 進度回報`, color: '#ffffff', size: 'md', weight: 'bold' },
          { type: 'text', text: `👤 ${name}`, color: '#ccddff', size: 'sm', margin: 'sm' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
        contents: bodyContents,
      },
    },
  };
}

async function pushLine(to, message) {
  if (!to) return;
  await axios.post(
    'https://api.line.me/v2/bot/message/push',
    { to, messages: [message] },
    { headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` } }
  );
}

// ── 處理【已定案/未定案】格式進度回報 ────────────────────────
async function handleProgressReport(event, client, text) {
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const groupId = event.source.groupId || null;

  const blocks = parseBlocks(text);
  if (blocks.length === 0) return false;

  const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

  // Step 1：先回覆員工（replyToken 僅 30 秒有效，必須最先執行）
  const summaryLines = blocks.map(b => `${b.status} ${b.projectName}（${b.items.length}項）`);
  const replyText = `✅ 進度已記錄！\n\n${summaryLines.join('\n')}\n\n主管將收到通知。`;
  try {
    await client.replyMessage({ replyToken, messages: [{ type: 'text', text: replyText }] });
  } catch (e) {
    console.error('[Progress] 回覆員工失敗:', e.message);
  }

  // Step 2：取得顯示名稱（reply 後再查，不阻塞 replyToken）
  const displayName = await getDisplayName(userId, groupId);

  // Step 3：寫入 Google Sheets（每個案件一行，寫進員工個人分頁）
  for (const block of blocks) {
    try {
      await appendProgressRow({
        time: now,
        name: displayName,
        date: today,
        projectName: block.projectName,
        status: block.status,
        items: block.items,
      });
    } catch (e) {
      console.error('[Progress] Sheets 寫入失敗:', e.message);
    }
  }

  // Step 4：推播主管通知
  const managerId = process.env.MANAGER_LINE_ID;
  if (managerId) {
    try {
      await pushLine(managerId, buildManagerFlex(displayName, today, blocks));
    } catch (e) {
      console.error('[Progress] 通知主管失敗:', e.message);
    }
  } else {
    console.warn('[Progress] MANAGER_LINE_ID 未設定，跳過通知主管');
  }

  return true;
}

// ── 進 說明 / 進 查詢 等子指令 ────────────────────────────────
async function handleProgress(event, client, text) {
  const replyToken = event.replyToken;

  // 【】格式直接回報
  if (text.includes('【已定案】') || text.includes('【未定案】') || text.includes('【結案】')) {
    return handleProgressReport(event, client, text);
  }

  const subCommand = text.slice(1).trim(); // 去掉「進」

  let replyText = '';
  if (!subCommand || subCommand === '說明') {
    replyText =
      '請貼上今日進度\n\n格式範例：\n【已定案】0426森活新壟_母親節\n1.整理備品清單\n2.蛋糕訂購付款\n\n【未定案】0516 sunhouse\n1.企劃報價調整\n\n【結案】案件名稱';
  } else if (subCommand.startsWith('查詢')) {
    replyText = '📅 個人進度查詢功能開發中，請稍後';
  } else if (subCommand.startsWith('摘要')) {
    replyText = '📋 團隊摘要功能開發中，請稍後';
  } else {
    replyText = '找不到此指令，輸入「進 說明」查看使用方式';
  }

  return client.replyMessage({ replyToken, messages: [{ type: 'text', text: replyText }] });
}

module.exports = { handleProgress, handleProgressReport };
