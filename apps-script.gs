/**
 * Backend simples para o PWA Controle Financeiro.
 * Salva pares chave/valor em uma aba chamada DB.
 */
const SHEET_NAME = 'DB';

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['key', 'value', 'updatedAt']);
  }
  return sheet;
}

function doGet(e) {
  const key = String(e.parameter.key || '').trim();
  if (!key) return json_({ ok: false, error: 'missing_key' });

  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === key) {
      return json_({ ok: true, key, value: values[i][1] || null, updatedAt: values[i][2] || null });
    }
  }
  return json_({ ok: true, key, value: null });
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || '{}');
  const key = String(payload.key || '').trim();
  const value = String(payload.value || '');
  if (!key) return json_({ ok: false, error: 'missing_key' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    const values = sheet.getDataRange().getValues();
    const now = new Date().toISOString();
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === key) {
        sheet.getRange(i + 1, 2, 1, 2).setValues([[value, now]]);
        return json_({ ok: true, key, updatedAt: now });
      }
    }
    sheet.appendRow([key, value, now]);
    return json_({ ok: true, key, updatedAt: now });
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
