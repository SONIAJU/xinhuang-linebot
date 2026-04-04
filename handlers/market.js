// handlers/market.js - 市集管理模組
// 觸發關鍵字：「市」
// 範例指令：市 攤位 / 市 報名 / 市 查詢

async function handleMarket(event, client, text) {
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const subCommand = text.slice(1).trim();

  let replyText = '';

  if (!subCommand || subCommand === '說明') {
    replyText =
      '🏪 市集管理功能\n\n' +
      '指令說明：\n' +
      '市 攤位 → 查看攤位資訊與空缺\n' +
      '市 報名 [活動名稱] [攤位號] → 攤位報名\n' +
      '市 查詢 → 查看我的報名紀錄\n' +
      '市 活動 → 查看近期市集活動\n\n' +
      '範例：市 報名 春季市集 A12';
    return client.replyMessage({ replyToken, messages: [{ type: 'text', text: replyText }] });
  }

  if (subCommand.startsWith('攤位')) {
    // TODO: 從 Google Sheets 撈取攤位資訊
    replyText =
      '🗺️ 攤位資訊：\n\n' +
      'A區：室內展覽空間\n' +
      'B區：戶外廣場\n' +
      'C區：美食專區\n\n' +
      '（詳細空缺資訊開發中）';
  } else if (subCommand.startsWith('報名')) {
    const details = subCommand.slice(2).trim();
    if (!details) {
      replyText = '請填寫活動名稱與攤位號\n範例：市 報名 春季市集 A12';
    } else {
      // TODO: 寫入 Google Sheets
      replyText = `✅ 攤位報名成功！\n內容：${details}\n申請人：${userId}\n狀態：待確認`;
    }
  } else if (subCommand.startsWith('查詢')) {
    // TODO: 從 Google Sheets 查詢該用戶報名紀錄
    replyText = '📋 您的市集報名紀錄：\n（功能開發中，請稍後）';
  } else if (subCommand.startsWith('活動')) {
    // TODO: 從 Google Sheets 撈取近期活動
    replyText = '📅 近期市集活動：\n（功能開發中，請稍後）';
  } else {
    replyText = '找不到此指令，輸入「市 說明」查看使用方式';
  }

  return client.replyMessage({ replyToken, messages: [{ type: 'text', text: replyText }] });
}

module.exports = handleMarket;
