// RelatedCharacters を Suspense で包む時の待機表示（見出し + グリッドの形だけ）

export default function RelatedCharactersSkeleton() {
  return (
    <section
      id="related-characters"
      className="mt-10 scroll-mt-24"
      aria-busy="true"
      aria-label="関連キャラクターを読み込み中"
    >
      <div className="h-6 w-40 mb-4 rounded bg-gray-800 animate-pulse" />
      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-10 3xl:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="aspect-[2/3] rounded bg-gray-800 animate-pulse"
          />
        ))}
      </div>
    </section>
  );
}
