# TASK — GAME 1 `EAT APPLE!` 구현 지시서

## 1. 작업 목적

MediaPipe Face Landmarker를 활용하여 **제한 시간 안에 입으로 사과를 먹어 전부 다 먹으면 클리어하는 게임 `EAT APPLE!`**을 구현한다.

본 작업은 기존 웹사이트의 공통 구조와 GAME 2, GAME 3 기능을 유지하면서 **GAME 1 관련 기능만 추가 또는 수정**하는 것을 원칙으로 한다.

---

# 2. 최우선 작업 원칙

## 2.1 수정 가능 범위

### 수정 가능

- GAME 1 `EAT APPLE!` 관련 파일 (`app/games/game-1/**`)
- GAME 1에서 사용하는 게임 로직(`game-engine.ts`)
- GAME 1에서 사용하는 스타일(`game-1.module.css`)
- GAME 1에서 사용하는 MediaPipe 처리 로직
- GAME 1 사운드 재생 로직

## 2.2 수정 금지

다음 영역은 임의로 수정하지 않는다.

- GAME 2 관련 코드
- GAME 3 관련 코드
- GAME 2/3의 게임 로직, UI, 결과 데이터, 스타일, 전용 컴포넌트
- 공용 인프라: `lib/games/registry.ts`, `lib/games/types.ts`, `lib/player-context.tsx`, `components/common/app-shell.tsx`
- 기존 라우팅 구조(`/` → `/player` → `/games` → `/games/game-N`)

기존 코드를 정리하거나 리팩터링한다는 이유로 GAME 2 또는 GAME 3 코드를 수정하지 않는다.

---

# 3. GAME 1 기본 정보

게임명:

```text
EAT APPLE!
```

게임 목적:

```text
제한 시간 안에 입을 벌려 화면에 튀어다니는 사과를 전부 먹는다.
```

사과 개수:

```text
10개
```

제한 시간:

```text
60초
```

---

# 4. 게임 시작 흐름

GAME 1 선택 시 다음 흐름을 따른다 (`app/games/game-1/page.tsx`의 `Stage` 상태).

```text
닉네임 입력 (/player)
↓
캐릭터 선택
↓
GAME 1 EAT APPLE! 선택 (/games/game-1)
↓
stage: ready — 웹캠 켜기 + 얼굴 인식 모델 로드
↓
stage: calibrating — 캐릭터 이미지 위 5개 기준점 클릭
  (왼쪽 눈 → 오른쪽 눈 → 이마 → 입 → 턱)
↓
stage: playing — 60초 동안 사과 먹기
↓
게임 종료 (성공 / 시간초과 / 사용자 중단)
↓
stage: result — 결과 화면 (기존 공통 결과 UI 아님, 게임1 자체 결과 섹션 사용)
```

---

# 5. 캐릭터 보정 (Calibration)

`stage === 'calibrating'`에서 사용자가 캐릭터 이미지 위에 5개 기준점을 순서대로 클릭한다.

```text
leftEye (왼쪽 눈)
rightEye (오른쪽 눈)
forehead (이마)
mouth (입)
chin (턱)
```

5개 점이 모두 채워져야(`calibrationComplete`) 게임을 시작할 수 있다.

---

# 6. MediaPipe 얼굴 인식

`@mediapipe/tasks-vision`의 `FaceLandmarker`를 사용한다 (`runningMode: 'VIDEO'`, `numFaces: 1`).

- 모델 자산: `/mediapipe/wasm`, `/mediapipe/face_landmarker.task` (`public/mediapipe/`)
- 추론 주기: 약 50ms에 한 번 (`lastInferenceRef`)
- 입 중심(`mouthCenter`): 랜드마크 13번(윗입술)·14번(아랫입술)의 중간점
- 입 열림 판정: `mouthOpenRatio = 입술간 거리 / 눈 사이 거리 >= 0.25`

동시에 여러 번 추론이 겹치지 않도록 타임스탬프 간격으로 제어한다.

---

# 7. 캐릭터 표시 및 위치 고정

보정 5개 점(캐릭터 이미지 좌표)과 실제 얼굴 5개 점(웹캠 좌표)을 `calculateCharacterTransform`으로 맞춰(회전+균일 스케일) 캐릭터 이미지를 웹캠 위에 겹쳐 그린다.

