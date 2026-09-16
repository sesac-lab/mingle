# 🎮 CV Arcade — Webcam Mini Game

웹캠 기반의 실시간 Computer Vision 기술과 게이미피케이션을 결합한 미니게임 프로젝트입니다.

사용자는 닉네임과 캐릭터를 설정한 뒤 3개의 미니게임 중 하나를 선택하여 플레이할 수 있습니다.

각 게임은 약 **1분 이내**로 진행되며, 게임이 진행되는 동안 시스템 자원 사용량과 애플리케이션 성능을 실시간으로 모니터링합니다.

게임 종료 후에는 게임 점수와 함께 자원 사용량 및 성능 측정 결과를 확인할 수 있습니다.

> ⚠️ **현재 구현 상태**: 이 저장소는 위 컨셉의 **화면(UI) 프로토타입**입니다. 닉네임/캐릭터 설정,
> 게임 선택, 준비 화면, 결과 화면까지의 흐름은 실제로 동작하지만, 웹캠 캡처·Computer Vision
> 인식·실시간 자원 모니터링은 아직 연결되어 있지 않고 결과 화면의 수치는 더미 데이터입니다.

---

## 📌 프로젝트 목표

- React(Next.js) 기반의 웹 미니게임 UI/UX 구현
- 웹캠을 활용한 실시간 사용자 인터랙션 구현 *(예정)*
- Computer Vision을 활용한 게임 기능 구현 *(예정)*
- 점수 등의 요소를 활용한 게이미피케이션
- 게임 실행 중 시스템 자원 사용량 모니터링 *(예정)*
- 게임 실행 중 영상 처리 성능 모니터링 *(예정)*
- 게임별 자원 사용량 및 성능 비교 *(예정)*

---

## 🛠 Tech Stack

| 영역 | 기술 |
|---|---|
| Framework | [Next.js](https://nextjs.org/) 16 (App Router) |
| Language | TypeScript, React 19 |
| Styling | Tailwind CSS 4 |
| UI Components | shadcn/ui (`Button`), lucide-react 아이콘 |
| 예정 | OpenCV / MediaPipe (Computer Vision), 브라우저 `getUserMedia` (웹캠), 자원·성능 계측 로직 |

---

## 🚀 시작하기

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속.

```bash
npm run build   # 프로덕션 빌드
npm run start   # 프로덕션 서버 실행
npm run lint    # ESLint 검사
```

---

## 📂 프로젝트 구조

```text
app/
  layout.tsx        # 루트 레이아웃, 메타데이터
  page.tsx          # 화면 전체 로직 (welcome/player/games/ready/result)
  globals.css        # 전체 스타일
components/ui/
  button.tsx         # 사용 중인 shadcn 컴포넌트
lib/
  utils.ts           # cn() 클래스 병합 유틸
vendor/
  shadcn-tailwind-4.13.0.css  # shadcn 기본 테마 CSS
public/
  favicon.svg
  default-character.png
```

---

## 🕹️ 서비스 흐름 (구현됨)

```text
Welcome 화면
    ↓
닉네임 설정
    ↓
캐릭터 선택 (기본 캐릭터 or 사진 업로드)
    ↓
게임 선택 (3종)
    ↓
게임 준비 화면 (카메라 프리뷰 자리 + 체크리스트)
    ↓
[게임 시작 → 실제 웹캠/CV 로직은 미구현]
    ↓
결과 화면 (더미 점수 및 자원 지표)
```

`app/page.tsx`의 `Screen` 타입(`welcome | player | games | ready | result`)과
`useState`로 화면을 전환하며, 실제 라우팅 없이 하나의 페이지 안에서 SPA처럼 동작합니다.

---

## 🎯 미니게임 (기획, 로직 미구현)

게임 선택 화면에 노출되는 3종입니다. 카드/설명/체크리스트 UI는 구현되어 있으나,
실제 웹캠 인식·채점 로직은 아직 없습니다.

| 게임 | 코드 | 설명 |
|---|---|---|
| 표정 챌린지 | `FACE_01` | 화면 속 표정을 따라 하면 인식/채점 (표정 인식) |
| 모션 캐처 | `MOVE_02` | 손·상체 움직임으로 타깃을 맞히면 채점 (동작 인식) |
| 포즈 미러 | `POSE_03` | 제시된 포즈를 완성하면 채점 (포즈 인식) |

준비 화면에서 "게임 시작"을 누르면 표정 챌린지(`FACE_01`)에 한해 예시용 결과 화면으로
바로 이동하도록 되어 있고, 나머지 2개는 안내 메시지만 표시됩니다.

---

## 🏆 게이미피케이션 (UI만 구현)

결과 화면은 아래 형태의 정보를 표시하도록 만들어져 있으며, 현재는 전부 하드코딩된
더미 값입니다.

- Score (P)
- Rank
- 성공 횟수 / 정확도 / 최대 콤보
- CPU / Memory / FPS 요약 (Average / Peak)
- 60초 타임라인 그래프 (예시용 임의 값)

---

## 📊 Resource Monitoring (예정)

README 기획상 아래 지표를 실시간으로 측정하는 것이 목표이며, 현재 UI는 이 지표들을
표시할 자리만 마련되어 있습니다.

| Category | Metric |
|---|---|
| System | CPU Average / Peak |
| System | Memory Average / Peak |
| Performance | Average FPS / Minimum FPS |
| AI | Average Inference / Maximum Inference |
| Game | Processed Frames / Duration |

실제 계측을 붙이려면 브라우저에서 `getUserMedia`로 웹캠 스트림을 받아 Computer
Vision 처리를 수행하고, `performance.now()` 기반으로 FPS/추론 시간을, 별도
백엔드나 브라우저 API로 리소스 사용량을 측정해 `app/page.tsx`의 더미 값을
대체해야 합니다.

---

## 🚀 핵심 컨셉

> **Play the Game, Monitor the Machine**

웹캠 기반의 짧은 미니게임을 플레이하면서 Computer Vision 기술을 체험하고, 동시에
게임을 처리하는 시스템의 자원 사용량과 성능을 실시간으로 확인하는 프로젝트입니다.
