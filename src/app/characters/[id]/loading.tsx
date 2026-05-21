export default function Loading() {
  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-24">
      <div className="max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
        <div className="h-4 w-40 bg-gray-800 rounded mb-6 animate-pulse" />
        <section className="grid grid-cols-1 md:grid-cols-[260px_1fr] lg:grid-cols-[320px_1fr] gap-6 md:gap-10 mb-12">
          <div className="aspect-[3/4] bg-gray-800 rounded-lg animate-pulse" />
          <div>
            <div className="h-10 w-2/3 bg-gray-800 rounded mb-3 animate-pulse" />
            <div className="h-4 w-1/3 bg-gray-800 rounded mb-5 animate-pulse" />
            <div className="flex gap-2 mb-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-6 w-16 bg-gray-800 rounded-full animate-pulse"
                />
              ))}
            </div>
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-3 w-full bg-gray-800 rounded animate-pulse"
                />
              ))}
            </div>
          </div>
        </section>
        <div className="h-6 w-32 bg-gray-800 rounded mb-4 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] bg-gray-800 rounded animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
