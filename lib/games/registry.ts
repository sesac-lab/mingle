import { game1Meta } from "@/app/games/game-1/meta";
import { game2Meta } from "@/app/games/game-2/meta";
import { game3Meta } from "@/app/games/game-3/meta";
import type { GameMeta, GameSlug } from "./types";

/**
 * 게임 선택 화면(app/games/page.tsx)이 참조하는 단일 소스.
 * 새 게임을 추가할 때만 여기에 한 줄씩 추가하면 된다 — 이미 등록된 게임의
 * 내용(title/description/checks 등)은 각자 자기 meta.ts만 수정하면 되고
 * 이 파일을 다시 건드릴 필요는 없다.
 */
export const gameRegistry: GameMeta[] = [game1Meta, game2Meta, game3Meta];

export function getGameMeta(slug: GameSlug): GameMeta {
  const meta = gameRegistry.find((game) => game.slug === slug);
  if (!meta) {
    throw new Error(`Unknown game slug: ${slug}`);
  }
  return meta;
}
