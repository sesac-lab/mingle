export const GAME_LIMIT_MS = 60_000
export const APPLE_COUNT = 10
export const MOUTH_OPEN_THRESHOLD = 0.25

export type Point = {
  x: number
  y: number
}

export type Apple = Point & {
  id: string
  velocityX: number
  velocityY: number
  radius: number
}

export type CalibrationPoints = {
  leftEye: Point
  rightEye: Point
  forehead: Point
  mouth: Point
  chin: Point
}

export type GameResult = {
  applesEaten: number
  elapsedMs: number
  status: 'success' | 'timeout' | 'stopped'
}

export type FaceGeometry = {
  leftEye: Point
  rightEye: Point
  forehead: Point
  mouthCenter: Point
  chin: Point
}

export type CharacterTransform = {
  rotation: number
  scale: number
  sourceCenter: Point
  targetCenter: Point
}

export type PixelImageData = {
  width: number
  height: number
  data: Uint8ClampedArray
}

type Random = () => number

const RECORD_KEY = 'mingle:game-1:apple-eater:best-clear-ms:v1'

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function randomBetween(min: number, max: number, random: Random) {
  return min + (max - min) * random()
}

type CheckerColor = {
  red: number
  green: number
  blue: number
}

function getPixelColor(data: Uint8ClampedArray, index: number): CheckerColor {
  return { red: data[index], green: data[index + 1], blue: data[index + 2] }
}

function colorDistance(first: CheckerColor, second: CheckerColor) {
  return Math.abs(first.red - second.red) + Math.abs(first.green - second.green) + Math.abs(first.blue - second.blue)
}

function isLightNeutralPixel(data: Uint8ClampedArray, index: number) {
  const red = data[index]
  const green = data[index + 1]
  const blue = data[index + 2]
  return data[index + 3] > 0 && Math.min(red, green, blue) >= 200 && Math.max(red, green, blue) - Math.min(red, green, blue) <= 20
}

function findCheckerColors(image: PixelImageData): CheckerColor[] | null {
  const { width, height, data } = image
  const perimeter: number[] = []
  for (let x = 0; x < width; x += 1) {
    perimeter.push(x, (height - 1) * width + x)
  }
  for (let y = 1; y < height - 1; y += 1) {
    perimeter.push(y * width, y * width + width - 1)
  }
  const colors = new Map<string, { color: CheckerColor; count: number }>()
  perimeter.forEach((position) => {
    const index = position * 4
    if (!isLightNeutralPixel(data, index)) return
    const color = getPixelColor(data, index)
    const key = `${Math.round(color.red / 8)}-${Math.round(color.green / 8)}-${Math.round(color.blue / 8)}`
    const existing = colors.get(key)
    if (existing) existing.count += 1
    else colors.set(key, { color, count: 1 })
  })
  const commonColors = [...colors.values()]
    .filter((item) => item.count >= perimeter.length * 0.15)
    .sort((first, second) => second.count - first.count)

  for (let first = 0; first < commonColors.length; first += 1) {
    for (let second = first + 1; second < commonColors.length; second += 1) {
      const difference = colorDistance(commonColors[first].color, commonColors[second].color)
      if (difference >= 24 && difference <= 180) return [commonColors[first].color, commonColors[second].color]
    }
  }
  return null
}

export function removeCheckerboardBackground(image: PixelImageData) {
  const { width, height, data } = image
  if (!width || !height) return

  const checkerColors = findCheckerColors(image)
  if (!checkerColors) return

  const visited = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let queueEnd = 0
  const addIfBackground = (position: number) => {
    const pixelIndex = position * 4
    const isCheckerColor = checkerColors.some((color) => colorDistance(getPixelColor(data, pixelIndex), color) <= 36)
    if (visited[position] || !isCheckerColor) return
    visited[position] = 1
    queue[queueEnd] = position
    queueEnd += 1
  }

  for (let x = 0; x < width; x += 1) {
    addIfBackground(x)
    addIfBackground((height - 1) * width + x)
  }
  for (let y = 1; y < height - 1; y += 1) {
    addIfBackground(y * width)
    addIfBackground(y * width + width - 1)
  }

  for (let head = 0; head < queueEnd; head += 1) {
    const position = queue[head]
    const x = position % width
    const y = Math.floor(position / width)
    data[position * 4 + 3] = 0
    if (x > 0) addIfBackground(position - 1)
    if (x < width - 1) addIfBackground(position + 1)
    if (y > 0) addIfBackground(position - width)
    if (y < height - 1) addIfBackground(position + width)
  }
}

export function spawnApples(width: number, height: number, random: Random = Math.random): Apple[] {
  const radius = Math.max(18, Math.round(Math.min(width, height) * 0.0375))
  const margin = radius + 12

  return Array.from({ length: APPLE_COUNT }, (_, index) => {
    const side = Math.floor(random() * 4)
    const x = side === 1 ? width - margin : side === 3 ? margin : randomBetween(margin, width - margin, random)
    const y = side === 0 ? margin : side === 2 ? height - margin : randomBetween(margin, height - margin, random)
    const angle = random() * Math.PI * 2
    const speed = randomBetween(width * 0.1125, width * 0.253125, random)

    return {
      id: `apple-${index}`,
      x,
      y,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed,
      radius,
    }
  })
}

export function moveApples(apples: Apple[], width: number, height: number, deltaSeconds: number): Apple[] {
  return apples.map((apple) => {
    let x = apple.x + apple.velocityX * deltaSeconds
    let y = apple.y + apple.velocityY * deltaSeconds
    let velocityX = apple.velocityX
    let velocityY = apple.velocityY

    if (x - apple.radius <= 0 || x + apple.radius >= width) {
      velocityX *= -1
      x = Math.max(apple.radius, Math.min(width - apple.radius, x))
    }
    if (y - apple.radius <= 0 || y + apple.radius >= height) {
      velocityY *= -1
      y = Math.max(apple.radius, Math.min(height - apple.radius, y))
    }

    return { ...apple, x, y, velocityX, velocityY }
  })
}

