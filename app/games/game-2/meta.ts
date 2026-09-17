import { ScanFace } from "lucide-react";
import type { GameMeta } from "@/lib/games/types";

export const game2Meta: GameMeta = {
  slug: "game-2",
  code: "FACE_MASK",
  title: "캐릭터 페이스",
  short: "내 캐릭터로 변신해보세요",
  description: "카메라가 얼굴을 찾으면 선택한 캐릭터가 움직임을 따라 얼굴 위에 나타나요.",
  tag: "FACE TRACKING",
  icon: ScanFace,
  accent: "#ff75bd",
  checks: ["얼굴 전체가 화면에 보이도록 앉기", "얼굴에 그림자가 생기지 않게 주변 밝히기", "한 번에 한 명만 카메라 앞에 서기"],
};
