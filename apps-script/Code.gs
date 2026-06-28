/**
 * Daily Dozen Friends League — Google Apps Script backend.
 *
 * This tiny web app receives a parsed result from the website and appends it
 * to the bound Google Sheet (one row per game per player; re-submitting the
 * same game updates the existing row).
 *
 * SETUP
 *  1. Create/open a Google Sheet.
 *  2. Extensions > Apps Script. Delete the sample, paste this file, Save.
 *  3. Deploy > New deployment > type "Web app".
 *       - Execute as: Me
 *       - Who has access: Anyone
 *     Deploy, authorize, and copy the Web app URL (ends in /exec).
 *  4. Put that URL in the website's config.js  ->  submitEndpoint.
 *  5. Back in the Sheet: File > Share > Publish to web > the "results" tab
 *     as CSV. Put THAT url in config.js  ->  sheetCsvUrl.
 */

var SHEET_NAME = 'results';
var HEADERS = ['submitted_at', 'game', 'player', 'score', 'correct', 'time', 'grid'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000); // avoid two submissions clobbering each other
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = getSheet_();

    var game = String(data.game || '').trim();
    var player = String(data.player || '').trim();
    if (!game || !player) return json_({ ok: false, error: 'Missing game or player' });

    var row = [new Date(), game, player, data.score, data.correct, data.time || '', data.grid || ''];

    // Update if this player already submitted this game; else append.
    var values = sheet.getDataRange().getValues();
    var foundRow = -1;
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][1]) === game &&
          String(values[i][2]).toLowerCase() === player.toLowerCase()) {
        foundRow = i + 1;
        break;
      }
    }
    if (foundRow > 0) sheet.getRange(foundRow, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);

    return json_({ ok: true, game: game, player: player });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Lets you open the /exec URL in a browser to sanity-check it's deployed.
function doGet() {
  return json_({ ok: true, service: 'daily-dozen-tracker', rows: getSheet_().getLastRow() - 1 });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
