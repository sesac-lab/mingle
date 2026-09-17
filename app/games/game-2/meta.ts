import { ScanFace } from "lucide-react";
import type { GameMeta } from "@/lib/games/types";

export const game2Meta: GameMeta = {
  slug: "game-2",
  code: "SPEED_QUIZ",
  title: "새싹 스피드 퀴즈",
  short: "사진을 보고 60초 안에 정답을 맞혀보세요",
  description: "사진 속 정답을 빠르게 입력하세요. 정답과 오답에 따라 얼굴 위 새싹 캐릭터의 표정이 달라져요.",
  tag: "60 SEC PHOTO QUIZ",
  icon: ScanFace,
  accent: "#ff75bd",
  checks: ["얼굴 전체가 화면에 보이도록 앉기", "키보드를 바로 입력할 수 있게 준비하기", "60초 동안 최대한 빠르게 정답 맞히기"],
};
