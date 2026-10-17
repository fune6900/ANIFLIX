export interface AnimeStudio {
  id: number;
  name: string;
  emoji: string;
  description: string;
}

export const ANIME_STUDIOS: AnimeStudio[] = [
  { id: 10342, name: "スタジオジブリ",       emoji: "🌿", description: "もののけ姫、千と千尋の神隠し" },
  { id: 2452,  name: "東映アニメーション",   emoji: "⚔️", description: "ドラゴンボール、ワンピース" },
  { id: 2505,  name: "Production I.G",       emoji: "🧠", description: "攻殻機動隊、ハイキュー!!" },
  { id: 7378,  name: "MADHOUSE",             emoji: "♟️", description: "DEATH NOTE、ハンター×ハンター" },
  { id: 10048, name: "京都アニメーション",   emoji: "🎨", description: "けいおん！、ヴァイオレット・エヴァーガーデン" },
  { id: 6594,  name: "A-1 Pictures",         emoji: "🎭", description: "ソードアート・オンライン、かぐや様" },
  { id: 2881,  name: "サンライズ",           emoji: "🤖", description: "ガンダム、コードギアス" },
  { id: 76043, name: "WIT STUDIO",           emoji: "⚡", description: "進撃の巨人、ヴィンランド・サガ" },
  { id: 122822,name: "MAPPA",               emoji: "🔥", description: "呪術廻戦、進撃の巨人 完結編" },
  { id: 37301, name: "ボンズ",               emoji: "💎", description: "鋼の錬金術師FA、僕のヒーローアカデミア" },
  { id: 44820, name: "ufotable",             emoji: "🗡️", description: "鬼滅の刃、Fate/stay night" },
  { id: 858,   name: "TMS Entertainment",   emoji: "🎬", description: "名探偵コナン、メガロボクス" },
];

export function findStudio(id: number): AnimeStudio | undefined {
  return ANIME_STUDIOS.find((s) => s.id === id);
}
