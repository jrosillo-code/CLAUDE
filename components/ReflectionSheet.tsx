"use client";

import { useEffect, useMemo, useState } from "react";
import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import {
  attachOptions,
  questionsForTrip,
  rewardLines,
  REFLECTION_VISIBILITY_LABEL,
  type InterviewQuestion,
} from "@/lib/interview";
import { track } from "@/lib/analytics";
import type { ReflectionAnswer, Visibility } from "@/lib/types";

// The 60-second debrief: one question per screen, tap-through, done before
// the airport wifi drops. Questions are adaptive (lib/interview.ts skips what
// pins and ratings already answered), answers save verbatim as the user
// types them, and each can anchor to a specific pin or the whole trip.
//
// Voice-ready: answers carry `source: "text" | "voice"` and all capture goes
// through the one <AnswerInput> below — a transcribe-to-text hook can be
// dropped in there without touching the flow.

export default function ReflectionSheet({
  tripId,
  onClose,
}: {
  tripId: string;
  onClose: () => void;
}) {
  const trips = useStore((s) => s.trips);
  const pins = useStore((s) => s.pins);
  const topPlaces = useStore((s) => s.topPlaces);
  const reflections = useStore((s) => s.reflections);
  const viewerId = useStore((s) => s.viewerId);
  const startReflection = useStore((s) => s.startReflection);
  const saveReflectionAnswer = useStore((s) => s.saveReflectionAnswer);
  const removeReflectionAnswer = useStore((s) => s.removeReflectionAnswer);
  const setReflectionVisibility = useStore((s) => s.setReflectionVisibility);
  const completeReflection = useStore((s) => s.completeReflection);
  const reopenReflection = useStore((s) => s.reopenReflection);
  const deleteReflection = useStore((s) => s.deleteReflection);

  const trip = trips.find((t) => t.id === tripId);
  const reflection = reflections.find((r) => r.tripId === tripId && r.userId === viewerId);

  const questions = useMemo(
    () => (trip ? questionsForTrip({ trip, pins, topPlaces }) : []),
    [trip, pins, topPlaces]
  );
  const attach = useMemo(() => (trip ? attachOptions(trip, pins) : []), [trip, pins]);

  // Resume where they left off: first question without a saved answer.
  const answered = new Set(reflection?.answers.map((a) => a.questionId) ?? []);
  const firstOpen = questions.findIndex((q) => !answered.has(q.id));
  const [step, setStep] = useState(() =>
    reflection?.status === "complete" ? questions.length : firstOpen === -1 ? questions.length : firstOpen
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  // After saving: the honest reward — where these exact answers now surface.
  const [savedLines, setSavedLines] = useState<string[] | null>(null);

  // Lifecycle events (ids only, never text): opened fresh vs resumed a draft.
  useEffect(() => {
    if (!trip || trip.userId !== viewerId) return;
    if (reflection?.status === "draft" && reflection.answers.length > 0) {
      track("debrief_resumed", { reflectionId: reflection.id, tripId, viewerId });
    } else if (!reflection || reflection.status === "draft") {
      track("debrief_started", { reflectionId: reflection?.id, tripId, viewerId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!trip || trip.userId !== viewerId) return null;
  const done = step >= questions.length;
  const q = done ? null : questions[step];
  const existing = q ? reflection?.answers.find((a) => a.questionId === q.id) : undefined;

  function ensureId(): string | null {
    return reflection?.id ?? startReflection(tripId);
  }

  function save(answer: Omit<ReflectionAnswer, "prompt" | "questionId"> & { skipEmpty?: boolean }) {
    if (!q) return;
    const id = ensureId();
    if (!id) return;
    if (!answer.text.trim() && !answer.scale) {
      // Skipped: clear any earlier answer so "skip" really means skip.
      if (existing) removeReflectionAnswer(id, q.id);
    } else {
      saveReflectionAnswer(id, {
        questionId: q.id,
        prompt: q.prompt,
        text: answer.text,
        pinId: answer.pinId,
        scale: answer.scale,
        source: answer.source,
      });
    }
    setStep((v) => v + 1);
  }

  function finish(visibility: Visibility) {
    const id = ensureId();
    if (!id) return;
    setReflectionVisibility(id, visibility);
    completeReflection(id);
    track("visibility_selected", { reflectionId: id, tripId, viewerId, visibility });
    track("debrief_completed", { reflectionId: id, tripId, viewerId });
    const saved = useStore.getState().reflections.find((r) => r.id === id);
    setSavedLines(
      rewardLines({ answers: saved?.answers ?? [], visibility, trip: trip!, pins })
    );
    track("reward_viewed", { reflectionId: id, tripId, viewerId });
  }

  // Abandonment: closing the sheet while the debrief is still a draft.
  function close() {
    const r = useStore.getState().reflections.find(
      (x) => x.tripId === tripId && x.userId === viewerId
    );
    if (r && r.status === "draft") {
      track("debrief_abandoned", {
        reflectionId: r.id,
        tripId,
        viewerId,
        count: r.answers.length,
      });
    }
    onClose();
  }

  return (
    <Sheet onClose={close}>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-2xl">Trip debrief</h2>
            <p className="mt-0.5 truncate text-sm text-ink-3">
              {trip.title} · under a minute, your words become your friends&apos; answers
            </p>
          </div>
          <button
            onClick={close}
            aria-label="Close — your progress is saved"
            title="Close — your progress is saved"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-paper-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {/* Progress dots */}
        <div className="mt-3 flex items-center gap-1.5">
          {questions.map((qq, i) => (
            <button
              key={qq.id}
              onClick={() => setStep(i)}
              aria-label={`Question ${i + 1}`}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < step ? "bg-accent" : i === step ? "bg-ink" : "bg-line"
              }`}
            />
          ))}
          <button
            onClick={() => setStep(questions.length)}
            aria-label="Finish"
            className={`h-1.5 w-6 rounded-full transition-colors ${done ? "bg-ink" : "bg-line"}`}
          />
        </div>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-5 py-5">
        {savedLines && (
          <div className="animate-fade">
            <div className="text-2xl">🌱</div>
            <h3 className="mt-2 font-display text-xl">Saved — your words are working now</h3>
            <ul className="mt-3 space-y-2">
              {savedLines.map((line, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-2xl border border-line bg-paper-2/60 p-3 text-sm leading-relaxed text-ink-2"
                >
                  <span className="mt-px shrink-0 text-accent">✦</span>
                  {line}
                </li>
              ))}
            </ul>
            <button
              onClick={onClose}
              className="mt-4 w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-paper"
            >
              Done
            </button>
          </div>
        )}

        {!savedLines && q && (
          <QuestionStep
            key={q.id}
            question={q}
            existing={existing}
            attach={attach}
            onBack={step > 0 ? () => setStep((v) => v - 1) : undefined}
            onSkip={() => save({ text: "", pinId: null, source: "text" })}
            onSave={(a) => save(a)}
          />
        )}

        {!savedLines && done && (
          <FinishStep
            answers={reflection?.answers ?? []}
            questions={questions}
            visibility={reflection?.visibility ?? "friends"}
            isComplete={reflection?.status === "complete"}
            onEdit={(i) => {
              if (reflection?.status === "complete") reopenReflection(reflection.id);
              setStep(i);
            }}
            onFinish={finish}
            confirmDelete={confirmDelete}
            onAskDelete={() => setConfirmDelete(true)}
            onDelete={() => {
              if (reflection) deleteReflection(reflection.id);
              onClose();
            }}
            onCancelDelete={() => setConfirmDelete(false)}
          />
        )}
      </div>
    </Sheet>
  );
}

// ── One question ────────────────────────────────────────────────────────────

function QuestionStep({
  question,
  existing,
  attach,
  onBack,
  onSkip,
  onSave,
}: {
  question: InterviewQuestion;
  existing?: ReflectionAnswer;
  attach: { pinId: string | null; label: string }[];
  onBack?: () => void;
  onSkip: () => void;
  onSave: (a: { text: string; pinId: string | null; scale?: "yes" | "maybe" | "no"; source: "text" }) => void;
}) {
  const [text, setText] = useState(existing?.text ?? "");
  const [pinId, setPinId] = useState<string | null>(existing?.pinId ?? null);
  const [scale, setScale] = useState<"yes" | "maybe" | "no" | undefined>(existing?.scale);
  const canNext = text.trim().length > 0 || scale !== undefined;

  return (
    <div className="animate-fade">
      <h3 className="font-display text-xl leading-snug">{question.prompt}</h3>

      {question.kind === "scale" && (
        <div className="mt-3 flex gap-2">
          {(["yes", "maybe", "no"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setScale(scale === v ? undefined : v)}
              className={`flex-1 rounded-full py-2 text-sm font-semibold capitalize transition-colors ${
                scale === v ? "bg-ink text-paper" : "bg-paper-2 text-ink-2 hover:bg-line"
              }`}
            >
              {v === "yes" ? "Yes" : v === "maybe" ? "Maybe" : "No"}
            </button>
          ))}
        </div>
      )}

      <AnswerInput value={text} placeholder={question.placeholder} onChange={setText} />

      {/* Anchor: whole trip or one of its pins */}
      {attach.length > 1 && (
        <div className="mt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
            This is about
          </div>
          <div className="no-scrollbar mt-1.5 flex gap-1.5 overflow-x-auto">
            {attach.map((o) => (
              <button
                key={o.pinId ?? "trip"}
                onClick={() => setPinId(o.pinId)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  pinId === o.pinId ? "bg-accent text-paper" : "bg-paper-2 text-ink-2 hover:bg-line"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center gap-2">
        {onBack && (
          <button
            onClick={onBack}
            className="rounded-full bg-paper-2 px-4 py-2.5 text-sm font-semibold text-ink-2"
          >
            Back
          </button>
        )}
        <button
          onClick={onSkip}
          className="rounded-full bg-paper-2 px-4 py-2.5 text-sm font-semibold text-ink-3"
        >
          Skip
        </button>
        <button
          onClick={() => canNext && onSave({ text, pinId, scale, source: "text" })}
          disabled={!canNext}
          className={`ml-auto rounded-full px-6 py-2.5 text-sm font-semibold transition-colors ${
            canNext ? "bg-accent text-paper" : "bg-line text-ink-3"
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
}

/**
 * The single capture surface. Text today; a voice path later records, sends
 * to transcription, then calls onChange with the transcript and flips the
 * answer's `source` to "voice" — nothing else in the flow changes.
 */
function AnswerInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      className="mt-3 w-full resize-none rounded-2xl bg-paper-2 px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-ink/15"
    />
  );
}

// ── Review + visibility + submit ────────────────────────────────────────────

function FinishStep({
  answers,
  questions,
  visibility,
  isComplete,
  onEdit,
  onFinish,
  confirmDelete,
  onAskDelete,
  onDelete,
  onCancelDelete,
}: {
  answers: ReflectionAnswer[];
  questions: InterviewQuestion[];
  visibility: Visibility;
  isComplete: boolean;
  onEdit: (questionIndex: number) => void;
  onFinish: (v: Visibility) => void;
  confirmDelete: boolean;
  onAskDelete: () => void;
  onDelete: () => void;
  onCancelDelete: () => void;
}) {
  const [vis, setVis] = useState<Visibility>(visibility);
  const byId = new Map(answers.map((a) => [a.questionId, a]));

  return (
    <div className="animate-fade">
      <h3 className="font-display text-xl">Your words, your call</h3>
      <p className="mt-1 text-sm text-ink-3">
        These are saved exactly as you wrote them — friends see them quoted with your name when
        they ask about these places.
      </p>

      <div className="mt-3 space-y-2">
        {questions.map((qq, i) => {
          const a = byId.get(qq.id);
          return (
            <button
              key={qq.id}
              onClick={() => onEdit(i)}
              className="w-full rounded-2xl border border-line bg-paper-2/60 p-3 text-left transition-colors hover:bg-paper-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                  {qq.prompt}
                </span>
                <span className="shrink-0 text-[11px] text-ink-3 underline-offset-2 hover:underline">
                  Edit
                </span>
              </div>
              {a ? (
                <p className="mt-1 text-sm leading-relaxed text-ink-2">
                  {a.scale && (
                    <span className="mr-1.5 rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-bold capitalize text-paper">
                      {a.scale}
                    </span>
                  )}
                  {a.text || <span className="text-ink-3">(no note)</span>}
                </p>
              ) : (
                <p className="mt-1 text-sm text-ink-3">Skipped</p>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
          Who can see this
        </div>
        <div className="mt-1.5 flex gap-2">
          {(["private", "friends", "public"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVis(v)}
              className={`flex-1 rounded-full py-2 text-xs font-semibold transition-colors ${
                vis === v ? "bg-ink text-paper" : "bg-paper-2 text-ink-2 hover:bg-line"
              }`}
            >
              {REFLECTION_VISIBILITY_LABEL[v]}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => onFinish(vis)}
        className="mt-4 w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-paper"
      >
        {isComplete ? "Save changes" : "Save debrief"}
      </button>

      {isComplete && !confirmDelete && (
        <button
          onClick={onAskDelete}
          className="mt-2 w-full rounded-full py-2 text-xs font-semibold text-ink-3 hover:text-accent"
        >
          Delete this debrief
        </button>
      )}
      {confirmDelete && (
        <div className="mt-2 flex items-center gap-2 rounded-2xl border border-line bg-paper-2/60 p-3">
          <span className="min-w-0 flex-1 text-xs text-ink-2">
            Delete your answers for this trip? Friends lose them as evidence too.
          </span>
          <button
            onClick={onDelete}
            className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-paper"
          >
            Delete
          </button>
          <button
            onClick={onCancelDelete}
            className="shrink-0 rounded-full bg-paper px-3 py-1.5 text-xs font-semibold text-ink-2 ring-1 ring-line"
          >
            Keep
          </button>
        </div>
      )}
    </div>
  );
}
