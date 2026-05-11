"use client";

import { useState, useTransition } from "react";
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

export default function DiagnosisForm({ initial }: DiagnosisFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mood, setMood] = useState<Mood | null>(initial?.mood ?? null);
  const [length, setLength] = useState<LengthChoice | null>(
    initial?.length ?? null,
  );
  const [era, setEra] = useState<EraChoice | null>(initial?.era ?? null);

  const canSubmit = mood !== null && length !== null && era !== null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const params = new URLSearchParams({
      mood: mood!,
      length: length!,
      era: era!,
    });
    startTransition(() => {
      router.push(`/diagnosis?${params.toString()}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {/* Q1: ムード */}
      <section>
        <h2 className="flex items-center gap-2 text-white text-lg md:text-xl font-bold mb-4">
          <span className="text-[#E50914]">Q1.</span>
          <span>今の気分は？</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {MOODS.map((option) => {
            const selected = mood === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setMood(option.id)}
                aria-pressed={selected}
                className={`relative overflow-hidden rounded-lg p-4 text-left transition-all duration-200 bg-gradient-to-br ${option.color} ${
                  selected
                    ? "ring-2 ring-[#E50914] scale-[1.02] shadow-xl"
                    : "ring-1 ring-white/10 hover:ring-white/40 opacity-90 hover:opacity-100"
                }`}
              >
                <div className="text-3xl mb-2">{option.emoji}</div>
                <p className="text-white font-bold text-sm md:text-base">
                  {option.label}
                </p>
                <p className="text-gray-300 text-xs mt-1 leading-snug">
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Q2: 長さ */}
      <section>
        <h2 className="flex items-center gap-2 text-white text-lg md:text-xl font-bold mb-4">
          <span className="text-[#E50914]">Q2.</span>
          <span>どのくらいの長さがいい？</span>
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {LENGTHS.map((option) => {
            const selected = length === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setLength(option.id)}
                aria-pressed={selected}
                className={`relative rounded-lg p-4 text-left transition-all duration-200 ${
                  selected
                    ? "bg-white/15 ring-2 ring-[#E50914] shadow-lg"
                    : "bg-white/5 ring-1 ring-white/10 hover:bg-white/10 hover:ring-white/40"
                }`}
              >
                <div className="text-2xl mb-2">{option.emoji}</div>
                <p className="text-white font-bold text-sm">{option.label}</p>
                <p className="text-gray-400 text-[11px] mt-1 leading-snug">
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Q3: 年代 */}
      <section>
        <h2 className="flex items-center gap-2 text-white text-lg md:text-xl font-bold mb-4">
          <span className="text-[#E50914]">Q3.</span>
          <span>観たい年代は？</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ERAS.map((option) => {
            const selected = era === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setEra(option.id)}
                aria-pressed={selected}
                className={`relative rounded-lg p-4 text-center transition-all duration-200 ${
                  selected
                    ? "bg-white/15 ring-2 ring-[#E50914] shadow-lg"
                    : "bg-white/5 ring-1 ring-white/10 hover:bg-white/10 hover:ring-white/40"
                }`}
              >
                <div className="text-2xl mb-1">{option.emoji}</div>
                <p className="text-white font-bold text-sm">{option.label}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* 送信ボタン */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={!canSubmit || pending}
          className={`w-full md:w-auto md:min-w-[280px] mx-auto flex items-center justify-center gap-2 px-8 py-4 rounded-md font-bold text-base md:text-lg transition-colors ${
            canSubmit && !pending
              ? "bg-[#E50914] hover:bg-red-700 text-white"
              : "bg-gray-700 text-gray-400 cursor-not-allowed"
          }`}
        >
          {pending ? (
            <>
              <svg
                className="animate-spin h-5 w-5 text-white"
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
              診断中…
            </>
          ) : (
            <>
              <span>診断する</span>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </>
          )}
        </button>
        {!canSubmit && (
          <p className="text-gray-500 text-xs text-center mt-3">
            3つの質問にすべて答えてください
          </p>
        )}
      </div>
    </form>
  );
}
