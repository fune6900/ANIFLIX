export default function Loading() {
  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-24">
      <div className="max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
        <div className="mb-8">
          <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
        </div>
        <div className="h-12 max-w-xl bg-gray-800 rounded mb-10 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 xl:gap-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[2/3] bg-gray-800 rounded animate-pulse" />
              <div className="mt-2 h-4 bg-gray-800 rounded animate-pulse" />
              <div className="mt-1 h-3 w-3/4 bg-gray-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
