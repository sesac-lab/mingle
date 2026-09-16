"use client";

import { useEffect, useRef, useState } from "react";

export type FrameInfo = {
  /** requestAnimationFrame 타임스탬프(ms) */
  timestamp: number;
  /** 이전 프레임과의 간격(ms) */
  delta: number;
};

export type UseFrameLoopOptions = {
  /** false면 루프를 돌지 않는다 (기본 true) */
  enabled?: boolean;
  /**
   * 매 프레임 호출된다. video 엘리먼트를 그대로 넘겨주므로
   * 얼굴 필터 합성, 이펙트 렌더링, CV 모델 추론 등 게임별 로직을
   * 여기서 자유롭게 구현하면 된다.
   */
  onFrame?: (video: HTMLVideoElement, info: FrameInfo) => void;
};

export type UseFrameLoopResult = {
  /** 최근 0.5초 구간 기준으로 계산한 실측 FPS. enabled가 false면 0. */
  fps: number;
};

/**
 * 비디오 프레임 루프(requestAnimationFrame) + FPS 측정만 공통화한 훅.
 * 실제로 프레임에 무엇을 그리는지는 onFrame 콜백을 쓰는 쪽(게임)에서 결정한다.
 */
export function useFrameLoop(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  { enabled = true, onFrame }: UseFrameLoopOptions = {}
): UseFrameLoopResult {
  const [fps, setFps] = useState(0);
  const onFrameRef = useRef(onFrame);

  useEffect(() => {
    onFrameRef.current = onFrame;
  });

  useEffect(() => {
    if (!enabled) return;

    let rafId = 0;
    let lastTimestamp = 0;
    let frameCount = 0;
    let fpsWindowStart = 0;

    const loop = (timestamp: number) => {
      const video = videoRef.current;
      if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const delta = lastTimestamp ? timestamp - lastTimestamp : 0;
        lastTimestamp = timestamp;
        onFrameRef.current?.(video, { timestamp, delta });

        frameCount += 1;
        if (!fpsWindowStart) fpsWindowStart = timestamp;
        const elapsed = timestamp - fpsWindowStart;
        if (elapsed >= 500) {
          setFps(Math.round((frameCount * 1000) / elapsed));
          frameCount = 0;
          fpsWindowStart = timestamp;
        }
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [enabled, videoRef]);

  return { fps: enabled ? fps : 0 };
}
