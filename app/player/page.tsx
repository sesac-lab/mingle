"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/common/app-shell";
import { usePlayer, DEFAULT_CHARACTER } from "@/lib/player-context";

export default function PlayerSetupPage() {
  const router = useRouter();
  const [uploadError, setUploadError] = useState("");
  const { nickname, setNickname, characterImage, characterLabel, setCharacter, resetCharacter } = usePlayer();

  const goToGames = () => {
    if (!nickname.trim()) return;
    router.push("/games");
  };

  const handleCharacterUpload = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("이미지 파일을 선택해주세요.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("5MB 이하의 이미지를 선택해주세요.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCharacter(String(reader.result), file.name);
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
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(event) => handleCharacterUpload(event.target.files?.[0])}
                    />
                  </label>
                  {characterImage !== DEFAULT_CHARACTER && (
                    <button type="button" className="reset-character" onClick={resetCharacter}>
                      기본 캐릭터로
                    </button>
                  )}
                </div>
                <small>PNG, JPG, WEBP, GIF · 최대 5MB</small>
              </div>
            </div>
            {uploadError && (
              <p className="field-error" role="alert">
                {uploadError}
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
