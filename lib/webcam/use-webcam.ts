"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type WebcamStatus = "idle" | "requesting" | "active" | "error";

export type UseWebcamOptions = {
  /** getUserMedia video constraints. 기본값은 1280x720 전면 카메라. */
  constraints?: MediaTrackConstraints;
  /** 마운트 시 자동으로 카메라를 시작할지 여부 (기본 true) */
  autoStart?: boolean;
};

export type UseWebcamResult = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: WebcamStatus;
  error: string | null;
  start: () => void;
  stop: () => void;
};

const DEFAULT_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  facingMode: "user",
};

function requestCameraStream(constraints: MediaTrackConstraints): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new Error("이 브라우저에서는 웹캠 기능을 지원하지 않습니다."));
  }
  return navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
}

/**
 * 웹캠 스트림 획득/해제만 담당하는 공용 훅.
 * 각 게임은 videoRef를 <video>에 꽂아 미리보기로 쓰거나,
 * useFrameLoop과 함께 프레임 단위 처리(필터/이펙트/포즈 인식 등)에 활용한다.
 */
export function useWebcam(options: UseWebcamOptions = {}): UseWebcamResult {
  const { constraints = DEFAULT_VIDEO_CONSTRAINTS, autoStart = true } = options;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<WebcamStatus>(() => (autoStart ? "requesting" : "idle"));
  const [error, setError] = useState<string | null>(null);

  // 스트림 획득 자체는 setState를 동기적으로 호출하지 않는다 - 결과는
  // then/catch 콜백 안에서만 반영되므로 effect 안에서 직접 불러도 안전하다.
  const attach = useCallback((videoConstraints: MediaTrackConstraints) => {
    requestCameraStream(videoConstraints)
      .then((stream) => {
        if (!mountedRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // 화면 전환/언마운트 중 재생이 중단되는 건 정상 상황이라 무시한다.
          videoRef.current.play().catch(() => {});
        }
        setStatus("active");
        setError(null);
      })
      .catch((err: unknown) => {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : "웹캠에 접근할 수 없습니다.");
        setStatus("error");
      });
  }, []);

  const start = useCallback(() => {
    setStatus("requesting");
    setError(null);
    attach(constraints);
  }, [attach, constraints]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus("idle");
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (autoStart) {
      attach(constraints);
    }
    return () => {
      mountedRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // <video>가 다른 화면(예: ready → playing)으로 옮겨가며 새로 마운트되면
  // videoRef.current가 새 엘리먼트로 바뀌는데, 그 엘리먼트에는 아직 스트림이
  // 연결돼 있지 않다. 매 렌더 뒤에 동기화해서 화면이 바뀌어도 영상이 끊기지 않게 한다.
  useEffect(() => {
    if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  });

  return { videoRef, status, error, start, stop };
}
