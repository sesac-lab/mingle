'use client'

import { useCallback, useMemo, useRef } from 'react'

export type ProfilerStage = 'idle' | 'init' | 'playing' | 'finish'

export type FrameSample = { t: number; fps: number; deltaMs: number }
export type StageMark = { stage: ProfilerStage; t: number }
export type AppleEatenMark = { count: number; t: number }
export type InferenceSample = { t: number; ms: number }
export type ProfilerSession = { samples: FrameSample[]; stages: StageMark[]; apples: AppleEatenMark[]; inferences: InferenceSample[]; startedAt: number }
export type ResourceSummary = { avgFps: number; avgFrameMs: number; avgInferenceMs: number | null }

export type UseResourceProfilerResult = {
  recordFrame: (timestamp: number) => void
  recordStage: (stage: ProfilerStage) => void
  recordAppleEaten: (count: number) => void
  recordInference: (timestamp: number, ms: number) => void
  exportSession: () => ProfilerSession
  getSummary: () => ResourceSummary
  reset: () => void
}

// performance.now() 기반 rAF 타임스탬프를 epoch ms로 변환한다.
// Python system_profiler.py가 기록하는 time.time()*1000 과 기준을 맞추기 위함.
function toEpochMs(perfTimestamp: number) {
  return performance.timeOrigin + perfTimestamp
}

export function useResourceProfiler(): UseResourceProfilerResult {
  const samplesRef = useRef<FrameSample[]>([])
  const stagesRef = useRef<StageMark[]>([])
  const applesRef = useRef<AppleEatenMark[]>([])
  const inferencesRef = useRef<InferenceSample[]>([])
  const lastFrameEpochRef = useRef(0)
  const startedAtRef = useRef<number | null>(null)

  // performance.now() 호출과 ref 쓰기는 렌더링 중이 아니라 콜백(이벤트/effect) 안에서만 일어나야
  // React 19 순수성 규칙(react-hooks/purity, react-hooks/refs)을 위반하지 않는다.
  const ensureStarted = () => {
    if (startedAtRef.current == null) startedAtRef.current = toEpochMs(performance.now())
    return startedAtRef.current
  }

  const recordFrame = useCallback((timestamp: number) => {
    ensureStarted()
    const epochMs = toEpochMs(timestamp)
    const last = lastFrameEpochRef.current
    lastFrameEpochRef.current = epochMs
    if (!last) return
    const deltaMs = epochMs - last
    const fps = deltaMs > 0 ? Math.round(1000 / deltaMs) : 0
    samplesRef.current.push({ t: epochMs, fps, deltaMs: Math.round(deltaMs) })
  }, [])

  const recordStage = useCallback((stage: ProfilerStage) => {
    ensureStarted()
    const marks = stagesRef.current
    if (marks.length && marks[marks.length - 1].stage === stage) return
    marks.push({ stage, t: toEpochMs(performance.now()) })
  }, [])

  // 사과를 먹은 순간의 시각(t)을 기록한다. 1초 단위 표에서 "몇 초에 먹었는지" 표시할 때 쓴다.
  const recordAppleEaten = useCallback((count: number) => {
    const lastSample = samplesRef.current[samplesRef.current.length - 1]
    applesRef.current.push({ count, t: lastSample ? lastSample.t : ensureStarted() })
  }, [])

  // 얼굴 인식(MediaPipe) 한 번 호출하는 데 실제로 몇 ms 걸렸는지 기록한다.
  // 이 값은 브라우저에서 실제로 CPU를 많이 쓰는 작업이라 1초마다 변화를 보여주기에 적합하다.
  const recordInference = useCallback((timestamp: number, ms: number) => {
    inferencesRef.current.push({ t: toEpochMs(timestamp), ms: Math.round(ms) })
  }, [])

  const exportSession = useCallback((): ProfilerSession => ({
    samples: [...samplesRef.current],
    stages: [...stagesRef.current],
    apples: [...applesRef.current],
    inferences: [...inferencesRef.current],
    startedAt: ensureStarted(),
  }), [])

  const getSummary = useCallback((): ResourceSummary => {
    const samples = samplesRef.current
    const inferences = inferencesRef.current
    const avgFps = samples.length ? Math.round(samples.reduce((sum, sample) => sum + sample.fps, 0) / samples.length) : 0
    const avgFrameMs = samples.length ? Math.round(samples.reduce((sum, sample) => sum + sample.deltaMs, 0) / samples.length) : 0
    const avgInferenceMs = inferences.length ? Math.round(inferences.reduce((sum, sample) => sum + sample.ms, 0) / inferences.length) : null
    return { avgFps, avgFrameMs, avgInferenceMs }
  }, [])

  // 새 판을 시작하기 전에 호출해서 이전 판 기록을 전부 비운다.
  // 이걸 안 하면 "다시 하기"로 재도전할 때 이전 판 샘플/사과 기록이 새 판 것과 섞여버린다.
  const reset = useCallback(() => {
    samplesRef.current = []
    stagesRef.current = []
    applesRef.current = []
    inferencesRef.current = []
    lastFrameEpochRef.current = 0
    startedAtRef.current = null
  }, [])

  return useMemo(() => ({ recordFrame, recordStage, recordAppleEaten, recordInference, exportSession, getSummary, reset }), [recordFrame, recordStage, recordAppleEaten, recordInference, exportSession, getSummary, reset])
}
