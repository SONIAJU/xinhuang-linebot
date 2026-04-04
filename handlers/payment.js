// handlers/payment.js - 請款流程模組
// 觸發關鍵字：「款」
// 範例指令：款 申請 / 款 查詢 / 款 列表

async function handlePayment(event, client, text) {
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const subCommand = text.slice(1).trim();

  let replyText = '';

  if (!subCommand || subCommand === '說明') {
    replyText =
      '💳 請款流程功能\n\n' +
      '指令說明：\n' +
      '款 申請 [金額] [事由] → 提交請款申請\n' +
      '款 查詢 → 查看我的請款紀錄\n' +
      '款 列表 → 顯示所有待處理請款（財務）\n' +
      '款 核准 [編號] → 核准請款（主管）\n\n' +
      '範例：款 申請 5000 購買辦公耗材';
    return client.replyMessage({ replyToken, messages: [{ type: 'text', text: replyText }] });
  }

  if (subCommand.startsWith('申請')) {
    const details = subCommand.slice(2).trim();
    if (!details) {
      replyText = '請填寫金額與事由\n範例：款 申請 5000 購買辦公耗材';
    } else {
      // TODO: 寫入 Google Sheets
      replyText = `✅ 請款申請已提交！\n內容：${details}\n申請人：${userId}\n狀態：待審核`;
    }
  } else if (subCommand.startsWith('查詢')) {
    // TODO: 從 Google Sheets 查詢該用戶請款紀錄
    replyText = '💰 您的請款紀錄：\n（功能開發中，請稍後）';
  } else if (subCommand.startsWith('列表')) {
    // TODO: 從 Google Sheets 撈取待處理列表
    replyText = '📋 待處理請款清單：\n（功能開發中，請稍後）';
  } else if (subCommand.startsWith('核准')) {
    const id = subCommand.slice(2).trim();
    // TODO: 更新 Google Sheets 狀態並通知申請人
    replyText = id
      ? `✅ 請款單 ${id} 已核准，系統將通知申請人`
      : '請輸入請款單編號，範例：款 核准 001';
  } else {
    replyText = '找不到此指令，輸入「款 說明」查看使用方式';
  }

  return client.replyMessage({ replyToken, messages: [{ type: 'text', text: replyText }] });
}

module.exports = handlePayment;