- 캐릭터 크기(스케일)는 게임 시작 후 첫 5프레임을 샘플링해 중앙값으로 **고정**한다 (`lockScaleAfterSamples`, `lockedCharacterScaleRef`). 이후 카메라와의 거리가 바뀌어도 캐릭터 크기는 변하지 않는다.
- 입 히트존 반지름도 동일한 방식으로 초반 5프레임을 샘플링해 **고정**한다 (`lockedMouthRadiusRef`).
- 사과 판정 및 입 열림 표시 원은 실제 사람 얼굴 좌표가 아니라, **보정 시 클릭한 "입" 기준점이 화면에 실제로 그려지는 위치**(`mapSourcePoint`)를 기준으로 한다. 캐릭터 이미지 비율이 실제 얼굴과 달라도 판정 위치가 캐릭터의 입 위치와 항상 일치한다.

---

# 8. 사과 판정 로직

- `spawnApples`: 게임 시작 시 화면 가장자리에서 무작위 방향/속도로 사과 10개를 생성한다.
- `moveApples`: 매 프레임 사과를 이동시키고, 화면 경계에 부딪히면 반사시킨다.
- `eatApple`: 입이 열려 있고(`mouthOpen`), 사과 중심이 (고정된) 입 히트존 반지름 안에 들어오면 해당 사과를 제거한다. 한 프레임에 한 개만 판정한다.

---

# 9. 게임 종료 조건

다음 중 하나가 발생하면 게임을 종료한다 (`finishGame`).

```text
status: 'success' — 사과 10개를 모두 먹음 (제한 시간 내)
status: 'timeout' — 60초 경과, 사과가 남아있음
status: 'stopped' — 사용자가 "게임 그만하기" 버튼 클릭
```

`endedRef`로 중복 종료 처리를 막는다.

---

# 10. 배경음 및 효과음

`public/sound/`의 기존 공용 사운드 asset을 사용한다.

## 게임 진행 배경음

```text
default-bgm.mp3
```

게임 시작(`beginPlaying`) 시 반복 재생, 볼륨 `0.32`. 게임 종료 시 정지한다.

## 사과 먹을 때

오실레이터로 직접 만든 합성음(`playEatSound`)을 사용한다. 게인 `0.096`, 주파수 520Hz → 860Hz로 짧게 상승.

## 결과별 효과음

```text
status === 'success'  → default-success.mp3
status === 'timeout'  → default-fail.mp3
status === 'stopped'  → default-end.mp3
```

`finishGame`에서 배경음을 멈추고 위 효과음을 1회 재생한다.

## 오디오 오류 처리

`Audio.play()` 실패(자동재생 제한 등)는 `.catch(() => {})`로 무시하고 게임 자체는 중단되지 않는다.

---

# 11. 결과 데이터

```ts
type GameResult = {
  applesEaten: number
  elapsedMs: number
  status: 'success' | 'timeout' | 'stopped'
}
```

- 성공 시 `saveBestClearTime`으로 `window.localStorage`에 최고 기록(클리어 시간)을 저장하고, 신기록 여부(`isNewRecord`)를 표시한다.
- 결과 화면은 게임1 자체 `result` 섹션을 사용하며, 별도의 공통 결과 페이지로 이동하지 않는다.

---

# 12. 테스트 항목

`app/games/game-1/game-engine.test.ts` (vitest)에서 다음을 검증한다.

- `spawnApples` / `moveApples` (벽 반사 포함)
- `eatApple` (원형 히트존 판정, 한 프레임 한 개 소비)
- `getMouthData` (랜드마크 → 입/눈/이마/턱 좌표 변환, 좌우 반전 처리)
- `calculateCharacterTransform` (회전/스케일/위치 정합)
- `mapSourcePoint` (보정 기준점의 실제 화면 좌표 계산)
- `resolveLockedScale` / `lockScaleAfterSamples` (초기 프레임 샘플링 후 고정)
- `saveBestClearTime` / `loadBestClearTime` (최고 기록 저장/불러오기)
- `removeCheckerboardBackground` (캐릭터 이미지 체커보드 배경 제거)

커밋 전 최소 `npm run lint`, `npm run test`를 통과해야 한다.

---

# 13. 완료 조건

다음 조건을 모두 만족하면 GAME 1 작업 완료로 판단한다.

- `EAT APPLE!` 정상 실행 (웹캠 → 보정 → 플레이 → 결과)
- MediaPipe Face Landmarker 정상 실행
- 캐릭터 보정 5점 입력 및 캐릭터 오버레이 정상 표시
- 사과 판정 위치/크기가 캐릭터 입 기준으로 고정되어 흔들리지 않음
- 성공 / 시간초과 / 사용자 중단 3가지 종료 상태 정상 동작
- 배경음 / 먹기 효과음 / 결과별 효과음 정상 재생
- 최고 기록 저장 및 신기록 표시 정상
- GAME 2 / GAME 3 기능에 영향 없음
- 승인받지 않은 공통 코드 변경 없음
