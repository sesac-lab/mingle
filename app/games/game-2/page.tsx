"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Clock3, CircleGauge, Cpu, Flag, Info, Play, RotateCcw, Send, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/common/app-shell";
import { usePlayer } from "@/lib/player-context";
import { useFrameLoop, useWebcam } from "@/lib/webcam";
import { game2Meta } from "./meta";
import { questions, type QuizQuestion } from "./questions";
import { useFaceMask } from "./use-face-mask";
import styles from "./game-2.module.css";

type Stage = "ready" | "countdown" | "playing" | "result";
type Expression = "smile" | "sad" | "angry";
type Feedback = { result: "correct" | "wrong" | "image-error"; message: string; answer?: string };
type ResourceLevel = "good" | "ok" | "warn" | "unknown";
type ResourceDetail = { id: string; label: string; value: string; level: ResourceLevel; what: string; meaning: string };

const levelLabel: Record<ResourceLevel, string> = { good: "원활", ok: "보통", warn: "주의", unknown: "" };
const levelClass: Record<ResourceLevel, string> = { good: "badgeGood", ok: "badgeOk", warn: "badgeWarn", unknown: "" };

type QuizAttempt = {
  questionId: string;
  submittedAnswer: string;
  correctAnswer: string;
  result: "correct" | "wrong";
  scoreDelta: number;
  totalScore: number;
  comboAfter: number;
  responseTimeMs: number;
  submittedAtMs: number;
};

const GAME_DURATION_MS = 60_000;
const QUESTION_TIME_LIMIT_MS = 3_000;
const CORRECT_FEEDBACK_MS = 350;
const WRONG_FEEDBACK_MS = 800;

const expressionImages: Record<Expression, string> = {
  smile: "/game-2/characters/sesac-smile.png",
  sad: "/game-2/characters/sesac-sad.png",
  angry: "/game-2/characters/sesac-angry.png",
};

const statusLabel: Record<string, { title: string; description: string; tracking: string }> = {
  idle: { title: "카메라가 꺼져 있어요", description: "버튼을 눌러 웹캠을 켜주세요", tracking: "STANDBY" },
  requesting: { title: "카메라 연결 중...", description: "브라우저의 카메라 권한 요청을 확인해주세요", tracking: "CONNECTING" },
  error: { title: "카메라를 사용할 수 없어요", description: "브라우저 권한 설정을 확인해주세요", tracking: "CAMERA ERROR" },
};

function getMaskStyle(): React.CSSProperties {
  const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return {
    position: "absolute",
    zIndex: 1,
    pointerEvents: "none",
    transformOrigin: "center",
    filter: "drop-shadow(0 8px 12px rgba(25, 13, 44, .22))",
    transition: reduceMotion ? "none" : "left 100ms linear, top 100ms linear, width 100ms linear, height 100ms linear, transform 100ms linear",
  };
}

function shuffleQuestions(source: QuizQuestion[], previousId?: string) {
  const shuffled = [...source];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  if (shuffled.length > 1 && shuffled[0]?.id === previousId) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }
  return shuffled;
}

function formatTime(milliseconds: number) {
  return `00:${Math.ceil(milliseconds / 1000).toString().padStart(2, "0")}`;
}

function formatDuration(milliseconds: number) {
  return `${(milliseconds / 1000).toFixed(2)}초`;
}

