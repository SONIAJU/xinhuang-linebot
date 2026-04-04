// utils/sheets.js - Google Sheets 工具模組
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

function getAuthClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: SCOPES,
  });
  return auth;
}

function getSheetsClient() {
  const auth = getAuthClient();
  return google.sheets({ version: 'v4', auth });
}

/**
 * 讀取指定範圍的資料
 * @param {string} range - 例如 'Sheet1!A1:E10'
 * @returns {Array} 二維陣列資料
 */
async function readSheet(range) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range,
  });
  return res.data.values || [];
}

/**
 * 在指定工作表末尾新增一行資料
 * @param {string} sheetName - 工作表名稱，例如 '請假紀錄'
 * @param {Array} rowData - 一維陣列，例如 ['2026/04/10', '王小明', '身體不適']
 */
async function appendRow(sheetName, rowData) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [rowData] },
  });
}

/**
 * 更新指定儲存格的值
 * @param {string} range - 例如 'Sheet1!C5'
 * @param {string} value - 要寫入的值
 */
async function updateCell(range, value) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });
}

/**
 * 依關鍵字搜尋某工作表的特定欄位
 * @param {string} sheetName - 工作表名稱
 * @param {number} columnIndex - 要搜尋的欄位索引（0-based）
 * @param {string} keyword - 搜尋關鍵字
 * @returns {Array} 符合的列資料
 */
async function searchRows(sheetName, columnIndex, keyword) {
  const data = await readSheet(`${sheetName}!A:Z`);
  return data.filter(row => row[columnIndex] && row[columnIndex].includes(keyword));
}

module.exports = { readSheet, appendRow, updateCell, searchRows };
