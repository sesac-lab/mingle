"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Activity,
  BarChart3,
  Camera,
  Check,
  ChevronRight,
  CircleGauge,
  Clock3,
  Cpu,
  Gamepad2,
  Hand,
  MemoryStick,
  Play,
  ScanFace,
  RotateCcw,
  Star,
  Sparkles,
  UserRound,
  Video,
  Trophy,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Screen = "welcome" | "player" | "games" | "ready" | "result";

const DEFAULT_CHARACTER = "/default-character.png";

const games = [
  {
    id: 0,
    code: "FACE_01",
    title: "표정 챌린지",
    short: "화면 속 표정을 따라 하세요",
    description: "카메라가 얼굴 표정을 인식합니다. 제한 시간 동안 더 정확하고 빠르게 따라 할수록 높은 점수를 얻어요.",
    tag: "표정 인식",
    icon: ScanFace,
    accent: "#9eff3e",
    checks: ["얼굴 전체가 화면에 보이게 앉기", "주변을 밝게 유지하기", "카메라 정면 바라보기"],
  },
  {
    id: 1,
    code: "MOVE_02",
    title: "모션 캐처",
    short: "움직여서 타깃을 맞히세요",
    description: "손과 상체의 움직임으로 화면 속 타깃을 맞힙니다. 연속으로 성공하면 콤보 점수가 올라가요.",
    tag: "동작 인식",
    icon: Sparkles,
    accent: "#ff75bd",
    checks: ["상체가 화면에 보이게 거리 두기", "움직일 공간 확보하기", "양손을 자유롭게 두기"],
  },
  {
    id: 2,
    code: "POSE_03",
    title: "포즈 미러",
    short: "제시된 포즈를 완성하세요",
    description: "실루엣을 보고 같은 포즈를 만드세요. 관절 위치와 자세 유지 시간을 함께 측정합니다.",
    tag: "포즈 인식",
    icon: Camera,
    accent: "#73d8ff",
    checks: ["전신이 화면에 보이게 서기", "카메라와 2m 정도 거리 두기", "주변 장애물 치우기"],
  },
];

const steps = [
  { key: "player", label: "PLAYER", icon: UserRound },
  { key: "games", label: "SELECT", icon: Gamepad2 },
  { key: "ready", label: "READY", icon: Video },
  { key: "result", label: "RESULT", icon: Trophy },
];

