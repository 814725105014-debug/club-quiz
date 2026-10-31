/**
 * Google Workspace audit performed before development (Phase 1).
 * Stored in settings so the administrator can review the integration map inside
 * the dashboard (Settings → Workspace audit).
 */
export const GOOGLE_WORKSPACE_AUDIT = {
  auditedAt: '2026-10-31',
  spreadsheet: {
    id: '1jiVDFpIxGwfSlHBt3vaHl-5GFd8DPGapSS4tsR-FhJQ',
    title: 'Course Completion Certificate Generator',
    timezone: 'Asia/Calcutta (Asia/Kolkata)',
    tabs: {
      'Form Responses 1': {
        rows: 1,
        columns: 15,
        headers: [
          'Timestamp',
          'Email Address',
          'Participant Full Name ',
          '  Register Number  ',
          '  Department  ',
          '  Course Name  ',
          '  Conducted By  ',
          '  Course Duration  ',
          'Issue Date  ',
          'Certificate ID',
          'PDF URL',
          'Mail Status',
          'Mail Sent Time',
          'Error',
          'Slide File ID',
        ],
        notes:
          'Headers preserved verbatim (including trailing spaces) because the existing automation resolves columns by header name. Existing row retained untouched.',
      },
      Logs: {
        headers: [
          'Timestamp',
          'Action',
          'Student Name',
          'Certificate ID',
          'Email',
          'Status',
          'Remarks',
          'Execution Time',
          'Error Stack',
        ],
        notes: 'Used by the existing Apps Script automation for certificate/email execution logs.',
      },
      Settings: {
        notes:
          'Key/value configuration for the existing automation: TEMPLATE_ID, Generated/Archive/Logs folder IDs, Certificate Prefix "SRMTRP/EEE/VAC/", Certificate Year 2026, Current Running Number 14, QR verification base URL, QR data mode CERTIFICATE_ID, email subject, administrator email.',
      },
    },
    observedRecord: {
      certificateIdPattern: 'SRMTRP/EEE/VAC/-2026-0014',
      pdfUrl: 'drive.google.com/file/d/1Ma5…/view',
      mailStatus: 'Sent',
      slideFileId: '15XZLmdBAAHyehFDgnQ7N6IG_r84gK_d0OoT61DN1PHE',
      note: 'The referenced PDF and slide copy are no longer resolvable through the connected account (Drive 404); the row itself is intact.',
    },
  },
  slidesTemplate: {
    id: '1dkfJ6PQtmeDEkcNR4xJWsWrLjSu5pkAnvY3JY44_ISo',
    title: 'Certificate Template - Course Completion',
    slides: 1,
    editablePlaceholders: [
      '{{NAME}}',
      '{{COURSE_NAME}}',
      '{{ISSUE_DATE}}',
      '{{QR_CODE}}',
      '{{COURSE_COORDINATOR_SIGNATURE}}',
      '{{HOD_SIGNATURE}}',
      '{{PRINCIPAL_SIGNATURE}}',
    ],
    notes:
      'Only these placeholders exist. The platform maps participant/quiz data onto them exactly and never overwrites the original deck — each certificate is produced from a copy.',
  },
  gmail: {
    connectedAccount: '814725105014@trp.srmtrichy.edu.in',
    configuredCertificateSender: 'certificate.trp.srmtrichy@gmail.com (existing automation)',
    notes:
      'Messages are sent from the connected account; the existing automation uses its own Gmail sender. During testing every email is redirected to the administrator address (EMAIL_TEST_MODE=true).',
  },
  appsScript: {
    providedProjectUrl:
      'https://script.google.com/home/projects/16hTGWLwIvGNZqPMQXdDUMasc8kZFg2atwkfWi50X9vg0gzjLUUf3MejZ',
    readable: false,
    driveScriptProjects: [
      { name: 'EMBEDX Quiz & Certification Engine', id: '1wDBigHjf8HTd4N_MWvfb726KCDpD54EhhlzY-dX1lGn4xe9jTwB6F93J' },
      { name: 'TRP Digital Sign Backend', id: '1XxVuP-RS2-DiHoLxdFp-4AdbXT4EvacnfYS-v-4jagIgzoeHoBFz6rdx' },
    ],
    notes:
      'The Apps Script source is not exposed through the connected Google APIs (Script projects are not readable as Drive files). Behaviour was reconstructed from the Settings/Logs tabs and the existing output row. A drop-in bridge (apps-script-bridge/) exposes the same placeholders, folders, certificate numbering and logging without modifying the existing project.',
  },
  fieldMapping: [
    { form: 'Participant Full Name', sheet: 'Participant Full Name ', placeholder: '{{NAME}}', platform: 'registration_fields.name' },
    { form: 'Email Address', sheet: 'Email Address', placeholder: '{{EMAIL}}', platform: 'registration_fields.email' },
    { form: 'Register Number', sheet: '  Register Number  ', placeholder: '{{REGISTRATION_NUMBER}}', platform: 'registration_fields.reg_number' },
    { form: 'Department', sheet: '  Department  ', placeholder: '{{DEPARTMENT}}', platform: 'registration_fields.department' },
    { form: 'Course Name', sheet: '  Course Name  ', placeholder: '{{COURSE_NAME}}', platform: 'quiz.cert_course_name' },
    { form: 'Conducted By', sheet: '  Conducted By  ', placeholder: '{{CONDUCTED_BY}}', platform: 'quiz.cert_conducted_by' },
    { form: 'Course Duration', sheet: '  Course Duration  ', placeholder: '{{COURSE_DURATION}}', platform: 'quiz.cert_duration' },
  ],
  constraints: [
    'Never overwrite the original Slides template — every certificate is generated from a copy.',
    'Never rename, reorder or delete existing spreadsheet columns; new data is written to a new "Quiz Results" tab and the existing "Form Responses 1" columns are reused by header name.',
    'Writing rows with the Sheets API does not fire the Google Form submit trigger, so the platform calls the certificate pipeline explicitly instead of relying on that trigger.',
    'The existing Apps Script trigger for the old Google Form workflow is left untouched.',
  ],
};
