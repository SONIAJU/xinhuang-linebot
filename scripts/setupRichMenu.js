// scripts/setupRichMenu.js - LINE 圖文選單建立工具
// 手動執行：node scripts/setupRichMenu.js --force
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { createCanvas } = require('@napi-rs/canvas');

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

// 產生圖文選單 PNG（6色方塊 + 中文文字）
function generatePng() {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const CJK_FONTS = '"Microsoft JhengHei UI", "Microsoft JhengHei", "PingFang TC", "Noto Sans CJK TC", sans-serif';

  CELLS.forEach(({ col, row, char, label, color }) => {
    const x = col * COL;
    const y = row * ROW;
    const w = col === 2 ? W - x : COL;
    const h = row === 1 ? H - y : ROW;
    const cx = x + w / 2;
    const cy = y + h / 2;

    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = 'white';
    ctx.font = `bold 170px ${CJK_FONTS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, cx, cy - 50);

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `62px ${CJK_FONTS}`;
    ctx.fillText(label, cx, cy + 100);
  });

  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(COL, 0);     ctx.lineTo(COL, H);
  ctx.moveTo(COL * 2, 0); ctx.lineTo(COL * 2, H);
  ctx.moveTo(0, ROW);     ctx.lineTo(W, ROW);
  ctx.stroke();

  return canvas.toBuffer('image/png');
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

  // 列出所有現有 Rich Menu
  const { data: listData } = await axios.get(`${BASE_URL}/richmenu/list`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const existing = listData.richmenus ?? [];

  // 已存在同名選單且非 force 模式 → 跳過（防止每次重部署重建）
  const alreadyExists = existing.find(m => m.name === RICH_MENU_BODY.name);
  if (!force && alreadyExists) {
    console.log(`圖文選單已存在（${alreadyExists.richMenuId}），跳過建立`);
    return;
  }

  // force 模式：刪除全部舊選單
  if (existing.length > 0) {
    for (const m of existing) {
      await axios.delete(`${BASE_URL}/richmenu/${m.richMenuId}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      console.log(`已刪除舊圖文選單 (${m.richMenuId})`);
    }
  }

  // 1. 建立圖文選單
  const { data: { richMenuId } } = await axios.post(
    `${BASE_URL}/richmenu`, RICH_MENU_BODY, { headers: authJson }
  );
  console.log(`圖文選單建立成功，ID: ${richMenuId}`);

  // 2. 取得圖片（優先用靜態檔案，避免 Linux 環境無中文字型亂碼）
  const staticPng = path.join(__dirname, '../assets/rich-menu.png');
  let pngBuffer;
  if (fs.existsSync(staticPng)) {
    pngBuffer = fs.readFileSync(staticPng);
    console.log('使用靜態 rich-menu.png（確保中文正確顯示）');
  } else {
    pngBuffer = generatePng();
    console.log('動態生成 PNG（建議在 Windows 執行後 commit assets/rich-menu.png）');
  }

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
