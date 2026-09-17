'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Clock3, RotateCcw, Trophy, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppShell } from '@/components/common/app-shell'
import { usePlayer } from '@/lib/player-context'
import { useWebcam } from '@/lib/webcam'
import { ResourceSummary, useResourceProfiler } from '@/lib/telemetry/use-resource-profiler'
import { buildSecondTicks, SecondTick } from '@/lib/telemetry/second-ticks'
import { ResourceChart } from './resource-chart'
import { game1Meta } from './meta'
import { APPLE_COUNT, calculateCharacterTransform, CalibrationPoints, eatApple, formatSeconds, GAME_LIMIT_MS, GameResult, getMouthData, loadBestClearTime, lockScaleAfterSamples, mapSourcePoint, moveApples, Point, removeCheckerboardBackground, resolveLockedScale, saveBestClearTime, spawnApples } from './game-engine'
import styles from './game-1.module.css'

type Stage = 'ready' | 'calibrating' | 'playing' | 'result'
type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'
type Landmark = { x: number; y: number }
type FaceData = ReturnType<typeof getMouthData>

const calibrationSteps: Array<{ key: keyof CalibrationPoints; label: string; description: string }> = [
  { key: 'leftEye', label: '왼쪽 눈', description: '이미지에서 보이는 방향 기준 왼쪽 눈 중심을 클릭하세요.' },
  { key: 'rightEye', label: '오른쪽 눈', description: '이미지에서 보이는 방향 기준 오른쪽 눈 중심을 클릭하세요.' },
  { key: 'forehead', label: '이마', description: '이미지에서 보이는 방향 기준 이마 중앙을 클릭하세요.' },
  { key: 'mouth', label: '입', description: '이미지에서 보이는 방향 기준 입 중심을 클릭하세요.' },
  { key: 'chin', label: '턱', description: '이미지에서 보이는 방향 기준 턱 끝을 클릭하세요.' },
]

