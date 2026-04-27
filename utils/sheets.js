// utils/sheets.js - Google Sheets 讀寫工具（出勤紀錄 統一工作表）
const { google } = require('googleapis');

// ════════════════════════════════════════════════════════════
//  工作表設定
// ════════════════════════════════════════════════════════════
const SHEET = '出勤紀錄';

const HEADER = [
  '申請時間',   // A 0
  '員工姓名',   // B 1
  '員工LINE ID',// C 2
  '類型',       // D 3  (請假申請 / 加班申請)
  '假別/加班',  // E 4  (特休假/病假… 或留空)
  '開始日期',   // F 5
  '結束日期',   // G 6
  '開始時間',   // H 7  (加班用)
  '結束時間',   // I 8  (加班用)
  '加班時數',   // J 9  (加班用)
  '案名',       // K 10 (加班用)
  '原因',       // L 11
  '代理人',     // M 12 (請假用)
  '主管審核',   // N 13
  'HR審核',     // O 14
];

// 欄位索引（0-based）
const COL = {
  TIME:           0,
  NAME:           1,
  USER_ID:        2,
  TYPE:           3,
  LEAVE_TYPE:     4,
  START_DATE:     5,
  END_DATE:       6,
  START_TIME:     7,
  END_TIME:       8,
  OVERTIME_HOURS: 9,
  PROJECT_NAME:   10,
  REASON:         11,
  AGENT:          12,
  MANAGER_RESULT: 13,
  HR_RESULT:      14,
};

// ── 顏色常數（0–1 範圍）─────────────────────────────────────
const C = {
  HEADER_BG:  rgb(127, 119, 221), // #7f77dd 深紫
  HEADER_FG:  rgb(255, 255, 255), // 白色
  LEAVE_BG:   rgb(255, 242, 204), // #FFF2CC 淡黃
  OT_BG:      rgb(255, 224, 204), // #FFE0CC 淡橘
};
function rgb(r, g, b) { return { red: r / 255, green: g / 255, blue: b / 255 }; }

