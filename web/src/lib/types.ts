export type Role = 'super_admin' | 'quiz_admin' | 'quiz_host' | 'results_viewer';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface SessionResponse {
  user: AdminUser;
  expiresAt: string;
}

export interface FieldRow {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'select' | 'tel';
  required: number;
  enabled: number;
  sort_order: number;
  pattern: string | null;
  pattern_hint: string | null;
  options: string | null;
  maps_to_sheet_column: string | null;
  maps_to_placeholder: string | null;
  is_core: number;
}

export interface Option {
  id: string;
  question_id: string;
  label: string;
  text: string;
  is_correct: number;
  sort_order: number;
}

export interface Question {
  id: string;
  quiz_id: string;
  text: string;
  type: 'single' | 'multi' | 'truefalse';
  marks: number;
  negative_marks: number;
  difficulty: 'easy' | 'medium' | 'hard';
  explanation: string | null;
  image_url: string | null;
  sort_order: number;
  options: Option[];
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  instructions: string;
  status: 'draft' | 'published' | 'scheduled' | 'active' | 'paused' | 'completed' | 'archived';
  start_at: string | null;
  end_at: string | null;
  duration_minutes: number;
  pass_percentage: number;
  max_attempts: number;
  shuffle_questions: number;
  shuffle_options: number;
  random_question_count: number | null;
  negative_marking: number;
  result_visibility: 'immediate' | 'after_end' | 'pass_only' | 'never';
  certificate_rule: 'none' | 'always' | 'pass' | 'score_threshold';
  certificate_min_score: number;
  cert_course_name: string | null;
  cert_conducted_by: string | null;
  cert_duration: string | null;
  auto_email: number;
  email_subject: string | null;
  email_body: string | null;
  cert_folder_id: string | null;
  join_code: string;
  allow_registration: number;
  allowed_email_domain: string | null;
  allowed_departments: string | null;
  announcement: string | null;
  violation_warn_after: number;
  violation_auto_submit_count: number;
  timezone: string;
  created_at: string;
  updated_at?: string;
  published_at: string | null;
  archived_at: string | null;
  totalQuestions?: number;
  totalMarks?: number;
  participantCount?: number;
  attemptCount?: number;
  submissionCount?: number;
  questions?: Question[];
}

export interface ResultRow {
  attemptId: string;
  participantId: string;
  name: string;
  email: string;
  regNumber: string | null;
  department: string | null;
  quizId: string;
  quizTitle: string;
  status: string;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: number | boolean;
  submittedAt: string | null;
  startedAt?: string | null;
  durationSeconds: number | null;
  violations: number;
  certificateStatus: string | null;
  certificateId: string | null;
  pdfUrl: string | null;
  emailStatus: string | null;
}

export interface CertificateRecord {
  id: string;
  certificate_id: string;
  quiz_id: string;
  participant_id: string;
  status: string;
  pdf_url: string | null;
  drive_file_id: string | null;
  slide_file_id: string | null;
  issued_at: string | null;
  error: string | null;
  email_status: string;
  email_error: string | null;
  created_at: string;
  participant_name?: string;
  participant_email?: string;
  reg_number?: string | null;
  quiz_title?: string;
}

export interface EmailRecord {
  id: string;
  template_key: string;
  to_email: string;
  actual_recipient: string;
  subject: string;
  status: string;
  error: string | null;
  attempt_count: number;
  created_at: string;
  sent_at: string | null;
}

export interface LiveOverview {
  quiz: {
    durationMinutes: number;
    status: string;
    shuffleQuestions: number;
    shuffleOptions: number;
    resultVisibility: string;
    allowRegistration: number;
    closeAt: string | null;
    violationWarnAfter: number;
    violationAutoSubmitCount: number;
    updatedAt: string;
  };
  participantCount: number;
  joined: number;
  inProgress: number;
  submitted: number;
  notStarted: number;
  avgPercentage: number;
  participants: LiveParticipant[];
  violations: { type: string; count: number }[];
  announcements: { id: string; message: string; created_at: string }[];
}

export interface LiveParticipant {
  attempt_id: string;
  participant_id: string;
  name: string;
  email: string;
  reg_number: string | null;
  department: string | null;
  status: string;
  score: number | null;
  total_marks: number;
  percentage: number | null;
  started_at: string | null;
  deadline_at: string | null;
  submitted_at: string | null;
  violations_count: number;
}

export interface DashboardStats {
  stats: {
    quizzes: Record<string, number>;
    participants: number;
    attempts: number;
    submissions: number;
    averageScore: number;
    certificates: { generated: number; pending: number; failed: number; emailed: number };
    emails: { sent: number; failed: number; queued: number };
    violations: number;
    syncQueue: { pending: number; failed: number };
  };
  activity: { id: number; actor_email: string | null; action: string; entity: string | null; created_at: string }[];
  upcoming: { id: string; title: string; status: string; start_at: string | null; join_code: string }[];
}

export interface WorkspaceSettings {
  workspace: {
    provider: 'mock' | 'apps_script' | 'google_api';
    spreadsheetId: string;
    responsesTab: string;
    resultsTab: string;
    logTab: string;
    templateId: string;
    outputFolderId: string;
    certificatePrefix: string;
    certificateYear: number;
    certificateStartNumber: number;
    verifyBaseUrl: string;
    emailFrom: string;
    emailFromName: string;
    organizationName: string;
    institutionLine: string;
    department: string;
    emailTestMode: boolean;
    emailRedirectTo: string;
    appBaseUrl: string;
    sharedSecretSet: boolean;
    webhookUrl: string;
    impersonateEmail: string;
  };
  audit: Record<string, unknown>;
  platform: { name: string; timezone: string };
}

export interface ParticipantRecord {
  id: string;
  name: string;
  email: string;
  reg_number: string | null;
  department: string | null;
  created_at: string;
  attempt_id: string | null;
  status: string | null;
  score: number | null;
  total_marks: number;
  percentage: number | null;
  passed: number | null;
  started_at: string | null;
  submitted_at: string | null;
  violations_count: number;
  certificate_status: string | null;
  certificate_id: string | null;
  email_status: string | null;
}
