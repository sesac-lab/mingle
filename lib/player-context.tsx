"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export const DEFAULT_CHARACTER = "/default-character.png";
const DEFAULT_CHARACTER_LABEL = "기본 캐릭터";

export type CharacterSounds = {
  bgm?: string;
  success?: string;
  fail?: string;
  end?: string;
};

type PlayerContextValue = {
  nickname: string;
  setNickname: (value: string) => void;
  playerName: string;
  characterImage: string;
  characterImages: string[];
  characterSounds: CharacterSounds;
  characterSoundNames: string[];
  characterLabel: string;
  setCharacter: (image: string, label: string) => void;
  setCharacters: (images: string[], label: string, sounds?: CharacterSounds, soundNames?: string[]) => void;
  resetCharacter: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [nickname, setNickname] = useState("Player01");
  const [characterImage, setCharacterImage] = useState(DEFAULT_CHARACTER);
  const [characterImages, setCharacterImages] = useState<string[]>([DEFAULT_CHARACTER]);
  const [characterSounds, setCharacterSounds] = useState<CharacterSounds>({});
  const [characterSoundNames, setCharacterSoundNames] = useState<string[]>([]);
  const [characterLabel, setCharacterLabel] = useState(DEFAULT_CHARACTER_LABEL);

  const value = useMemo<PlayerContextValue>(
    () => ({
      nickname,
      setNickname,
      playerName: nickname.trim() || "Player01",
      characterImage,
      characterImages,
      characterSounds,
      characterSoundNames,
      characterLabel,
      setCharacter: (image: string, label: string) => {
        setCharacterImage(image);
        setCharacterImages([image]);
        setCharacterSounds({});
        setCharacterSoundNames([]);
        setCharacterLabel(label);
      },
      setCharacters: (images: string[], label: string, sounds = {}, soundNames = []) => {
        const nextImages = images.length ? images : [DEFAULT_CHARACTER];
        setCharacterImage(nextImages[0]);
        setCharacterImages(nextImages);
        setCharacterSounds(sounds);
        setCharacterSoundNames(soundNames);
        setCharacterLabel(label);
      },
      resetCharacter: () => {
        setCharacterImage(DEFAULT_CHARACTER);
        setCharacterImages([DEFAULT_CHARACTER]);
        setCharacterSounds({});
        setCharacterSoundNames([]);
        setCharacterLabel(DEFAULT_CHARACTER_LABEL);
      },
    }),
    [nickname, characterImage, characterImages, characterSounds, characterSoundNames, characterLabel]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
