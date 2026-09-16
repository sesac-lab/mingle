"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Clock3, CircleGauge, Cpu, Flag, Play, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/common/app-shell";
import { usePlayer } from "@/lib/player-context";
import { useWebcam, useFrameLoop } from "@/lib/webcam";
import { game3Meta } from "./meta";

// TODO(3번 게임 담당자): 이 파일 안에서만 작업하면 됩니다.
// - 게임 컨셉이 정해지면 meta.ts의 title/description/checks/code 등을 먼저 채우기
// - stage === "playing" 화면의 SCORE/TIMER는 더미 값입니다. useFrameLoop의 onFrame 콜백에서
//   실제 인식/채점 로직을 연결하세요
// - 결과 화면이 아직 없습니다. "게임 종료" 버튼을 결과 화면으로 연결하세요
//   (app/games/game-1/page.tsx의 stage === "result" 참고)
// - 공통으로 건드릴 일이 있는 건 lib/games/types.ts (GameMeta 계약),
//   lib/player-context.tsx (닉네임/캐릭터), lib/webcam/* (카메라 스트림) 뿐입니다.

type Stage = "ready" | "playing";

const statusLabel: Record<string, { title: string; description: string; tracking: string }> = {
  idle: { title: "카메라가 꺼져 있어요", description: "버튼을 눌러 웹캠을 켜주세요", tracking: "STANDBY" },
  requesting: { title: "카메라 연결 중...", description: "브라우저의 카메라 권한 요청을 확인해주세요", tracking: "CONNECTING" },
  error: { title: "카메라를 사용할 수 없어요", description: "브라우저 권한 설정을 확인해주세요", tracking: "CAMERA ERROR" },
};

export default function Game3Page() {
  const router = useRouter();
  const { playerName, characterImage } = usePlayer();
  const [stage, setStage] = useState<Stage>("ready");
  const Icon = game3Meta.icon;

  const { videoRef, status, error, start } = useWebcam({ autoStart: false });
  const { fps } = useFrameLoop(videoRef, { enabled: status === "active" });

  return (
    <AppShell activeStep={2} stageKey={stage}>
      {stage === "ready" && (
        <div className="ready-layout" style={{ "--choice": game3Meta.accent } as React.CSSProperties}>
          <div className="camera-preview">
            <div className="camera-bar">
              <span>
                <i /> CAMERA PREVIEW
              </span>
              <small>1280 × 720</small>
            </div>
            <div className="camera-body">
              <video ref={videoRef} className="camera-video" autoPlay playsInline muted hidden={status !== "active"} />
              <div className="frame-corners">
                <i />
                <i />
                <i />
                <i />
              </div>
              {status !== "active" && (
                <div className={`camera-placeholder${status === "error" ? " is-error" : ""}`}>
                  <Icon />
                  <b>{statusLabel[status]?.title ?? statusLabel.idle.title}</b>
                  <span>{status === "error" && error ? error : statusLabel[status]?.description ?? statusLabel.idle.description}</span>
                  {status !== "requesting" && (
                    <Button size="lg" className="camera-start-button" onClick={start}>
                      <Video fill="currentColor" /> {status === "error" ? "다시 시도" : "웹캠 켜기"}
                    </Button>
                  )}
                </div>
              )}
              <div className="tracking-label">
                <span /> {status === "active" ? "TRACKING READY" : statusLabel[status]?.tracking ?? statusLabel.idle.tracking}
              </div>
            </div>
            <div className="camera-stats">
              <span>
                <Cpu /> CPU <b>--%</b>
              </span>
              <span>
                <CircleGauge /> FPS <b>{status === "active" ? fps.toFixed(1) : "--.-"}</b>
              </span>
              <span>
                <Clock3 /> INFERENCE <b>-- ms</b>
              </span>
            </div>
          </div>

          <div className="ready-info">
            <span className="screen-count">03 / 03 · {game3Meta.code}</span>
            <div className="ready-title">
              <span>
                <Icon />
              </span>
              <div>
                <small>{game3Meta.tag}</small>
                <h2>{game3Meta.title}</h2>
              </div>
            </div>
            <p className="ready-description">{game3Meta.description}</p>

            <div className="ready-player">
              <span>
                <img src={characterImage} alt="" />
              </span>
              <div>
                <small>PLAYER</small>
                <b>{playerName}</b>
              </div>
              <em>실제 게임 시간으로 변경하기</em>
            </div>

            <div className="check-list">
              <h3>시작 전 체크</h3>
              {game3Meta.checks.map((item) => (
                <div key={item}>
                  <span>
                    <Check />
                  </span>
                  {item}
                </div>
              ))}
            </div>

            <div className="ready-actions">
              <Button variant="ghost" size="lg" onClick={() => router.push("/games")}>
                <ArrowLeft /> 다른 게임
              </Button>
              <Button size="lg" className="start-game" disabled={status !== "active"} onClick={() => setStage("playing")}>
                <Play fill="currentColor" /> 게임 시작
              </Button>
            </div>
            {status !== "active" && <p className="ready-description">웹캠을 켜야 게임을 시작할 수 있어요.</p>}
          </div>
        </div>
      )}

      {stage === "playing" && (
        <div className="play-layout">
          <div className="play-camera">
            <video ref={videoRef} className="camera-video" autoPlay playsInline muted />
            <div className="play-hud">
              <div className="play-hud-item">
                <small>SCORE</small>
                <b>0</b>
              </div>
              <div className="play-hud-timer">
                <Clock3 /> 00:60
              </div>
            </div>
            <div className="play-hint">여기에 실제 게임 화면(타깃, 가이드, 인식 결과 등)을 그리면 됩니다.</div>
          </div>
          <div className="play-actions">
            <Button size="lg" variant="outline" onClick={() => router.push("/games")}>
              <Flag /> 게임 종료
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
