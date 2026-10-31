export interface RegistrationField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'select' | 'tel';
  required: boolean;
  options: string[] | null;
  patternHint: string | null;
  mapsToSheetColumn: string | null;
}

export interface PublicQuiz {
  id: string;
  title: string;
  description: string;
  instructions: string;
  status: string;
  durationMinutes: number;
  passPercentage: number;
  startAt: string | null;
  endAt: string | null;
  joinCode: string;
  allowRegistration: number;
  resultVisibility: string;
  certificateRule: string;
  questionCount: number;
  totalMarks: number;
  announcement: string | null;
  timezone: string;
}

export interface PublicQuizResponse {
  quiz: PublicQuiz;
  registration: { open: boolean; reason: string | null; startsInSeconds: number | null };
  fields: RegistrationField[];
  participantCount: number;
}

export interface JoinResponse {
  participantToken: string;
  participant: { id: string; name: string; email: string; regNumber: string | null; department: string | null };
  quiz: { id: string; title: string; joinCode: string };
  attemptsUsed: number;
  maxAttempts: number;
  openAttemptId: string | null;
}

export interface AttemptQuestion {
  id: string;
  text: string;
  type: 'single' | 'multi' | 'truefalse';
  marks: number;
  imageUrl: string | null;
  options: { id: string; label: string; text: string }[];
}

export interface AttemptState {
  quiz: {
    id: string;
    title: string;
    instructions: string;
    durationMinutes: number;
    resultVisibility: string;
    totalQuestions: number;
  };
  attempt: {
    id: string;
    status: string;
    startedAt: string;
    deadlineAt: string;
    serverNow: string;
    remainingSeconds: number;
    totalMarks: number;
    violations: number;
    warning: string | null;
  };
  questions: AttemptQuestion[];
  answers: Record<string, { selected: string[]; markedForReview: boolean }>;
  submitted: boolean;
  result?: ResultPayload;
}

export interface ResultPayload {
  attemptId: string;
  status: string;
  submittedAt: string | null;
  score: number | null;
  totalMarks: number;
  percentage: number | null;
  passed: boolean | null;
  visibility: string;
  message: string;
  certificate: {
    status: string;
    certificateId: string | null;
    pdfUrl: string | null;
    emailStatus: string;
  } | null;
  violations: number;
  durationSeconds: number | null;
}

export interface ViolationResponse {
  accepted: boolean;
  count: number;
  autoSubmitted: boolean;
  warning: string | null;
}

const PARTICIPANT_KEY = (code: string) => `qp.participant.${code.toUpperCase()}`;
const ATTEMPT_KEY = (code: string) => `qp.attempt.${code.toUpperCase()}`;

export const studentStore = {
  participantToken(code: string): string | null {
    try {
      return localStorage.getItem(PARTICIPANT_KEY(code));
    } catch {
      return null;
    }
  },
  attemptToken(code: string): string | null {
    try {
      return localStorage.getItem(ATTEMPT_KEY(code));
    } catch {
      return null;
    }
  },
  saveParticipant(code: string, token: string) {
    try {
      localStorage.setItem(PARTICIPANT_KEY(code), token);
    } catch {
      /* private mode */
    }
  },
  saveAttempt(code: string, token: string) {
    try {
      localStorage.setItem(ATTEMPT_KEY(code), token);
    } catch {
      /* private mode */
    }
  },
  clearAttempt(code: string) {
    try {
      localStorage.removeItem(ATTEMPT_KEY(code));
    } catch {
      /* private mode */
    }
  },
};
