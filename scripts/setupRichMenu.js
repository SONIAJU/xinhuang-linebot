// scripts/setupRichMenu.js - LINE 圖文選單建立工具
// 首次啟動時自動執行，或手動執行：node scripts/setupRichMenu.js --force
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const sharp = require('sharp');

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const BASE_URL = 'https://api.line.me/v2/bot';
const DATA_URL = 'https://api-data.line.me/v2/bot';

const W = 2500, H = 843;
const COL = Math.floor(W / 3); // 833
const ROW = Math.floor(H / 2); // 421

// 六個功能按鈕定義
const CELLS = [
  { col: 0, row: 0, char: '假', label: '請假審批', color: '#4A90D9' },
  { col: 1, row: 0, char: '報', label: '報價追蹤', color: '#27AE60' },
  { col: 2, row: 0, char: '款', label: '請款流程', color: '#E67E22' },
  { col: 0, row: 1, char: '市', label: '市集管理', color: '#8E44AD' },
  { col: 1, row: 1, char: '進', label: '每日進度', color: '#16A085' },
  { col: 2, row: 1, char: '雲', label: '雲端資料夾', color: '#C0392B' },
];

// 產生圖文選單 SVG 圖片（6色方塊 + 文字）
function generateSvg() {
  const cells = CELLS.map(({ col, row, char, label, color }) => {
    const x = col * COL;
    const y = row * ROW;
    const w = col === 2 ? W - x : COL;
    const h = row === 1 ? H - y : ROW;
    const cx = x + w / 2;
    const cy = y + h / 2;

    return `
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>
      <text x="${cx}" y="${cy - 50}"
        font-family="Microsoft JhengHei UI,Microsoft JhengHei,PingFang TC,Noto Sans CJK TC,sans-serif"
        font-size="170" font-weight="bold" fill="white"
        text-anchor="middle" dominant-baseline="middle">${char}</text>
      <text x="${cx}" y="${cy + 100}"
        font-family="Microsoft JhengHei UI,Microsoft JhengHei,PingFang TC,Noto Sans CJK TC,sans-serif"
        font-size="62" fill="rgba(255,255,255,0.92)"
        text-anchor="middle" dominant-baseline="middle">${label}</text>`;
  });

  const grid = `
    <line x1="${COL}"   y1="0" x2="${COL}"   y2="${H}" stroke="rgba(255,255,255,0.35)" stroke-width="4"/>
    <line x1="${COL*2}" y1="0" x2="${COL*2}" y2="${H}" stroke="rgba(255,255,255,0.35)" stroke-width="4"/>
    <line x1="0" y1="${ROW}" x2="${W}" y2="${ROW}" stroke="rgba(255,255,255,0.35)" stroke-width="4"/>`;

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${cells.join('')}
    ${grid}
  </svg>`;
}

// 圖文選單結構定義
const RICH_MENU_BODY = {
  size: { width: W, height: H },
  selected: true,
  name: '鑫創小助手選單',
  chatBarText: '功能選單',
  areas: CELLS.map(({ col, row, char }) => ({
    bounds: {
      x: col * COL,
      y: row * ROW,
      width: col === 2 ? W - col * COL : COL,
      height: row === 1 ? H - row * ROW : ROW,
    },
    action: { type: 'message', text: char },
  })),
};

async function setupRichMenu(force = false) {
  const authJson = {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  };

  // 檢查是否已存在預設圖文選單
  if (!force) {
    try {
      const { data } = await axios.get(`${BASE_URL}/richmenu/default`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      if (data.richMenuId) {
        console.log('圖文選單已存在，跳過建立（使用 --force 強制重建）');
        return;
      }
    } catch (_) { /* 尚無預設選單，繼續建立 */ }
  }

  // 若 force 模式，先刪除舊選單
  if (force) {
    try {
      const { data } = await axios.get(`${BASE_URL}/richmenu/default`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      if (data.richMenuId) {
        await axios.delete(`${BASE_URL}/richmenu/${data.richMenuId}`, {
          headers: { Authorization: `Bearer ${TOKEN}` },
        });
        console.log(`已刪除舊圖文選單 (${data.richMenuId})`);
      }
    } catch (_) { /* 無舊選單 */ }
  }

  // 1. 建立圖文選單
  const { data: { richMenuId } } = await axios.post(
    `${BASE_URL}/richmenu`, RICH_MENU_BODY, { headers: authJson }
  );
  console.log(`圖文選單建立成功，ID: ${richMenuId}`);

  // 2. 產生並上傳圖片
  const pngBuffer = await sharp(Buffer.from(generateSvg())).png().toBuffer();
  await axios.post(
    `${DATA_URL}/richmenu/${richMenuId}/content`,
    pngBuffer,
    { headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'image/png' } }
  );
  console.log('圖文選單圖片上傳完成');

  // 3. 設為所有用戶的預設選單
  await axios.post(
    `${BASE_URL}/user/all/richmenu/${richMenuId}`,
    {},
    { headers: authJson }
  );
  console.log('圖文選單已設為預設 ✅');
}

// 直接執行時的進入點
if (require.main === module) {
  const force = process.argv.includes('--force');
  setupRichMenu(force)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('圖文選單建立失敗:', err.response?.data || err.message);
      process.exit(1);
    });
}

module.exports = setupRichMenu;
