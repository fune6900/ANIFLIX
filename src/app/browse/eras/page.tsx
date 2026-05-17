import Link from "next/link";
import { ANIME_ERAS } from "@/lib/eras";

export default function ErasPage() {
  return (
    <div className="min-h-screen bg-[#141414] text-white pt-24 pb-24">
      <div className="max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl xl:text-5xl font-black mb-2">
            年代別アニメ
          </h1>
          <p className="text-gray-400 text-sm xl:text-base">
            放送年代からアニメを探す
          </p>
        </div>

        {/* 年代タイル */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-5 gap-4 xl:gap-5">
          {ANIME_ERAS.map((era) => (
            <Link
              key={era.decade}
              href={`/browse/era/${era.decade}`}
              className={`relative overflow-hidden rounded-lg h-32 md:h-40 xl:h-48 bg-gradient-to-br ${era.color} group`}
            >
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
              <div className="absolute bottom-2 right-3 text-white/10 font-black text-5xl xl:text-7xl leading-none select-none">
                {era.shortLabel}
              </div>
              <div className="relative p-4 h-full flex flex-col justify-between">
                <span className="text-3xl xl:text-4xl">{era.emoji}</span>
                <div>
                  <p className="text-white font-black text-base xl:text-lg leading-tight">
                    {era.label}
                  </p>
                  <p className="text-gray-300 text-[11px] xl:text-xs mt-0.5 line-clamp-1">
                    {era.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
