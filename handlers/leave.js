// handlers/leave.js - 請假審批模組
// 觸發關鍵字：「假」
// 範例指令：假 申請 / 假 查詢 / 假 審核

async function handleLeave(event, client, text) {
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const subCommand = text.slice(1).trim(); // 去除「假」字後的內容

  let replyText = '';

  if (!subCommand || subCommand === '說明') {
    replyText =
      '📋 請假審批功能\n\n' +
      '指令說明：\n' +
      '假 申請 [日期] [原因] → 提交請假申請\n' +
      '假 查詢 → 查看我的請假紀錄\n' +
      '假 審核 → 查看待審核清單（主管）\n\n' +
      '範例：假 申請 2026/04/10 身體不適';
    return client.replyMessage({ replyToken, messages: [{ type: 'text', text: replyText }] });
  }

  if (subCommand.startsWith('申請')) {
    const details = subCommand.slice(2).trim();
    if (!details) {
      replyText = '請填寫請假日期與原因\n範例：假 申請 2026/04/10 身體不適';
    } else {
      // TODO: 寫入 Google Sheets
      replyText = `✅ 請假申請已提交！\n內容：${details}\n\n申請人：${userId}\n狀態：待審核`;
    }
  } else if (subCommand.startsWith('查詢')) {
    // TODO: 從 Google Sheets 查詢該用戶的請假紀錄
    replyText = '📅 您的請假紀錄：\n（功能開發中，請稍後）';
  } else if (subCommand.startsWith('審核')) {
    // TODO: 從 Google Sheets 撈取待審核清單
    replyText = '📝 待審核請假清單：\n（功能開發中，請稍後）';
  } else {
    replyText = '找不到此指令，輸入「假 說明」查看使用方式';
  }

  return client.replyMessage({ replyToken, messages: [{ type: 'text', text: replyText }] });
}

module.exports = handleLeave;
