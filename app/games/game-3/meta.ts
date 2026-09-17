import { FaceSlightlySmilingPlus } from "lucide-react";
import type { GameMeta } from "@/lib/games/types";

export const game3Meta: GameMeta = {
  slug: "game-3",
  code: "GAME_03",
  title: "CHEE-SE!",
  short: "제한 시간 안에 캐릭터와 함께 치-즈!",
  description: "제한 시간 안에 얼굴을 FACE ZONE 안으로 옮겨 캐릭터와 함께 사진을 촬영하는 게임입니다. 빠르게 위치를 맞추고 다양한 포즈를 완성해 가장 멋진 베스트 샷을 남겨보세요!",
  tag: "SPEED",
  icon: FaceSlightlySmilingPlus,
  accent: "#73d8ff",
  checks: [
    "웹캠에 얼굴이 잘 보이도록 준비하기",
    "얼굴이 잘 인식되도록 주변을 밝게 유지하기",
    "제한 시간 안에 FACE ZONE으로 빠르게 이동하기",
    "캐릭터와 함께 다양한 포즈로 베스트 샷 남기기",
  ],
};