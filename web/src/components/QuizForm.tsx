import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { apiErrorMessage, fromKolkataInput, toKolkataInput } from '../lib/format';
import type { Quiz } from '../lib/types';
import { Button, Card, Checkbox, Input, Select, Textarea, useToast } from './ui';

export interface QuizInputState {
  title: string;
  description: string;
  instructions: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  passPercentage: number;
  maxAttempts: number;
  randomQuestionCount: string;
  negativeMarking: boolean;
  resultVisibility: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  certificateRule: string;
  certificateMinScore: number;
  certCourseName: string;
  certConductedBy: string;
  certDuration: string;
  certFolderId: string;
  autoEmail: boolean;
  emailSubject: string;
  emailBody: string;
  allowRegistration: boolean;
  allowedEmailDomain: string;
  allowedDepartments: string;
  violationWarnAfter: number;
  violationAutoSubmitCount: number;
}

export function quizToForm(quiz?: Quiz | null): QuizInputState {
  return {
    title: quiz?.title ?? '',
    description: quiz?.description ?? '',
    instructions: quiz?.instructions ?? '',
    startAt: toKolkataInput(quiz?.start_at),
    endAt: toKolkataInput(quiz?.end_at),
    durationMinutes: quiz?.duration_minutes ?? 15,
    passPercentage: quiz?.pass_percentage ?? 40,
    maxAttempts: quiz?.max_attempts ?? 1,
    randomQuestionCount: quiz?.random_question_count ? String(quiz.random_question_count) : '',
    negativeMarking: Boolean(quiz?.negative_marking),
    resultVisibility: quiz?.result_visibility ?? 'after_end',
    shuffleQuestions: Boolean(quiz?.shuffle_questions),
    shuffleOptions: Boolean(quiz?.shuffle_options),
    certificateRule: quiz?.certificate_rule ?? 'pass',
    certificateMinScore: quiz?.certificate_min_score ?? 0,
    certCourseName: quiz?.cert_course_name ?? '',
    certConductedBy: quiz?.cert_conducted_by ?? '',
    certDuration: quiz?.cert_duration ?? '',
    certFolderId: quiz?.cert_folder_id ?? '',
    autoEmail: quiz?.auto_email === undefined ? true : Boolean(quiz.auto_email),
    emailSubject: quiz?.email_subject ?? '',
    emailBody: quiz?.email_body ?? '',
    allowRegistration: quiz?.allow_registration === undefined ? true : Boolean(quiz.allow_registration),
    allowedEmailDomain: quiz?.allowed_email_domain ?? '',
    allowedDepartments: quiz?.allowed_departments ?? '',
    violationWarnAfter: quiz?.violation_warn_after ?? 1,
    violationAutoSubmitCount: quiz?.violation_auto_submit_count ?? 3,
  };
}

export function formToPayload(form: QuizInputState) {
  return {
    title: form.title.trim(),
    description: form.description,
    instructions: form.instructions,
    startAt: form.startAt ? fromKolkataInput(form.startAt) : null,
    endAt: form.endAt ? fromKolkataInput(form.endAt) : null,
    durationMinutes: Number(form.durationMinutes),
    passPercentage: Number(form.passPercentage),
    maxAttempts: Number(form.maxAttempts),
    randomQuestionCount: form.randomQuestionCount ? Number(form.randomQuestionCount) : null,
    negativeMarking: form.negativeMarking,
    resultVisibility: form.resultVisibility,
    shuffleQuestions: form.shuffleQuestions,
    shuffleOptions: form.shuffleOptions,
    certificateRule: form.certificateRule,
    certificateMinScore: Number(form.certificateMinScore),
    certCourseName: form.certCourseName.trim() || null,
    certConductedBy: form.certConductedBy.trim() || null,
    certDuration: form.certDuration.trim() || null,
    certFolderId: form.certFolderId.trim() || null,
    autoEmail: form.autoEmail,
    emailSubject: form.emailSubject.trim() || null,
    emailBody: form.emailBody.trim() || null,
    allowRegistration: form.allowRegistration,
    allowedEmailDomain: form.allowedEmailDomain.trim() || null,
    allowedDepartments: form.allowedDepartments.trim() || null,
    violationWarnAfter: Number(form.violationWarnAfter),
    violationAutoSubmitCount: Number(form.violationAutoSubmitCount),
  };
}

