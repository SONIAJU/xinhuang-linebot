// handlers/leave.js - 請假審批模組
// 觸發關鍵字：「假」→ 回傳 Flex Message 含 LIFF 連結

// 用函式取值，確保每次呼叫都讀到最新的環境變數
const getLiffUrl = () =>
  `https://liff.line.me/${process.env.LIFF_ID || '2009693582-DSh3EP6P'}`;

async function handleLeave(event, client, text) {
  console.log(`[Leave] ✅ handleLeave 觸發 | text="${text}" | userId=${event.source.userId}`);

  const replyToken = event.replyToken;
  const subCommand = text.slice(1).trim();

  // 純「假」或「假 申請」→ 回傳 Flex Message 開啟 LIFF 表單
  if (!subCommand || subCommand === '申請' || subCommand === '說明') {
    return client.replyMessage({
      replyToken,
      messages: [buildLeaveFlexMessage()],
    });
  }

  // 文字指令：查詢、審核
  let replyText = '';

  if (subCommand.startsWith('查詢')) {
    // TODO: 從 Google Sheets 查詢該用戶的請假紀錄
    replyText = '📅 您的請假紀錄：\n（功能開發中，請稍後）';
  } else if (subCommand.startsWith('審核')) {
    // TODO: 從 Google Sheets 撈取待審核清單
    replyText = '📝 待審核請假清單：\n（功能開發中，請稍後）';
  } else {
    return client.replyMessage({
      replyToken,
      messages: [buildLeaveFlexMessage()],
    });
  }

  return client.replyMessage({ replyToken, messages: [{ type: 'text', text: replyText }] });
}

function buildLeaveFlexMessage() {
  return {
    type: 'flex',
    altText: '📋 請假申請',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#7f77dd',
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: '📋 請假申請',
            color: '#ffffff',
            size: 'xl',
            weight: 'bold',
          },
          {
            type: 'text',
            text: '填寫線上表單，主管即時收到通知',
            color: 'rgba(255,255,255,0.8)',
            size: 'sm',
            margin: 'sm',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '20px',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: [
              buildInfoRow('🌴', '特休假 / 病假 / 事假 / 其他'),
              buildInfoRow('📅', '填寫起訖日期'),
              buildInfoRow('📝', '填寫請假原因'),
              buildInfoRow('👥', '填寫代理人姓名'),
            ],
          },
          { type: 'separator', margin: 'lg' },
          {
            type: 'text',
            text: '送出後主管將收到 LINE 通知',
            size: 'xs',
            color: '#aaaaaa',
            align: 'center',
            margin: 'md',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '16px',
        paddingTop: '0px',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '開啟請假表單',
              uri: getLiffUrl(),
            },
            style: 'primary',
            color: '#7f77dd',
            height: 'md',
            cornerRadius: '12px',
          },
        ],
      },
    },
  };
}

function buildInfoRow(icon, text) {
  return {
    type: 'box',
    layout: 'horizontal',
    spacing: 'sm',
    contents: [
      { type: 'text', text: icon, size: 'sm', flex: 0 },
      { type: 'text', text, size: 'sm', color: '#555555', flex: 1 },
    ],
  };
}

module.exports = handleLeave;
