// handlers/cloud.js - 雲端資料夾模組
// 觸發關鍵字：「雲」
// 範例指令：雲 連結 / 雲 查詢 / 雲 分類

// 預設雲端資料夾連結（填入實際 Google Drive 連結）
const CLOUD_FOLDERS = {
  總覽: 'https://drive.google.com/drive/folders/YOUR_ROOT_FOLDER_ID',
  報價: 'https://drive.google.com/drive/folders/YOUR_QUOTE_FOLDER_ID',
  合約: 'https://drive.google.com/drive/folders/YOUR_CONTRACT_FOLDER_ID',
  市集: 'https://drive.google.com/drive/folders/YOUR_MARKET_FOLDER_ID',
  行政: 'https://drive.google.com/drive/folders/YOUR_ADMIN_FOLDER_ID',
};

async function handleCloud(event, client, text) {
  const replyToken = event.replyToken;
  const subCommand = text.slice(1).trim();

  let replyText = '';

  if (!subCommand || subCommand === '說明') {
    replyText =
      '☁️ 雲端資料夾功能\n\n' +
      '指令說明：\n' +
      '雲 連結 → 取得所有資料夾連結\n' +
      '雲 報價 → 報價相關資料夾\n' +
      '雲 合約 → 合約相關資料夾\n' +
      '雲 市集 → 市集相關資料夾\n' +
      '雲 行政 → 行政相關資料夾';
    return client.replyMessage({ replyToken, messages: [{ type: 'text', text: replyText }] });
  }

  if (subCommand.startsWith('連結')) {
    replyText =
      '☁️ 鑫創雲端資料夾\n\n' +
      Object.entries(CLOUD_FOLDERS)
        .map(([name, url]) => `📁 ${name}：${url}`)
        .join('\n');
  } else if (CLOUD_FOLDERS[subCommand]) {
    replyText = `📁 ${subCommand} 資料夾：\n${CLOUD_FOLDERS[subCommand]}`;
  } else {
    replyText = '找不到此資料夾分類，輸入「雲 說明」查看使用方式';
  }

  return client.replyMessage({ replyToken, messages: [{ type: 'text', text: replyText }] });
}

module.exports = handleCloud;
