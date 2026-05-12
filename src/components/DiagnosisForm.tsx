"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  MOODS,
  LENGTHS,
  ERAS,
  type Mood,
  type LengthChoice,
  type EraChoice,
  type DiagnosisInput,
} from "@/lib/diagnosis";

interface DiagnosisFormProps {
  initial?: Partial<DiagnosisInput>;
}

type StepIndex = 0 | 1 | 2;

const TOTAL_STEPS = 3;
const AUTO_ADVANCE_DELAY = 280;

export default function DiagnosisForm({ initial }: DiagnosisFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const hasInitial =
    initial?.mood && initial?.length && initial?.era ? true : false;

  const [mood, setMood] = useState<Mood | null>(initial?.mood ?? null);
  const [length, setLength] = useState<LengthChoice | null>(
    initial?.length ?? null,
  );
  const [era, setEra] = useState<EraChoice | null>(initial?.era ?? null);

  const [step, setStep] = useState<StepIndex>(0);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [reviewMode, setReviewMode] = useState<boolean>(hasInitial);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function clearScheduled() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function goNext() {
    if (step >= TOTAL_STEPS - 1) return;
    setDirection("forward");
    setStep((s) => (s + 1) as StepIndex);
  }

  function goBack() {
    if (step <= 0) return;
    clearScheduled();
    setDirection("backward");
    setStep((s) => (s - 1) as StepIndex);
  }

  function submit(values: {
    mood: Mood;
    length: LengthChoice;
    era: EraChoice;
  }) {
    const params = new URLSearchParams({
      mood: values.mood,
      length: values.length,
      era: values.era,
    });
    startTransition(() => {
      router.push(`/diagnosis?${params.toString()}`);
    });
  }

  function handleMoodSelect(value: Mood) {
    clearScheduled();
    setMood(value);
    timeoutRef.current = setTimeout(() => goNext(), AUTO_ADVANCE_DELAY);
  }

  function handleLengthSelect(value: LengthChoice) {
    clearScheduled();
    setLength(value);
    timeoutRef.current = setTimeout(() => goNext(), AUTO_ADVANCE_DELAY);
  }

  function handleEraSelect(value: EraChoice) {
    clearScheduled();
    setEra(value);
    if (mood && length) {
      timeoutRef.current = setTimeout(() => {
        submit({ mood, length, era: value });
      }, AUTO_ADVANCE_DELAY + 120);
    }
  }

  function resetAndRestart() {
    clearScheduled();
    setMood(null);
    setLength(null);
    setEra(null);
    setStep(0);
    setDirection("forward");
    setReviewMode(false);
    startTransition(() => {
      router.push("/diagnosis");
    });
  }

  const slideClass =
    direction === "forward"
      ? "animate-slide-in-right"
      : "animate-slide-in-left";

  // 結果表示中（initial 揃い）は要約とリセットだけ
  if (reviewMode) {
    const moodOpt = MOODS.find((m) => m.id === initial?.mood);
    const lengthOpt = LENGTHS.find((l) => l.id === initial?.length);
    const eraOpt = ERAS.find((e) => e.id === initial?.era);
    return (
      <div className="animate-fade-in flex flex-col gap-4">
        <p className="text-gray-300 text-sm">
          現在の診断結果はこちらの選択に基づいている。
        </p>
        <div className="flex flex-wrap gap-2">
          {moodOpt && (
            <span className="inline-flex items-center gap-1 bg-white/10 text-white text-xs md:text-sm px-3 py-1 rounded-full">
              <span>{moodOpt.emoji}</span>
              {moodOpt.label}
            </span>
          )}
          {lengthOpt && (
            <span className="inline-flex items-center gap-1 bg-white/10 text-white text-xs md:text-sm px-3 py-1 rounded-full">
              <span>{lengthOpt.emoji}</span>
              {lengthOpt.label}
            </span>
          )}
          {eraOpt && (
            <span className="inline-flex items-center gap-1 bg-white/10 text-white text-xs md:text-sm px-3 py-1 rounded-full">
              <span>{eraOpt.emoji}</span>
              {eraOpt.label}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={resetAndRestart}
          disabled={pending}
          className="self-start inline-flex items-center gap-2 bg-[#E50914] hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-bold px-5 py-2.5 rounded-md transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v6h6M20 20v-6h-6M5 19A9 9 0 0119 5"
            />
          </svg>
          もう一度診断する
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* プログレスバー */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center justify-between mb-2">
          <p className="text-gray-400 text-xs md:text-sm font-semibold tracking-wider">
            STEP {step + 1} / {TOTAL_STEPS}
          </p>
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-500 ${
                  i < step
                    ? "bg-[#E50914] scale-100"
                    : i === step
                      ? "bg-[#E50914] scale-125 shadow-[0_0_12px_rgba(229,9,20,0.6)]"
                      : "bg-white/15 scale-90"
                }`}
              />
            ))}
          </div>
        </div>
        <div className="relative h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#54b9c5] to-[#E50914] rounded-full transition-all duration-700 ease-out"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {/* ステップ本体 */}
      <div
        key={step}
        className={`${slideClass} min-h-[320px] md:min-h-[360px]`}
      >
        {step === 0 && <StepMood selected={mood} onSelect={handleMoodSelect} />}
        {step === 1 && (
          <StepLength selected={length} onSelect={handleLengthSelect} />
        )}
        {step === 2 && (
          <StepEra
            selected={era}
            onSelect={handleEraSelect}
            pending={pending}
          />
        )}
      </div>

      {/* ナビゲーション */}
      <div className="mt-8 flex items-center justify-between gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={goBack}
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            戻る
          </button>
        ) : (
          <span />
        )}
        <p className="text-gray-600 text-[11px] md:text-xs">
          選択すると自動で次へ進む
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// Step Components
// ──────────────────────────────────────────

function StepHeader({
  index,
  title,
  subtitle,
}: {
  index: number;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6 md:mb-7">
      <div className="inline-flex items-center gap-2 text-[#E50914] text-xs font-black tracking-widest mb-2">
        <span>Q{index}.</span>
      </div>
      <h2 className="text-white text-2xl md:text-3xl font-black leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="text-gray-400 text-xs md:text-sm mt-2">{subtitle}</p>
      )}
    </div>
  );
}

function StepMood({
  selected,
  onSelect,
}: {
  selected: Mood | null;
  onSelect: (value: Mood) => void;
}) {
  return (
    <section>
      <StepHeader
        index={1}
        title="今の気分は？"
        subtitle="観たいテンポを決める。"
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {MOODS.map((option, i) => {
          const isSelected = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              aria-pressed={isSelected}
              style={{ animationDelay: `${i * 60}ms` }}
              className={`group animate-pop-in relative overflow-hidden rounded-xl p-4 md:p-5 text-left transition-all duration-300 bg-gradient-to-br ${option.color} ${
                isSelected
                  ? "ring-2 ring-[#E50914] scale-[1.03] shadow-2xl shadow-[#E50914]/30"
                  : "ring-1 ring-white/10 hover:ring-white/40 hover:scale-[1.02] opacity-90 hover:opacity-100"
              }`}
            >
              <div className="text-4xl mb-2 transition-transform duration-300 group-hover:scale-110">
                {option.emoji}
              </div>
              <p className="text-white font-bold text-sm md:text-base">
                {option.label}
              </p>
              <p className="text-gray-300 text-xs mt-1 leading-snug">
                {option.description}
              </p>
              {isSelected && (
                <span className="absolute top-2 right-2 bg-[#E50914] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pop-in">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StepLength({
  selected,
  onSelect,
}: {
  selected: LengthChoice | null;
  onSelect: (value: LengthChoice) => void;
}) {
  return (
    <section>
      <StepHeader
        index={2}
        title="どのくらいの長さがいい？"
        subtitle="集中して観られる尺を選ぶ。"
      />
      <div className="grid grid-cols-3 gap-3">
        {LENGTHS.map((option, i) => {
          const isSelected = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              aria-pressed={isSelected}
              style={{ animationDelay: `${i * 80}ms` }}
              className={`animate-pop-in relative rounded-xl p-4 md:p-5 text-left transition-all duration-300 ${
                isSelected
                  ? "bg-white/15 ring-2 ring-[#E50914] shadow-xl scale-[1.03]"
                  : "bg-white/5 ring-1 ring-white/10 hover:bg-white/10 hover:ring-white/40 hover:scale-[1.02]"
              }`}
            >
              <div className="text-3xl mb-2">{option.emoji}</div>
              <p className="text-white font-bold text-sm">{option.label}</p>
              <p className="text-gray-400 text-[11px] mt-1 leading-snug">
                {option.description}
              </p>
              {isSelected && (
                <span className="absolute top-2 right-2 bg-[#E50914] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pop-in">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StepEra({
  selected,
  onSelect,
  pending,
}: {
  selected: EraChoice | null;
  onSelect: (value: EraChoice) => void;
  pending: boolean;
}) {
  return (
    <section>
      <StepHeader
        index={3}
        title="観たい年代は？"
        subtitle="選び終えると診断が走る。"
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ERAS.map((option, i) => {
          const isSelected = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              disabled={pending}
              aria-pressed={isSelected}
              style={{ animationDelay: `${i * 70}ms` }}
              className={`animate-pop-in relative rounded-xl p-4 md:p-5 text-center transition-all duration-300 disabled:cursor-not-allowed ${
                isSelected
                  ? "bg-white/15 ring-2 ring-[#E50914] shadow-xl scale-[1.03]"
                  : "bg-white/5 ring-1 ring-white/10 hover:bg-white/10 hover:ring-white/40 hover:scale-[1.02]"
              }`}
            >
              <div className="text-3xl mb-1">{option.emoji}</div>
              <p className="text-white font-bold text-sm">{option.label}</p>
              {isSelected && (
                <span className="absolute top-2 right-2 bg-[#E50914] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pop-in">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
      {pending && (
        <div className="mt-6 flex items-center justify-center gap-2 text-gray-300 text-sm animate-fade-in">
          <svg
            className="animate-spin h-5 w-5 text-[#E50914]"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          診断結果を計算中…
        </div>
      )}
    </section>
  );
}
