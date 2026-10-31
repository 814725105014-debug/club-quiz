import { useState } from 'react';
import { api } from '../lib/api';
import { apiErrorMessage } from '../lib/format';
import type { Question } from '../lib/types';
import { Button, Checkbox, Input, Select, Textarea, useToast } from './ui';

interface OptionDraft {
  text: string;
  isCorrect: boolean;
}

const BLANK_OPTIONS: OptionDraft[] = [
  { text: '', isCorrect: true },
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
];

export function QuestionForm({
  quizId,
  question,
  onSaved,
  onCancel,
}: {
  quizId: string;
  question?: Question;
  onSaved: (question: Question) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(question?.text ?? '');
  const [type, setType] = useState<'single' | 'multi' | 'truefalse'>(question?.type ?? 'single');
  const [marks, setMarks] = useState(question?.marks ?? 1);
  const [negativeMarks, setNegativeMarks] = useState(question?.negative_marks ?? 0);
  const [difficulty, setDifficulty] = useState(question?.difficulty ?? 'medium');
  const [explanation, setExplanation] = useState(question?.explanation ?? '');
  const [imageUrl, setImageUrl] = useState(question?.image_url ?? '');
  const [options, setOptions] = useState<OptionDraft[]>(
    question
      ? question.options.map((o) => ({ text: o.text, isCorrect: Boolean(o.is_correct) }))
      : BLANK_OPTIONS,
  );
  const [multi, setMulti] = useState(Boolean(question?.type === 'multi'));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const setOption = (index: number, patch: Partial<OptionDraft>) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  };

  const toggleCorrect = (index: number) => {
    setOptions((prev) =>
      prev.map((o, i) => {
        if (i === index) return { ...o, isCorrect: !o.isCorrect };
        return multi ? o : { ...o, isCorrect: false };
      }),
    );
  };

  const changeType = (next: 'single' | 'multi' | 'truefalse') => {
    setType(next);
    if (next === 'truefalse') {
      setOptions([
        { text: 'True', isCorrect: options[0]?.isCorrect ?? true },
        { text: 'False', isCorrect: !(options[0]?.isCorrect ?? true) },
      ]);
      setMulti(false);
      return;
    }
    if (next === 'multi') {
      setMulti(true);
      return;
    }
    setMulti(false);
    setOptions((prev) => {
      const firstCorrect = prev.findIndex((o) => o.isCorrect);
      return prev.map((o, i) => ({ ...o, isCorrect: i === (firstCorrect >= 0 ? firstCorrect : 0) }));
    });
  };

  const submit = async () => {
    setError(null);
    if (!text.trim()) {
      setError('Enter the question text.');
      return;
    }
    const cleaned = options.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })).filter((o) => o.text);
    if (cleaned.length < 2) {
      setError('Provide at least two options.');
      return;
    }
    if (!cleaned.some((o) => o.isCorrect)) {
      setError('Mark at least one option as correct.');
      return;
    }
    if (type !== 'multi' && cleaned.filter((o) => o.isCorrect).length > 1) {
      setError('This question type allows a single correct answer.');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        text: text.trim(),
        type,
        marks: Number(marks) || 1,
        negativeMarks: Number(negativeMarks) || 0,
        difficulty,
        explanation: explanation.trim() || undefined,
        imageUrl: imageUrl.trim() || '',
        options: cleaned,
      };
      const response = question
        ? await api.patch<{ question: Question }>(`/admin/questions/${question.id}`, payload)
        : await api.post<{ question: Question }>(`/admin/quizzes/${quizId}/questions`, payload);
      toast(question ? 'Question updated.' : 'Question added.', 'success');
      onSaved(response.question);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <Textarea
        label="Question"
        required
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Which register holds the program counter in the 8051?"
        maxLength={4000}
      />
      <div className="form-grid form-grid-3">
        <Select label="Type" value={type} onChange={(e) => changeType(e.target.value as 'single' | 'multi' | 'truefalse')}>
          <option value="single">Single choice</option>
          <option value="multi">Multiple answers</option>
          <option value="truefalse">True / False</option>
        </Select>
        <Select label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </Select>
        <Input label="Marks" type="number" min={0.25} step={0.25} value={marks} onChange={(e) => setMarks(Number(e.target.value))} />
      </div>
      <div className="form-grid">
        <Input
          label="Negative marks"
          type="number"
          min={0}
          step={0.25}
          value={negativeMarks}
          onChange={(e) => setNegativeMarks(Number(e.target.value))}
          hint="Only applied when negative marking is enabled on the quiz."
        />
        <Input
          label="Image URL (optional)"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>

      <div className="field-label" style={{ marginBottom: 8 }}>
        Options <span className="muted tiny">— {type === 'multi' ? 'tick every correct answer' : 'tick the correct answer'}</span>
      </div>
      <div className="stack" style={{ gap: 8, marginBottom: 14 }}>
        {options.map((option, index) => (
          <div key={index} className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <button
              type="button"
              onClick={() => toggleCorrect(index)}
              aria-label={option.isCorrect ? 'Correct answer' : 'Mark as correct'}
              style={{
                width: 30,
                height: 30,
                flex: 'none',
                borderRadius: multi ? 7 : '50%',
                border: `1.5px solid ${option.isCorrect ? 'var(--green-600)' : 'var(--line-strong)'}`,
                background: option.isCorrect ? 'var(--green-100)' : '#fff',
                color: option.isCorrect ? 'var(--green-600)' : 'var(--muted)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {option.isCorrect ? '✓' : String.fromCharCode(65 + index)}
            </button>
            <input
              className="input"
              value={option.text}
              disabled={type === 'truefalse'}
              onChange={(e) => setOption(index, { text: e.target.value })}
              placeholder={`Option ${String.fromCharCode(65 + index)}`}
              maxLength={2000}
            />
            {type !== 'truefalse' && options.length > 2 ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                aria-label="Remove option"
              >
                ✕
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {type !== 'truefalse' && options.length < 8 ? (
        <Button
          type="button"
          size="sm"
          variant="subtle"
          onClick={() => setOptions((prev) => [...prev, { text: '', isCorrect: false }])}
          style={{ marginBottom: 14 }}
        >
          + Add option
        </Button>
      ) : null}

      <Textarea
        label="Explanation (optional)"
        rows={2}
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        hint="Shown to participants after results are released, never during the attempt."
      />

      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
        <Button variant="subtle" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} loading={busy}>
          {question ? 'Save question' : 'Add question'}
        </Button>
      </div>
      <div style={{ display: 'none' }}>
        <Checkbox label="" checked={false} onChange={() => undefined} />
      </div>
    </div>
  );
}
