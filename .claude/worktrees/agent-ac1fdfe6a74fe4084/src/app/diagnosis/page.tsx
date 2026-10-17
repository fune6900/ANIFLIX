import Link from "next/link";
import DiagnosisForm from "@/components/DiagnosisForm";
import DiagnosisResultCard from "@/components/DiagnosisResultCard";
import {
  MOODS,
  LENGTHS,
  ERAS,
  parseDiagnosisInput,
  runDiagnosis,
  type DiagnosisResultItem,
} from "@/lib/diagnosis";

interface DiagnosisPageProps {
  searchParams: Promise<{
    mood?: string;
    length?: string;
    era?: string;
  }>;
}

export const metadata = {
  title: "アニメ診断 | ANIFLIX",
  description:
    "気分・長さ・年代の3つの質問に答えて、あなたにぴったりなアニメを診断します。",
};

export default async function DiagnosisPage({
  searchParams,
}: DiagnosisPageProps) {
  const sp = await searchParams;
  const input = parseDiagnosisInput({
    mood: sp.mood,
    length: sp.length,
    era: sp.era,
  });

  let results: DiagnosisResultItem[] = [];
  let error: string | null = null;

  if (input) {
    try {
      results = await runDiagnosis(input, 5);
    } catch {
      error =
        "診断データの取得に失敗しました。時間をおいて再度お試しください。";
    }
  }

  const mood = input ? MOODS.find((m) => m.id === input.mood) : null;
  const lengthOpt = input ? LENGTHS.find((l) => l.id === input.length) : null;
  const era = input ? ERAS.find((e) => e.id === input.era) : null;

  return (
    <div className="min-h-screen bg-[#141414] text-white pt-24 pb-28">
      <div className="max-w-3xl mx-auto px-4 md:px-8">
        {/* ヘッダー */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E50914]/15 ring-1 ring-[#E50914]/40 text-[#E50914] text-xs font-bold mb-4">
            <span>✦</span>
            <span>ANIFLIX 診断</span>
          </div>
          <h1 className="text-3xl md:text-4xl xl:text-5xl font-black leading-tight">
            あなたにぴったりな
            <br className="md:hidden" />
            アニメを診断
          </h1>
          <p className="text-gray-400 text-sm md:text-base mt-3">
            3つの質問に答えるだけ。相性度（％）付きでおすすめを5作品提案する。
          </p>
        </div>

        {/* フォーム */}
        <div className="bg-white/[0.03] ring-1 ring-white/10 rounded-xl p-5 md:p-8">
          <DiagnosisForm initial={input ?? undefined} />
        </div>

        {/* 結果 */}
        {input && (
          <section className="mt-12 md:mt-16">
            {/* サマリー */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="text-gray-400 text-xs md:text-sm">
                あなたの選択:
              </span>
              {mood && (
                <span className="inline-flex items-center gap-1 bg-white/10 text-white text-xs md:text-sm px-3 py-1 rounded-full">
                  <span>{mood.emoji}</span>
                  {mood.label}
                </span>
              )}
              {lengthOpt && (
                <span className="inline-flex items-center gap-1 bg-white/10 text-white text-xs md:text-sm px-3 py-1 rounded-full">
                  <span>{lengthOpt.emoji}</span>
                  {lengthOpt.label}
                </span>
              )}
              {era && (
                <span className="inline-flex items-center gap-1 bg-white/10 text-white text-xs md:text-sm px-3 py-1 rounded-full">
                  <span>{era.emoji}</span>
                  {era.label}
                </span>
              )}
            </div>

            {/* エラー */}
            {error && (
              <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded mb-6">
                {error}
              </div>
            )}

            {/* 結果ヘッダー */}
            {!error && results.length > 0 && (
              <div className="mb-5 animate-fade-in">
                <h2 className="text-white text-xl md:text-2xl font-black">
                  あなたへのおすすめ
                </h2>
                <p className="text-gray-400 text-xs md:text-sm mt-1">
                  相性度の高い順に上位{results.length}件
                </p>
              </div>
            )}

            {/* カード一覧 */}
            {!error && results.length > 0 && (
              <div className="space-y-3 md:space-y-4">
                {results.map((item, idx) => (
                  <div
                    key={item.anime.id}
                    className="animate-card-in"
                    style={{ animationDelay: `${idx * 120}ms` }}
                  >
                    <DiagnosisResultCard item={item} rank={idx + 1} />
                  </div>
                ))}
              </div>
            )}

            {/* 結果ゼロ */}
            {!error && results.length === 0 && (
              <div className="text-center py-12 bg-white/[0.03] ring-1 ring-white/10 rounded-xl">
                <p className="text-gray-400 text-sm">
                  条件に合う作品が見つかりませんでした。
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  別の気分や年代で試してみてください。
                </p>
              </div>
            )}

            {/* もう一度 */}
            {!error && results.length > 0 && (
              <div className="text-center mt-10">
                <Link
                  href="/diagnosis"
                  className="inline-flex items-center gap-2 text-gray-300 hover:text-white text-sm font-medium transition"
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
                </Link>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
