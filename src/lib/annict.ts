// Annict GraphQL クライアント
// 用途: キャラクター詳細プロフィール（身長/体重/血液型/誕生日/紹介文/引用元 等）の取得
// 認証: ANNICT_ACCESS_TOKEN（.env.local）で Bearer トークン
// 読み取り専用 query のみ使用する

import type {
  AnnictCharacterProfile,
  AnnictSearchCharactersResponse,
} from "@/types/annict";

const ANNICT_ENDPOINT = "https://api.annict.com/graphql";

function resolveAuth(): string {
  const token = process.env.ANNICT_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "Annict authentication failed: ANNICT_ACCESS_TOKEN is not set",
    );
  }
  return `Bearer ${token}`;
}

async function fetchAnnict<T>(
  query: string,
  variables: Record<string, unknown>,
  cacheTime = 3600,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(ANNICT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: resolveAuth(),
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(8000),
      next: { revalidate: cacheTime },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error("Annict API timeout (>8s)");
    }
    throw err;
  }

  if (!response.ok) {
    throw new Error(
      `Annict API error: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

const SEARCH_CHARACTERS_QUERY = `
  query SearchCharacters($names: [String!], $first: Int!) {
    searchCharacters(names: $names, first: $first) {
      nodes {
        id
        annictId
        name
        nameKana
        nameEn
        nickname
        nicknameEn
        birthday
        birthdayEn
        age
        ageEn
        bloodType
        bloodTypeEn
        height
        heightEn
        weight
        weightEn
        nationality
        nationalityEn
        occupation
        occupationEn
        description
        descriptionEn
        descriptionSource
        descriptionSourceEn
        favoriteCharactersCount
      }
    }
  }
`;

/** Annict でキャラ名検索（完全一致 OR）。最初のヒットを返す */
export async function searchAnnictCharacterByName(
  name: string,
): Promise<AnnictCharacterProfile | null> {
  if (!name || !name.trim()) return null;
  try {
    const data = await fetchAnnict<AnnictSearchCharactersResponse>(
      SEARCH_CHARACTERS_QUERY,
      { names: [name.trim()], first: 3 },
    );
    if (data.errors && data.errors.length > 0) {
      // 認証エラー等は呼び出し側で握りつぶせるよう null
      console.error(
        "[annict.searchAnnictCharacterByName]",
        data.errors.map((e) => e.message).join("; "),
      );
      return null;
    }
    const nodes = data.data?.searchCharacters?.nodes ?? [];
    // 完全一致を優先、なければ先頭
    const exact = nodes.find((n) => n.name === name.trim());
    return exact ?? nodes[0] ?? null;
  } catch (err) {
    // トークン未設定や Annict 障害はサイレントに null（詳細ページの一部欠落で済ませる）
    console.error("[annict.searchAnnictCharacterByName]", err);
    return null;
  }
}
