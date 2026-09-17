"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Clock3, CircleGauge, Cpu, Flag, Play, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/common/app-shell";
import { usePlayer } from "@/lib/player-context";
import { useWebcam, useFrameLoop } from "@/lib/webcam";
import { game2Meta } from "./meta";
import { useFaceMask } from "./use-face-mask";

// TODO(2번 게임 담당자): 이 파일 안에서만 작업하면 됩니다.
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

const expressions = [
  { id: "smile", label: "신나요", image: "/game-2/characters/sesac-smile.png" },
  { id: "sad", label: "슬퍼요", image: "/game-2/characters/sesac-sad.png" },
  { id: "angry", label: "화났어요", image: "/game-2/characters/sesac-angry.png" },
] as const;

const maskStyle: React.CSSProperties = {
  position: "absolute",
  zIndex: 1,
  pointerEvents: "none",
  transformOrigin: "center",
  filter: "drop-shadow(0 8px 12px rgba(25, 13, 44, .22))",
  transition: "left 100ms linear, top 100ms linear, width 100ms linear, height 100ms linear, transform 100ms linear",
};

const searchingStyle: React.CSSProperties = {
  position: "absolute",
  zIndex: 2,
  left: "50%",
  bottom: 22,
  translate: "-50% 0",
  margin: 0,
  borderRadius: 999,
  padding: "8px 13px",
  background: "rgba(20, 14, 35, .64)",
  backdropFilter: "blur(7px)",
  color: "#fff",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: ".03em",
  whiteSpace: "nowrap",
};

export default function Game2Page() {
  const router = useRouter();
  const { playerName } = usePlayer();
  const [stage, setStage] = useState<Stage>("ready");
  const [expressionId, setExpressionId] = useState<(typeof expressions)[number]["id"]>("smile");
  const Icon = game2Meta.icon;
  const expression = expressions.find((item) => item.id === expressionId) ?? expressions[0];

  const { videoRef, status, error, start, stop } = useWebcam({ autoStart: false });
  const faceMask = useFaceMask(status === "active");
  const { fps } = useFrameLoop(videoRef, {
    enabled: status === "active",
    onFrame: (video, { timestamp }) => faceMask.onFrame(video, timestamp),
  });

  useEffect(() => stop, [stop]);

  const trackingText =
    faceMask.state === "tracking"
      ? "FACE TRACKED"
      : faceMask.state === "searching"
        ? "얼굴을 카메라 중앙에 보여주세요"
        : faceMask.state === "error"
          ? "얼굴 추적 모델을 불러오지 못했어요"
          : "얼굴 추적 준비 중...";

  const maskOverlay = faceMask.position ? (
    <div
      style={{
        ...maskStyle,
        left: faceMask.position.left,
        top: faceMask.position.top,
        width: faceMask.position.width,
        height: faceMask.position.height,
        transform: `rotate(${faceMask.position.rotation}rad)`,
      }}
      aria-hidden="true"
    >
      <img
        src={expression.image}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "fill",
        }}
      />
    </div>
  ) : null;

  return (
    <AppShell activeStep={2} stageKey={stage}>
      {stage === "ready" && (
        <div className="ready-layout" style={{ "--choice": game2Meta.accent } as React.CSSProperties}>
          <div className="camera-preview">
            <div className="camera-bar">
              <span>
                <i /> CAMERA PREVIEW
              </span>
              <small>1280 × 720</small>
            </div>
            <div className="camera-body">
              <video ref={videoRef} className="camera-video" autoPlay playsInline muted hidden={status !== "active"} />
              {status === "active" && maskOverlay}
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
              <div className="tracking-label" style={{ zIndex: 2 }}>
                <span
                  style={
                    status === "active"
                      ? { background: faceMask.state === "tracking" ? "#54cc8a" : faceMask.state === "error" ? "#ff6b78" : "#ffd84d" }
                      : undefined
                  }
                />
                {status === "active" ? trackingText : statusLabel[status]?.tracking ?? statusLabel.idle.tracking}
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
                <Clock3 /> INFERENCE <b>{faceMask.inferenceMs ? `${faceMask.inferenceMs.toFixed(0)} ms` : "-- ms"}</b>
              </span>
            </div>
          </div>

          <div className="ready-info">
            <span className="screen-count">03 / 03 · {game2Meta.code}</span>
            <div className="ready-title">
              <span>
                <Icon />
              </span>
              <div>
                <small>{game2Meta.tag}</small>
                <h2>{game2Meta.title}</h2>
              </div>
            </div>
            <p className="ready-description">{game2Meta.description}</p>

            <div className="ready-player">
              <span>
                <img src={expression.image} alt={`선택한 새싹 캐릭터: ${expression.label}`} />
              </span>
              <div>
                <small>PLAYER</small>
                <b>{playerName}</b>
              </div>
              <em>{expression.label}</em>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, margin: "-12px 0 22px" }}>
              {expressions.map((item) => {
                const selected = expressionId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setExpressionId(item.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 7,
                      minHeight: 42,
                      border: `2px solid ${selected ? game2Meta.accent : "#ded5ed"}`,
                      borderRadius: 13,
                      background: selected ? "#fff0f8" : "#fff",
                      color: "#514763",
                      fontSize: 12,
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    <img src={item.image} alt="" style={{ width: 28, height: 28, objectFit: "contain" }} />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="check-list">
              <h3>시작 전 체크</h3>
              {game2Meta.checks.map((item) => (
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
            {maskOverlay}
            <div className="play-hud">
              <div className="play-hud-item">
                <small>SCORE</small>
                <b>0</b>
              </div>
              <div className="play-hud-timer">
                <Clock3 /> 00:60
              </div>
            </div>
            {!faceMask.position && <p style={searchingStyle}>{trackingText}</p>}
          </div>
          <div className="play-actions" style={{ flexWrap: "wrap", gap: 9 }}>
            {expressions.map((item) => (
              <Button
                key={item.id}
                size="lg"
                variant={expressionId === item.id ? "default" : "outline"}
                onClick={() => setExpressionId(item.id)}
                aria-pressed={expressionId === item.id}
                style={{ minWidth: 110 }}
              >
                {item.label}
              </Button>
            ))}
            <Button size="lg" variant="outline" onClick={() => router.push("/games")}>
              <Flag /> 게임 종료
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
