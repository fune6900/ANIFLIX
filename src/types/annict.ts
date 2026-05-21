// Annict GraphQL API 型定義
// docs: https://developers.annict.com/docs/graphql-api/beta/reference
// 用途: キャラクター詳細プロフィール（身長・体重・血液型・誕生日等の Annict 固有情報）の取得

export interface AnnictCharacterProfile {
  id: string;
  annictId: number;
  name: string;
  nameKana: string;
  nameEn: string;
  nickname: string;
  nicknameEn: string;
  birthday: string;
  birthdayEn: string;
  age: string;
  ageEn: string;
  bloodType: string;
  bloodTypeEn: string;
  height: string;
  heightEn: string;
  weight: string;
  weightEn: string;
  nationality: string;
  nationalityEn: string;
  occupation: string;
  occupationEn: string;
  description: string;
  descriptionEn: string;
  descriptionSource: string;
  descriptionSourceEn: string;
  favoriteCharactersCount: number;
}

export interface AnnictSearchCharactersResponse {
  data?: {
    searchCharacters?: {
      nodes: AnnictCharacterProfile[];
    } | null;
  };
  errors?: Array<{ message: string }>;
}
