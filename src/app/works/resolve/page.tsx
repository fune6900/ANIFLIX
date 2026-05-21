import { redirect } from "next/navigation";
import { isJapaneseAnimeTV, searchAnime } from "@/lib/tmdb";

interface PageProps {
  searchParams: Promise<{ title?: string; aniListId?: string }>;
}

function sanitizeTitle(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/[<>"'`]/g, "")
    .trim()
    .slice(0, 200);
}

export default async function WorksResolvePage({ searchParams }: PageProps) {
  const { title: rawTitle = "" } = await searchParams;
  const title = sanitizeTitle(rawTitle);

  if (!title) {
    redirect("/");
  }

  let topId: number | null = null;
  try {
    const data = await searchAnime(title);
    const top = data.results.find(isJapaneseAnimeTV) ?? data.results[0];
    topId = top?.id ?? null;
  } catch (error) {
    console.error("[/works/resolve] TMDb error:", error);
  }

  if (topId !== null) {
    redirect(`/anime/${topId}`);
  }

  redirect(`/search?q=${encodeURIComponent(title)}`);
}
