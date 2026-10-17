import { redirect } from "next/navigation";
import { isJapaneseAnimeTV, searchAnime } from "@/lib/tmdb";
import { getSearchTitleVariants, stripSeasonSuffix } from "@/lib/title-strip";

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

  const variants = getSearchTitleVariants(title);

  let targetId: number | null = null;
  for (const variant of variants) {
    try {
      const data = await searchAnime(variant);
      const filtered = data.results.filter(isJapaneseAnimeTV);
      if (filtered.length > 0) {
        targetId = filtered[0].id;
        break;
      }
    } catch (error) {
      console.error("[/works/resolve] TMDb error:", error);
    }
  }

  if (targetId !== null) {
    redirect(`/anime/${targetId}`);
  }
  redirect(`/search?q=${encodeURIComponent(stripSeasonSuffix(title))}`);
}
