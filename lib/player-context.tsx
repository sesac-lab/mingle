"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export const DEFAULT_CHARACTER = "/default-character.png";
const DEFAULT_CHARACTER_LABEL = "기본 캐릭터";

type PlayerContextValue = {
  nickname: string;
  setNickname: (value: string) => void;
  playerName: string;
  characterImage: string;
  characterLabel: string;
  setCharacter: (image: string, label: string) => void;
  resetCharacter: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [nickname, setNickname] = useState("Player01");
  const [characterImage, setCharacterImage] = useState(DEFAULT_CHARACTER);
  const [characterLabel, setCharacterLabel] = useState(DEFAULT_CHARACTER_LABEL);

  const value = useMemo<PlayerContextValue>(
    () => ({
      nickname,
      setNickname,
      playerName: nickname.trim() || "Player01",
      characterImage,
      characterLabel,
      setCharacter: (image: string, label: string) => {
        setCharacterImage(image);
        setCharacterLabel(label);
      },
      resetCharacter: () => {
        setCharacterImage(DEFAULT_CHARACTER);
        setCharacterLabel(DEFAULT_CHARACTER_LABEL);
      },
    }),
    [nickname, characterImage, characterLabel]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
