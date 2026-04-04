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
      messages: [
        buildLeaveFlexMessage(),
        {
          type: 'text',
          text: '💻 電腦版用戶請複製以下連結到瀏覽器開啟：\nhttps://xinhuang-linebot.onrender.com/leave',
        },
      ],
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
    altText: '請假申請',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#7f77dd',
        contents: [
          {
            type: 'text',
            text: '📋 請假審批',
            weight: 'bold',
            size: 'lg',
            color: '#ffffff',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '點下方按鈕開啟請假申請表單',
            wrap: true,
            color: '#555555',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
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
          },
        ],
      },
    },
  };
}

module.exports = handleLeave;