function drawApple(context: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  context.save()
  context.fillStyle = '#ef4f5f'
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#fff1f2'
  context.beginPath()
  context.ellipse(x - radius * 0.28, y - radius * 0.3, radius * 0.2, radius * 0.33, -0.45, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#52b96b'
  context.beginPath()
  context.ellipse(x + radius * 0.22, y - radius * 0.92, radius * 0.38, radius * 0.16, -0.7, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

function createCharacterCanvas(image: HTMLImageElement) {
  const canvas = document.createElement('canvas')
  const maximumSide = 1600
  const scale = Math.min(1, maximumSide / Math.max(image.naturalWidth, image.naturalHeight))
  canvas.width = Math.round(image.naturalWidth * scale)
  canvas.height = Math.round(image.naturalHeight * scale)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  removeCheckerboardBackground(imageData)
  context.putImageData(imageData, 0, 0)
  return canvas
}

function drawCharacter(context: CanvasRenderingContext2D, image: HTMLCanvasElement, calibration: CalibrationPoints, face: FaceData, lockedScale: number | null, mouthRadius: number) {
  const transform = calculateCharacterTransform(calibration, face)
  if (!transform) return null
  const scale = lockedScale ?? transform.scale
  context.save()
  context.translate(transform.targetCenter.x, transform.targetCenter.y)
  context.rotate(transform.rotation)
  context.scale(scale, scale)
  context.translate(-transform.sourceCenter.x, -transform.sourceCenter.y)
  context.drawImage(image, 0, 0)
  context.restore()
  const mouthCenter = mapSourcePoint(transform, calibration.mouth, scale)
  if (face.mouthOpen) {
    context.fillStyle = 'rgba(47, 22, 44, 0.85)'
    context.beginPath()
    context.arc(mouthCenter.x, mouthCenter.y, mouthRadius, 0, Math.PI * 2)
    context.fill()
  }
  return { suggestedScale: transform.scale, mouthCenter }
}

function playEffect(src: string, volume = 0.6) {
  const audio = new Audio(src)
  audio.volume = volume
  audio.play().catch(() => {})
}

function playEatSound(audioContext: AudioContext | null) {
  if (!audioContext) return
  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()
  oscillator.type = 'triangle'
  oscillator.frequency.setValueAtTime(520, audioContext.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(860, audioContext.currentTime + 0.12)
  gain.gain.setValueAtTime(0.096, audioContext.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.14)
  oscillator.connect(gain)
  gain.connect(audioContext.destination)
  oscillator.start()
  oscillator.stop(audioContext.currentTime + 0.15)
}

export default function Game1Page() {
  const router = useRouter()
  const { playerName, characterImage } = usePlayer()
  const { videoRef, status: cameraStatus, error: cameraError, start, stop } = useWebcam({ autoStart: false })
  const profiler = useResourceProfiler()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const calibrationImageRef = useRef<HTMLImageElement | null>(null)
  const landmarkerRef = useRef<{ detectForVideo: (video: HTMLVideoElement, timestamp: number) => { faceLandmarks: Landmark[][] }; close: () => void } | null>(null)
  const characterImageRef = useRef<HTMLCanvasElement | null>(null)
  const applesRef = useRef<ReturnType<typeof spawnApples>>([])
  const faceDataRef = useRef<FaceData | null>(null)
  const bgmRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const startedAtRef = useRef(0)
  const lastFrameRef = useRef(0)
  const lastInferenceRef = useRef(0)
  const endedRef = useRef(false)
  const lockedCharacterScaleRef = useRef<number | null>(null)
  const initialScaleSamplesRef = useRef<number[]>([])
  const lockedMouthRadiusRef = useRef<number | null>(null)
  const initialMouthRadiusSamplesRef = useRef<number[]>([])
  const [stage, setStage] = useState<Stage>('ready')
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle')
  const [modelError, setModelError] = useState('')
  const [calibration, setCalibration] = useState<Partial<CalibrationPoints>>({})
  const [result, setResult] = useState<GameResult | null>(null)
  const [bestClearMs, setBestClearMs] = useState<number | null>(null)
  const [isNewRecord, setIsNewRecord] = useState(false)
  const [hud, setHud] = useState({ applesEaten: 0, remainingMs: GAME_LIMIT_MS, mouthOpen: false, faceFound: false })
  const [resourceSummary, setResourceSummary] = useState<ResourceSummary | null>(null)
  const [secondTicks, setSecondTicks] = useState<SecondTick[]>([])
  const [calibrationImageSize, setCalibrationImageSize] = useState({ width: 0, height: 0 })
  const [calibrationCharacterImage, setCalibrationCharacterImage] = useState(characterImage)
  const calibrationComplete = calibrationSteps.every((step) => calibration[step.key])

  useEffect(() => {
    const image = new Image()
    image.src = characterImage
    image.onload = () => {
      try {
        const canvas = createCharacterCanvas(image)
        if (!canvas) return
        characterImageRef.current = canvas
        setCalibrationCharacterImage(canvas.toDataURL('image/png'))
      } catch {
        characterImageRef.current = null
        setCalibrationCharacterImage(characterImage)
      }
    }
    return () => { characterImageRef.current = null }
  }, [characterImage])

  const initializeModel = useCallback(async () => {
    if (landmarkerRef.current || modelStatus === 'loading') return
    setModelStatus('loading')
    setModelError('')
    try {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
      const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
      landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: '/mediapipe/face_landmarker.task' }, runningMode: 'VIDEO', numFaces: 1, minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5 })
      setModelStatus('ready')
    } catch (error: unknown) {
      setModelStatus('error')
      setModelError(error instanceof Error ? error.message : '얼굴 인식 엔진을 준비하지 못했습니다.')
    }
  }, [modelStatus])

  useEffect(() => () => { landmarkerRef.current?.close(); bgmRef.current?.pause(); audioContextRef.current?.close().catch(() => {}) }, [])

  useEffect(() => { profiler.recordStage('idle') }, [profiler])

  const prepareCamera = () => {
    profiler.reset()
    profiler.recordStage('init')
    if (cameraStatus === 'idle' || cameraStatus === 'error') start()
    if (!audioContextRef.current) audioContextRef.current = new AudioContext()
    if (modelStatus === 'error') {
      setModelStatus('idle')
      setModelError('')
    }
    void initializeModel()
  }

  const finishGame = useCallback((status: GameResult['status'], elapsedMs: number) => {
    if (endedRef.current) return
    endedRef.current = true
    profiler.recordStage('finish')
    const session = profiler.exportSession()
    setResourceSummary(profiler.getSummary())
    setSecondTicks(buildSecondTicks(session))
    const gameResult = { status, elapsedMs: Math.min(elapsedMs, GAME_LIMIT_MS), applesEaten: APPLE_COUNT - applesRef.current.length }
    setResult(gameResult)
    if (status === 'success') {
      const record = saveBestClearTime(window.localStorage, gameResult.elapsedMs)
      setBestClearMs(record.bestClearMs)
      setIsNewRecord(record.isNewRecord)
    } else {
      setBestClearMs(loadBestClearTime(window.localStorage))
      setIsNewRecord(false)
    }
    bgmRef.current?.pause()
    playEffect(status === 'success' ? '/sound/default-success.mp3' : status === 'timeout' ? '/sound/default-fail.mp3' : '/sound/default-end.mp3')
    stop()
    setStage('result')
  }, [profiler, stop])

  const beginPlaying = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    profiler.recordStage('playing')
    applesRef.current = spawnApples(video.videoWidth || 1280, video.videoHeight || 720)
    startedAtRef.current = performance.now()
    lastFrameRef.current = 0
    lastInferenceRef.current = 0
    endedRef.current = false
    lockedCharacterScaleRef.current = null
    initialScaleSamplesRef.current = []
    lockedMouthRadiusRef.current = null
    initialMouthRadiusSamplesRef.current = []
    setResult(null)
    setHud({ applesEaten: 0, remainingMs: GAME_LIMIT_MS, mouthOpen: false, faceFound: false })
    if (!bgmRef.current) {
      bgmRef.current = new Audio('/sound/default-bgm.mp3')
      bgmRef.current.loop = true
      bgmRef.current.volume = 0.32
    }
    bgmRef.current.currentTime = 0
    bgmRef.current.play().catch(() => {})
    setStage('playing')
  }, [profiler, videoRef])

  useEffect(() => {
    if (stage !== 'playing') return
    let animationFrame = 0
    const render = (timestamp: number) => {
      const canvas = canvasRef.current
      const video = videoRef.current
      const context = canvas?.getContext('2d')
      if (!canvas || !video || !context || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) { animationFrame = requestAnimationFrame(render); return }
      profiler.recordFrame(timestamp)
      const width = video.videoWidth || 1280
      const height = video.videoHeight || 720
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
      context.save()
      context.translate(width, 0)
      context.scale(-1, 1)
      context.drawImage(video, 0, 0, width, height)
      context.restore()
      if (landmarkerRef.current && timestamp - lastInferenceRef.current >= 50) {
        lastInferenceRef.current = timestamp
        const inferenceStartedAt = performance.now()
        const landmarks = landmarkerRef.current.detectForVideo(video, timestamp).faceLandmarks[0]
        profiler.recordInference(timestamp, performance.now() - inferenceStartedAt)
        faceDataRef.current = landmarks ? getMouthData(landmarks, width, height) : null
      }
      const faceData = faceDataRef.current
      const character = characterImageRef.current
      if (faceData && lockedMouthRadiusRef.current === null) {
        const lock = lockScaleAfterSamples(initialMouthRadiusSamplesRef.current, faceData.mouthRadius.y)
        initialMouthRadiusSamplesRef.current = lock.samples
        lockedMouthRadiusRef.current = resolveLockedScale(lockedMouthRadiusRef.current, lock.lockedScale)
      }
      const mouthRadiusValue = lockedMouthRadiusRef.current ?? faceData?.mouthRadius.y ?? 0
      let hitTestMouthCenter: Point | null = faceData?.mouthCenter ?? null
      if (faceData && character && calibrationComplete) {
        const drawResult = drawCharacter(context, character, calibration as CalibrationPoints, faceData, lockedCharacterScaleRef.current, mouthRadiusValue)
        if (drawResult) {
          hitTestMouthCenter = drawResult.mouthCenter
          if (lockedCharacterScaleRef.current === null) {
            const lock = lockScaleAfterSamples(initialScaleSamplesRef.current, drawResult.suggestedScale)
            initialScaleSamplesRef.current = lock.samples
            lockedCharacterScaleRef.current = resolveLockedScale(lockedCharacterScaleRef.current, lock.lockedScale)
          }
        }
      }
      const deltaSeconds = lastFrameRef.current ? Math.min((timestamp - lastFrameRef.current) / 1000, 0.1) : 0
      lastFrameRef.current = timestamp
      applesRef.current = moveApples(applesRef.current, width, height, deltaSeconds)
      const eaten = eatApple(applesRef.current, hitTestMouthCenter, { x: mouthRadiusValue, y: mouthRadiusValue }, faceData?.mouthOpen ?? false)
      applesRef.current = eaten.apples
      if (eaten.ateApple) {
        playEatSound(audioContextRef.current)
        profiler.recordAppleEaten(APPLE_COUNT - applesRef.current.length)
      }
      applesRef.current.forEach((apple) => drawApple(context, apple.x, apple.y, apple.radius))
      const elapsedMs = timestamp - startedAtRef.current
      setHud({ applesEaten: APPLE_COUNT - applesRef.current.length, remainingMs: Math.max(0, GAME_LIMIT_MS - elapsedMs), mouthOpen: faceData?.mouthOpen ?? false, faceFound: Boolean(faceData) })
      if (applesRef.current.length === 0) { finishGame('success', elapsedMs); return }
      if (elapsedMs >= GAME_LIMIT_MS) { finishGame('timeout', elapsedMs); return }
      animationFrame = requestAnimationFrame(render)
    }
    animationFrame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animationFrame)
  }, [calibration, calibrationComplete, finishGame, profiler, stage, videoRef])

  const addCalibrationPoint = (event: React.MouseEvent<HTMLImageElement>) => {
    const image = calibrationImageRef.current
    const step = calibrationSteps.find((item) => !calibration[item.key])
    if (!image || !step || !image.naturalWidth || !image.naturalHeight) return
    const bounds = image.getBoundingClientRect()
    setCalibration((points) => ({ ...points, [step.key]: { x: ((event.clientX - bounds.left) / bounds.width) * image.naturalWidth, y: ((event.clientY - bounds.top) / bounds.height) * image.naturalHeight } }))
  }
  const undoCalibration = () => {
    const latest = calibrationSteps.filter((step) => calibration[step.key]).at(-1)
    if (!latest) return
    setCalibration((points) => { const next = { ...points }; delete next[latest.key]; return next })
  }
  const startFlow = () => { if (calibrationComplete) beginPlaying(); else setStage('calibrating') }
  const currentStep = calibrationSteps.find((step) => !calibration[step.key])
  const cameraReady = cameraStatus === 'active' && modelStatus === 'ready'

  return <AppShell activeStep={stage === 'result' ? 3 : 2} stageKey={stage}>
    <video ref={videoRef} className={styles.hiddenVideo} autoPlay playsInline muted />
    <div className={styles.game} style={{ '--choice': game1Meta.accent } as React.CSSProperties}>
      {stage === 'ready' && <section className={styles.ready}>
        <div className={styles.preview}><Video aria-hidden="true" /><strong>{cameraStatus === 'error' ? '카메라를 사용할 수 없어요' : cameraStatus === 'active' ? '카메라가 준비됐어요' : '웹캠을 준비해주세요'}</strong><span>{cameraStatus === 'error' ? cameraError : '버튼을 눌러 카메라 권한을 허용해주세요.'}</span><Button size="lg" onClick={prepareCamera} disabled={cameraStatus === 'requesting'}><Video fill="currentColor" />{cameraStatus === 'error' ? '다시 시도' : '웹캠 켜기'}</Button>{modelStatus === 'loading' && <p>얼굴 인식 엔진을 준비하는 중이에요.</p>}{modelStatus === 'error' && <p className={styles.error}>인식 엔진 오류: {modelError}</p>}</div>
        <div className={styles.readyInfo}><span className="screen-count">03 / 03 · {game1Meta.code}</span><h1>{game1Meta.title}</h1><p>{game1Meta.description}</p><p className={styles.player}>플레이어 <b>{playerName}</b></p><ul>{game1Meta.checks.map((item) => <li key={item}><Check />{item}</li>)}</ul><div className={styles.actions}><Button variant="ghost" size="lg" onClick={() => router.push('/games')}><ArrowLeft /> 다른 게임</Button><Button size="lg" onClick={startFlow} disabled={!cameraReady}><Video fill="currentColor" /> 게임 시작</Button></div>{!cameraReady && <small>카메라와 얼굴 인식 엔진이 준비되면 게임을 시작할 수 있어요.</small>}</div>
      </section>}
      {stage === 'calibrating' && <section className={styles.calibration}><div><span className="screen-count">캐릭터 보정 · {Object.keys(calibration).length} / 5</span><h1>캐릭터 얼굴 위치를<br />알려주세요.</h1><p>{currentStep?.description ?? '이미지에서 보이는 방향을 기준으로 왼쪽부터 찍어주세요.'}</p><div className={styles.calibrationSteps}>{calibrationSteps.map((step, index) => <span key={step.key} className={calibration[step.key] ? styles.done : ''}>{index + 1}. 화면 기준 {step.label}</span>)}</div><div className={styles.actions}><Button variant="outline" onClick={undoCalibration} disabled={!Object.keys(calibration).length}>이전 점</Button><Button onClick={beginPlaying} disabled={!calibrationComplete}>보정 완료하고 시작</Button></div></div><div className={styles.calibrationImageWrap}><div className={styles.calibrationImageStage}><img ref={calibrationImageRef} src={calibrationCharacterImage} alt="캐릭터 기준점 설정" onClick={addCalibrationPoint} onLoad={(event) => setCalibrationImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />{calibrationSteps.map((step, index) => { const point = calibration[step.key]; return point && calibrationImageSize.width ? <i key={step.key} style={{ left: `${(point.x / calibrationImageSize.width) * 100}%`, top: `${(point.y / calibrationImageSize.height) * 100}%` }}>{index + 1}</i> : null })}</div></div></section>}
      {stage === 'playing' && <section className={styles.playing}><div className={styles.canvasWrap}><canvas ref={canvasRef} aria-label="사과 먹기 게임 화면" /><div className={styles.hud}><strong>사과 <b>{hud.applesEaten}</b> / {APPLE_COUNT}</strong><strong><Clock3 /> {Math.ceil(hud.remainingMs / 1000)}초</strong></div><div className={styles.status}>{hud.faceFound ? (hud.mouthOpen ? '입 열림 · 사과를 먹을 수 있어요!' : '입을 벌려 사과를 먹어보세요') : '얼굴을 찾는 중이에요'}</div></div><Button variant="outline" onClick={() => finishGame('stopped', performance.now() - startedAtRef.current)}>게임 그만하기</Button></section>}
      {stage === 'result' && result && <section className={styles.result}><Trophy /><span>{result.status === 'success' ? 'GAME CLEAR!' : result.status === 'timeout' ? 'TIME UP' : 'GAME STOPPED'}</span><h1>{result.status === 'success' ? `${formatSeconds(result.elapsedMs)}초 만에 성공!` : `${result.applesEaten}개의 사과를 먹었어요`}</h1><p>{isNewRecord ? '새 최고 기록이에요!' : bestClearMs ? `내 최고 기록은 ${formatSeconds(bestClearMs)}초예요.` : '다시 도전해서 모든 사과를 먹어보세요.'}</p><div className={styles.resultStats}><b>{result.applesEaten}<small>먹은 사과</small></b><b>{formatSeconds(result.elapsedMs)}<small>플레이 시간(초)</small></b></div>
      <div className={styles.resourceLabel}><span>자원 소비 현황</span></div>
      <div className={styles.resultStats}><b>{resourceSummary ? resourceSummary.avgFps : '--'}<small>평균 FPS</small></b><b>{resourceSummary ? resourceSummary.avgFrameMs : '--'}<small>평균 프레임(ms)</small></b><b>{resourceSummary?.avgInferenceMs ?? '--'}<small>평균 추론 시간(ms)</small></b></div>
      <div className={styles.statsTableWrap}>
        <div className={styles.resourceLabel}><span>1초마다 자원 사용 현황</span></div>
        {secondTicks.length > 0 && <ResourceChart ticks={secondTicks} />}
        {secondTicks.length > 0 ? <table className={styles.statsTable}>
          <thead><tr><th>초</th><th>평균 FPS</th><th>최대 프레임(ms)</th><th>추론 시간(ms)</th><th>먹은 사과</th></tr></thead>
          <tbody>{secondTicks.map((tick) => <tr key={tick.second}><td>{tick.second}초</td><td>{tick.avgFps}</td><td>{tick.maxFrameMs}</td><td>{tick.avgInferenceMs ?? '--'}</td><td>{tick.applesEaten.length > 0 ? tick.applesEaten.join(', ') + '번째' : '-'}</td></tr>)}</tbody>
        </table> : <p>이번 판에서 기록된 자원 사용 데이터가 없어요.</p>}
      </div>
      <div className={styles.actions}><Button variant="outline" size="lg" onClick={() => router.push('/games')}><ArrowLeft /> 다른 게임</Button><Button size="lg" onClick={() => { profiler.recordStage('idle'); setStage('ready'); setResult(null); setResourceSummary(null); setSecondTicks([]) }}><RotateCcw /> 다시 하기</Button></div></section>}
    </div>
  </AppShell>
}
