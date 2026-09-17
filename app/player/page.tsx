"use client";

import { useState } from "react";
import JSZip from "jszip";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/common/app-shell";
import { usePlayer, DEFAULT_CHARACTER, type CharacterSounds } from "@/lib/player-context";

export default function PlayerSetupPage() {
  const router = useRouter();
  const [uploadError, setUploadError] = useState("");
  const [audioScanComplete, setAudioScanComplete] = useState(false);
  const { nickname, setNickname, characterImage, characterLabel, characterSoundNames, setCharacter, setCharacters, resetCharacter } = usePlayer();

  const goToGames = () => {
    if (!nickname.trim()) return;
    router.push("/games");
  };

  const handleCharacterUpload = async (file?: File) => {
    if (!file) return;
    setAudioScanComplete(false);
    const isZip = file.name.toLowerCase().endsWith(".zip") || file.type === "application/zip";
    if (isZip) {
      if (file.size > 20 * 1024 * 1024) {
        setUploadError("ZIP 파일은 20MB 이하만 사용할 수 있어요.");
        return;
      }
      try {
        const zip = await JSZip.loadAsync(file);
        const imageEntries = Object.values(zip.files).filter(
          (entry) => !entry.dir && /\.(png|jpe?g|webp|gif)$/i.test(entry.name) && !entry.name.startsWith("__MACOSX/")
        );
        if (!imageEntries.length) {
          setUploadError("ZIP 안에 사용할 수 있는 이미지가 없어요.");
          return;
        }
        const images = await Promise.all(imageEntries.slice(0, 30).map((entry) => entry.async("base64")));
        const soundKeys: Record<string, keyof CharacterSounds> = {
          "bgm.mp3": "bgm",
          "success.mp3": "success",
          "fail.mp3": "fail",
          "end.mp3": "end",
        };
        const soundEntries = Object.values(zip.files).filter((entry) => {
          const fileName = entry.name.split("/").pop()?.toLowerCase() ?? "";
          return !entry.dir && !entry.name.startsWith("__MACOSX/") && fileName in soundKeys;
        });
        const sounds: CharacterSounds = {};
        const soundNames: string[] = [];
        for (const entry of soundEntries) {
          const fileName = entry.name.split("/").pop()?.toLowerCase() ?? "";
          const key = soundKeys[fileName];
          if (!key || sounds[key]) continue;
          sounds[key] = `data:audio/mpeg;base64,${await entry.async("base64")}`;
          soundNames.push(entry.name);
        }
        const mimeFor = (name: string) => {
          const ext = name.split(".").pop()?.toLowerCase();
          if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
          return `image/${ext}`;
        };
        setCharacters(images.map((data, index) => `data:${mimeFor(imageEntries[index].name)};base64,${data}`), `${file.name} · ${images.length}장`, sounds, soundNames);
        setAudioScanComplete(true);
        setUploadError("");
      } catch {
        setAudioScanComplete(false);
        setUploadError("ZIP 파일을 열 수 없어요. 파일이 손상되지 않았는지 확인해주세요.");
      }
      return;
    }
    if (!file.type.startsWith("image/")) {
      setUploadError("이미지 또는 ZIP 파일을 선택해주세요.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("5MB 이하의 이미지를 선택해주세요.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCharacter(String(reader.result), file.name);
      setAudioScanComplete(false);
      setUploadError("");
    };
    reader.readAsDataURL(file);
  };

  return (
    <AppShell activeStep={0}>
      <div className="flow-layout player-layout">
        <div className="flow-intro">
          <span className="screen-count">01 / 03</span>
          <h2>
            플레이어를
            <br />
            설정해주세요.
          </h2>
          <p>게임 결과에 표시할 이름과 캐릭터를 선택하세요.</p>
        </div>
        <div className="flow-panel player-panel">
          <label className="field-label" htmlFor="nickname">
            닉네임
          </label>
          <div className="nickname-field">
            <span>@</span>
            <input id="nickname" value={nickname} maxLength={12} onChange={(e) => setNickname(e.target.value)} autoFocus />
            <small>{nickname.length}/12</small>
          </div>
          {!nickname.trim() && <p className="field-error">닉네임을 입력해주세요.</p>}

          <fieldset>
            <legend className="field-label">캐릭터</legend>
            <div className="character-uploader">
              <div className="avatar-preview">
                <img src={characterImage} alt="선택한 플레이어 캐릭터" />
              </div>
              <div className="avatar-controls">
                <span className="avatar-status">
                  <Check /> 현재 캐릭터
                </span>
                <b>{characterLabel}</b>
                <p>컴퓨터에 있는 사진을 올려 나만의 캐릭터로 사용할 수 있어요.</p>
                <div className="avatar-buttons">
                  <label className="upload-button">
                    <Upload /> 사진 선택
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,.zip,application/zip"
                      onChange={(event) => handleCharacterUpload(event.target.files?.[0])}
                    />
                  </label>
                  {characterImage !== DEFAULT_CHARACTER && (
                    <button type="button" className="reset-character" onClick={() => { resetCharacter(); setAudioScanComplete(false); }}>
                      기본 캐릭터로
                    </button>
                  )}
                </div>
                <small>PNG, JPG, WEBP, GIF · 최대 5MB / ZIP · 최대 20MB</small>
              </div>
            </div>
            {uploadError && (
              <p className="field-error" role="alert">
                {uploadError}
              </p>
            )}
            {audioScanComplete && (
              <p className="flow-message" role="status">
                음원 파일 {characterSoundNames.length}개가 발견됐어요.
                {characterSoundNames.length > 0 && ` (${characterSoundNames.join(", ")}) 나만의 음원과 함께 게임을 플레이해요!`}
              </p>
            )}
          </fieldset>

          <div className="panel-actions">
            <Button variant="ghost" size="lg" asChild>
              <Link href="/">
                <ArrowLeft /> 이전
              </Link>
            </Button>
            <Button size="lg" disabled={!nickname.trim()} onClick={goToGames}>
              게임 고르기 <ArrowRight />
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
