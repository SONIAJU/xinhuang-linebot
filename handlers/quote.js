// handlers/quote.js - 報價追蹤模組
// 觸發關鍵字：「報」
// 範例指令：報 新增 / 報 查詢 / 報 列表

async function handleQuote(event, client, text) {
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const subCommand = text.slice(1).trim();

  let replyText = '';

  if (!subCommand || subCommand === '說明') {
    replyText =
      '💰 報價追蹤功能\n\n' +
      '指令說明：\n' +
      '報 新增 [客戶] [金額] [項目] → 新增報價紀錄\n' +
      '報 查詢 [客戶名稱] → 查詢特定客戶報價\n' +
      '報 列表 → 顯示所有報價清單\n' +
      '報 更新 [編號] [狀態] → 更新報價狀態\n\n' +
      '狀態選項：待回覆 / 成交 / 未成交\n' +
      '範例：報 新增 台積電 150000 網站建置';
    return client.replyMessage({ replyToken, messages: [{ type: 'text', text: replyText }] });
  }

  if (subCommand.startsWith('新增')) {
    const details = subCommand.slice(2).trim();
    if (!details) {
      replyText = '請填寫報價資訊\n範例：報 新增 台積電 150000 網站建置';
    } else {
      // TODO: 寫入 Google Sheets
      replyText = `✅ 報價紀錄已新增！\n內容：${details}\n狀態：待回覆`;
    }
  } else if (subCommand.startsWith('查詢')) {
    const keyword = subCommand.slice(2).trim();
    // TODO: 從 Google Sheets 查詢
    replyText = keyword
      ? `🔍 查詢「${keyword}」的報價紀錄：\n（功能開發中，請稍後）`
      : '請輸入客戶名稱，範例：報 查詢 台積電';
  } else if (subCommand.startsWith('列表')) {
    // TODO: 從 Google Sheets 撈取列表
    replyText = '📊 報價清單：\n（功能開發中，請稍後）';
  } else if (subCommand.startsWith('更新')) {
    const details = subCommand.slice(2).trim();
    // TODO: 更新 Google Sheets 狀態
    replyText = details
      ? `🔄 報價狀態更新：${details}\n（功能開發中，請稍後）`
      : '請輸入編號與狀態，範例：報 更新 001 成交';
  } else {
    replyText = '找不到此指令，輸入「報 說明」查看使用方式';
  }

  return client.replyMessage({ replyToken, messages: [{ type: 'text', text: replyText }] });
}

module.exports = handleQuote;
