export type QuizStatus =
  | 'draft'
  | 'scheduled'
  | 'published'
  | 'active'
  | 'paused'
  | 'ended'
  | 'archived';

export interface QuizRow {
  id: string;
  title: string;
  description: string;
  instructions: string;
  status: QuizStatus;
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
  created_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  archived_at: string | null;
}

export interface QuestionRow {
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
  created_at: string;
  updated_at: string;
}

export interface OptionRow {
  id: string;
  question_id: string;
  label: string;
  text: string;
  is_correct: number;
  sort_order: number;
}

export interface ParticipantRow {
  id: string;
  quiz_id: string;
  email: string;
  name: string;
  reg_number: string | null;
  department: string | null;
  extra: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttemptRow {
  id: string;
  quiz_id: string;
  participant_id: string;
  attempt_no: number;
  status: 'in_progress' | 'submitted' | 'auto_submitted';
  started_at: string;
  deadline_at: string;
  submitted_at: string | null;
  total_marks: number;
  score: number;
  percentage: number;
  passed: number;
  question_order: string | null;
  option_order: string | null;
  violations_count: number;
  auto_submitted: number;
  ip: string | null;
  user_agent: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface AnswerRow {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_options: string;
  is_correct: number | null;
  marks_awarded: number | null;
  marked_for_review: number;
  saved_at: string;
}

export interface CertificateRow {
  id: string;
  certificate_id: string;
  attempt_id: string;
  quiz_id: string;
  participant_id: string;
  status: 'pending' | 'generating' | 'generated' | 'failed';
  pdf_url: string | null;
  drive_file_id: string | null;
  slide_file_id: string | null;
  issued_at: string | null;
  error: string | null;
  email_status: string;
  email_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailRow {
  id: string;
  template_key: string;
  to_email: string;
  actual_recipient: string;
  subject: string;
  body_html: string;
  attempt_id: string | null;
  participant_id: string | null;
  certificate_id: string | null;
  status: 'queued' | 'sent' | 'failed' | 'redirected';
  provider_message_id: string | null;
  error: string | null;
  attempt_count: number;
  created_at: string;
  sent_at: string | null;
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
  created_at: string;
  updated_at: string;
}

export interface ViolationRow {
  id: string;
  attempt_id: string;
  quiz_id: string;
  participant_id: string;
  type: string;
  severity: 'info' | 'warning' | 'serious';
  metadata: string | null;
  handled: number;
  created_at: string;
}

export interface QuizStats {
  totalQuestions: number;
  totalMarks: number;
}
