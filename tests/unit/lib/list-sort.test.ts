import { describe, it, expect } from "vitest";
import {
  DEFAULT_LIST_SORT,
  LIST_SORTS,
  listSortLabel,
  movieSortBy,
  parseListSort,
  tvSortBy,
  withSort,
} from "@/lib/list-sort";

/**
 * 一覧の並び替え（#99）。ジャンル一覧と、後続の年代一覧で共用する。
 * 値は URL クエリで持つため、必ずホワイトリストで照合してから TMDb の sort_by に読み替える
 * （sort_by はそのまま Data Cache のキーになる）。
 */

describe("parseListSort", () => {
  it("選択肢は放送年の新しい順 / 古い順の 2 つで、初期値は新しい順", () => {
    expect(LIST_SORTS).toEqual(["year_desc", "year_asc"]);
    expect(DEFAULT_LIST_SORT).toBe("year_desc");
  });

  it("選択肢にある値だけを受け付ける", () => {
    expect(parseListSort("year_asc")).toBe("year_asc");
    expect(parseListSort("year_desc")).toBe("year_desc");
  });

  it.each([
    ["未指定", undefined],
    ["空文字", ""],
    ["TMDb の sort_by をそのまま", "popularity.desc"],
    ["大文字違い", "YEAR_ASC"],
    ["前後に余計な文字", "year_asc "],
    ["プロトタイプのキー", "constructor"],
    ["タグ入り", "<script>"],
  ])("%s は初期値に戻す", (_label, raw) => {
    expect(parseListSort(raw)).toBe("year_desc");
  });

  it("配列（?sort=a&sort=b）は先頭だけを見る", () => {
    expect(parseListSort(["year_asc", "year_desc"])).toBe("year_asc");
  });
});

describe("TMDb の sort_by への読み替え", () => {
  it("TV は放送開始日", () => {
    expect(tvSortBy("year_desc")).toBe("first_air_date.desc");
    expect(tvSortBy("year_asc")).toBe("first_air_date.asc");
  });

  it("映画は公開日", () => {
    expect(movieSortBy("year_desc")).toBe("primary_release_date.desc");
    expect(movieSortBy("year_asc")).toBe("primary_release_date.asc");
  });
});

describe("listSortLabel", () => {
  it("TV は放送年、映画は公開年で表す", () => {
    expect(listSortLabel("year_desc", "anime")).toBe("放送年が新しい順");
    expect(listSortLabel("year_asc", "anime")).toBe("放送年が古い順");
    expect(listSortLabel("year_desc", "movie")).toBe("公開年が新しい順");
    expect(listSortLabel("year_asc", "movie")).toBe("公開年が古い順");
  });
});

describe("withSort", () => {
  it("初期値以外はクエリに載せる", () => {
    expect(withSort("/browse/genre/35", "year_asc")).toBe(
      "/browse/genre/35?sort=year_asc",
    );
    expect(withSort("/browse/genre/35?page=2", "year_asc")).toBe(
      "/browse/genre/35?page=2&sort=year_asc",
    );
  });

  it("初期値はクエリに載せない（URL を短く保つ）", () => {
    expect(withSort("/browse/genre/35?page=2", "year_desc")).toBe(
      "/browse/genre/35?page=2",
    );
  });
});