export function eatApple(apples: Apple[], mouthCenter: Point | null, mouthRadius: Point | null, mouthOpen: boolean) {
  if (!mouthOpen || !mouthCenter || !mouthRadius) return { apples, ateApple: false }

  const appleIndex = apples.findIndex((apple) => {
    const horizontal = (apple.x - mouthCenter.x) / Math.max(mouthRadius.x, 1)
    const vertical = (apple.y - mouthCenter.y) / Math.max(mouthRadius.y, 1)
    return horizontal ** 2 + vertical ** 2 <= 1
  })

  if (appleIndex < 0) return { apples, ateApple: false }
  return { apples: apples.filter((_, index) => index !== appleIndex), ateApple: true }
}

export function getMouthData(landmarks: Point[], width: number, height: number, mirrored = true) {
  const toCanvasPoint = (landmark: Point) => ({ x: (mirrored ? 1 - landmark.x : landmark.x) * width, y: landmark.y * height })
  // 캔버스를 좌우 반전했으므로, 화면에서 보이는 왼쪽/오른쪽 순서에 맞춰 교환한다.
  const leftEye = toCanvasPoint(landmarks[263])
  const rightEye = toCanvasPoint(landmarks[33])
  const forehead = toCanvasPoint(landmarks[10])
  const chin = toCanvasPoint(landmarks[152])
  const upperLip = toCanvasPoint(landmarks[13])
  const lowerLip = toCanvasPoint(landmarks[14])
  const eyeDistance = Math.max(distance(leftEye, rightEye), 1)
  const mouthCenter = { x: (upperLip.x + lowerLip.x) / 2, y: (upperLip.y + lowerLip.y) / 2 }
  const mouthOpenRatio = distance(upperLip, lowerLip) / eyeDistance

  const mouthRadius = Math.max(18, eyeDistance * 0.42)

  return {
    mouthCenter,
    mouthOpenRatio,
    mouthOpen: mouthOpenRatio >= MOUTH_OPEN_THRESHOLD,
    mouthRadius: { x: mouthRadius, y: mouthRadius },
    leftEye,
    rightEye,
    forehead,
    chin,
  }
}

function normalizeUprightRotation(angle: number) {
  let normalized = Math.atan2(Math.sin(angle), Math.cos(angle))
  if (normalized > Math.PI / 2) normalized -= Math.PI
  if (normalized < -Math.PI / 2) normalized += Math.PI
  return normalized
}

function getCenter(points: Point[]) {
  const center = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), { x: 0, y: 0 })
  center.x /= points.length
  center.y /= points.length
  return center
}

export function calculateCharacterTransform(
  calibration: CalibrationPoints,
  face: FaceGeometry
): CharacterTransform | null {
  const sourcePoints = [calibration.leftEye, calibration.rightEye, calibration.forehead, calibration.mouth, calibration.chin]
  const targetPoints = [face.leftEye, face.rightEye, face.forehead, face.mouthCenter, face.chin]
  const sourceCenter = getCenter(sourcePoints)
  const targetCenter = getCenter(targetPoints)
  let rotationCosineSum = 0
  let rotationSineSum = 0
  let sourceVariance = 0

  sourcePoints.forEach((source, index) => {
    const target = targetPoints[index]
    const sourceX = source.x - sourceCenter.x
    const sourceY = source.y - sourceCenter.y
    const targetX = target.x - targetCenter.x
    const targetY = target.y - targetCenter.y
    rotationCosineSum += sourceX * targetX + sourceY * targetY
    rotationSineSum += sourceX * targetY - sourceY * targetX
    sourceVariance += sourceX ** 2 + sourceY ** 2
  })
  if (!sourceVariance) return null

  const rotation = normalizeUprightRotation(Math.atan2(rotationSineSum, rotationCosineSum))

  return {
    rotation,
    scale: Math.hypot(rotationCosineSum, rotationSineSum) / sourceVariance,
    sourceCenter,
    targetCenter,
  }
}

export function resolveLockedScale(lockedScale: number | null, suggestedScale: number | null) {
  return lockedScale ?? suggestedScale
}

export function lockScaleAfterSamples(samples: number[], suggestedScale: number | null, requiredSamples = 5) {
  if (suggestedScale === null) return { samples, lockedScale: null }
  const nextSamples = [...samples, suggestedScale].slice(-requiredSamples)
  if (nextSamples.length < requiredSamples) return { samples: nextSamples, lockedScale: null }
  const sorted = [...nextSamples].sort((first, second) => first - second)
  return { samples: nextSamples, lockedScale: sorted[Math.floor(sorted.length / 2)] }
}

export function loadBestClearTime(storage: Pick<Storage, 'getItem'> | null) {
  if (!storage) return null
  const value = Number(storage.getItem(RECORD_KEY))
  return Number.isFinite(value) && value > 0 ? value : null
}

export function saveBestClearTime(storage: Pick<Storage, 'getItem' | 'setItem'> | null, elapsedMs: number) {
  const current = loadBestClearTime(storage)
  const isNewRecord = current === null || elapsedMs < current
  if (storage && isNewRecord) storage.setItem(RECORD_KEY, String(Math.round(elapsedMs)))
  return { bestClearMs: isNewRecord ? elapsedMs : current, isNewRecord }
}

export function formatSeconds(milliseconds: number) {
  return (milliseconds / 1000).toFixed(2)
}
