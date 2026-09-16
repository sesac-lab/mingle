import type { LucideIcon } from "lucide-react";

export type GameSlug = "game-1" | "game-2" | "game-3";

/**
 * 게임 선택 카드 / 준비 화면에서 쓰는 메타데이터 계약.
 * 각 게임 폴더(app/games/<slug>/meta.ts)에서 이 타입으로 export 한다.
 */
export type GameMeta = {
  slug: GameSlug;
  code: string;
  title: string;
  short: string;
  description: string;
  tag: string;
  icon: LucideIcon;
  accent: string;
  checks: string[];
};
