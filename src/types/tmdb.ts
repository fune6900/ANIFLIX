// TMDb API の型定義

export interface TMDbAnime {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  origin_country: string[];
  /** ISO 639-1 language code (e.g. "ja", "en"). 検索結果のフィルタに使用 */
  original_language?: string;
}

export interface TMDbSearchResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TMDbPersonKnownFor {
  id: number;
  name?: string;
  title?: string;
  media_type: string;
  poster_path: string | null;
  vote_average?: number;
  first_air_date?: string;
  release_date?: string;
  genre_ids?: number[];
  origin_country?: string[];
}

export interface TMDbPerson {
  id: number;
  name: string;
  original_name: string;
  profile_path: string | null;
  known_for_department: string;
  popularity: number;
  known_for?: TMDbPersonKnownFor[];
}

export interface TMDbPersonCreditCast {
  id: number;
  name?: string;
  title?: string;
  character: string;
  media_type: string;
  poster_path: string | null;
  vote_average: number;
  first_air_date?: string;
  release_date?: string;
  genre_ids?: number[];
  origin_country?: string[];
}

export interface TMDbPersonDetail extends TMDbPerson {
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  also_known_as: string[];
  combined_credits?: {
    cast: TMDbPersonCreditCast[];
  };
}

export interface TMDbGenre {
  id: number;
  name: string;
}

export interface TMDbNetwork {
  id: number;
  name: string;
  logo_path: string | null;
}

export interface TMDbCastMember {
  id: number;
  name: string;
  original_name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TMDbCredit {
  cast: TMDbCastMember[];
  crew: {
    id: number;
    name: string;
    job: string;
    department: string;
    profile_path: string | null;
  }[];
}

export interface TMDbSeason {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
  overview: string;
}

export interface TMDbEpisode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  air_date: string | null;
  still_path: string | null;
  vote_average: number;
  vote_count: number;
  runtime: number | null;
}

export interface TMDbSeasonDetail {
  id: number;
  name: string;
  overview: string;
  season_number: number;
  air_date: string | null;
  poster_path: string | null;
  episodes: TMDbEpisode[];
}

export interface TMDbVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

export interface TMDbExternalIds {
  twitter_id: string | null;
  instagram_id: string | null;
  facebook_id: string | null;
  imdb_id: string | null;
}

export interface TMDbWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority: number;
}

export interface TMDbWatchProviderCountry {
  link: string;
  flatrate?: TMDbWatchProvider[];
  buy?: TMDbWatchProvider[];
  rent?: TMDbWatchProvider[];
  ads?: TMDbWatchProvider[];
  free?: TMDbWatchProvider[];
}

export interface TMDbWatchProvidersResponse {
  id: number;
  results: Record<string, TMDbWatchProviderCountry>;
}

export interface TMDbMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  /** ISO 639-1 language code. アニメ判定の補強に使用 */
  original_language?: string;
  /** TMDb の一部エンドポイントでは origin_country が返るため任意で保持 */
  origin_country?: string[];
}

export interface TMDbMovieDetail extends TMDbMovie {
  genres: TMDbGenre[];
  runtime: number | null;
  tagline?: string;
  homepage?: string;
  status: string;
  credits?: TMDbCredit;
  external_ids?: TMDbExternalIds;
  videos?: { results: TMDbVideo[] };
  recommendations?: TMDbSearchResponse<TMDbMovie>;
}

export interface TMDbTVDetail extends TMDbAnime {
  number_of_episodes: number;
  number_of_seasons: number;
  status: string;
  genres: TMDbGenre[];
  networks: TMDbNetwork[];
  tagline?: string;
  homepage?: string;
  credits?: TMDbCredit;
  seasons?: TMDbSeason[];
  last_air_date?: string | null;
  in_production?: boolean;
  next_episode_to_air?: {
    air_date: string;
    season_number: number;
    episode_number: number;
  } | null;
  last_episode_to_air?: {
    air_date: string;
    season_number: number;
    episode_number: number;
  } | null;
}
