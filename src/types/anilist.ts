// AniList GraphQL のキャラクター検索レスポンス型と UI 受け渡し型

export interface AniListCharacterImage {
  large: string | null;
  medium: string | null;
}

export interface AniListCharacterMediaNode {
  id: number;
  idMal: number | null;
  title: {
    native: string | null;
    romaji: string | null;
    english: string | null;
  };
  coverImage: {
    large: string | null;
    extraLarge: string | null;
  };
  seasonYear: number | null;
  countryOfOrigin: string | null;
}

export interface AniListCharacterVoiceActor {
  id: number;
  name: {
    full: string | null;
    native: string | null;
  };
  image: AniListCharacterImage;
}

export interface AniListCharacterMediaEdge {
  node: AniListCharacterMediaNode;
  voiceActors: AniListCharacterVoiceActor[];
}

export interface AniListCharacter {
  id: number;
  name: {
    full: string | null;
    native: string | null;
    alternative: string[] | null;
  };
  image: AniListCharacterImage;
  media: {
    edges: AniListCharacterMediaEdge[];
  };
}

export interface AniListSearchCharactersResponse {
  data?: {
    Page?: {
      characters: AniListCharacter[];
    } | null;
  };
  errors?: Array<{ message: string }>;
}

// --- キャラクター詳細 ---

export interface AniListFuzzyDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface AniListCharacterDetailMediaEdge {
  characterRole: string | null;
  node: AniListCharacterMediaNode;
  voiceActors: AniListCharacterVoiceActor[];
}

export interface AniListCharacterDetail {
  id: number;
  name: {
    full: string | null;
    native: string | null;
    alternative: string[] | null;
  };
  image: AniListCharacterImage;
  description: string | null;
  age: string | null;
  gender: string | null;
  bloodType: string | null;
  dateOfBirth: AniListFuzzyDate | null;
  siteUrl: string | null;
  favourites: number | null;
  media: {
    edges: AniListCharacterDetailMediaEdge[];
  };
}

export interface AniListCharacterDetailResponse {
  data?: {
    Character?: AniListCharacterDetail | null;
  };
  errors?: Array<{ message: string }>;
}

// --- 関連キャラクター（Media.characters 経由） ---

export interface AniListRelatedCharacterNode {
  id: number;
  name: {
    full: string | null;
    native: string | null;
  };
  image: AniListCharacterImage;
}

export interface AniListRelatedCharacterEdge {
  role: string | null;
  node: AniListRelatedCharacterNode;
}

export interface AniListMediaCharactersResponse {
  data?: {
    Media?: {
      characters?: {
        edges: AniListRelatedCharacterEdge[];
      } | null;
    } | null;
  };
  errors?: Array<{ message: string }>;
}

/** UI で扱う正規化済みキャラ検索結果 */
export interface CharacterSearchResult {
  id: number;
  name: string;
  characterImageUrl: string | null;
  work: {
    aniListId: number;
    title: string;
    posterUrl: string | null;
    seasonYear: number | null;
  } | null;
  voiceActor: {
    id: number;
    name: string;
  } | null;
}

// --- Media タイトル検索（フォールバック用 / 詳細ページの AniList ID 解決用） ---

export type AniListMediaType = "ANIME" | "MOVIE";

export interface AniListMediaSearchNode {
  id: number;
  idMal: number | null;
  format: string | null;
  popularity: number;
  countryOfOrigin: string | null;
  isAdult: boolean;
  synonyms: string[];
  title: {
    native: string | null;
    romaji: string | null;
    english: string | null;
  };
}

export interface AniListMediaSearchResponse {
  data?: {
    Page?: {
      media: AniListMediaSearchNode[];
    } | null;
  };
  errors?: Array<{ message: string }>;
}

// --- Staff（声優）→ 演じたキャラ ---

export interface AniListStaffCharacterMediaNode {
  id: number;
  title: {
    native: string | null;
    romaji: string | null;
    english: string | null;
  };
  coverImage: {
    large: string | null;
    extraLarge: string | null;
  };
  seasonYear: number | null;
  popularity: number;
}

export interface AniListStaffCharacterNode {
  id: number;
  name: {
    full: string | null;
    native: string | null;
  };
  image: AniListCharacterImage;
}

export interface AniListStaffCharacterEdge {
  role: string | null;
  node: AniListStaffCharacterNode;
  media: AniListStaffCharacterMediaNode[];
}

export interface AniListStaffSearchResponse {
  data?: {
    Page?: {
      staff: Array<{
        id: number;
        name: {
          full: string | null;
          native: string | null;
        };
        characters?: {
          edges: AniListStaffCharacterEdge[];
        } | null;
      }>;
    } | null;
  };
  errors?: Array<{ message: string }>;
}
