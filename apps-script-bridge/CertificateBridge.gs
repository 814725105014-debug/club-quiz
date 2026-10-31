/**
 * QUIZ PLATFORM — Apps Script bridge (ADDITIVE, not deployed by the repository)
 * ---------------------------------------------------------------------------
 * Paste this file into the EXISTING Apps Script project as a NEW file. It adds a
 * web-app entry point only; existing files, functions and Form triggers are untouched.
 *
 * Script properties required:
 *   QUIZ_PLATFORM_SECRET              shared secret, same as APPS_SCRIPT_SHARED_SECRET
 *   QUIZ_PLATFORM_SPREADSHEET_ID      Form responses spreadsheet
 *   QUIZ_PLATFORM_TEMPLATE_ID         Slides certificate template (read-only use)
 *   QUIZ_PLATFORM_OUTPUT_FOLDER_ID    Drive folder for generated PDFs
 * Optional:
 *   QUIZ_PLATFORM_SIGNATURE_TEXT      default "" (template may already contain images)
 *
 * Deploy: Deploy > New deployment > Web app > Execute as "Me" > Access "Anyone".
 * Then set APPS_SCRIPT_WEBHOOK_URL to the /exec URL and GOOGLE_PROVIDER=apps_script.
 */

var BRIDGE = {
  secret: 'QUIZ_PLATFORM_SECRET',
  spreadsheet: 'QUIZ_PLATFORM_SPREADSHEET_ID',
  template: 'QUIZ_PLATFORM_TEMPLATE_ID',
  folder: 'QUIZ_PLATFORM_OUTPUT_FOLDER_ID',
  signature: 'QUIZ_PLATFORM_SIGNATURE_TEXT',
};

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return bridgeJson_({ ok: false, error: 'Empty request body.' });
    }
    var body = JSON.parse(e.postData.contents);
    if (!bridgeSecretOk_(body.secret)) {
      return bridgeJson_({ ok: false, error: 'unauthorized' });
    }
    var action = String(body.action || '');
    switch (action) {
      case 'ping':
        return bridgeJson_(bridgePing_());
      case 'list_tabs':
        return bridgeJson_(bridgeListTabs_());
      case 'read_sheet':
        return bridgeJson_(bridgeReadSheet_(body));
      case 'write_sheet_row':
        return bridgeJson_(bridgeWriteSheetRow_(body));
      case 'issue_certificate':
        return bridgeJson_(bridgeIssueCertificate_(body));
      case 'send_email':
        return bridgeJson_(bridgeSendEmail_(body));
      default:
        return bridgeJson_({ ok: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return bridgeJson_({ ok: false, error: String((err && err.message) || err) });
  }
}

function doGet() {
  return bridgeJson_({ ok: true, message: 'QUIZ PLATFORM bridge is running. POST signed JSON.' });
}

/* ------------------------------------------------------------------ helpers */

function bridgeJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function bridgeProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function bridgeSecretOk_(given) {
  var expected = bridgeProp_(BRIDGE.secret) || '';
  given = String(given || '');
  if (!expected || given.length !== expected.length) return false;
  var diff = 0;
  for (var i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

function bridgeSpreadsheet_() {
  var id = bridgeProp_(BRIDGE.spreadsheet);
  if (!id) throw new Error('QUIZ_PLATFORM_SPREADSHEET_ID is not set.');
  return SpreadsheetApp.openById(id);
}

function bridgeFolder_() {
  return DriveApp.getFolderById(bridgeProp_(BRIDGE.folder));
}

/* -------------------------------------------------------------------- sheets */

function bridgePing_() {
  var ss = bridgeSpreadsheet_();
  return { ok: true, message: 'Bridge reachable: ' + ss.getName(), spreadsheet: ss.getId() };
}

function bridgeListTabs_() {
  var ss = bridgeSpreadsheet_();
  return { ok: true, tabs: ss.getSheets().map(function (s) { return s.getName(); }) };
}

function bridgeReadSheet_(body) {
  var ss = bridgeSpreadsheet_();
  var sheet = ss.getSheetByName(String(body.tab || ''));
  if (!sheet) throw new Error('Tab not found: ' + body.tab);
  var values = sheet.getDataRange().getDisplayValues();
  var headers = values.length ? values[0] : [];
  return { ok: true, headers: headers, rows: values.slice(1) };
}

/** Appends a row, or updates the row whose key column matches body.keyValue. */
function bridgeWriteSheetRow_(body) {
  var ss = bridgeSpreadsheet_();
  var tab = String(body.tab || '');
  var sheet = ss.getSheetByName(tab) || ss.insertSheet(tab);
  var values = body.values || [];
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (sheet.getLastRow() === 0 && body.headers && body.headers.length) {
      sheet.appendRow(body.headers);
    }
    if (body.mode === 'upsert' && body.keyColumn && body.keyValue !== undefined && body.keyValue !== null) {
      var width = Math.max(sheet.getLastColumn(), values.length);
      var headerRow = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
      var keyIndex = headerRow.indexOf(String(body.keyColumn));
      if (keyIndex >= 0 && sheet.getLastRow() > 1) {
        var keys = sheet.getRange(2, keyIndex + 1, sheet.getLastRow() - 1, 1).getDisplayValues();
        var rowIndex = -1;
        for (var i = 0; i < keys.length; i++) {
          if (String(keys[i][0]) === String(body.keyValue)) { rowIndex = i + 2; break; }
        }
        if (rowIndex > 0) {
          sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
          return { ok: true, updated: true, row: rowIndex };
        }
      }
    }
    sheet.appendRow(values);
    return { ok: true, updated: false, row: sheet.getLastRow() };
  } finally {
    lock.releaseLock();
  }
}

/* -------------------------------------------------------------- certificates */

/**
 * Copies the template (never edits it), replaces the placeholders that actually exist
 * in the live template and exports a PDF. Reuses the same replacement table as the
 * legacy Form path if that function is refactored into a shared helper later.
 */
function bridgeIssueCertificate_(body) {
  var templateId = body.templateId || bridgeProp_(BRIDGE.template);
  var folder = body.folderId ? DriveApp.getFolderById(body.folderId) : bridgeFolder_();
  var certificateId = String(body.certificateId || '');
  var participant = body.participant || {};
  var quiz = body.quiz || {};
  var issueDate = body.issueDate ? new Date(body.issueDate) : new Date();
  var issued = Utilities.formatDate(issueDate, Session.getScriptTimeZone(), 'dd MMMM yyyy');
  var safeName = certificateId.replace(/[^A-Za-z0-9._-]+/g, '-');

  var template = DriveApp.getFileById(templateId);
  var copy = template.makeCopy('Certificate ' + certificateId + ' - ' + (participant.name || ''), folder);
  var presentation = SlidesApp.openById(copy.getId());
  var slide = presentation.getSlides()[0];
  var shapes = slide.getShapes();
  for (var i = 0; i < shapes.length; i++) {
    var textRange = shapes[i].getText();
    if (!textRange) continue;
    textRange.replaceAllText('{{NAME}}', String(participant.name || ''));
    textRange.replaceAllText('{{COURSE_NAME}}', String(quiz.courseName || quiz.title || ''));
    textRange.replaceAllText('{{ISSUE_DATE}}', issued);
    textRange.replaceAllText('{{COORDINATOR_SIGNATURE}}', bridgeProp_(BRIDGE.signature) || '');
    textRange.replaceAllText('{{HOD_SIGNATURE}}', bridgeProp_(BRIDGE.signature) || '');
    textRange.replaceAllText('{{PRINCIPAL_SIGNATURE}}', bridgeProp_(BRIDGE.signature) || '');
  }
  presentation.saveAndClose();

  // Insert the QR over {{QR_CODE}} using the PNG supplied by the platform (no external service).
  if (body.qrPngBase64) {
    presentation = SlidesApp.openById(copy.getId());
    slide = presentation.getSlides()[0];
    var elements = slide.getShapes();
    for (var j = 0; j < elements.length; j++) {
      var el = elements[j];
      var t = el.getText();
      if (t && t.asString().indexOf('{{QR_CODE}}') >= 0) {
        var blob = Utilities.newBlob(Utilities.base64Decode(String(body.qrPngBase64)), 'image/png', 'qr.png');
        var image = slide.insertImage(blob, el.getLeft(), el.getTop(), el.getWidth(), el.getHeight());
        image.setDescription('Certificate verification QR — ' + certificateId);
        el.remove();
        break;
      }
    }
    presentation.saveAndClose();
  }

  var pdfBlob = DriveApp.getFileById(copy.getId()).getAs('application/pdf').setName(safeName + '.pdf');
  var pdfFile = folder.createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // Keep the Sheet's certificate row up to date (upsert by Certificate ID).
  try {
    bridgeWriteSheetRow_({
      tab: 'Form Responses 1',
      mode: 'upsert',
      keyColumn: 'Certificate ID',
      keyValue: certificateId,
      values: [
        new Date(),
        participant.email || '',
        participant.name || '',
        participant.regNumber || '',
        participant.department || '',
        quiz.courseName || quiz.title || '',
        quiz.conductedBy || '',
        quiz.duration || '',
        new Date(),
        certificateId,
        pdfFile.getUrl(),
        copy.getId(),
        'Generated',
        '',
        '',
      ],
    });
  } catch (sheetErr) {
    // A sheet failure must not lose the certificate.
    console.error('sheet upsert failed: ' + sheetErr);
  }

  return {
    ok: true,
    pdfUrl: pdfFile.getUrl(),
    driveFileId: pdfFile.getId(),
    slideFileId: copy.getId(),
  };
}

/* -------------------------------------------------------------------- email */

function bridgeSendEmail_(body) {
  var options = { htmlBody: String(body.html || ''), name: String(body.fromName || 'SRM TRP Engineering College') };
  if (body.attachment && body.attachment.driveFileId) {
    var file = DriveApp.getFileById(String(body.attachment.driveFileId));
    options.attachments = [file.getBlob().setName(body.attachment.filename || file.getName())];
  }
  MailApp.sendEmail(String(body.to || ''), String(body.subject || 'Certificate'), String(body.text || 'Please view this email in HTML.'), options);
  return { ok: true, messageId: 'apps-script-' + Utilities.getUuid() };
}
