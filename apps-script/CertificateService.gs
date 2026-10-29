/**
 * EMBEDX Certificate Generation & Verification Engine
 * Strictly Gated by Phase 2 Completion, Idempotent, and Slides-to-PDF Driven
 */

/**
 * Checks existing certificate record or eligibility
 */
function getStudentCertificate_(studentId, isPhase2Completed) {
  const ss = getSpreadsheet();
  const certsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CERTIFICATES);

  if (certsSheet && certsSheet.getLastRow() > 1) {
    const data = certsSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const cIdIdx = headers.indexOf('certificate_id');
    const sIdIdx = headers.indexOf('student_id');
    const fileIdIdx = headers.indexOf('drive_file_id');
    const pdfUrlIdx = headers.indexOf('pdf_url');
    const issuedAtIdx = headers.indexOf('issued_at');
    const statusIdx = headers.indexOf('status');

    for (let i = 1; i < data.length; i++) {
      if (data[i][sIdIdx] === studentId && data[i][statusIdx] === 'issued') {
        const issuedDate = data[i][issuedAtIdx];
        return {
          eligible: true,
          issued: true,
          certificateId: data[i][cIdIdx],
          driveFileId: data[i][fileIdIdx],
          pdfUrl: data[i][pdfUrlIdx],
          issuedAt: issuedDate instanceof Date ? Utilities.formatDate(issuedDate, CONFIG.EVENT.TIMEZONE, 'dd MMMM yyyy') : String(issuedDate)
        };
      }
    }
  }

  return {
    eligible: Boolean(isPhase2Completed),
    issued: false,
    certificateId: null,
    driveFileId: null,
    pdfUrl: null,
    issuedAt: null
  };
}

/**
 * Generates an official Certificate of Completion upon verified Phase 2 completion
 */
function generateCertificateForStudent(targetStudentId) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    throw new Error('Server busy generating certificates. Please retry in a few seconds.');
  }

  try {
    const user = requireAuthenticatedUser_();
    const profile = getOrCreateStudentProfile_(user);
    const ss = getSpreadsheet();

    const studentId = (user.isAdmin && targetStudentId) ? targetStudentId : profile.id;
    const studentUser = findUserById_(studentId) || profile;

    // 1. Strict Phase 2 Prerequisite Check
    const dashData = getStudentDashboardData();
    if (!dashData.phaseProgress.phase2.completed && !user.isAdmin) {
      throw new Error('ELIGIBILITY_FAILED: Certificate generation requires 100% verified completion of Phase 2 requirements.');
    }

    // 2. Idempotency Check: Return existing if already issued
    const certsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CERTIFICATES);
    const existingCert = getStudentCertificate_(studentId, true);
    if (existingCert.issued && existingCert.certificateId) {
      return {
        success: true,
        alreadyIssued: true,
        certificate: existingCert
      };
    }

    // 3. Prepare Template Placeholders
    const certId = 'EMBEDX-2026-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    const issueDateStr = Utilities.formatDate(new Date(), CONFIG.EVENT.TIMEZONE, '30 October 2026');
    const studentName = studentUser.displayName || studentUser.name || 'Student Contender';

    const templateId = getAppProperty('SLIDES_TEMPLATE_ID');
    const folderId = getAppProperty('CERTIFICATE_FOLDER_ID');

    let pdfFileUrl = '';
    let driveFileId = '';

    if (templateId) {
      try {
        // Copy Slides Template
        const templateFile = DriveApp.getFileById(templateId);
        let destinationFolder = DriveApp.getRootFolder();
        if (folderId) {
          try {
            destinationFolder = DriveApp.getFolderById(folderId);
          } catch (e) {
            console.warn('Configured folder not accessible, using Drive root: ' + e.message);
          }
        }

        const copyName = 'EMBEDX_Certificate_' + studentId + '_' + certId;
        const copiedFile = templateFile.makeCopy(copyName, destinationFolder);
        const presentation = SlidesApp.openById(copiedFile.getId());
        const slides = presentation.getSlides();

        // Replace Placeholders on all slides
        const placeholders = {
          '{{STUDENT_NAME}}': studentName,
          '{{WORKSHOP_TITLE}}': CONFIG.EVENT.TITLE,
          '{{ISSUE_DATE}}': issueDateStr,
          '{{CERTIFICATE_ID}}': certId,
          '{{INSTITUTION_NAME}}': CONFIG.INSTITUTION.NAME,
          '{{CLUB_NAME}}': CONFIG.INSTITUTION.CLUB,
          '{{DEPARTMENT}}': CONFIG.INSTITUTION.DEPARTMENT
        };

        slides.forEach(slide => {
          for (const [findStr, repStr] of Object.entries(placeholders)) {
            slide.replaceAllText(findStr, repStr);
          }
        });

        presentation.saveAndClose();

        // Convert to PDF
        const pdfBlob = copiedFile.getAs('application/pdf');
        pdfBlob.setName(copyName + '.pdf');
        const pdfFile = destinationFolder.createFile(pdfBlob);

        // Security: Remove temporary slide copy
        copiedFile.setTrashed(true);

        driveFileId = pdfFile.getId();
        pdfFileUrl = pdfFile.getUrl();

        // Restrict access directly to student
        try {
          pdfFile.addViewer(studentUser.email);
        } catch (permErr) {
          console.warn('Could not add direct viewer permission: ' + permErr.message);
        }

      } catch (slidesErr) {
        console.error('Google Slides error: ' + slidesErr.message);
        // Fallback for development if template ID is not yet connected by admin
        driveFileId = 'DEV-PLACEHOLDER-' + certId;
        pdfFileUrl = '#certificate-preview-' + certId;
      }
    } else {
      // Slides Template ID not configured yet in ScriptProperties
      driveFileId = 'DEV-MOCK-DRIVE-ID';
      pdfFileUrl = '#certificate-ready-' + certId;
    }

    // 4. Save Record in CERTIFICATES sheet
    const now = new Date();
    certsSheet.appendRow([
      certId,
      studentId,
      'EMBEDX-WORKSHOP-2026',
      templateId || 'DEFAULT_SLIDES_V1',
      driveFileId,
      pdfFileUrl,
      now,
      'issued',
      '' // revoked_at
    ]);

    // 5. Log Audit Trail
    logAuditAction_(user.email, 'ISSUE_CERTIFICATE', 'CERTIFICATE', certId, 'Issued to ' + studentUser.email + ' (' + studentName + ')');

    // 6. Queue Certificate Notification
    try {
      queueNotification_('CERTIFICATE_ISSUED', studentUser.email, studentId, certId, {
        studentName: studentName,
        certificateId: certId,
        pdfUrl: pdfFileUrl
      });
    } catch (e) {
      console.warn('Certificate email queue skipped: ' + e.message);
    }

    return {
      success: true,
      alreadyIssued: false,
      certificate: {
        certificateId: certId,
        pdfUrl: pdfFileUrl,
        driveFileId: driveFileId,
        issuedAt: Utilities.formatDate(now, CONFIG.EVENT.TIMEZONE, 'dd MMMM yyyy')
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function findUserById_(id) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.USERS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const idIdx = headers.indexOf('student_id');
    const emailIdx = headers.indexOf('email');
    const nameIdx = headers.indexOf('display_name');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === id) {
        return {
          id: id,
          email: data[i][emailIdx],
          name: data[i][nameIdx],
          displayName: data[i][nameIdx]
        };
      }
    }
  } catch (e) {
    return null;
  }
  return null;
}
