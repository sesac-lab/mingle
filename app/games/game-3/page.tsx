"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FaceDetector, FaceLandmarker, FilesetResolver, type Detection, type NormalizedLandmark } from "@mediapipe/tasks-vision";
import { ArrowLeft, Check, Clock3, CircleGauge, Cpu, Flag, ImageIcon, Play, RotateCcw, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/common/app-shell";
import { usePlayer } from "@/lib/player-context";
import { GAME_RESULT_STORAGE_KEY, type Game3Result, type Game3RoundResult, type GameEvent, type GameEventType } from "@/lib/games/game-result";
import { useWebcam, useFrameLoop } from "@/lib/webcam";
import { game3Meta } from "./meta";

type Stage = "idle" | "preview" | "ready" | "playing" | "roundTransition" | "finished";
type Edge = "top" | "bottom" | "left" | "right";
type Rect = { left: number; top: number; width: number; height: number };
type Placement = Rect & { edge: Edge; flipX: boolean; flipY: boolean };

const MAX_ROUNDS = 10;
const MAX_FAILURES = 5;
const INFERENCE_INTERVAL_MS = 90;

const statusLabel: Record<string, { title: string; description: string; tracking: string }> = {
  idle: { title: "카메라가 꺼져 있어요", description: "버튼을 눌러 웹캠을 켜주세요", tracking: "STANDBY" },
  requesting: { title: "카메라 연결 중...", description: "브라우저의 카메라 권한 요청을 확인해주세요", tracking: "CONNECTING" },
  error: { title: "카메라를 사용할 수 없어요", description: "브라우저 권한 설정을 확인해주세요", tracking: "CAMERA ERROR" },
};

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function createRoundLayout(): { zone: Rect; placement: Placement } {
  const ratio = randomItem([3 / 4, 4 / 3, 4 / 5, 5 / 4]);
  const width = (ratio < 1 ? 0.28 + Math.random() * 0.06 : 0.34 + Math.random() * 0.08) * 1.32;
  const height = width / ratio;
  const randomPosition = (available: number) => {
    const mode = Math.floor(Math.random() * 4);
    return mode === 0 ? 0 : mode === 1 ? available : Math.random() * available;
  };
  const zone: Rect = { left: randomPosition(1 - width), top: randomPosition(1 - height), width, height };
  const edge = randomItem<Edge>(["top", "bottom", "left", "right"]);
  const characterWidth = zone.width * 0.45;
  const characterHeight = zone.height * 0.45;
  return {
    zone,
    placement: {
      left: zone.left + (edge === "left" ? 0 : edge === "right" ? zone.width - characterWidth : (zone.width - characterWidth) / 2),
      top: zone.top + (edge === "top" ? 0 : edge === "bottom" ? zone.height - characterHeight : (zone.height - characterHeight) / 2),
      width: characterWidth,
      height: characterHeight,
      edge,
      flipX: edge === "left",
      flipY: edge === "top",
    },
  };
}

function contains(zone: Rect, face: Rect) {
  return face.left >= zone.left && face.top >= zone.top && face.left + face.width <= zone.left + zone.width && face.top + face.height <= zone.top + zone.height;
}

function overlapRatio(face: Rect, character: Rect) {
  const width = Math.max(0, Math.min(face.left + face.width, character.left + character.width) - Math.max(face.left, character.left));
  const height = Math.max(0, Math.min(face.top + face.height, character.top + character.height) - Math.max(face.top, character.top));
  return (width * height) / Math.max(face.width * face.height, 0.0001);
}

function sharpnessVariance(context: CanvasRenderingContext2D, width: number, height: number) {
  const sampleWidth = Math.min(width, 320);
  const sampleHeight = Math.max(1, Math.round((height / width) * sampleWidth));
  const sample = document.createElement("canvas");
  sample.width = sampleWidth;
  sample.height = sampleHeight;
  const sampleContext = sample.getContext("2d", { willReadFrequently: true });
  if (!sampleContext) return 0;
  sampleContext.drawImage(context.canvas, 0, 0, sampleWidth, sampleHeight);
  const pixels = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;
  let sum = 0;
  let squared = 0;
  let count = 0;
  const gray = (index: number) => pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
  for (let y = 1; y < sampleHeight - 1; y += 2) {
    for (let x = 1; x < sampleWidth - 1; x += 2) {
      const i = (y * sampleWidth + x) * 4;
      const laplacian = gray(i - 4) + gray(i + 4) + gray(i - sampleWidth * 4) + gray(i + sampleWidth * 4) - 4 * gray(i);
      sum += laplacian;
      squared += laplacian * laplacian;
      count += 1;
    }
  }
  const mean = sum / Math.max(count, 1);
  return squared / Math.max(count, 1) - mean * mean;
}

function eyesAreClosed(landmarks: NormalizedLandmark[]) {
  const distance = (a: number, b: number) => Math.hypot(landmarks[a].x - landmarks[b].x, landmarks[a].y - landmarks[b].y);
  const eyeAspectRatio = (points: [number, number, number, number, number, number]) =>
    (distance(points[1], points[5]) + distance(points[2], points[4])) / Math.max(2 * distance(points[0], points[3]), 0.0001);
  const left = eyeAspectRatio([33, 160, 158, 133, 153, 144]);
  const right = eyeAspectRatio([362, 385, 387, 263, 373, 380]);
  return (left + right) / 2 < 0.18;
}

export default function Game3Page() {
  const router = useRouter();
  const { playerName, characterImage, characterImages, characterSounds } = usePlayer();
  const [stage, setStage] = useState<Stage>("idle");
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [modelError, setModelError] = useState("");
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [successes, setSuccesses] = useState(0);
  const [failures, setFailures] = useState(0);
  const [remainingMs, setRemainingMs] = useState(3000);
  const [zone, setZone] = useState<Rect>({ left: 0.3, top: 0.25, width: 0.4224, height: 0.528 });
  const [placement, setPlacement] = useState<Placement>({ left: 0.41616, top: 0.25, width: 0.19008, height: 0.2376, edge: "top", flipX: false, flipY: true });
  const [roundCharacter, setRoundCharacter] = useState(characterImage);
  const [faceBox, setFaceBox] = useState<Rect | null>(null);
  const [lastResult, setLastResult] = useState<"success" | "fail" | null>(null);
  const [roundResults, setRoundResults] = useState<Game3RoundResult[]>([]);
  const [averageInference, setAverageInference] = useState(0);
  const detectorRef = useRef<FaceDetector | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const inferenceBusyRef = useRef(false);
  const lastInferenceRef = useRef(0);
  const roundLockedRef = useRef(false);
  const roundStartedAtRef = useRef(0);
  const detectionCallsRef = useRef(0);
  const inferenceTotalRef = useRef(0);
  const inferenceMaxRef = useRef(0);
  const droppedInferenceCountRef = useRef(0);
  const roundFrameCountRef = useRef(0);
  const roundFrameElapsedRef = useRef(0);
  const roundErrorCountRef = useRef(0);
  const modelErrorLoggedRoundRef = useRef(0);
  const cameraRequestedAtRef = useRef(0);
  const cameraReadyMsRef = useRef(0);
  const modelLoadingAtRef = useRef(0);
  const modelReadyMsRef = useRef(0);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundTimerRef = useRef<number | null>(null);
  const characterRef = useRef<HTMLImageElement | null>(null);
  const stageRef = useRef<Stage>(stage);
  const eventsRef = useRef<GameEvent[]>([]);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const effectAudiosRef = useRef<Set<HTMLAudioElement>>(new Set());
  const gameRef = useRef({ round: 1, score: 0, successes: 0, failures: 0, startedAt: 0, results: [] as Game3RoundResult[] });
  const Icon = game3Meta.icon;
  const { videoRef, status, error, start, stop } = useWebcam({ autoStart: false });

  useEffect(() => { stageRef.current = stage; }, [stage]);

  const addEvent = useCallback((type: GameEventType, message?: string, eventRound?: number, durationMs?: number) => {
    const event: GameEvent = { timestamp: Date.now(), type, round: eventRound, durationMs, message };
    eventsRef.current = [...eventsRef.current, event];
    if (type.endsWith("_ERROR") && eventRound !== undefined) {
      const resultIndex = gameRef.current.results.findIndex((item) => item.round === eventRound);
      if (resultIndex >= 0) {
        const results = gameRef.current.results.map((item, index) => index === resultIndex ? { ...item, errorCount: item.errorCount + 1 } : item);
        gameRef.current = { ...gameRef.current, results };
        setRoundResults(results);
      } else if (eventRound === gameRef.current.round) {
        roundErrorCountRef.current += 1;
      }
    }
    return event;
  }, []);

  const stopBgm = useCallback(() => {
    if (!bgmRef.current) return;
    bgmRef.current.pause();
    bgmRef.current.currentTime = 0;
    bgmRef.current = null;
  }, []);

  const playAudio = useCallback((name: "bgm" | "success" | "fail" | "end") => {
    const defaultSources = {
      bgm: "/sound/default-bgm.mp3",
      success: "/sound/default-success.mp3",
      fail: "/sound/default-fail.mp3",
      end: "/sound/default-end.mp3",
    };
    const source = characterSounds[name] ?? defaultSources[name];
    const audioRound = gameRef.current.round;
    if (name === "bgm" || name === "end") stopBgm();
    const audio = new Audio(source);
    let audioErrorReported = false;
    audio.volume = name === "bgm" ? 0.66 : 1;
    audio.loop = name === "bgm";
    const release = () => effectAudiosRef.current.delete(audio);
    const reportAudioError = (message: string) => {
      if (audioErrorReported) return;
      audioErrorReported = true;
      release();
      addEvent("AUDIO_ERROR", message, audioRound);
    };
    audio.addEventListener("error", () => reportAudioError(`${name} 음원을 재생하지 못했습니다.`), { once: true });
    if (name === "bgm") bgmRef.current = audio;
    else {
      effectAudiosRef.current.add(audio);
      audio.addEventListener("ended", release, { once: true });
    }
    void audio.play().catch((audioError: unknown) => {
      reportAudioError(audioError instanceof Error ? audioError.message : name);
    });
  }, [addEvent, characterSounds, stopBgm]);

  const cleanupActiveResources = useCallback(() => {
    try {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
      roundTimerRef.current = null;
      stopBgm();
      effectAudiosRef.current.forEach((audio) => audio.pause());
      effectAudiosRef.current.clear();
      inferenceBusyRef.current = false;
      stop();
      addEvent("RESOURCE_CLEANUP", "MediaStream, timer, animation frame, audio 정리 완료");
    } catch (cleanupError) {
      addEvent("RESOURCE_CLEANUP_ERROR", cleanupError instanceof Error ? cleanupError.message : "자원 정리 오류");
    }
  }, [addEvent, stop, stopBgm]);

  const timeLimitFor = (successCount: number) => (successCount >= 4 ? 1000 : successCount >= 2 ? 2000 : 3000);

  const capture = useCallback((face: Rect, characterPlacement: Placement) => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    const width = Math.min(video.videoWidth, 960);
    const height = Math.round((video.videoHeight / video.videoWidth) * width);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.save();
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, width, height);
    context.restore();
    const sharpness = sharpnessVariance(context, width, height);
    let closedEyes = false;
    let qualityError: string | undefined;
    try {
      const landmarks = landmarkerRef.current?.detect(canvas).faceLandmarks[0];
      if (landmarks) closedEyes = eyesAreClosed(landmarks);
    } catch (landmarkError) {
      qualityError = landmarkError instanceof Error ? landmarkError.message : "눈 감김 판정 오류";
    }
    const image = characterRef.current;
    if (image?.complete && image.naturalWidth) {
      const boxWidth = characterPlacement.width * width;
      const boxHeight = characterPlacement.height * height;
      const scale = Math.min(boxWidth / image.naturalWidth, boxHeight / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const x = characterPlacement.left * width + (boxWidth - drawWidth) / 2;
      const y = characterPlacement.top * height + (boxHeight - drawHeight) / 2;
      context.save();
      context.translate(x + drawWidth / 2, y + drawHeight / 2);
      context.scale(characterPlacement.flipX ? -1 : 1, characterPlacement.flipY ? -1 : 1);
      context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      context.restore();
    }
    const excludedReasons: string[] = [];
    if (overlapRatio(face, characterPlacement) >= 0.8) excludedReasons.push("캐릭터 얼굴 가림");
    if (sharpness < 100) excludedReasons.push("초점 불량");
    if (closedEyes) excludedReasons.push("눈 감음");
    return { image: canvas.toDataURL("image/jpeg", 0.82), excludedReasons, qualityError };
  }, [videoRef]);

  const finishGame = useCallback((resultOverride?: Game3RoundResult[]) => {
    roundLockedRef.current = true;
    const results = resultOverride ?? gameRef.current.results;
    addEvent("GAME_ENDED", undefined, gameRef.current.round);
    cleanupActiveResources();
    playAudio("end");
    const result: Game3Result = {
      game: "game-3",
      playerName,
      characterImage,
      score: gameRef.current.score,
      startedAt: gameRef.current.startedAt || Date.now(),
      endedAt: Date.now(),
      successRate: results.length ? (results.filter((item) => item.result === "success").length / results.length) * 100 : 0,
      cameraReadyMs: cameraReadyMsRef.current,
      modelReadyMs: modelReadyMsRef.current,
      rounds: results,
      events: [...eventsRef.current],
    };
    try {
      sessionStorage.setItem(GAME_RESULT_STORAGE_KEY, JSON.stringify(result));
    } catch {
      addEvent("CAPTURE_ERROR", "결과 저장 공간이 부족해 사진 일부를 저장하지 못했습니다.");
      const compactResult = { ...result, rounds: results.map((item) => ({ ...item, capturedImage: undefined })), events: [...eventsRef.current] };
      try {
        sessionStorage.setItem(GAME_RESULT_STORAGE_KEY, JSON.stringify(compactResult));
      } catch {
        // Storage may be unavailable in privacy-restricted browsers. The completion screen still works.
      }
    }
    setStage("finished");
  }, [addEvent, characterImage, cleanupActiveResources, playAudio, playerName]);

  const beginRound = useCallback((nextRound: number) => {
    const layout = createRoundLayout();
    const nextCharacter = randomItem(characterImages.length ? characterImages : [characterImage]);
    const limit = timeLimitFor(gameRef.current.successes);
    gameRef.current.round = nextRound;
    detectionCallsRef.current = 0;
    inferenceTotalRef.current = 0;
    inferenceMaxRef.current = 0;
    droppedInferenceCountRef.current = 0;
    roundFrameCountRef.current = 0;
    roundFrameElapsedRef.current = 0;
    roundErrorCountRef.current = 0;
    modelErrorLoggedRoundRef.current = 0;
    roundStartedAtRef.current = performance.now();
    roundLockedRef.current = false;
    setRound(nextRound);
    setZone(layout.zone);
    setPlacement(layout.placement);
    setRoundCharacter(nextCharacter);
    setRemainingMs(limit);
    setFaceBox(null);
    setLastResult(null);
    setStage("playing");
    addEvent("ROUND_STARTED", `제한 시간 ${limit}ms`, nextRound);
  }, [addEvent, characterImage, characterImages]);

  const finishRound = useCallback((result: "success" | "fail", detectedFace?: Rect) => {
    if (roundLockedRef.current || stageRef.current !== "playing") return;
    roundLockedRef.current = true;
    const current = gameRef.current;
    const limit = timeLimitFor(current.successes);
    const responseTimeMs = Math.min(Math.round(performance.now() - roundStartedAtRef.current), limit);
    const scoreDelta = result === "success" ? 5 : -2;
    const totalScore = current.score + scoreDelta;
    const nextSuccesses = current.successes + (result === "success" ? 1 : 0);
    const nextFailures = current.failures + (result === "fail" ? 1 : 0);
    const avgInferenceMs = detectionCallsRef.current ? inferenceTotalRef.current / detectionCallsRef.current : 0;
    const avgFps = roundFrameElapsedRef.current > 0 ? (roundFrameCountRef.current * 1000) / roundFrameElapsedRef.current : 0;
    let capturedImage: string | undefined;
    let excludedReasons: string[] | undefined;
    if (result === "success" && detectedFace) {
      try {
        const captured = capture(detectedFace, placement);
        capturedImage = captured?.image;
        excludedReasons = captured?.excludedReasons;
        if (captured?.qualityError) addEvent("MODEL_ERROR", captured.qualityError, current.round);
        if (!captured) addEvent("CAPTURE_ERROR", "사진을 캡처하지 못했습니다.", current.round);
      } catch (captureError) {
        addEvent("CAPTURE_ERROR", captureError instanceof Error ? captureError.message : undefined, current.round);
      }
    }
    const roundResult: Game3RoundResult = {
      round: current.round,
      result,
      scoreDelta,
      totalScore,
      responseTimeMs: result === "success" ? responseTimeMs : limit,
      timeLimitMs: limit,
      detectionCalls: detectionCallsRef.current,
      avgInferenceMs,
      maxInferenceMs: inferenceMaxRef.current,
      droppedInferenceCount: droppedInferenceCountRef.current,
      avgFps,
      errorCount: roundErrorCountRef.current,
      capturedImage,
      excludedReasons,
    };
    const results = [...current.results, roundResult];
    gameRef.current = { ...current, score: totalScore, successes: nextSuccesses, failures: nextFailures, results };
    setScore(totalScore);
    setSuccesses(nextSuccesses);
    setFailures(nextFailures);
    setRoundResults(results);
    setAverageInference(avgInferenceMs);
    setLastResult(result);
    setStage("roundTransition");
    addEvent(result === "success" ? "ROUND_SUCCESS" : "ROUND_TIMEOUT", undefined, current.round, roundResult.responseTimeMs);
    addEvent("ROUND_ENDED", undefined, current.round);
    playAudio(result);
    transitionTimerRef.current = setTimeout(() => {
      if (current.round >= MAX_ROUNDS || nextFailures >= MAX_FAILURES) finishGame(gameRef.current.results);
      else beginRound(current.round + 1);
    }, 500);
  }, [addEvent, beginRound, capture, finishGame, placement, playAudio]);

  const handleFrame = useCallback(async (video: HTMLVideoElement, timestamp: number, delta: number) => {
    if (stageRef.current !== "playing" || roundLockedRef.current) return;
    if (delta > 0) {
      roundFrameCountRef.current += 1;
      roundFrameElapsedRef.current += delta;
    }
    if (!detectorRef.current) return;
    if (inferenceBusyRef.current) {
      droppedInferenceCountRef.current += 1;
      return;
    }
    if (timestamp - lastInferenceRef.current < INFERENCE_INTERVAL_MS) return;
    lastInferenceRef.current = timestamp;
    inferenceBusyRef.current = true;
    const inferenceStart = performance.now();
    try {
      const result = detectorRef.current.detectForVideo(video, timestamp);
      const latency = performance.now() - inferenceStart;
      detectionCallsRef.current += 1;
      inferenceTotalRef.current += latency;
      inferenceMaxRef.current = Math.max(inferenceMaxRef.current, latency);
      setAverageInference(inferenceTotalRef.current / detectionCallsRef.current);
      const detection: Detection | undefined = result.detections[0];
      if (!detection?.boundingBox || !video.videoWidth || !video.videoHeight) {
        setFaceBox(null);
        return;
      }
      const box = detection.boundingBox;
      const normalized: Rect = { left: 1 - (box.originX + box.width) / video.videoWidth, top: box.originY / video.videoHeight, width: box.width / video.videoWidth, height: box.height / video.videoHeight };
      setFaceBox(normalized);
      if (contains(zone, normalized)) finishRound("success", normalized);
    } catch (inferenceError) {
      if (modelErrorLoggedRoundRef.current !== gameRef.current.round) {
        modelErrorLoggedRoundRef.current = gameRef.current.round;
        addEvent("MODEL_ERROR", inferenceError instanceof Error ? inferenceError.message : "얼굴 감지 오류", gameRef.current.round);
      }
    } finally {
      inferenceBusyRef.current = false;
    }
  }, [addEvent, finishRound, zone]);

  const { fps } = useFrameLoop(videoRef, { enabled: status === "active" && (stage === "preview" || stage === "ready" || stage === "playing"), onFrame: (video, info) => void handleFrame(video, info.timestamp, info.delta) });

  useEffect(() => {
    if (status !== "active" || detectorRef.current) return;
    let cancelled = false;
    setModelStatus("loading");
    modelLoadingAtRef.current = performance.now();
    FilesetResolver.forVisionTasks("/mediapipe")
      .then((vision) => Promise.all([
        FaceDetector.createFromOptions(vision, { baseOptions: { modelAssetPath: "/mediapipe/blaze_face_short_range.tflite" }, runningMode: "VIDEO", minDetectionConfidence: 0.55 }),
        FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task" }, runningMode: "IMAGE", numFaces: 1 }),
      ]))
      .then(([detector, landmarker]) => {
        if (cancelled) { detector.close(); landmarker.close(); return; }
        detectorRef.current = detector;
        landmarkerRef.current = landmarker;
        modelReadyMsRef.current = Math.round(performance.now() - modelLoadingAtRef.current);
        setModelStatus("ready");
        setStage("ready");
        addEvent("MODEL_READY", undefined, undefined, modelReadyMsRef.current);
      })
      .catch((modelLoadError: unknown) => {
        if (cancelled) return;
        const message = modelLoadError instanceof Error ? modelLoadError.message : "MediaPipe 모델을 준비하지 못했습니다.";
        setModelError(message);
        setModelStatus("error");
        addEvent("MODEL_ERROR", message);
      });
    return () => { cancelled = true; };
  }, [addEvent, status]);

  useEffect(() => {
    if (stage !== "playing") return;
    roundTimerRef.current = window.setInterval(() => {
      const limit = timeLimitFor(gameRef.current.successes);
      const remaining = Math.max(0, limit - (performance.now() - roundStartedAtRef.current));
      setRemainingMs(remaining);
      if (remaining <= 0) finishRound("fail");
    }, 40);
    return () => {
      if (roundTimerRef.current) window.clearInterval(roundTimerRef.current);
      roundTimerRef.current = null;
    };
  }, [finishRound, stage]);

  useEffect(() => () => {
    try {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
      detectorRef.current?.close();
      landmarkerRef.current?.close();
      detectorRef.current = null;
      landmarkerRef.current = null;
      stopBgm();
      effectAudiosRef.current.forEach((audio) => audio.pause());
      effectAudiosRef.current.clear();
      eventsRef.current = [...eventsRef.current, { timestamp: Date.now(), type: "RESOURCE_CLEANUP", message: "페이지 이동 자원 정리 완료" }];
    } catch (cleanupError) {
      eventsRef.current = [...eventsRef.current, { timestamp: Date.now(), type: "RESOURCE_CLEANUP_ERROR", message: cleanupError instanceof Error ? cleanupError.message : "페이지 이동 자원 정리 오류" }];
    }
  }, [stopBgm]);

  useEffect(() => {
    if (status === "active") {
      cameraReadyMsRef.current = cameraRequestedAtRef.current ? Math.round(performance.now() - cameraRequestedAtRef.current) : 0;
      addEvent("CAMERA_CONNECTED", undefined, undefined, cameraReadyMsRef.current);
      if (detectorRef.current) {
        modelReadyMsRef.current = 0;
        addEvent("MODEL_READY", undefined, undefined, 0);
      }
    }
    if (status === "error") addEvent("CAMERA_ERROR", error ?? undefined);
  }, [addEvent, error, status]);

  const requestCamera = () => {
    eventsRef.current = [];
    cameraRequestedAtRef.current = performance.now();
    cameraReadyMsRef.current = 0;
    modelReadyMsRef.current = 0;
    setStage("preview");
    start();
  };
  const startGame = () => {
    gameRef.current = { round: 1, score: 0, successes: 0, failures: 0, startedAt: Date.now(), results: [] };
    setScore(0); setSuccesses(0); setFailures(0); setRoundResults([]);
    addEvent("GAME_STARTED");
    playAudio("bgm");
    beginRound(1);
  };
  const retry = () => { setStage("idle"); setLastResult(null); setFaceBox(null); setModelStatus(detectorRef.current ? "ready" : "idle"); };
  const isReadyScreen = stage === "idle" || stage === "preview" || stage === "ready";
  const currentLimit = timeLimitFor(successes);

  return (
    <AppShell activeStep={stage === "finished" ? 3 : 2} stageKey={stage}>
      {isReadyScreen && (
        <div className="ready-layout" style={{ "--choice": game3Meta.accent } as React.CSSProperties}>
          <div className="camera-preview">
            <div className="camera-bar"><span><i /> CAMERA PREVIEW</span><small>1280 × 720</small></div>
            <div className="camera-body">
              <video ref={videoRef} className="camera-video" autoPlay playsInline muted hidden={status !== "active"} />
              <div className="frame-corners"><i /><i /><i /><i /></div>
              {status !== "active" && <div className={`camera-placeholder${status === "error" ? " is-error" : ""}`}><Icon /><b>{statusLabel[status]?.title ?? statusLabel.idle.title}</b><span>{status === "error" && error ? error : statusLabel[status]?.description ?? statusLabel.idle.description}</span>{status !== "requesting" && <Button size="lg" className="camera-start-button" onClick={requestCamera}><Video fill="currentColor" /> {status === "error" ? "다시 시도" : "웹캠 켜기"}</Button>}</div>}
              {status === "active" && modelStatus !== "ready" && <div className="model-loading"><CircleGauge /> {modelStatus === "error" ? "MODEL ERROR" : "MODEL LOADING"}</div>}
              <div className="tracking-label"><span /> {modelStatus === "ready" ? "TRACKING READY" : statusLabel[status]?.tracking ?? "STANDBY"}</div>
            </div>
            <div className="camera-stats"><span><Cpu /> MODEL <b>{modelStatus.toUpperCase()}</b></span><span><CircleGauge /> FPS <b>{status === "active" ? fps.toFixed(1) : "--.-"}</b></span><span><Clock3 /> INFERENCE <b>{averageInference ? `${averageInference.toFixed(1)} ms` : "-- ms"}</b></span></div>
          </div>
          <div className="ready-info">
            <span className="screen-count">03 / 03 · {game3Meta.code}</span>
            <div className="ready-title"><span><Icon /></span><div><small>{game3Meta.tag}</small><h2>{game3Meta.title}</h2></div></div>
            <p className="ready-description">{game3Meta.description}</p>
            <div className="ready-player"><span><img src={characterImage} alt="" /></span><div><small>PLAYER</small><b>{playerName}</b></div><em>최대 10 라운드</em></div>
            <div className="check-list"><h3>시작 전 체크</h3>{game3Meta.checks.map((item) => <div key={item}><span><Check /></span>{item}</div>)}</div>
            {modelStatus === "error" && <p className="flow-message" role="alert">모델 준비 실패: {modelError}</p>}
            <div className="ready-actions"><Button variant="ghost" size="lg" onClick={() => router.push("/games")}><ArrowLeft /> 다른 게임</Button><Button size="lg" className="start-game" disabled={status !== "active" || modelStatus !== "ready"} onClick={startGame}><Play fill="currentColor" /> 게임 시작</Button></div>
            {(status !== "active" || modelStatus !== "ready") && <p className="ready-description">웹캠과 얼굴 감지 모델이 준비되면 시작할 수 있어요.</p>}
          </div>
        </div>
      )}

      {(stage === "playing" || stage === "roundTransition") && (
        <div className="play-layout chee-se-play">
          <div className="play-camera">
            <video ref={videoRef} className="camera-video" autoPlay playsInline muted />
            <div className="face-zone" style={{ left: `${zone.left * 100}%`, top: `${zone.top * 100}%`, width: `${zone.width * 100}%`, height: `${zone.height * 100}%` }}><span>FACE ZONE</span></div>
            <img ref={characterRef} className="zone-character" src={roundCharacter} alt="선택한 캐릭터" style={{ left: `${placement.left * 100}%`, top: `${placement.top * 100}%`, width: `${placement.width * 100}%`, height: `${placement.height * 100}%`, transform: `scale(${placement.flipX ? -1 : 1}, ${placement.flipY ? -1 : 1})` }} />
            {faceBox && <div className={`detected-face${contains(zone, faceBox) ? " is-inside" : ""}`} style={{ left: `${faceBox.left * 100}%`, top: `${faceBox.top * 100}%`, width: `${faceBox.width * 100}%`, height: `${faceBox.height * 100}%` }} />}
            <div className="play-hud"><div className="play-hud-item"><small>ROUND {round} / {MAX_ROUNDS}</small><b>{score} P</b><em>{failures} / {MAX_FAILURES} FAIL</em></div><div className={`play-hud-timer${remainingMs < 700 ? " is-urgent" : ""}`}><Clock3 /> {(remainingMs / 1000).toFixed(1)}s</div></div>
            {stage === "roundTransition" && <div className={`round-feedback ${lastResult}`}>{lastResult === "success" ? "+5 CHEE-SE!" : "-2 TIME OUT"}</div>}
            <div className="game-live-stats"><span>FPS {fps.toFixed(0)}</span><span>INFERENCE {averageInference.toFixed(1)}ms</span><span>TIME LIMIT {(currentLimit / 1000).toFixed(0)}s</span></div>
          </div>
          <div className="play-actions"><Button size="lg" variant="outline" onClick={() => finishGame()}><Flag /> 게임 종료</Button></div>
        </div>
      )}

      {stage === "finished" && <div className="game-finished"><span className="result-label">GAME COMPLETE!</span><div className="finished-icon"><ImageIcon /></div><h2>촬영 완료!</h2><p>{roundResults.length}라운드 · 성공 {successes}회 · 실패 {failures}회 · <b>{score}P</b></p><div className="result-actions"><Button variant="outline" size="lg" onClick={retry}><RotateCcw /> 다시 하기</Button><Button size="lg" onClick={() => router.push("/results")}>결과 확인</Button></div></div>}
    </AppShell>
  );
}
