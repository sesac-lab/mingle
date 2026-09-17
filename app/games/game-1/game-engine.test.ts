import { describe, expect, it } from 'vitest'
import { calculateCharacterTransform, eatApple, GAME_LIMIT_MS, getMouthData, loadBestClearTime, lockScaleAfterSamples, moveApples, removeCheckerboardBackground, resolveLockedScale, saveBestClearTime, spawnApples } from './game-engine'

describe('사과 게임 로직', () => {
  it('사과 10개를 화면 경계 안에 생성한다', () => {
    const apples = spawnApples(640, 480, () => 0.5)
    expect(apples).toHaveLength(10)
    expect(apples.every((apple) => apple.x >= apple.radius && apple.y >= apple.radius)).toBe(true)
  })

  it('사과를 벽에서 반사한다', () => {
    const [apple] = moveApples([{ id: 'apple', x: 630, y: 240, velocityX: 100, velocityY: 0, radius: 18 }], 640, 480, 1)
    expect(apple.velocityX).toBeLessThan(0)
    expect(apple.x).toBe(622)
  })

  it('입이 열린 한 프레임에는 사과 하나만 먹는다', () => {
    const result = eatApple([
      { id: 'one', x: 100, y: 100, velocityX: 0, velocityY: 0, radius: 18 },
      { id: 'two', x: 105, y: 105, velocityX: 0, velocityY: 0, radius: 18 },
    ], { x: 100, y: 100 }, { x: 30, y: 30 }, true)
    expect(result.ateApple).toBe(true)
    expect(result.apples).toHaveLength(1)
  })

  it('먹는 영역은 기존 세로 지름을 기준으로 한 원형이다', () => {
    const landmarks = Array.from({ length: 264 }, () => ({ x: 0.5, y: 0.5 }))
    landmarks[263] = { x: 0.7, y: 0.4 }
    landmarks[33] = { x: 0.3, y: 0.4 }
    landmarks[13] = { x: 0.5, y: 0.55 }
    landmarks[14] = { x: 0.5, y: 0.58 }
    const mouth = getMouthData(landmarks, 1000, 800)
    expect(mouth.mouthRadius.x).toBe(mouth.mouthRadius.y)
    expect(mouth.mouthRadius.y).toBeCloseTo(168)
  })

  it('원형 먹는 영역의 수평·수직 경계에서 같은 반지름을 사용한다', () => {
    const apples = [
      { id: 'horizontal', x: 130, y: 100, velocityX: 0, velocityY: 0, radius: 18 },
      { id: 'vertical', x: 100, y: 130, velocityX: 0, velocityY: 0, radius: 18 },
      { id: 'outside', x: 131, y: 100, velocityX: 0, velocityY: 0, radius: 18 },
    ]
    const first = eatApple(apples, { x: 100, y: 100 }, { x: 30, y: 30 }, true)
    const second = eatApple(first.apples, { x: 100, y: 100 }, { x: 30, y: 30 }, true)
    const third = eatApple(second.apples, { x: 100, y: 100 }, { x: 30, y: 30 }, true)
    expect(first.ateApple).toBe(true)
    expect(second.ateApple).toBe(true)
    expect(third.ateApple).toBe(false)
  })

  it('더 짧은 성공 시간만 최고 기록으로 저장한다', () => {
    const data = new Map<string, string>()
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) }
    expect(GAME_LIMIT_MS).toBe(60_000)
    expect(saveBestClearTime(storage, 20_000).isNewRecord).toBe(true)
    expect(saveBestClearTime(storage, 21_000).isNewRecord).toBe(false)
    expect(loadBestClearTime(storage)).toBe(20_000)
  })

  it('좌우 반전된 랜드마크도 화면 기준으로 직립 회전을 계산한다', () => {
    const landmarks = Array.from({ length: 264 }, () => ({ x: 0.5, y: 0.5 }))
    landmarks[263] = { x: 0.7, y: 0.4 }
    landmarks[33] = { x: 0.3, y: 0.4 }
    landmarks[10] = { x: 0.5, y: 0.2 }
    landmarks[152] = { x: 0.5, y: 0.8 }
    landmarks[13] = { x: 0.5, y: 0.55 }
    landmarks[14] = { x: 0.5, y: 0.58 }
    const face = getMouthData(landmarks, 1000, 800)
    const transform = calculateCharacterTransform({ leftEye: { x: 300, y: 300 }, rightEye: { x: 700, y: 300 }, forehead: { x: 500, y: 100 }, mouth: { x: 500, y: 450 }, chin: { x: 500, y: 700 } }, face)
    expect(transform?.rotation).toBeCloseTo(0)
    expect(Math.abs(transform?.rotation ?? Infinity)).toBeLessThanOrEqual(Math.PI / 2)
  })

  it('전신 이미지도 다섯 얼굴 기준점의 비율로 배율을 계산한다', () => {
    const calibration = { leftEye: { x: 300, y: 300 }, rightEye: { x: 700, y: 300 }, forehead: { x: 500, y: 100 }, mouth: { x: 500, y: 450 }, chin: { x: 500, y: 700 } }
    const face = { leftEye: { x: 600, y: 600 }, rightEye: { x: 1400, y: 600 }, forehead: { x: 1000, y: 200 }, mouthCenter: { x: 1000, y: 900 }, chin: { x: 1000, y: 1400 } }
    const transform = calculateCharacterTransform(calibration, face)
    expect(transform?.scale).toBeCloseTo(2)
  })

  it('다섯 기준점의 위치·회전·배율을 함께 맞춘다', () => {
    const calibration = { leftEye: { x: 0, y: 0 }, rightEye: { x: 100, y: 0 }, forehead: { x: 50, y: -50 }, mouth: { x: 50, y: 50 }, chin: { x: 50, y: 100 } }
    const face = { leftEye: { x: 400, y: 300 }, rightEye: { x: 400, y: 500 }, forehead: { x: 500, y: 400 }, mouthCenter: { x: 300, y: 400 }, chin: { x: 200, y: 400 } }
    const transform = calculateCharacterTransform(calibration, face)
    expect(transform).not.toBeNull()
    const sourcePoints = [calibration.leftEye, calibration.rightEye, calibration.forehead, calibration.mouth, calibration.chin]
    const targetPoints = [face.leftEye, face.rightEye, face.forehead, face.mouthCenter, face.chin]
    sourcePoints.forEach((point, index) => {
      const x = point.x - (transform?.sourceCenter.x ?? 0)
      const y = point.y - (transform?.sourceCenter.y ?? 0)
      const rotatedX = x * Math.cos(transform?.rotation ?? 0) - y * Math.sin(transform?.rotation ?? 0)
      const rotatedY = x * Math.sin(transform?.rotation ?? 0) + y * Math.cos(transform?.rotation ?? 0)
      expect((transform?.targetCenter.x ?? 0) + rotatedX * (transform?.scale ?? 0)).toBeCloseTo(targetPoints[index].x)
      expect((transform?.targetCenter.y ?? 0) + rotatedY * (transform?.scale ?? 0)).toBeCloseTo(targetPoints[index].y)
    })
  })

  it('첫 인식 배율은 이후 얼굴 크기가 달라져도 유지한다', () => {
    expect(resolveLockedScale(null, 1.24)).toBe(1.24)
    expect(resolveLockedScale(1.24, 0.82)).toBe(1.24)
  })

  it('초기 다섯 프레임의 중앙값으로 배율을 고정한다', () => {
    let samples: number[] = []
    ;[0.98, 1.01, 3, 1, 0.99].forEach((scale) => { samples = lockScaleAfterSamples(samples, scale).samples })
    expect(lockScaleAfterSamples([0.98, 1.01, 3, 1], 0.99).lockedScale).toBe(1)
    expect(samples).toHaveLength(5)
  })

  it('가장자리에 연결된 체크무늬 배경만 투명하게 만든다', () => {
    const width = 7
    const height = 7
    const data = new Uint8ClampedArray(width * height * 4)
    for (let position = 0; position < width * height; position += 1) {
      const shade = position % 2 ? 232 : 255
      data.set([shade, shade, shade, 255], position * 4)
    }
    for (let y = 2; y <= 4; y += 1) {
      for (let x = 2; x <= 4; x += 1) {
        if (x === 2 || x === 4 || y === 2 || y === 4) data.set([30, 120, 230, 255], (y * width + x) * 4)
      }
    }
    removeCheckerboardBackground({ width, height, data })
    expect(data[3]).toBe(0)
    expect(data[(3 * width + 3) * 4 + 3]).toBe(255)
    expect(data[(2 * width + 2) * 4 + 3]).toBe(255)
  })

  it('체크무늬가 아닌 흰색 캐릭터 가장자리는 유지한다', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4).fill(255)
    removeCheckerboardBackground({ width: 4, height: 4, data })
    expect(data.every((value, index) => index % 4 !== 3 || value === 255)).toBe(true)
  })
})