export default function Home() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [nickname, setNickname] = useState("Player01");
  const [characterImage, setCharacterImage] = useState(DEFAULT_CHARACTER);
  const [characterLabel, setCharacterLabel] = useState("기본 캐릭터");
  const [uploadError, setUploadError] = useState("");
  const [selectedGame, setSelectedGame] = useState(0);
  const [message, setMessage] = useState("");

  const playerName = nickname.trim() || "Player01";
  const game = games[selectedGame];
  const GameIcon = game.icon;
  const stepIndex = screen === "player" ? 0 : screen === "games" ? 1 : screen === "ready" ? 2 : screen === "result" ? 3 : -1;

  const goToGames = () => {
    if (!nickname.trim()) return;
    setScreen("games");
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
      setCharacterImage(String(reader.result));
      setCharacterLabel(file.name);
      setUploadError("");
    };
    reader.readAsDataURL(file);
  };

  const resetCharacter = () => {
    setCharacterImage(DEFAULT_CHARACTER);
    setCharacterLabel("기본 캐릭터");
    setUploadError("");
  };

  return (
    <main className="app-shell">
      <div className="grid-bg" aria-hidden="true" />
      <header className="site-header">
        <button className="brand" type="button" onClick={() => setScreen("welcome")} aria-label="처음 화면으로 이동">
          <span className="brand-symbol"><span /></span>
          <span><b>CV ARCADE</b><small>WEBCAM MINI GAMES</small></span>
        </button>

        {screen !== "welcome" && (
          <nav className="stepper" aria-label="게임 시작 단계">
            {steps.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={item.key} className={`step ${index === stepIndex ? "current" : ""} ${index < stepIndex ? "done" : ""}`}>
                  <span>{index < stepIndex ? <Check /> : <Icon />}</span>
                  <small>{item.label}</small>
                </div>
              );
            })}
          </nav>
        )}

        <div className="system-badge"><i /> SYSTEM ONLINE</div>
      </header>

      <section className="screen-stage" key={screen}>
        {screen === "welcome" && (
          <div className="welcome-screen">
            <div className="welcome-copy">
              <div className="kicker">PLAY · TRACK · COMPARE</div>
              <h1>몸으로 플레이하고,<br /><em>성능까지 확인하세요.</em></h1>
              <p>웹캠과 Computer Vision으로 즐기는 1분 미니게임.<br />게임이 끝나면 점수와 시스템 성능을 함께 보여드려요.</p>
              <Button size="lg" className="primary-cta" onClick={() => setScreen("player")}>
                아케이드 입장하기 <ArrowRight />
              </Button>
              <div className="quick-facts">
                <span><Clock3 /> 60초 플레이</span>
                <span><Video /> 웹캠 인터랙션</span>
                <span><CircleGauge /> 실시간 모니터링</span>
              </div>
            </div>
            <div className="welcome-visual" aria-hidden="true">
              <div className="orbit orbit-one" /><div className="orbit orbit-two" />
              <div className="scanner-card">
                <div className="scanner-corners"><i /><i /><i /><i /></div>
                <img className="welcome-character" src={DEFAULT_CHARACTER} alt="" />
                <span>PLAYER<br />DETECTED</span>
                <div className="scan-line" />
              </div>
              <div className="floating-stat stat-a"><small>FPS</small><b>29.4</b></div>
              <div className="floating-stat stat-b"><small>CPU</small><b>42%</b></div>
              <div className="floating-tag">CV / ACTIVE</div>
            </div>
          </div>
        )}

        {screen === "player" && (
          <div className="flow-layout player-layout">
            <div className="flow-intro">
              <span className="screen-count">01 / 03</span>
              <h2>플레이어를<br />설정해주세요.</h2>
              <p>게임 결과에 표시할 이름과 캐릭터를 선택하세요.</p>
            </div>
            <div className="flow-panel player-panel">
              <label className="field-label" htmlFor="nickname">닉네임</label>
              <div className="nickname-field"><span>@</span><input id="nickname" value={nickname} maxLength={12} onChange={(e) => setNickname(e.target.value)} autoFocus /><small>{nickname.length}/12</small></div>
              {!nickname.trim() && <p className="field-error">닉네임을 입력해주세요.</p>}

              <fieldset>
                <legend className="field-label">캐릭터</legend>
                <div className="character-uploader">
                  <div className="avatar-preview"><img src={characterImage} alt="선택한 플레이어 캐릭터" /></div>
                  <div className="avatar-controls">
                    <span className="avatar-status"><Check /> 현재 캐릭터</span>
                    <b>{characterLabel}</b>
                    <p>컴퓨터에 있는 사진을 올려 나만의 캐릭터로 사용할 수 있어요.</p>
                    <div className="avatar-buttons">
                      <label className="upload-button">
                        <Upload /> 사진 선택
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => handleCharacterUpload(event.target.files?.[0])} />
                      </label>
                      {characterImage !== DEFAULT_CHARACTER && <button type="button" className="reset-character" onClick={resetCharacter}>기본 캐릭터로</button>}
                    </div>
                    <small>PNG, JPG, WEBP, GIF · 최대 5MB</small>
                  </div>
                </div>
                {uploadError && <p className="field-error" role="alert">{uploadError}</p>}
              </fieldset>

              <div className="panel-actions">
                <Button variant="ghost" size="lg" onClick={() => setScreen("welcome")}><ArrowLeft /> 이전</Button>
                <Button size="lg" disabled={!nickname.trim()} onClick={goToGames}>게임 고르기 <ArrowRight /></Button>
              </div>
            </div>
          </div>
        )}

        {screen === "games" && (
          <div className="flow-layout games-layout">
            <div className="flow-intro games-intro">
              <span className="screen-count">02 / 03</span>
              <h2>플레이할 게임을<br />선택하세요.</h2>
              <p className="player-greeting"><img src={characterImage} alt="" /><b>{playerName}</b> 님, 어떤 방식으로 움직여볼까요?</p>
            </div>
            <div className="game-grid">
              {games.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.id} type="button" className="select-game-card" style={{ "--choice": item.accent } as React.CSSProperties} onClick={() => { setSelectedGame(item.id); setScreen("ready"); }}>
                    <span className="game-card-top"><small>0{item.id + 1}</small><span>{item.id === 0 ? "결과 예시 포함" : item.tag}</span></span>
                    <span className="select-icon"><Icon /></span>
                    <strong>{item.title}</strong>
                    <p>{item.short}</p>
                    <span className="select-link">선택하기 <ChevronRight /></span>
                  </button>
                );
              })}
              <Button variant="ghost" size="lg" className="games-back" onClick={() => setScreen("player")}><ArrowLeft /> 플레이어 설정으로</Button>
            </div>
          </div>
        )}

        {screen === "ready" && (
          <div className="ready-layout" style={{ "--choice": game.accent } as React.CSSProperties}>
            <div className="camera-preview">
              <div className="camera-bar"><span><i /> CAMERA PREVIEW</span><small>1280 × 720</small></div>
              <div className="camera-body">
                <div className="frame-corners"><i /><i /><i /><i /></div>
                <div className="camera-placeholder"><GameIcon /><b>{game.tag} 영역</b><span>게임 시작 시 웹캠 영상이 표시됩니다</span></div>
                <div className="tracking-label"><span /> TRACKING READY</div>
              </div>
              <div className="camera-stats">
                <span><Cpu /> CPU <b>--%</b></span><span><CircleGauge /> FPS <b>--.-</b></span><span><Clock3 /> INFERENCE <b>-- ms</b></span>
              </div>
            </div>

            <div className="ready-info">
              <span className="screen-count">03 / 03 · {game.code}</span>
              <div className="ready-title"><span><GameIcon /></span><div><small>{game.tag}</small><h2>{game.title}</h2></div></div>
              <p className="ready-description">{game.description}</p>

              <div className="ready-player"><span><img src={characterImage} alt="" /></span><div><small>PLAYER</small><b>{playerName}</b></div><em>60 SEC</em></div>

              <div className="check-list">
                <h3>시작 전 체크</h3>
                {game.checks.map((item) => <div key={item}><span><Check /></span>{item}</div>)}
              </div>

              <div className="ready-actions">
                <Button variant="ghost" size="lg" onClick={() => { setMessage(""); setScreen("games"); }}><ArrowLeft /> 다른 게임</Button>
                <Button size="lg" className="start-game" onClick={() => game.id === 0 ? setScreen("result") : setMessage("여기서 실제 웹캠 게임 화면으로 연결됩니다.")}><Play fill="currentColor" /> {game.id === 0 ? "결과 예시 보기" : "게임 시작"}</Button>
              </div>
              {message && <output className="flow-message" aria-live="polite">{message}</output>}
            </div>
          </div>
        )}

        {screen === "result" && (
          <div className="result-layout">
            <div className="result-celebration">
              <span className="confetti confetti-one" /><span className="confetti confetti-two" /><span className="confetti confetti-three" /><span className="confetti confetti-four" />
              <span className="result-label">GAME COMPLETE!</span>
              <div className="trophy-bubble"><Trophy /></div>
              <div className="result-player"><img src={characterImage} alt="" /><span>{playerName}</span></div>
              <h2>8,420<small>P</small></h2>
              <div className="result-rank"><Star fill="currentColor" /> RANK A</div>
              <p>표정을 빠르고 정확하게 따라 했어요!</p>
              <div className="result-actions">
                <Button variant="outline" size="lg" onClick={() => setScreen("games")}><ArrowLeft /> 다른 게임</Button>
                <Button size="lg" onClick={() => setScreen("ready")}><RotateCcw /> 다시 하기</Button>
              </div>
            </div>

            <div className="result-report">
              <div className="report-heading"><div><span>PERFORMANCE REPORT</span><h3>플레이 리포트</h3></div><BarChart3 /></div>
              <div className="score-breakdown">
                <div><span>성공</span><b>24</b><small>회</small></div>
                <div><span>정확도</span><b>92</b><small>%</small></div>
                <div><span>최대 콤보</span><b>11</b><small>x</small></div>
              </div>
              <div className="metric-list">
                <div className="metric-row"><span className="metric-icon cpu"><Cpu /></span><div><b>CPU Usage</b><small>Average / Peak</small></div><strong>42.3% <em>71.2%</em></strong></div>
                <div className="metric-row"><span className="metric-icon memory"><MemoryStick /></span><div><b>Memory</b><small>Average / Peak</small></div><strong>382 MB <em>451 MB</em></strong></div>
                <div className="metric-row"><span className="metric-icon fps"><Activity /></span><div><b>Frame Rate</b><small>Average / Minimum</small></div><strong>28.7 <em>21.4 FPS</em></strong></div>
              </div>
              <div className="mini-chart">
                <div className="chart-title"><span>60초 성능 타임라인</span><em>CPU</em></div>
                <div className="chart-bars" aria-label="게임 중 CPU 사용량 예시 그래프">
                  {[35,48,42,61,55,72,50,46,58,43,39,47,36,44,41,32,38,35].map((value,index)=><i key={index} style={{height:`${value}%`}} />)}
                </div>
                <div className="chart-axis"><span>0s</span><span>30s</span><span>60s</span></div>
              </div>
              <div className="report-foot"><span><Clock3 /> 60.2 sec</span><span><Video /> 1,724 frames</span><span><CircleGauge /> 17.8 ms avg</span></div>
            </div>
          </div>
        )}
      </section>

      <footer className="site-footer"><span>CV ARCADE / LOCAL PROTOTYPE</span><span>PLAY THE GAME · MONITOR THE MACHINE</span></footer>
    </main>
  );
}
