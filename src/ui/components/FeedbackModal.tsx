import { useState } from 'react';
import { persistFeedback, type FeedbackInsertData } from '../../lib/roundPersistence';
import type { ScoreBreakdown } from '../../scoring/types';

interface FeedbackModalProps {
  roundId: string;
  score: ScoreBreakdown;
  multiplier: number;
  onClose: () => void;
  onSubmitted: () => void;
}

type FairnessVote = 'too_low' | 'about_right' | 'too_high';
type Difficulty = 'easy' | 'medium' | 'hard' | 'impossible';
type ScoreComponent = 'direction' | 'magnitude' | 'turningPoints' | 'volatility';

const FAIRNESS_OPTIONS: { value: FairnessVote; label: string }[] = [
  { value: 'too_low', label: 'Too Low' },
  { value: 'about_right', label: 'About Right' },
  { value: 'too_high', label: 'Too High' },
];

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'impossible', label: 'Impossible' },
];

const COMPONENT_OPTIONS: { value: ScoreComponent; label: string }[] = [
  { value: 'direction', label: 'Direction' },
  { value: 'magnitude', label: 'Magnitude' },
  { value: 'turningPoints', label: 'Turning Pts' },
  { value: 'volatility', label: 'Volatility' },
];

export function FeedbackModal({ roundId, score, multiplier, onClose, onSubmitted }: FeedbackModalProps) {
  const [fairness, setFairness] = useState<FairnessVote | null>(null);
  const [selfScore, setSelfScore] = useState<number>(Math.round(score.total));
  const [confidence, setConfidence] = useState<number>(3);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [wouldBet, setWouldBet] = useState<boolean | null>(null);
  const [wrongComponents, setWrongComponents] = useState<ScoreComponent[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const canSubmit = fairness !== null && difficulty !== null && wouldBet !== null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(false);

    const data: FeedbackInsertData = {
      roundId,
      fairnessVote: fairness,
      selfAssessedScore: selfScore,
      confidence,
      wrongComponents,
      difficultyPerception: difficulty,
      wouldBetRealMoney: wouldBet,
      comment: comment.trim() || null,
    };

    const ok = await persistFeedback(data);
    setSubmitting(false);

    if (ok) {
      onSubmitted();
    } else {
      setSubmitError(true);
    }
  };

  const toggleComponent = (c: ScoreComponent) => {
    setWrongComponents((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  };

  return (
    <div
      className="fixed right-0 top-0 bottom-0 flex items-start justify-end"
      style={{ zIndex: 60, pointerEvents: 'none' }}
    >
      <div
        className="dtc-panel p-4 w-72 animate-slide-in space-y-3 overflow-y-auto m-2 mt-14"
        style={{ maxHeight: 'calc(100vh - 72px)', pointerEvents: 'auto', boxShadow: 'var(--shadow-md)' }}
      >
        {/* Header */}
        <div>
          <h2 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            Quick Feedback
          </h2>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Score: <span className="dtc-data" style={{
              color: score.total >= 60 ? 'var(--green)' : score.total >= 40 ? 'var(--accent)' : 'var(--red)',
            }}>{score.total.toFixed(1)}</span>
            {' / '}
            {multiplier.toFixed(2)}x
          </p>
        </div>

        {/* 1. Fairness vote */}
        <Field label="Was this score fair?">
          <PillGroup
            options={FAIRNESS_OPTIONS}
            selected={fairness}
            onSelect={setFairness}
          />
        </Field>

        {/* 2. Self-assessed score */}
        <Field label={`What score would you give yourself? ${selfScore}`}>
          <div className="relative">
            <input
              type="range"
              min={0}
              max={100}
              value={selfScore}
              onChange={(e) => setSelfScore(Number(e.target.value))}
              className="w-full accent-amber-500"
              style={{ height: '4px' }}
            />
            {/* Reference marker for algorithm score */}
            <div
              className="absolute top-0 h-4 w-px"
              style={{
                left: `${score.total}%`,
                background: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </Field>

        {/* 3. Confidence */}
        <Field label="How confident in your assessment?">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setConfidence(n)}
                className="w-7 h-7 rounded text-[10px] dtc-data"
                style={{
                  background: n <= confidence ? 'var(--accent-soft)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${n <= confidence ? 'var(--accent)' : 'var(--border)'}`,
                  color: n <= confidence ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </Field>

        {/* 4. Difficulty */}
        <Field label="How hard was this market to predict?">
          <PillGroup
            options={DIFFICULTY_OPTIONS}
            selected={difficulty}
            onSelect={setDifficulty}
          />
        </Field>

        {/* 5. Would bet */}
        <Field label="Would you bet real money at this score?">
          <div className="flex gap-2">
            <PillButton
              label="Yes"
              selected={wouldBet === true}
              onClick={() => setWouldBet(true)}
            />
            <PillButton
              label="No"
              selected={wouldBet === false}
              onClick={() => setWouldBet(false)}
            />
          </div>
        </Field>

        {/* 6. Wrong component (optional) */}
        <Field label="Which score feels most wrong? (optional)">
          <div className="flex flex-wrap gap-1.5">
            {COMPONENT_OPTIONS.map((opt) => (
              <PillButton
                key={opt.value}
                label={opt.label}
                selected={wrongComponents.includes(opt.value)}
                onClick={() => toggleComponent(opt.value)}
              />
            ))}
          </div>
        </Field>

        {/* 7. Comment (optional) */}
        <Field label="">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Anything else? (optional)"
            className="w-full h-8 px-3 text-xs rounded"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </Field>

        {/* Submit */}
        <div className="space-y-2 pt-1">
          {submitError && (
            <p className="text-[10px]" style={{ color: 'var(--red)' }}>
              Failed to save — try again
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="dtc-button-primary w-full h-8 text-xs font-semibold"
          >
            {submitting ? 'Saving...' : 'Submit Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

function PillGroup<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: { value: T; label: string }[];
  selected: T | null;
  onSelect: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <PillButton
          key={opt.value}
          label={opt.label}
          selected={selected === opt.value}
          onClick={() => onSelect(opt.value)}
        />
      ))}
    </div>
  );
}

function PillButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="h-6 px-2.5 text-[10px] rounded"
      style={{
        background: selected ? 'var(--accent-soft)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        color: selected ? 'var(--accent)' : 'var(--text-secondary)',
        fontWeight: selected ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}
