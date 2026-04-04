// utils/sheets.js - Google Sheets 讀寫工具
const { google } = require('googleapis');

// ── 工作表設定 ────────────────────────────────────────────────
const LEAVE_SHEET  = '請假紀錄';
const LEAVE_HEADER = [
  '申請時間', '員工姓名', '員工LINE ID', '假別',
  '開始日期', '結束日期', '請假原因',  '代理人',
  '主管審核結果', 'HR審核結果',
];

// 欄位索引（0-based）← 對應 LEAVE_HEADER 順序
const COL = {
  TIME:           0,
  NAME:           1,
  USER_ID:        2,
  LEAVE_TYPE:     3,
  START_DATE:     4,
  END_DATE:       5,
  REASON:         6,
  AGENT:          7,
  MANAGER_RESULT: 8,  // 欄 I
  HR_RESULT:      9,  // 欄 J
};

// ── 認證 ──────────────────────────────────────────────────────
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

const api = () => google.sheets({ version: 'v4', auth: getAuth() });
const sid = () => {
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id) throw new Error('GOOGLE_SHEETS_ID 未設定');
  return id;
};

// ── 內部工具 ──────────────────────────────────────────────────
// 確保工作表第一列為表頭（首次使用時自動建立）
async function ensureLeaveHeader() {
  const res = await api().spreadsheets.values.get({
    spreadsheetId: sid(),
    range: `${LEAVE_SHEET}!A1:J1`,
  });
  if (!res.data.values?.length) {
    await api().spreadsheets.values.update({
      spreadsheetId: sid(),
      range: `${LEAVE_SHEET}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [LEAVE_HEADER] },
    });
  }
}

// 將欄位索引轉為 A1 記法字母（0=A, 8=I, 9=J ...）
function colLetter(index) {
  return String.fromCharCode(65 + index);
}

// ── 公開 API ──────────────────────────────────────────────────

/**
 * 新增請假紀錄，回傳寫入的列號（int）。
 * 若寫入失敗則拋出例外。
 */
async function appendLeaveRow({ time, name, userId, leaveType, startDate, endDate, reason, agent }) {
  await ensureLeaveHeader();
  const row = [
    time, name, userId, leaveType,
    startDate, endDate, reason, agent,
    '待審核', '待審核',
  ];
  const res = await api().spreadsheets.values.append({
    spreadsheetId: sid(),
    range: `${LEAVE_SHEET}!A:J`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
  // updatedRange 格式：「請假紀錄!A5:J5」→ 取列號 5
  const match = (res.data.updates?.updatedRange || '').match(/A(\d+)/);
  if (!match) throw new Error('無法解析寫入列號');
  return parseInt(match[1]);
}

/**
 * 讀取指定列的請假資料，回傳字串陣列（對應 LEAVE_HEADER 順序）。
 */
async function getLeaveRow(rowIndex) {
  const res = await api().spreadsheets.values.get({
    spreadsheetId: sid(),
    range: `${LEAVE_SHEET}!A${rowIndex}:J${rowIndex}`,
  });
  return res.data.values?.[0] || null;
}

/**
 * 更新主管審核結果（欄 I = COL.MANAGER_RESULT）
 * @param {number} rowIndex - 列號
 * @param {'核准'|'拒絕'} result
 */
async function updateManagerResult(rowIndex, result) {
  const col = colLetter(COL.MANAGER_RESULT);
  await api().spreadsheets.values.update({
    spreadsheetId: sid(),
    range: `${LEAVE_SHEET}!${col}${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[result]] },
  });
}

/**
 * 更新 HR 審核結果（欄 J = COL.HR_RESULT）
 * @param {number} rowIndex - 列號
 * @param {'核准'|'拒絕'} result
 */
async function updateHRResult(rowIndex, result) {
  const col = colLetter(COL.HR_RESULT);
  await api().spreadsheets.values.update({
    spreadsheetId: sid(),
    range: `${LEAVE_SHEET}!${col}${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[result]] },
  });
}

module.exports = { appendLeaveRow, getLeaveRow, updateManagerResult, updateHRResult, COL };