export default function Game2Page() {
  const router = useRouter();
  const { playerName, characterSounds } = usePlayer();
  const [stage, setStage] = useState<Stage>("ready");
  const [countdown, setCountdown] = useState<3 | 2 | 1 | "START">(3);
  const [deck, setDeck] = useState<QuizQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [expression, setExpression] = useState<Expression>("smile");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [locked, setLocked] = useState(false);
  const [remainingMs, setRemainingMs] = useState(GAME_DURATION_MS);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [consecutiveWrong, setConsecutiveWrong] = useState(0);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [averageFps, setAverageFps] = useState(0);
  const [memoryMb, setMemoryMb] = useState<number | null>(null);
  const [longTaskCount, setLongTaskCount] = useState<number | null>(null);
  const [blockingTimeMs, setBlockingTimeMs] = useState<number | null>(null);
  const [showResourceDetail, setShowResourceDetail] = useState(false);
  const modalCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const deadlineRef = useRef(0);
  const questionStartedAtRef = useRef(0);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fpsSamplesRef = useRef<number[]>([]);
  const longTaskStatsRef = useRef({ count: 0, blockingMs: 0 });
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const effectAudiosRef = useRef<Set<HTMLAudioElement>>(new Set());
  const longTaskSupportedRef = useRef(
    typeof PerformanceObserver !== "undefined" && (PerformanceObserver.supportedEntryTypes?.includes("longtask") ?? false)
  );
  const stageRef = useRef<Stage>(stage);

  const Icon = game2Meta.icon;
  const currentQuestion = deck[questionIndex];
  const { videoRef, status, error, start, stop } = useWebcam({ autoStart: false });
  const faceMask = useFaceMask(status === "active" && stage !== "result");
  const { fps } = useFrameLoop(videoRef, {
    enabled: status === "active" && stage !== "result",
    onFrame: (video, { timestamp }) => faceMask.onFrame(video, timestamp),
  });

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  const stopBgm = useCallback(() => {
    if (!bgmRef.current) return;
    bgmRef.current.pause();
    bgmRef.current.currentTime = 0;
    bgmRef.current = null;
  }, []);

  const stopAllAudio = useCallback(() => {
    stopBgm();
    effectAudiosRef.current.forEach((audio) => audio.pause());
    effectAudiosRef.current.clear();
  }, [stopBgm]);

  const playAudio = useCallback((name: "bgm" | "success" | "fail" | "end") => {
    const defaultSources = {
      bgm: "/sound/default-bgm.mp3",
      success: "/sound/default-success.mp3",
      fail: "/sound/default-fail.mp3",
      end: "/sound/default-end.mp3",
    };
    const source = characterSounds[name] ?? defaultSources[name];
    if (name === "bgm" || name === "end") stopBgm();
    const audio = new Audio(source);
    audio.volume = name === "bgm" ? 0.66 : 1;
    audio.loop = name === "bgm";
    const release = () => effectAudiosRef.current.delete(audio);
    audio.addEventListener("error", () => {
      console.warn(`[game-2] ${name} 음원을 재생하지 못했습니다.`);
      release();
    }, { once: true });
    if (name === "bgm") {
      bgmRef.current = audio;
    } else {
      effectAudiosRef.current.add(audio);
      audio.addEventListener("ended", release, { once: true });
    }
    void audio.play().catch((audioError: unknown) => {
      console.warn(`[game-2] ${name} 음원 재생 실패`, audioError);
    });
  }, [characterSounds, stopBgm]);

  useEffect(() => () => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    stopAllAudio();
    stop();
  }, [stop, stopAllAudio]);

  useEffect(() => {
    if (stage === "playing" && fps) fpsSamplesRef.current.push(fps);
  }, [fps, stage]);

  useEffect(() => {
    if (stage !== "playing" || !longTaskSupportedRef.current) return;
    longTaskStatsRef.current = { count: 0, blockingMs: 0 };
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTaskStatsRef.current.count += 1;
        longTaskStatsRef.current.blockingMs += Math.max(0, entry.duration - 50);
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
    return () => observer.disconnect();
  }, [stage]);

  const resetGame = useCallback(() => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setDeck([]);
    setQuestionIndex(0);
    setAnswer("");
    setExpression("smile");
    setFeedback(null);
    setLocked(false);
    setRemainingMs(GAME_DURATION_MS);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setCorrectCount(0);
    setWrongCount(0);
    setConsecutiveWrong(0);
    setAttempts([]);
    setAverageFps(0);
    setMemoryMb(null);
    setLongTaskCount(null);
    setBlockingTimeMs(null);
    setShowResourceDetail(false);
    fpsSamplesRef.current = [];
    longTaskStatsRef.current = { count: 0, blockingMs: 0 };
    stopAllAudio();
    faceMask.resetMetrics();
  }, [faceMask, stopAllAudio]);

  const finishGame = useCallback(() => {
    if (stageRef.current === "result") return;
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = null;
    const samples = fpsSamplesRef.current;
    setAverageFps(samples.length ? samples.reduce((sum, value) => sum + value, 0) / samples.length : 0);
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    setMemoryMb(memory ? memory.usedJSHeapSize / 1024 / 1024 : null);
    if (longTaskSupportedRef.current) {
      setLongTaskCount(longTaskStatsRef.current.count);
      setBlockingTimeMs(longTaskStatsRef.current.blockingMs);
    }
    setRemainingMs(0);
    setLocked(true);
    setStage("result");
    playAudio("end");
    stop();
  }, [playAudio, stop]);

  useEffect(() => {
    if (stage !== "countdown") return;
    const timers = [
      setTimeout(() => setCountdown(2), 1_000),
      setTimeout(() => setCountdown(1), 2_000),
      setTimeout(() => setCountdown("START"), 3_000),
      setTimeout(() => {
        deadlineRef.current = performance.now() + GAME_DURATION_MS;
        questionStartedAtRef.current = performance.now();
        setStage("playing");
        playAudio("bgm");
      }, 3_450),
    ];
    return () => timers.forEach(clearTimeout);
  }, [playAudio, stage]);

  useEffect(() => {
    if (stage !== "playing") return;
    let animationFrame = 0;
    const tick = () => {
      const nextRemaining = Math.max(0, deadlineRef.current - performance.now());
      setRemainingMs(nextRemaining);
      if (nextRemaining <= 0) {
        finishGame();
        return;
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [finishGame, stage]);

  useEffect(() => {
    if (stage === "playing" && !locked) inputRef.current?.focus();
  }, [currentQuestion?.id, locked, stage]);

  const beginCountdown = () => {
    if (status !== "active" || faceMask.state !== "tracking" || !questions.length) return;
    resetGame();
    setCountdown(3);
    setDeck(shuffleQuestions(questions));
    setStage("countdown");
  };

  const advanceQuestion = useCallback(() => {
    setFeedback(null);
    setLocked(false);
    setQuestionIndex((index) => {
      const nextIndex = index + 1;
      if (nextIndex < deck.length) return nextIndex;
      setDeck((currentDeck) => shuffleQuestions(questions, currentDeck.at(-1)?.id));
      return 0;
    });
    questionStartedAtRef.current = performance.now();
  }, [deck.length]);

  const scheduleNextQuestion = useCallback((delay: number) => {
    feedbackTimeoutRef.current = setTimeout(() => {
      if (performance.now() >= deadlineRef.current) finishGame();
      else advanceQuestion();
    }, delay);
  }, [advanceQuestion, finishGame]);

  useEffect(() => {
    if (stage !== "playing" || locked || !currentQuestion) return;
    const timer = setTimeout(() => {
      const question = currentQuestion;
      const now = performance.now();
      const nextWrongStreak = consecutiveWrong + 1;
      setLocked(true);
      playAudio("fail");
      setConsecutiveWrong(nextWrongStreak);
      setExpression(nextWrongStreak >= 2 ? "angry" : "sad");
      setCombo(0);
      setWrongCount((count) => count + 1);
      setFeedback({ result: "wrong", message: "시간 초과!", answer: question.answer });
      setAttempts((history) => [...history, {
        questionId: question.id,
        submittedAnswer: "",
        correctAnswer: question.answer,
        result: "wrong",
        scoreDelta: 0,
        totalScore: score,
        comboAfter: 0,
        responseTimeMs: QUESTION_TIME_LIMIT_MS,
        submittedAtMs: GAME_DURATION_MS - Math.max(0, deadlineRef.current - now),
      }]);
      scheduleNextQuestion(WRONG_FEEDBACK_MS);
    }, QUESTION_TIME_LIMIT_MS);
    return () => clearTimeout(timer);
  }, [consecutiveWrong, currentQuestion, locked, playAudio, scheduleNextQuestion, score, stage]);

  const submitAnswer = (event?: FormEvent) => {
    event?.preventDefault();
    const submittedAnswer = answer.trim();
    if (stage !== "playing" || locked || !currentQuestion || !submittedAnswer) return;

    setLocked(true);
    setAnswer("");
    const now = performance.now();
    const isCorrect = submittedAnswer === currentQuestion.answer;
    playAudio(isCorrect ? "success" : "fail");
    const nextCombo = isCorrect ? combo + 1 : 0;
    const scoreDelta = isCorrect ? 100 + Math.min(nextCombo * 10, 50) : 0;
    const nextScore = score + scoreDelta;

    if (isCorrect) {
      setExpression("smile");
      setConsecutiveWrong(0);
      setCombo(nextCombo);
      setMaxCombo((maximum) => Math.max(maximum, nextCombo));
      setScore(nextScore);
      setCorrectCount((count) => count + 1);
      setFeedback({ result: "correct", message: `정답이에요! +${scoreDelta}점` });
    } else {
      const nextWrongStreak = consecutiveWrong + 1;
      setConsecutiveWrong(nextWrongStreak);
      setExpression(nextWrongStreak >= 2 ? "angry" : "sad");
      setCombo(0);
      setWrongCount((count) => count + 1);
      setFeedback({ result: "wrong", message: "틀렸어요", answer: currentQuestion.answer });
    }

    setAttempts((history) => [...history, {
      questionId: currentQuestion.id,
      submittedAnswer,
      correctAnswer: currentQuestion.answer,
      result: isCorrect ? "correct" : "wrong",
      scoreDelta,
      totalScore: nextScore,
      comboAfter: nextCombo,
      responseTimeMs: now - questionStartedAtRef.current,
      submittedAtMs: GAME_DURATION_MS - Math.max(0, deadlineRef.current - now),
    }]);

    scheduleNextQuestion(isCorrect ? CORRECT_FEEDBACK_MS : WRONG_FEEDBACK_MS);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault();
  };

  const handleQuestionImageError = () => {
    if (locked || stage !== "playing") return;
    console.warn(`[game-2] 문제 이미지 로딩 실패로 건너뜀: ${currentQuestion?.id}`);
    setLocked(true);
    setFeedback({ result: "image-error", message: "이미지를 불러오지 못해 다음 문제로 넘어갑니다." });
    scheduleNextQuestion(600);
  };

  const maskOverlay = faceMask.position ? (
    <div style={{ ...getMaskStyle(), left: faceMask.position.left, top: faceMask.position.top, width: faceMask.position.width, height: faceMask.position.height, transform: `rotate(${faceMask.position.rotation}rad)` }} aria-hidden="true">
      <img src={expressionImages[expression]} alt="" style={{ width: "100%", height: "100%", objectFit: "fill" }} />
    </div>
  ) : null;

  const totalAttempts = correctCount + wrongCount;
  const accuracy = totalAttempts ? (correctCount / totalAttempts) * 100 : 0;
  const averageResponseMs = useMemo(() => attempts.length ? attempts.reduce((sum, attempt) => sum + attempt.responseTimeMs, 0) / attempts.length : 0, [attempts]);
  const lastAttempt = attempts.at(-1);

  useEffect(() => {
    if (!showResourceDetail) return;
    modalCloseButtonRef.current?.focus();
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setShowResourceDetail(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showResourceDetail]);

  const resourceDetails = useMemo<ResourceDetail[]>(() => {
    const fpsLevel: ResourceLevel = averageFps >= 50 ? "good" : averageFps >= 30 ? "ok" : "warn";
    const avgInferenceLevel: ResourceLevel = faceMask.averageInferenceMs <= 20 ? "good" : faceMask.averageInferenceMs <= 50 ? "ok" : "warn";
    const maxInferenceLevel: ResourceLevel = faceMask.maxInferenceMs <= 40 ? "good" : faceMask.maxInferenceMs <= 100 ? "ok" : "warn";
    const modelLoadLevel: ResourceLevel = faceMask.modelLoadMs === null ? "unknown" : faceMask.modelLoadMs <= 1000 ? "good" : faceMask.modelLoadMs <= 3000 ? "ok" : "warn";
    const longTaskLevel: ResourceLevel = longTaskCount === null ? "unknown" : longTaskCount <= 2 ? "good" : longTaskCount <= 10 ? "ok" : "warn";
    const blockingLevel: ResourceLevel = blockingTimeMs === null ? "unknown" : blockingTimeMs <= 200 ? "good" : blockingTimeMs <= 600 ? "ok" : "warn";

    return [
      {
        id: "response",
        label: "평균 응답 시간",
        value: formatDuration(averageResponseMs),
        level: "unknown",
        what: "문제 사진이 표시된 순간부터 정답을 제출할 때까지 걸린 시간의 평균입니다.",
        meaning: "시스템 자원이라기보다 플레이어의 반응 속도에 가까운 지표입니다. 값이 클수록 문제를 보고 답을 입력하는 데 시간이 오래 걸렸다는 뜻입니다.",
      },
      {
        id: "fps",
        label: "평균 FPS",
        value: `${averageFps.toFixed(1)} fps`,
        level: fpsLevel,
        what: "웹캠 화면과 얼굴 마스크를 1초에 몇 번 다시 그렸는지(초당 프레임 수)입니다.",
        meaning: "60에 가까울수록 화면이 부드럽습니다. 30 밑으로 떨어지면 캐릭터 마스크가 뚝뚝 끊겨 보일 수 있습니다.",
      },
      {
        id: "avgInference",
        label: "평균 추론",
        value: `${faceMask.averageInferenceMs.toFixed(1)}ms`,
        level: avgInferenceLevel,
        what: "MediaPipe 얼굴 인식 모델이 한 번 실행되는 데 걸린 시간의 평균입니다(약 100ms 간격으로 실행).",
        meaning: "값이 작을수록 얼굴 인식이 기기에 부담을 덜 줍니다. 20ms 이하면 가볍게 돌아가고 있는 것입니다.",
      },
      {
        id: "maxInference",
        label: "최대 추론",
        value: `${faceMask.maxInferenceMs.toFixed(1)}ms`,
        level: maxInferenceLevel,
        what: "게임 도중 얼굴 인식 1회 실행 중 가장 오래 걸렸던 시간입니다.",
        meaning: "평균은 낮아도 이 값이 튀면 순간적으로 기기가 버벅였을 가능성이 있습니다.",
      },
      {
        id: "detectionCount",
        label: "추론 횟수",
        value: `${faceMask.detectionCount}회`,
        level: "unknown",
        what: "게임 중 얼굴 인식을 실제로 실행한 총 횟수입니다.",
        meaning: "플레이 시간과 얼굴이 카메라에 잡혀 있던 시간에 비례합니다. 너무 적다면 얼굴이 화면 밖으로 자주 벗어났을 수 있습니다.",
      },
      {
        id: "modelLoad",
        label: "모델 로딩",
        value: faceMask.modelLoadMs === null ? "측정 안 됨" : `${faceMask.modelLoadMs.toFixed(0)}ms`,
        level: modelLoadLevel,
        what: "웹캠을 처음 켰을 때 얼굴 인식 모델(WASM + tflite 파일)을 내려받고 초기화하는 데 걸린 시간입니다.",
        meaning: "네트워크 속도와 기기 성능에 좌우됩니다. 1초 이하면 빠른 편이고, 3초를 넘으면 시작 전 대기가 길게 느껴질 수 있습니다.",
      },
      {
        id: "longTask",
        label: "LONG TASK",
        value: longTaskCount === null ? "지원 안 함" : `${longTaskCount}건`,
        level: longTaskLevel,
        what: "브라우저 메인 스레드를 50ms 이상 한 번에 점유한 작업의 횟수입니다.",
        meaning: "많을수록 입력이나 화면 반응이 순간적으로 멈칫했을 가능성이 큽니다. Safari 등 일부 브라우저는 이 측정 자체를 지원하지 않습니다.",
      },
      {
        id: "blocking",
        label: "BLOCKING TIME",
        value: blockingTimeMs === null ? "지원 안 함" : `${blockingTimeMs.toFixed(0)}ms`,
        level: blockingLevel,
        what: "LONG TASK들이 50ms를 초과한 만큼만 모두 더한 시간입니다(구글 라이트하우스의 Total Blocking Time과 같은 계산 방식).",
        meaning: "누적 시간이 클수록 플레이 중 입력 지연을 체감했을 가능성이 높습니다. 200ms 이하면 거의 체감되지 않는 수준입니다.",
      },
      {
        id: "memory",
        label: "JS 메모리",
        value: memoryMb === null ? "지원 안 함" : `${memoryMb.toFixed(1)}MB`,
        level: "unknown",
        what: "게임 종료 시점에 자바스크립트가 사용 중이던 힙 메모리 크기입니다(Chrome 계열 브라우저만 제공).",
        meaning: "기기·브라우저마다 기준이 달라 절대값보다는, 같은 기기에서 여러 판을 반복했을 때 계속 늘어나는지를 보는 것이 더 의미 있습니다.",
      },
    ];
  }, [averageResponseMs, averageFps, faceMask.averageInferenceMs, faceMask.maxInferenceMs, faceMask.detectionCount, faceMask.modelLoadMs, longTaskCount, blockingTimeMs, memoryMb]);
  const trackingText = faceMask.state === "tracking" ? "FACE TRACKED" : faceMask.state === "searching" ? "얼굴을 카메라 중앙에 보여주세요" : faceMask.state === "error" ? "얼굴 추적 모델을 불러오지 못했어요" : "얼굴 추적 준비 중...";

  const cameraStage = (
    <div className={styles.cameraStage}>
      <video ref={videoRef} className="camera-video" autoPlay playsInline muted />
      {maskOverlay}
      {!faceMask.position && status === "active" && <p className="play-hint">{trackingText}</p>}
    </div>
  );

  return (
    <AppShell activeStep={stage === "result" ? 3 : 2} stageKey={stage}>
      {stage === "ready" && (
        <div className="ready-layout" style={{ "--choice": game2Meta.accent } as React.CSSProperties}>
          <div className="camera-preview">
            <div className="camera-bar"><span><i /> CAMERA PREVIEW</span><small>1280 × 720</small></div>
            <div className="camera-body">
              <video ref={videoRef} className="camera-video" autoPlay playsInline muted hidden={status !== "active"} />
              {status === "active" && maskOverlay}
              <div className="frame-corners"><i /><i /><i /><i /></div>
              {status !== "active" && (
                <div className={`camera-placeholder${status === "error" ? " is-error" : ""}`}>
                  <Icon /><b>{statusLabel[status]?.title ?? statusLabel.idle.title}</b>
                  <span>{status === "error" && error ? error : statusLabel[status]?.description ?? statusLabel.idle.description}</span>
                  {status !== "requesting" && <Button size="lg" className="camera-start-button" onClick={start}><Video fill="currentColor" /> {status === "error" ? "다시 시도" : "웹캠 켜기"}</Button>}
                </div>
              )}
              <div className="tracking-label" style={{ zIndex: 2 }}><span style={status === "active" ? { background: faceMask.state === "tracking" ? "#54cc8a" : "#ffd84d" } : undefined} />{status === "active" ? trackingText : statusLabel[status]?.tracking ?? statusLabel.idle.tracking}</div>
            </div>
            <div className="camera-stats">
              <span><Cpu /> QUESTIONS <b>{questions.length || "--"}</b></span>
              <span><CircleGauge /> FPS <b>{status === "active" ? fps.toFixed(1) : "--.-"}</b></span>
              <span><Clock3 /> INFERENCE <b>{faceMask.inferenceMs ? `${faceMask.inferenceMs.toFixed(0)} ms` : "-- ms"}</b></span>
            </div>
          </div>
          <div className="ready-info">
            <span className="screen-count">03 / 03 · {game2Meta.code}</span>
            <div className="ready-title"><span><Icon /></span><div><small>{game2Meta.tag}</small><h2>{game2Meta.title}</h2></div></div>
            <p className="ready-description">{game2Meta.description}</p>
            <div className="ready-player"><span><img src={expressionImages.smile} alt="웃는 새싹 캐릭터" /></span><div><small>PLAYER</small><b>{playerName}</b></div><em>60초</em></div>
            <div className="check-list"><h3>시작 전 체크</h3>{game2Meta.checks.map((item) => <div key={item}><span><Check /></span>{item}</div>)}</div>
            {!questions.length && <p className={styles.noQuestions}>문제 사진과 정답 데이터가 아직 없습니다. `public/game-2/questions/`와 `questions.ts`에 문제를 추가해주세요.</p>}
            <div className="ready-actions">
              <Button variant="ghost" size="lg" onClick={() => router.push("/games")}><ArrowLeft /> 다른 게임</Button>
              <Button size="lg" className="start-game" disabled={status !== "active" || faceMask.state !== "tracking" || !questions.length} onClick={beginCountdown}><Play fill="currentColor" /> 게임 시작</Button>
            </div>
          </div>
        </div>
      )}

      {stage === "countdown" && <div className={styles.countdownLayout}><div className={styles.countdownCamera}>{cameraStage}<div className={styles.countdownValue} aria-live="assertive">{countdown}</div></div></div>}

      {stage === "playing" && currentQuestion && (
        <div className={styles.gameLayout}>
          <section className={styles.cameraPanel} aria-label="캐릭터 웹캠">{cameraStage}<div className={styles.cameraFooter}><span><CircleGauge /> FPS {fps.toFixed(1)}</span><span><Clock3 /> 추론 {faceMask.inferenceMs.toFixed(0)}ms</span><span>{trackingText}</span></div></section>
          <section className={styles.quizPanel}>
            <div className={styles.quizHeader}><span className="screen-count">PHOTO QUIZ</span><div className={`${styles.timer}${remainingMs <= 10_000 ? ` ${styles.danger}` : ""}`}><Clock3 /> {formatTime(remainingMs)}</div></div>
            <div className={styles.scoreRow}><div className={styles.scoreBox}><small>SCORE</small><b>{score.toLocaleString()}</b></div><div className={styles.scoreBox}><small>COMBO</small><b>{combo}</b></div><div className={styles.scoreBox}><small>CORRECT</small><b>{correctCount}</b></div></div>
            <div className={styles.questionTimer} aria-hidden="true"><div key={currentQuestion.id} className={styles.questionTimerBar} style={{ animationPlayState: locked ? "paused" : "running" }} /></div>
            <div className={styles.questionFrame}>
              <img src={currentQuestion.image} alt="정답을 맞힐 사진 문제" onError={handleQuestionImageError} />
              {feedback && (
                <div className={`${styles.feedback}${feedback.result === "correct" ? ` ${styles.feedbackCorrect}` : ` ${styles.feedbackWrong}`}`} role="status" aria-live="assertive">
                  <strong>{feedback.result === "correct" ? <Check /> : <X />} {feedback.message}</strong>
                  {feedback.answer && <span>정답: {feedback.answer}</span>}
                </div>
              )}
            </div>
            <form className={styles.answerForm} onSubmit={submitAnswer}>
              <input ref={inputRef} value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={handleInputKeyDown} disabled={locked} aria-label="사진 퀴즈 정답" autoComplete="off" placeholder="정답을 입력하세요" />
              <Button type="submit" disabled={locked || !answer.trim()}><Send /> 전송</Button>
            </form>
            <p className={styles.recentAnswer}>{lastAttempt ? `최근 답변: ${lastAttempt.submittedAnswer} · ${lastAttempt.result === "correct" ? "정답" : "오답"}` : "사진을 보고 정답을 입력하세요."}</p>
            <div className={styles.gameActions}><Button variant="outline" onClick={finishGame}><Flag /> 게임 종료</Button></div>
          </section>
        </div>
      )}

      {stage === "result" && (
        <div className={styles.resultLayout}><div className={styles.resultCard}>
          <div className={styles.resultLeft}>
            <div className={styles.resultHeading}><span className="screen-count">GAME COMPLETE</span><h2>{playerName}님의 스피드 퀴즈 결과</h2><p>60초 동안의 기록을 확인해보세요.</p></div>
            <div className={styles.resultScore}>{score.toLocaleString()}P</div>
            <div className={styles.resultActions}><Button variant="outline" size="lg" onClick={() => router.push("/games")}><ArrowLeft /> 다른 게임</Button><Button size="lg" onClick={() => { resetGame(); setStage("ready"); }}><RotateCcw /> 다시 하기</Button></div>
          </div>
          <div className={styles.resultRight}>
            <div className={styles.resultGrid}><div className={styles.resultMetric}><small>정답</small><b>{correctCount}개</b></div><div className={styles.resultMetric}><small>오답</small><b>{wrongCount}개</b></div><div className={styles.resultMetric}><small>정답률</small><b>{accuracy.toFixed(0)}%</b></div><div className={styles.resultMetric}><small>최고 콤보</small><b>{maxCombo}</b></div></div>
            <div className={styles.performanceHeader}>
              <h3 className={styles.performanceTitle}>리소스 모니터링</h3>
              <button type="button" className={styles.detailButton} onClick={() => setShowResourceDetail(true)}><Info /> 상세 보기</button>
            </div>
            <div className={styles.performanceGrid}>
              <div className={styles.resultMetric}><small>평균 응답 시간</small><b>{formatDuration(averageResponseMs)}</b></div>
              <div className={styles.resultMetric}><small>평균 FPS</small><b>{averageFps.toFixed(1)}</b></div>
              <div className={styles.resultMetric}><small>평균 추론</small><b>{faceMask.averageInferenceMs.toFixed(1)}ms</b></div>
              <div className={styles.resultMetric}><small>최대 추론</small><b>{faceMask.maxInferenceMs.toFixed(1)}ms</b></div>
              <div className={styles.resultMetric}><small>추론 횟수</small><b>{faceMask.detectionCount}</b></div>
              <div className={styles.resultMetric}><small>모델 로딩</small><b>{faceMask.modelLoadMs === null ? "측정 안 됨" : `${faceMask.modelLoadMs.toFixed(0)}ms`}</b></div>
              <div className={styles.resultMetric}><small>LONG TASK</small><b>{longTaskCount === null ? "지원 안 함" : `${longTaskCount}건`}</b></div>
              <div className={styles.resultMetric}><small>BLOCKING TIME</small><b>{blockingTimeMs === null ? "지원 안 함" : `${blockingTimeMs.toFixed(0)}ms`}</b></div>
              <div className={styles.resultMetric}><small>JS 메모리</small><b>{memoryMb === null ? "지원 안 함" : `${memoryMb.toFixed(1)}MB`}</b></div>
            </div>
          </div>
        </div></div>
      )}

      {showResourceDetail && (
        <div className={styles.modalOverlay} role="presentation" onClick={() => setShowResourceDetail(false)}>
          <div className={styles.modalPanel} role="dialog" aria-modal="true" aria-labelledby="resourceDetailTitle" onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 id="resourceDetailTitle">리소스 모니터링 상세</h3>
              <button ref={modalCloseButtonRef} type="button" aria-label="닫기" className={styles.modalClose} onClick={() => setShowResourceDetail(false)}><X /></button>
            </div>
            <div className={styles.modalBody}>
              {resourceDetails.map((item) => (
                <div key={item.id} className={styles.modalRow}>
                  <div className={styles.modalRowHead}>
                    <span className={styles.modalRowLabel}>{item.label}</span>
                    {item.level !== "unknown" && <span className={`${styles.badge} ${styles[levelClass[item.level]]}`}>{levelLabel[item.level]}</span>}
                    <span className={styles.modalRowValue}>{item.value}</span>
                  </div>
                  <p className={styles.modalRowText}><b>무엇:</b> {item.what}</p>
                  <p className={styles.modalRowText}><b>의미:</b> {item.meaning}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