export function QuizForm({
  quiz,
  onSaved,
  onCancel,
  savingLabel = 'Save changes',
}: {
  quiz?: Quiz;
  onSaved: (quiz: Quiz) => void;
  onCancel?: () => void;
  savingLabel?: string;
}) {
  const [form, setForm] = useState<QuizInputState>(() => quizToForm(quiz));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const set = <K extends keyof QuizInputState>(key: K, value: QuizInputState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.title.trim().length < 3) {
      setError('Give the quiz a title of at least 3 characters.');
      return;
    }
    if (form.startAt && form.endAt && form.endAt <= form.startAt) {
      setError('The closing time must be after the opening time.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = formToPayload(form);
      const response = quiz
        ? await api.patch<{ quiz: Quiz }>(`/admin/quizzes/${quiz.id}`, payload)
        : await api.post<{ quiz: Quiz }>('/admin/quizzes', payload);
      toast(quiz ? 'Quiz details saved.' : 'Quiz created.', 'success');
      onSaved(response.quiz);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      {error ? <div className="alert alert-error">{error}</div> : null}

      <Card title="Identity" subtitle="What participants see on the join screen and projector">
        <Input
          label="Quiz title"
          required
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="Embedded Systems Fundamentals — Quiz 1"
          maxLength={200}
        />
        <Textarea
          label="Short description"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          hint="Shown beneath the title on the student landing page."
          rows={2}
          maxLength={4000}
        />
        <Textarea
          label="Instructions"
          value={form.instructions}
          onChange={(e) => set('instructions', e.target.value)}
          hint="Rules displayed before the participant begins. Mention timing, navigation and proctoring."
          rows={4}
          maxLength={6000}
        />
      </Card>

      <div style={{ height: 16 }} />

      <Card title="Schedule & scoring" subtitle="All times are Asia/Kolkata (IST)">
        <div className="form-grid">
          <Input
            label="Registration / quiz opens"
            type="datetime-local"
            value={form.startAt}
            onChange={(e) => set('startAt', e.target.value)}
            hint="Optional — leave blank to open immediately."
          />
          <Input
            label="Closes"
            type="datetime-local"
            value={form.endAt}
            onChange={(e) => set('endAt', e.target.value)}
            hint="Joining closes after this time; running attempts keep their own timer."
          />
          <Input
            label="Duration (minutes)"
            type="number"
            min={1}
            max={600}
            required
            value={form.durationMinutes}
            onChange={(e) => set('durationMinutes', Number(e.target.value))}
          />
          <Input
            label="Pass percentage"
            type="number"
            min={0}
            max={100}
            value={form.passPercentage}
            onChange={(e) => set('passPercentage', Number(e.target.value))}
            hint="Scores at or above this percentage are marked PASS."
          />
          <Input
            label="Attempts allowed"
            type="number"
            min={1}
            max={20}
            value={form.maxAttempts}
            onChange={(e) => set('maxAttempts', Number(e.target.value))}
          />
          <Input
            label="Random question subset"
            type="number"
            min={1}
            placeholder="All questions"
            value={form.randomQuestionCount}
            onChange={(e) => set('randomQuestionCount', e.target.value)}
            hint="Optional — draw only this many questions per attempt."
          />
          <Select
            label="Result visibility"
            value={form.resultVisibility}
            onChange={(e) => set('resultVisibility', e.target.value)}
            hint="Controls what the participant sees after submitting."
          >
            <option value="immediate">Show score immediately</option>
            <option value="after_end">After the quiz closes</option>
            <option value="pass_only">Only pass / fail</option>
            <option value="never">Never show the score</option>
          </Select>
          <div className="span-2">
            <Checkbox
              label="Enable negative marking"
              hint="Deduct each question's negative mark for a wrong answer. Unanswered questions are never penalised."
              checked={form.negativeMarking}
              onChange={(v) => set('negativeMarking', v)}
            />
          </div>
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card title="Attempt experience" subtitle="Shuffling is evaluated by stable option IDs, never by position">
        <div className="form-grid">
          <Checkbox
            label="Shuffle questions"
            hint="Each attempt receives a deterministic, server-side question order."
            checked={form.shuffleQuestions}
            onChange={(v) => set('shuffleQuestions', v)}
          />
          <Checkbox
            label="Shuffle options"
            hint="Option order changes per attempt; correctness lookup stays ID-based."
            checked={form.shuffleOptions}
            onChange={(v) => set('shuffleOptions', v)}
          />
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card
        title="Certificate rule"
        subtitle="Certificates are generated from the existing Google Slides template"
      >
        <div className="form-grid">
          <Select
            label="Issue certificates"
            value={form.certificateRule}
            onChange={(e) => set('certificateRule', e.target.value)}
          >
            <option value="pass">To everyone who passes</option>
            <option value="score_threshold">To scores above a threshold</option>
            <option value="always">To every submission</option>
            <option value="none">Do not issue certificates</option>
          </Select>
          <Input
            label="Minimum score (%) when using a threshold"
            type="number"
            min={0}
            max={100}
            value={form.certificateMinScore}
            onChange={(e) => set('certificateMinScore', Number(e.target.value))}
            disabled={form.certificateRule !== 'score_threshold'}
          />
          <Input
            label="Course name on certificate"
            value={form.certCourseName}
            onChange={(e) => set('certCourseName', e.target.value)}
            hint="Maps to {{COURSE_NAME}} on the template."
            placeholder="Basics of Embedded Systems and Embedded Programming Language"
            className="span-2"
          />
          <Input
            label="Conducted by"
            value={form.certConductedBy}
            onChange={(e) => set('certConductedBy', e.target.value)}
            placeholder="EMBEDX — Embedded Systems & Automation Club"
          />
          <Input
            label="Course duration"
            value={form.certDuration}
            onChange={(e) => set('certDuration', e.target.value)}
            placeholder="30 hours"
          />
          <div className="span-2">
            <Checkbox
              label="Email the certificate automatically"
              hint="Delivered through the configured provider. In test mode every message is redirected to the administrator inbox."
              checked={form.autoEmail}
              onChange={(v) => set('autoEmail', v)}
            />
          </div>
          <Input
            label="Email subject override"
            placeholder="Certificate of Completion"
            value={form.emailSubject}
            onChange={(e) => set('emailSubject', e.target.value)}
          />
          <Input
            label="Certificate folder override (Drive ID)"
            placeholder="Uses the workspace default"
            value={form.certFolderId}
            onChange={(e) => set('certFolderId', e.target.value)}
          />
          <Textarea
            label="Email body override"
            className="span-2"
            rows={4}
            value={form.emailBody}
            onChange={(e) => set('emailBody', e.target.value)}
            hint="Leave blank to use the editable template in Settings. Supports {{PARTICIPANT_NAME}}, {{QUIZ_TITLE}}, {{CERTIFICATE_ID}} and more."
          />
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card title="Registration & integrity" subtitle="Keep registration open until the quiz closes unless you need a cut-off">
        <div className="form-grid">
          <Checkbox
            label="Registration open"
            hint="When off, new participants cannot register but existing attempts continue."
            checked={form.allowRegistration}
            onChange={(v) => set('allowRegistration', v)}
          />
          <Input
            label="Allowed email domain"
            placeholder="trp.srmtrichy.edu.in"
            value={form.allowedEmailDomain}
            onChange={(e) => set('allowedEmailDomain', e.target.value)}
            hint="Optional — blank accepts any valid email address."
          />
          <Textarea
            label="Allowed departments"
            className="span-2"
            rows={2}
            value={form.allowedDepartments}
            onChange={(e) => set('allowedDepartments', e.target.value)}
            hint="Optional comma-separated list. Leave blank to accept any department."
          />
          <Input
            label="Warn participant after N events"
            type="number"
            min={0}
            max={50}
            value={form.violationWarnAfter}
            onChange={(e) => set('violationWarnAfter', Number(e.target.value))}
            hint="Visibility changes, blur and blocked gestures are recorded as events."
          />
          <Input
            label="Auto-submit after N events"
            type="number"
            min={0}
            max={50}
            value={form.violationAutoSubmitCount}
            onChange={(e) => set('violationAutoSubmitCount', Number(e.target.value))}
            hint="0 disables automatic submission. Recorded events remain for review."
          />
        </div>
        <div className="anti-cheat-note" style={{ marginTop: 12 }}>
          <span>⚠</span>
          <span>
            Browser proctoring is a deterrent, not a lockdown. Browsers cannot prevent app switching, screenshots or
            OS-level gestures on mobile. Supervise high-stakes sessions or use a kiosk browser.
          </span>
        </div>
      </Card>

      <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
        {onCancel ? (
          <Button variant="subtle" type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        ) : null}
        <Button variant="primary" type="submit" loading={busy}>
          {savingLabel}
        </Button>
      </div>
    </form>
  );
}