// ════════════════════════════════════════════════════════════
//  認證 & API 實例
// ════════════════════════════════════════════════════════════
function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY 未設定');
  const creds = JSON.parse(raw);
  return new google.auth.JWT({
    email: creds.client_email,
    key:   creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

const getApi = () => google.sheets({ version: 'v4', auth: getAuth() });
const getSid = () => {
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id) throw new Error('GOOGLE_SHEETS_ID 未設定');
  return id;
};

// ── 快取 sheetId（數字型 gid，batchUpdate 用）───────────────
let _sheetGid = null;
async function getSheetGid() {
  if (_sheetGid !== null) return _sheetGid;
  const res = await getApi().spreadsheets.get({ spreadsheetId: getSid() });
  const found = res.data.sheets.find(s => s.properties.title === SHEET);
  if (!found) throw new Error(`試算表中找不到工作表「${SHEET}」，請先手動建立`);
  _sheetGid = found.properties.sheetId;
  return _sheetGid;
}

// ════════════════════════════════════════════════════════════
//  標題列初始化（首次寫入時自動執行）
// ════════════════════════════════════════════════════════════
let _headerDone = false;

async function ensureHeader() {
  if (_headerDone) return;

  const res = await getApi().spreadsheets.values.get({
    spreadsheetId: getSid(),
    range: `${SHEET}!A1:O1`,
  });

  if (res.data.values?.length) { _headerDone = true; return; }

  // 1. 寫入標題文字
  await getApi().spreadsheets.values.update({
    spreadsheetId: getSid(),
    range: `${SHEET}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [HEADER] },
  });

  // 2. 格式化：深紫背景 + 白色粗體
  const gid = await getSheetGid();
  await getApi().spreadsheets.batchUpdate({
    spreadsheetId: getSid(),
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId: gid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 15 },
            cell: {
              userEnteredFormat: {
                backgroundColor: C.HEADER_BG,
                textFormat: { foregroundColor: C.HEADER_FG, bold: true },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        },
      ],
    },
  });

  _headerDone = true;
}

// ════════════════════════════════════════════════════════════
//  內部工具
// ════════════════════════════════════════════════════════════

// 解析 updatedRange 取得列號
function parseRowIndex(updatedRange) {
  const match = (updatedRange || '').match(/A(\d+)/);
  if (!match) throw new Error('無法從 updatedRange 解析列號');
  return parseInt(match[1]);
}

// 寫入一列資料，回傳列號
async function appendRow(rowData) {
  const res = await getApi().spreadsheets.values.append({
    spreadsheetId: getSid(),
    range: `${SHEET}!A:O`,
    valueInputOption: 'RAW',       // ← 改這裡
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [rowData] },
  });
  return parseRowIndex(res.data.updates?.updatedRange);
}

// 用 batchUpdate 為指定列上色
async function colorRow(rowIndex, bgColor) {
  const gid = await getSheetGid();
  await getApi().spreadsheets.batchUpdate({
    spreadsheetId: getSid(),
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: gid,
              startRowIndex: rowIndex - 1, // API 用 0-based
              endRowIndex:   rowIndex,
              startColumnIndex: 0,
              endColumnIndex:   15,
            },
            cell: { userEnteredFormat: { backgroundColor: bgColor } },
            fields: 'userEnteredFormat.backgroundColor',
          },
        },
      ],
    },
  });
}

// ════════════════════════════════════════════════════════════
//  公開函式
// ════════════════════════════════════════════════════════════

/**
 * 新增請假紀錄（淡黃色 #FFF2CC）
 * @returns {Promise<number>} 寫入的 Sheets 列號
 */
async function appendLeaveRow({ time, name, userId, leaveType, startDate, endDate, reason, agent }) {
  await ensureHeader();
  const row = [
    time, name, userId, '請假申請',
    leaveType, startDate, endDate,
    '',  // 開始時間（加班用，請假留空）
    '',  // 結束時間
    '',  // 加班時數
    '',  // 案名
    reason, agent,
    '待審核', '待審核',
  ];
  const idx = await appendRow(row);
  await colorRow(idx, C.LEAVE_BG);
  return idx;
}

/**
 * 新增加班紀錄（淡橘色 #FFE0CC）
 * @returns {Promise<number>} 寫入的 Sheets 列號
 */
async function appendOvertimeRow({ time, name, userId, overtimeDate, overtimeStart, overtimeEnd, overtimeHours, projectName, overtimeReason }) {
  await ensureHeader();
  const row = [
    time, name, userId, '加班申請',
    '',            // 假別（加班不適用）
    overtimeDate, overtimeDate, // 開始/結束日期（加班同一天）
    overtimeStart, overtimeEnd,
    overtimeHours, projectName,
    overtimeReason,
    '',            // 代理人（加班不適用）
    '待審核', '待審核',
  ];
  const idx = await appendRow(row);
  await colorRow(idx, C.OT_BG);
  return idx;
}

/**
 * 讀取指定列的出勤資料（陣列，對應 COL 索引順序）
 */
async function getAttendRow(rowIndex) {
  const res = await getApi().spreadsheets.values.get({
    spreadsheetId: getSid(),
    range: `${SHEET}!A${rowIndex}:O${rowIndex}`,
  });
  return res.data.values?.[0] || null;
}

/**
 * 更新主管審核結果（欄 N，COL.MANAGER_RESULT = 13）
 */
async function updateManagerResult(rowIndex, result) {
  await getApi().spreadsheets.values.update({
    spreadsheetId: getSid(),
    range: `${SHEET}!N${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[result]] },
  });
}

/**
 * 更新 HR 審核結果（欄 O，COL.HR_RESULT = 14）
 */
async function updateHRResult(rowIndex, result) {
  await getApi().spreadsheets.values.update({
    spreadsheetId: getSid(),
    range: `${SHEET}!O${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[result]] },
  });
}

module.exports = {
  appendLeaveRow,
  appendOvertimeRow,
  getAttendRow,
  updateManagerResult,
  updateHRResult,
  COL,
};
