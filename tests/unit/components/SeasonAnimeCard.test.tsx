import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import SeasonAnimeCard from "@/components/SeasonAnimeCard";
import type { SeasonalEntry } from "@/lib/seasonal-anime";
import type { AniListMedia } from "@/lib/anilist";
import type { TMDbAnime, TMDbMovie } from "@/types/tmdb";

/**
 * シーズン一覧のカード。
 *
 * TMDb の TV・TMDb の映画・TMDb に無い作品（AniList のデータ）の 3 種類を
 * 描き分ける。**詳細ページを持たない作品にリンクを張らないこと**が要。
 */

function tvEntry(overrides: Partial<TMDbAnime> = {}): SeasonalEntry {
  return {
    kind: "tv",
    anime: {
      id: 42,
      name: "テレビ作品",
      original_name: "TV Work",
      overview: "",
      poster_path: "/poster.jpg",
      backdrop_path: "/backdrop.jpg",
      first_air_date: "2026-07-05",
      vote_average: 8.4,
      vote_count: 100,
      genre_ids: [],
      origin_country: ["JP"],
      ...overrides,
    },
  };
}

function movieEntry(overrides: Partial<TMDbMovie> = {}): SeasonalEntry {
  return {
    kind: "movie",
    movie: {
      id: 77,
      title: "劇場版 作品",
      original_title: "Movie Work",
      overview: "",
      poster_path: "/mposter.jpg",
      backdrop_path: "/mbackdrop.jpg",
      release_date: "2026-08-10",
      vote_average: 7.2,
      vote_count: 50,
      genre_ids: [],
      ...overrides,
    },
  };
}

function unlistedEntry(overrides: Partial<AniListMedia> = {}): SeasonalEntry {
  return {
    kind: "unlisted",
    media: {
      id: 999,
      idMal: null,
      title: { native: "ショート作品", romaji: "Short Work", english: null },
      coverImage: {
        large: "https://s4.anilist.co/file/anilistcdn/cover.jpg",
        extraLarge: "https://s4.anilist.co/file/anilistcdn/cover-xl.jpg",
        color: null,
      },
      bannerImage: "https://s4.anilist.co/file/anilistcdn/banner.jpg",
      averageScore: 78,
      popularity: 100,
      startDate: { year: 2026, month: 7, day: 3 },
      endDate: { year: null, month: null, day: null },
      status: "RELEASING",
      format: "TV_SHORT",
      episodes: 12,
      countryOfOrigin: "JP",
      isAdult: false,
      synonyms: [],
      siteUrl: "",
      ...overrides,
    },
  };
}

afterEach(() => cleanup());

describe("SeasonAnimeCard", () => {
  describe("リンク先", () => {
    it("TV 作品はアニメ詳細へ飛ばす", () => {
      render(<SeasonAnimeCard entry={tvEntry()} />);

      const links = screen.getAllByRole("link");
      expect(links[0]).toHaveAttribute("href", "/anime/42");
    });

    it("劇場版は映画詳細へ飛ばす", () => {
      render(<SeasonAnimeCard entry={movieEntry()} />);

      const links = screen.getAllByRole("link");
      expect(links[0]).toHaveAttribute("href", "/movie/77");
    });

    it("TMDb に無い作品にはリンクを張らない", () => {
      // 詳細ページが存在しないので、押せてしまうと 404 に落ちる
      render(<SeasonAnimeCard entry={unlistedEntry()} />);

      expect(screen.queryAllByRole("link")).toHaveLength(0);
    });
  });

  describe("タイトル", () => {
    it.each([
      ["TV 作品", tvEntry(), "テレビ作品"],
      ["劇場版", movieEntry(), "劇場版 作品"],
      ["TMDb に無い作品", unlistedEntry(), "ショート作品"],
    ])("%s の名前を出す", (_label, entry, expected) => {
      render(<SeasonAnimeCard entry={entry} />);
      expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
    });

    it("AniList に原題が無ければローマ字を使う", () => {
      render(
        <SeasonAnimeCard
          entry={unlistedEntry({
            title: { native: null, romaji: "Short Work", english: null },
          })}
        />,
      );
      expect(screen.getAllByText("Short Work").length).toBeGreaterThan(0);
    });
  });

  describe("スコア", () => {
    it("TMDb は 10 点満点をそのまま出す", () => {
      render(<SeasonAnimeCard entry={tvEntry()} />);
      expect(screen.getAllByText("★ 8.4").length).toBeGreaterThan(0);
    });

    it("AniList の 100 点満点は 10 点満点へ直す", () => {
      // 揃えないと「78.0」のような見た目になる
      render(<SeasonAnimeCard entry={unlistedEntry({ averageScore: 78 })} />);
      expect(screen.getAllByText("★ 7.8").length).toBeGreaterThan(0);
    });

    it("スコアが無ければ出さない", () => {
      render(<SeasonAnimeCard entry={unlistedEntry({ averageScore: null })} />);
      expect(screen.queryByText(/★/)).not.toBeInTheDocument();
    });
  });

  describe("放送時期", () => {
    it("TV 作品は初回放送月を出す", () => {
      render(<SeasonAnimeCard entry={tvEntry()} />);
      expect(screen.getAllByText("2026年7月〜").length).toBeGreaterThan(0);
    });

    it("劇場版は公開月を出す", () => {
      render(<SeasonAnimeCard entry={movieEntry()} />);
      expect(screen.getAllByText("2026年8月〜").length).toBeGreaterThan(0);
    });

    it("TMDb に無い作品は AniList の開始日を出す", () => {
      render(<SeasonAnimeCard entry={unlistedEntry()} />);
      expect(screen.getAllByText("2026年7月〜").length).toBeGreaterThan(0);
    });
  });

  it("ON AIR バッジを出さない（#89）", () => {
    render(<SeasonAnimeCard entry={tvEntry()} />);
    expect(screen.queryByText("ON AIR")).not.toBeInTheDocument();
  });
});
