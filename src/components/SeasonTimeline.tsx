"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { TMDbSeason } from "@/types/tmdb";

/* ─── helpers ─────────────────────────────────────────── */
const IMG = "https://image.tmdb.org/t/p";
const src = (path: string | null, size = "w342") =>
  path ? `${IMG}/${size}${path}` : null;

/** season-number → accent color (cycles every 6) */
const ACCENTS = [
  { hex: "#54b9c5", shadow: "rgba(84,185,197,0.45)" },
  { hex: "#E50914", shadow: "rgba(229,9,20,0.45)" },
  { hex: "#f59e0b", shadow: "rgba(245,158,11,0.45)" },
  { hex: "#8b5cf6", shadow: "rgba(139,92,246,0.45)" },
  { hex: "#10b981", shadow: "rgba(16,185,129,0.45)" },
  { hex: "#f43f5e", shadow: "rgba(244,63,94,0.45)" },
] as const;

type AccentColor = (typeof ACCENTS)[number];

type Status = "aired" | "upcoming";
const getStatus = (d: string | null): Status =>
  !d || new Date(d) > new Date() ? "upcoming" : "aired";

const STATUS_LABEL: Record<Status, string> = {
  aired: "放送済み",
  upcoming: "放送予定",
};
const STATUS_CLS: Record<Status, string> = {
  aired: "bg-gray-700/70 text-gray-300",
  upcoming: "bg-amber-900/60 text-amber-300 border border-amber-700/50",
};

/* ─── scroll reveal hook ─────────────────────────────── */
function useInView(threshold = 0.18) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, set] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          set(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, on };
}

/* ─── spine dot ──────────────────────────────────────── */
function SpineDot({
  accent,
  upcoming,
  on,
}: {
  accent: AccentColor;
  upcoming: boolean;
  on: boolean;
}) {
  return (
    <div className="relative flex items-center justify-center w-5 h-5 flex-shrink-0">
      {/* outer pulse ring — only for aired */}
      {on && !upcoming && (
        <span
          className="absolute inset-0 rounded-full animate-ping opacity-25"
          style={{ backgroundColor: accent.hex }}
        />
      )}
      {/* dot */}
      <div
        className={`relative w-4 h-4 rounded-full border-2 transition-all duration-500 delay-150 ${
          on ? "scale-100 opacity-100" : "scale-0 opacity-0"
        }`}
        style={{
          borderColor: accent.hex,
          backgroundColor: upcoming ? "transparent" : accent.hex,
          boxShadow: on && !upcoming ? `0 0 10px ${accent.shadow}` : "none",
          backgroundImage: upcoming
            ? `radial-gradient(circle at center, transparent 40%, ${accent.hex}33 100%)`
            : "none",
        }}
      />
    </div>
  );
}

/* ─── season card ────────────────────────────────────── */
interface CardProps {
  season: TMDbSeason;
  accent: AccentColor;
  status: Status;
  isLatest: boolean;
  isNext: boolean; // next upcoming
  on: boolean;
  slideDir: "left" | "right";
}

