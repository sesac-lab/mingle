"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceDetector } from "@mediapipe/tasks-vision";

export type FaceMaskPosition = {
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
};

type FaceMaskState = "loading" | "searching" | "tracking" | "error";

const DETECTION_INTERVAL_MS = 100;

export function useFaceMask(enabled: boolean) {
  const detectorRef = useRef<FaceDetector | null>(null);
  const lastDetectionRef = useRef(0);
  const previousPositionRef = useRef<FaceMaskPosition | null>(null);
  const [position, setPosition] = useState<FaceMaskPosition | null>(null);
  const [state, setState] = useState<FaceMaskState>("loading");
  const [inferenceMs, setInferenceMs] = useState(0);

  useEffect(() => {
    if (!enabled || detectorRef.current) return;

    let cancelled = false;

    const loadDetector = async () => {
      try {
        setState("loading");
        const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks("/game-2/wasm");
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "/game-2/blaze_face_short_range.tflite" },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.55,
        });

        if (cancelled) {
          detector.close();
          return;
        }

        detectorRef.current = detector;
        setState("searching");
      } catch (error) {
        console.error("Face detector initialization failed", error);
        if (!cancelled) setState("error");
      }
    };

    void loadDetector();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(
    () => () => {
      detectorRef.current?.close();
      detectorRef.current = null;
    },
    []
  );

  const onFrame = useCallback((video: HTMLVideoElement, timestamp: number) => {
    const detector = detectorRef.current;
    if (!detector || timestamp - lastDetectionRef.current < DETECTION_INTERVAL_MS) return;
    lastDetectionRef.current = timestamp;

    const startedAt = performance.now();
    const detection = detector.detectForVideo(video, timestamp).detections[0];
    setInferenceMs(performance.now() - startedAt);

    const boundingBox = detection?.boundingBox;
    if (!boundingBox || !video.videoWidth || !video.videoHeight) {
      setState("searching");
      setPosition(null);
      previousPositionRef.current = null;
      return;
    }

    const host = video.parentElement;
    if (!host) return;

    const hostRect = host.getBoundingClientRect();
    const scale = Math.max(hostRect.width / video.videoWidth, hostRect.height / video.videoHeight);
    const renderedWidth = video.videoWidth * scale;
    const renderedHeight = video.videoHeight * scale;
    const cropX = (renderedWidth - hostRect.width) / 2;
    const cropY = (renderedHeight - hostRect.height) / 2;

    // Face Detector keypoints 0 and 1 are the eyes. Convert them to the
    // mirrored, object-fit: cover coordinate system used by the preview.
    const eyes = detection.keypoints.slice(0, 2).map((keypoint) => ({
      x: (video.videoWidth * (1 - keypoint.x)) * scale - cropX,
      y: video.videoHeight * keypoint.y * scale - cropY,
    }));

    const hasEyePair = eyes.length === 2;
    const [screenLeftEye, screenRightEye] = hasEyePair ? [...eyes].sort((a, b) => a.x - b.x) : eyes;
    const rotation = hasEyePair
      ? Math.atan2(screenRightEye.y - screenLeftEye.y, screenRightEye.x - screenLeftEye.x)
      : 0;

    // Cover the whole head instead of locking the character eyes to the user.
    // The PNG includes leaves above its white face, so its center sits higher
    // than the detected face center and extends below the jaw.
    const faceWidth = boundingBox.width * scale;
    const faceHeight = boundingBox.height * scale;
    const width = faceWidth * 1.72;
    const height = faceHeight * 1.8;
    const centerX = (video.videoWidth - boundingBox.originX - boundingBox.width / 2) * scale - cropX;
    const centerY = (boundingBox.originY + boundingBox.height * 0.3) * scale - cropY;
    const next = {
      left: centerX - width / 2,
      top: centerY - height / 2,
      width,
      height,
      rotation,
    };

    const previous = previousPositionRef.current;
    const smoothing = previous ? 0.34 : 1;
    const smoothed = previous
      ? {
          left: previous.left + (next.left - previous.left) * smoothing,
          top: previous.top + (next.top - previous.top) * smoothing,
          width: previous.width + (next.width - previous.width) * smoothing,
          height: previous.height + (next.height - previous.height) * smoothing,
          rotation: previous.rotation + (next.rotation - previous.rotation) * smoothing,
        }
      : next;

    previousPositionRef.current = smoothed;
    setPosition(smoothed);
    setState("tracking");
  }, []);

  return {
    position: enabled ? position : null,
    state: enabled ? state : "loading",
    inferenceMs: enabled ? inferenceMs : 0,
    onFrame,
  };
}
