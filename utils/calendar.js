// utils/calendar.js - Google Calendar 同步工具
const { google } = require('googleapis');

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY 未設定');
  const creds = JSON.parse(raw);
  return new google.auth.JWT({
    email: creds.client_email,
    key:   creds.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
}

// Excel serial number → YYYY-MM-DD
function toDateStr(val) {
  if (!val) return '';
  if (!isNaN(val)) {
    const date = new Date(Math.round((Number(val) - 25569) * 86400 * 1000));
    return date.toISOString().slice(0, 10);
  }
  return String(val).slice(0, 10);
}

// 日期字串 +N 天（YYYY-MM-DD）
function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function addLeaveToCalendar({ name, leaveType, startDate, endDate, reason, agent }) {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) throw new Error('GOOGLE_CALENDAR_ID 未設定');
  const calendar = google.calendar({ version: 'v3', auth: getAuth() });

  const start = toDateStr(startDate);
  const end   = toDateStr(endDate);

  const res = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: `${name} 請假 - ${leaveType}`,
      description: `申請人：${name}\n假別：${leaveType}\n原因：${reason}\n代理人：${agent}`,
      colorId: '1',
      start: { date: start },
      end:   { date: addDays(end, 1) },
    },
  });
  console.log(`[Calendar] 新增成功：${res.data.htmlLink}`);
  return res.data;
}

module.exports = { addLeaveToCalendar };
