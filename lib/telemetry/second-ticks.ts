// ProfilerSession(프레임/추론 기록)을 "플레이 시작 후 1초, 2초, 3초..." 구간으로 잘라서
// 각 구간의 평균 FPS / 최대 프레임 시간 / 평균 추론 시간을 계산하는 순수 함수.
// React와 무관하므로 훅이 아니라 일반 함수로 둔다.

import { ProfilerSession } from './use-resource-profiler'

export type SecondTick = { second: number; avgFps: number; maxFrameMs: number; avgInferenceMs: number | null; applesEaten: number[] }

export function buildSecondTicks(session: ProfilerSession): SecondTick[] {
  const playingStartedAt = session.stages.find((mark) => mark.stage === 'playing')?.t ?? session.startedAt
  const finishedAt = session.stages.find((mark) => mark.stage === 'finish')?.t ?? playingStartedAt
  const totalSeconds = Math.max(1, Math.ceil((finishedAt - playingStartedAt) / 1000))

  const ticks: SecondTick[] = []
  for (let second = 1; second <= totalSeconds; second++) {
    const bucketStart = playingStartedAt + (second - 1) * 1000
    const bucketEnd = playingStartedAt + second * 1000
    const frameBucket = session.samples.filter((sample) => sample.t >= bucketStart && sample.t < bucketEnd)
    const inferenceBucket = session.inferences.filter((sample) => sample.t >= bucketStart && sample.t < bucketEnd)
    const appleBucket = session.apples.filter((apple) => apple.t >= bucketStart && apple.t < bucketEnd)
    if (frameBucket.length === 0 && inferenceBucket.length === 0) continue
    const avgFps = frameBucket.length ? Math.round(frameBucket.reduce((sum, sample) => sum + sample.fps, 0) / frameBucket.length) : 0
    const maxFrameMs = frameBucket.length ? Math.max(...frameBucket.map((sample) => sample.deltaMs)) : 0
    const avgInferenceMs = inferenceBucket.length ? Math.round(inferenceBucket.reduce((sum, sample) => sum + sample.ms, 0) / inferenceBucket.length) : null
    const applesEaten = appleBucket.map((apple) => apple.count)
    ticks.push({ second, avgFps, maxFrameMs, avgInferenceMs, applesEaten })
  }
  return ticks
}
