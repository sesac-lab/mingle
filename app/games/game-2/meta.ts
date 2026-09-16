import { Dices } from "lucide-react";
import type { GameMeta } from "@/lib/games/types";

// 게임 컨셉이 아직 정해지지 않아 플레이스홀더 값입니다.
// 담당자가 정해지고 컨셉이 확정되면 title/short/description/tag/code/icon/checks를 실제 내용으로 교체하세요.
export const game2Meta: GameMeta = {
  slug: "game-2",
  code: "GAME_02",
  title: "게임 2",
  short: "게임 내용은 준비 중이에요",
  description: "이 자리에 어떤 게임이 들어갈지는 아직 정해지지 않았습니다. 컨셉이 확정되면 이 설명도 함께 업데이트될 예정이에요.",
  tag: "TBD",
  icon: Dices,
  accent: "#ff75bd",
  checks: ["웹캠이 잘 보이는 위치에 앉기", "주변을 밝게 유지하기", "게임 내용은 추후 공개됩니다"],
};
