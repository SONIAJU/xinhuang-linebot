// handlers/progress.js - 每日進度匯報模組
// 觸發關鍵字：「進」
// 範例指令：進 回報 / 進 查詢 / 進 摘要

async function handleProgress(event, client, text) {
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const subCommand = text.slice(1).trim();

  const today = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  });

  let replyText = '';

  if (!subCommand || subCommand === '說明') {
    replyText =
      '📊 每日進度匯報功能\n\n' +
      '指令說明：\n' +
      '進 回報 [今日完成事項] → 提交今日進度\n' +
      '進 查詢 → 查看我的進度紀錄\n' +
      '進 摘要 → 查看全團隊今日摘要（主管）\n' +
      '進 提醒 → 設定每日提醒時間\n\n' +
      '範例：進 回報 完成報價單製作、客戶會議確認';
    return client.replyMessage({ replyToken, messages: [{ type: 'text', text: replyText }] });
  }

  if (subCommand.startsWith('回報')) {
    const content = subCommand.slice(2).trim();
    if (!content) {
      replyText = '請填寫今日完成事項\n範例：進 回報 完成報價單製作';
    } else {
      // TODO: 寫入 Google Sheets
      replyText = `✅ 進度回報成功！\n日期：${today}\n內容：${content}\n\n感謝您的回報，繼續加油！💪`;
    }
  } else if (subCommand.startsWith('查詢')) {
    // TODO: 從 Google Sheets 查詢個人進度紀錄
    replyText = `📅 ${userId} 的進度紀錄：\n（功能開發中，請稍後）`;
  } else if (subCommand.startsWith('摘要')) {
    // TODO: 從 Google Sheets 撈取今日所有成員回報
    replyText = `📋 ${today} 團隊進度摘要：\n（功能開發中，請稍後）`;
  } else if (subCommand.startsWith('提醒')) {
    replyText = '⏰ 每日提醒設定：\n（功能開發中，預計支援自訂提醒時間）';
  } else {
    replyText = '找不到此指令，輸入「進 說明」查看使用方式';
  }

  return client.replyMessage({ replyToken, messages: [{ type: 'text', text: replyText }] });
}

module.exports = handleProgress;