function SeasonCard({
  season,
  accent,
  status,
  isLatest,
  isNext,
  on,
  slideDir,
}: CardProps) {
  const upcoming = status === "upcoming";
  const posterSrc = src(season.poster_path);
  const year = season.air_date?.split("-")[0];
  const dateDisp = season.air_date
    ? season.air_date.replace(/-/g, "/")
    : "放送日未定";

  const slide = on
    ? "opacity-100 translate-x-0"
    : slideDir === "left"
      ? "opacity-0 -translate-x-10"
      : "opacity-0 translate-x-10";

  return (
    <div className={`transition-all duration-700 ease-out delay-100 ${slide}`}>
      <div
        className={`relative rounded-xl overflow-hidden border bg-[#1a1a1a] transition-all duration-300 group
          ${upcoming ? "border-dashed border-gray-600" : "border-gray-700/50 hover:border-gray-500/60"}`}
        style={
          on && !upcoming ? { boxShadow: `0 4px 28px ${accent.shadow}` } : {}
        }
      >
        {/* large watermark season number */}
        <div
          className="pointer-events-none select-none absolute -bottom-2 right-2 text-[80px] font-black leading-none opacity-[0.06] z-0"
          style={{ color: accent.hex }}
          aria-hidden
        >
          {season.season_number}
        </div>

        <div className="relative z-10 p-3 sm:p-4 flex gap-3">
          {/* poster */}
          <div className="flex-shrink-0 w-[60px] sm:w-[72px] rounded-md overflow-hidden shadow-lg bg-gray-800">
            <div className="relative aspect-[2/3]">
              {posterSrc ? (
                <Image
                  src={posterSrc}
                  alt={season.name}
                  fill
                  sizes="72px"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-1">
                  <span className="text-gray-600 text-[10px] text-center">
                    {season.name}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* info */}
          <div className="flex-1 min-w-0">
            {/* badges */}
            <div className="flex flex-wrap gap-1 mb-1.5">
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_CLS[status]}`}
              >
                {STATUS_LABEL[status]}
              </span>
              {isLatest && !upcoming && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#54b9c5]/20 text-[#54b9c5] border border-[#54b9c5]/40">
                  最新
                </span>
              )}
              {isNext && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
                  NEXT
                </span>
              )}
            </div>

            {/* title */}
            <p className="text-white font-bold text-sm leading-snug mb-1 line-clamp-2">
              {season.name}
            </p>

            {/* meta row */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1.5">
              {year && (
                <span
                  className="text-xs font-semibold"
                  style={{ color: accent.hex }}
                >
                  {year}
                </span>
              )}
              {!year && (
                <span className="text-xs text-gray-500">{dateDisp}</span>
              )}
              {season.episode_count > 0 && (
                <span className="text-gray-500 text-xs">
                  {season.episode_count}話
                </span>
              )}
            </div>

            {/* overview */}
            {season.overview ? (
              <p className="text-gray-400 text-[11px] leading-relaxed line-clamp-3">
                {season.overview}
              </p>
            ) : (
              upcoming && (
                <p className="text-gray-600 text-[11px] italic">
                  続報をお待ちください…
                </p>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── timeline item (one row) ───────────────────────── */
interface ItemProps {
  season: TMDbSeason;
  index: number;
  accent: AccentColor;
  status: Status;
  isLatest: boolean;
  isNext: boolean;
  isLast: boolean;
  prevYear: string | null;
}

function TimelineItem({
  season,
  index,
  accent,
  status,
  isLatest,
  isNext,
  isLast,
  prevYear,
}: ItemProps) {
  const { ref, on } = useInView();
  const upcoming = status === "upcoming";
  const year = season.air_date?.split("-")[0] ?? null;
  const showYear = !!year && year !== prevYear;
  // even → card on LEFT desktop side; odd → RIGHT
  const leftSide = index % 2 === 0;

  return (
    <div ref={ref} className="relative">
      {/* ── year pill on spine ── */}
      {showYear && (
        <div
          className={`absolute left-4 md:left-1/2 top-0 md:-translate-x-1/2 z-20
            text-[10px] font-bold px-2 py-0.5 rounded-full border bg-[#141414]
            transition-all duration-500 ${on ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}
          style={{ borderColor: accent.hex, color: accent.hex }}
        >
          {year}
        </div>
      )}

      {/* ── row ── */}
      <div
        className={`flex items-start ${leftSide ? "" : "md:flex-row-reverse"}`}
      >
        {/* desktop: left card slot */}
        <div className="hidden md:flex md:w-[calc(50%-2rem)] justify-end pr-5 pt-2">
          {leftSide && (
            <SeasonCard
              season={season}
              accent={accent}
              status={status}
              isLatest={isLatest}
              isNext={isNext}
              on={on}
              slideDir="left"
            />
          )}
        </div>

        {/* spine: dot + vertical lines */}
        <div className="flex flex-col items-center w-8 md:w-16 flex-shrink-0 pt-2">
          {/* line above dot */}
          <div
            className={`w-px flex-1 min-h-3 transition-opacity duration-500 ${on ? "opacity-100" : "opacity-0"}`}
            style={{
              backgroundImage: upcoming
                ? `repeating-linear-gradient(to bottom, ${accent.hex} 0, ${accent.hex} 4px, transparent 4px, transparent 8px)`
                : `linear-gradient(to bottom, ${accent.hex}80, ${accent.hex})`,
            }}
          />
          <SpineDot accent={accent} upcoming={upcoming} on={on} />
          {/* line below dot */}
          {!isLast && <div className="w-px flex-1 min-h-8 bg-gray-800" />}
        </div>

        {/* right card slot (mobile: always; desktop: only for right-side items) */}
        <div className="flex-1 md:w-[calc(50%-2rem)] pl-3 md:pl-5 pt-2">
          {/* mobile: always render */}
          <div className="md:hidden">
            <SeasonCard
              season={season}
              accent={accent}
              status={status}
              isLatest={isLatest}
              isNext={isNext}
              on={on}
              slideDir="right"
            />
          </div>
          {/* desktop: only for right-side items */}
          {!leftSide && (
            <div className="hidden md:block">
              <SeasonCard
                season={season}
                accent={accent}
                status={status}
                isLatest={isLatest}
                isNext={isNext}
                on={on}
                slideDir="right"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── main export ────────────────────────────────────── */
interface SeasonTimelineProps {
  seasons: TMDbSeason[];
}

export default function SeasonTimeline({ seasons }: SeasonTimelineProps) {
  const sorted = [...seasons]
    .filter((s) => s.season_number > 0)
    .sort((a, b) => {
      if (!a.air_date && !b.air_date) return a.season_number - b.season_number;
      if (!a.air_date) return 1;
      if (!b.air_date) return -1;
      return a.air_date.localeCompare(b.air_date);
    });

  if (sorted.length < 2) return null; // 1シーズンのみなら年表不要

  // latest aired & next upcoming
  const lastAiredIdx = [...sorted]
    .reverse()
    .findIndex((s) => getStatus(s.air_date) === "aired");
  const latestAired =
    lastAiredIdx >= 0 ? sorted[sorted.length - 1 - lastAiredIdx] : null;
  const nextUpcoming =
    sorted.find((s) => getStatus(s.air_date) === "upcoming") ?? null;

  return (
    <section className="mt-10">
      {/* section header */}
      <div className="flex items-baseline gap-3 mb-8">
        <h2 className="text-white font-bold text-lg">ヒストリー</h2>
        <span className="text-gray-600 text-sm">— シリーズ年表</span>
        <span className="ml-auto text-gray-700 text-xs tabular-nums">
          {sorted.length} シーズン
        </span>
      </div>

      {/* timeline */}
      <div className="relative">
        {/* background spine line (full height decoration) */}
        <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-gray-800/70 md:-translate-x-1/2 pointer-events-none" />

        <div className="space-y-4 md:space-y-6">
          {sorted.map((season, i) => {
            const prevYear =
              i > 0 ? (sorted[i - 1].air_date?.split("-")[0] ?? null) : null;
            return (
              <TimelineItem
                key={season.id}
                season={season}
                index={i}
                accent={ACCENTS[i % ACCENTS.length]}
                status={getStatus(season.air_date)}
                isLatest={latestAired?.id === season.id}
                isNext={nextUpcoming?.id === season.id}
                isLast={i === sorted.length - 1}
                prevYear={prevYear}
              />
            );
          })}
        </div>

        {/* bottom cap */}
        <div className="flex justify-center md:justify-start md:pl-[calc(50%-0.5rem)] mt-3">
          <span className="text-gray-700 text-[11px]">
            {nextUpcoming ? "続く…" : "完結"}
          </span>
        </div>
      </div>
    </section>
  );
}
