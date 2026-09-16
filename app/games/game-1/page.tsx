"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Check,
  Clock3,
  CircleGauge,
  Cpu,
  Flag,
  MemoryStick,
  Play,
  RotateCcw,
  Star,
  Trophy,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/common/app-shell";
import { usePlayer } from "@/lib/player-context";
import { useWebcam, useFrameLoop } from "@/lib/webcam";
import { game1Meta } from "./meta";

// TODO(1번 게임 담당자): 이 파일 안에서만 작업하면 됩니다.
// - 게임 컨셉이 정해지면 meta.ts의 title/description/checks/code 등을 먼저 채우기
// - stage === "playing" 화면의 SCORE/TIMER는 더미 값입니다. useFrameLoop의 onFrame 콜백에서
//   실제 인식/채점 로직을 연결하고, 타이머가 끝나거나 조건을 만족하면 setStage("result") 호출
// - 결과 화면(stage === "result")의 더미 값을 실제 채점/리소스 지표로 교체
// - 공통으로 건드릴 일이 있는 건 lib/games/types.ts (GameMeta 계약),
//   lib/player-context.tsx (닉네임/캐릭터), lib/webcam/* (카메라 스트림) 뿐입니다.

type Stage = "ready" | "playing" | "result";

const statusLabel: Record<string, { title: string; description: string; tracking: string }> = {
  idle: { title: "카메라가 꺼져 있어요", description: "버튼을 눌러 웹캠을 켜주세요", tracking: "STANDBY" },
  requesting: { title: "카메라 연결 중...", description: "브라우저의 카메라 권한 요청을 확인해주세요", tracking: "CONNECTING" },
  error: { title: "카메라를 사용할 수 없어요", description: "브라우저 권한 설정을 확인해주세요", tracking: "CAMERA ERROR" },
};

export default function Game1Page() {
  const router = useRouter();
  const { playerName, characterImage } = usePlayer();
  const [stage, setStage] = useState<Stage>("ready");
  const Icon = game1Meta.icon;

  const { videoRef, status, error, start, stop } = useWebcam({ autoStart: false });
  const { fps } = useFrameLoop(videoRef, { enabled: status === "active" });

  useEffect(() => {
    if (stage === "result") {
      stop();
    }
  }, [stage, stop]);

  return (
    <AppShell activeStep={stage === "result" ? 3 : 2} stageKey={stage}>
      <div style={{ "--choice": game1Meta.accent } as React.CSSProperties}>
        {stage === "ready" && (
          <div className="ready-layout">
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
              <span className="screen-count">03 / 03 · {game1Meta.code}</span>
              <div className="ready-title">
                <span>
                  <Icon />
                </span>
                <div>
                  <small>{game1Meta.tag}</small>
                  <h2>{game1Meta.title}</h2>
                </div>
              </div>
              <p className="ready-description">{game1Meta.description}</p>

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
                {game1Meta.checks.map((item) => (
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
              <Button size="lg" variant="outline" onClick={() => setStage("result")}>
                <Flag /> 게임 종료
              </Button>
            </div>
          </div>
        )}

        {stage === "result" && (
          <div className="result-layout">
            <div className="result-celebration">
              <span className="confetti confetti-one" />
              <span className="confetti confetti-two" />
              <span className="confetti confetti-three" />
              <span className="confetti confetti-four" />
              <span className="result-label">GAME COMPLETE!</span>
              <div className="trophy-bubble">
                <Trophy />
              </div>
              <div className="result-player">
                <img src={characterImage} alt="" />
                <span>{playerName}</span>
              </div>
              <h2>
                8,420<small>P</small>
              </h2>
              <div className="result-rank">
                <Star fill="currentColor" /> RANK A
              </div>
              <p>표정을 빠르고 정확하게 따라 했어요!</p>
              <div className="result-actions">
                <Button variant="outline" size="lg" onClick={() => router.push("/games")}>
                  <ArrowLeft /> 다른 게임
                </Button>
                <Button size="lg" onClick={() => setStage("ready")}>
                  <RotateCcw /> 다시 하기
                </Button>
              </div>
            </div>

            <div className="result-report">
              <div className="report-heading">
                <div>
                  <span>PERFORMANCE REPORT</span>
                  <h3>플레이 리포트</h3>
                </div>
                <BarChart3 />
              </div>
              <div className="score-breakdown">
                <div>
                  <span>성공</span>
                  <b>24</b>
                  <small>회</small>
                </div>
                <div>
                  <span>정확도</span>
                  <b>92</b>
                  <small>%</small>
                </div>
                <div>
                  <span>최대 콤보</span>
                  <b>11</b>
                  <small>x</small>
                </div>
              </div>
              <div className="metric-list">
                <div className="metric-row">
                  <span className="metric-icon cpu">
                    <Cpu />
                  </span>
                  <div>
                    <b>CPU Usage</b>
                    <small>Average / Peak</small>
                  </div>
                  <strong>
                    42.3% <em>71.2%</em>
                  </strong>
                </div>
                <div className="metric-row">
                  <span className="metric-icon memory">
                    <MemoryStick />
                  </span>
                  <div>
                    <b>Memory</b>
                    <small>Average / Peak</small>
                  </div>
                  <strong>
                    382 MB <em>451 MB</em>
                  </strong>
                </div>
                <div className="metric-row">
                  <span className="metric-icon fps">
                    <Activity />
                  </span>
                  <div>
                    <b>Frame Rate</b>
                    <small>Average / Minimum</small>
                  </div>
                  <strong>
                    28.7 <em>21.4 FPS</em>
                  </strong>
                </div>
              </div>
              <div className="mini-chart">
                <div className="chart-title">
                  <span>60초 성능 타임라인</span>
                  <em>CPU</em>
                </div>
                <div className="chart-bars" aria-label="게임 중 CPU 사용량 예시 그래프">
                  {[35, 48, 42, 61, 55, 72, 50, 46, 58, 43, 39, 47, 36, 44, 41, 32, 38, 35].map((value, index) => (
                    <i key={index} style={{ height: `${value}%` }} />
                  ))}
                </div>
                <div className="chart-axis">
                  <span>0s</span>
                  <span>30s</span>
                  <span>60s</span>
                </div>
              </div>
              <div className="report-foot">
                <span>
                  <Clock3 /> 60.2 sec
                </span>
                <span>
                  <Video /> 1,724 frames
                </span>
                <span>
                  <CircleGauge /> 17.8 ms avg
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
