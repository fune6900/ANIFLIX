import { NextRequest, NextResponse } from "next/server";
import {
  getAnimeMovies,
  getAnimeByGenre,
  getAnimeByKeywords,
  parsePageParam,
  TMDB_MAX_PAGE,
} from "@/lib/tmdb";
import { findGenre } from "@/lib/genres";
import type { TMDbAnime, TMDbMovie } from "@/types/tmdb";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store",
};

export interface NormalizedGridItem {
  id: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: string;
  score: number;
  href: string;
}

export interface BrowseApiResponse {
  items: NormalizedGridItem[];
  page: number;
  totalPages: number;
  totalResults: number;
}

function normalizeAnime(a: TMDbAnime): NormalizedGridItem {
  return {
    id: a.id,
    title: a.name,
    posterPath: a.poster_path,
    backdropPath: a.backdrop_path,
    year: a.first_air_date?.split("-")[0] ?? "",
    score: a.vote_average ?? 0,
    href: `/anime/${a.id}`,
  };
}

function normalizeMovie(m: TMDbMovie): NormalizedGridItem {
  return {
    id: m.id,
    title: m.title,
    posterPath: m.poster_path,
    backdropPath: m.backdrop_path,
    year: m.release_date?.split("-")[0] ?? "",
    score: m.vote_average ?? 0,
    href: `/movie/${m.id}`,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") ?? "";
  const page = parsePageParam(searchParams.get("page"));

  try {
    let items: NormalizedGridItem[] = [];
    let totalPages = 1;
    let totalResults = 0;

    if (type === "movies") {
      const data = await getAnimeMovies(page);
      items = data.results.map(normalizeMovie);
      totalPages = data.total_pages;
      totalResults = data.total_results;
    } else if (type === "genre") {
      const genreId = parseInt(searchParams.get("genreId") ?? "", 10);
      if (isNaN(genreId)) {
        return NextResponse.json(
          { error: "Invalid genreId" },
          { status: 400, headers: SECURITY_HEADERS },
        );
      }
      // ANIME_GENRES に無い ID は弾く。getAnimeByGenre は 1800 秒キャッシュ対象で、
      // 未検証の整数がそのまま with_genres としてキャッシュキーになるため、
      // 任意の ID で R2 の Data Cache にエントリを作られてしまう。
      const genre = findGenre(genreId);
      if (!genre) {
        return NextResponse.json(
          { error: "Invalid genreId" },
          { status: 400, headers: SECURITY_HEADERS },
        );
      }
      let data;
      if (genre.filterType === "keyword" && genre.keyword) {
        const allKeywords = [genre.keyword, ...(genre.extraKeywords ?? [])];
        data = await getAnimeByKeywords(allKeywords, page);
      } else {
        data = await getAnimeByGenre(genreId, page);
      }
      if (data) {
        items = data.results.map(normalizeAnime);
        totalPages = data.total_pages;
        totalResults = data.total_results;
      }
    } else {
      return NextResponse.json(
        { error: "Unknown type" },
        { status: 400, headers: SECURITY_HEADERS },
      );
    }

    const response: BrowseApiResponse = {
      items,
      page,
      totalPages: Math.min(totalPages, TMDB_MAX_PAGE),
      totalResults,
    };

    return NextResponse.json(response, { headers: SECURITY_HEADERS });
  } catch (err) {
    console.error("Browse API error:", err);
    return NextResponse.json(
      { error: "データの取得に失敗しました" },
      { status: 500, headers: SECURITY_HEADERS },
    );
  }
}
