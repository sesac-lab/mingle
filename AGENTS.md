<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 프로젝트 규칙 (Mingle)

## 1. 폴더 소유권

- `app/games/game-1/`, `app/games/game-2/`, `app/games/game-3/`는 각 담당자가 독립적으로 작업하는 영역입니다. 다른 사람의 `game-N` 폴더는 건드리지 마세요.
- 아래는 공용 인프라라 여럿이 동시에 수정하면 충돌이 나기 쉽습니다. 수정이 필요하면 먼저 팀과 상의하세요:
  - `lib/games/registry.ts`, `lib/games/types.ts` — 게임 목록/메타데이터 계약
  - `lib/player-context.tsx` — 닉네임/캐릭터 전역 상태
  - `components/common/app-shell.tsx` — 헤더/스테퍼/푸터 공용 레이아웃

## 2. GameMeta 계약

- 각 게임 폴더의 `meta.ts`는 `lib/games/types.ts`의 `GameMeta` 타입을 구현합니다. `title`/`description`/`tag`/`code`/`icon`/`checks` 등 이 값만 채우면 게임 선택 화면(`/games`)과 준비 화면에 자동으로 반영됩니다.
- 게임 컨셉이 아직 확정되지 않아 현재 `meta.ts` 값은 전부 플레이스홀더("게임 1/2/3", "TBD" 등)입니다. 실제 게임을 구현할 때는 이 값부터 채우세요.
- 새 게임을 추가하는 경우가 아니라면 `lib/games/registry.ts`를 수정할 필요는 없습니다.

## 3. 라우팅 구조

- 화면 흐름은 `/`(welcome) → `/player`(닉네임/캐릭터) → `/games`(게임 선택) → `/games/game-N`(각 게임)로, 전부 실제 Next.js 라우트입니다.
- 예전처럼 페이지 하나 안에서 `useState`로 화면을 전환하는 SPA 패턴으로 되돌리지 마세요. 브라우저 뒤로가기, "다른 게임" 같은 이동이 라우트 분리에 의존하고 있습니다.

## 4. 웹캠 시작 규칙

- `lib/webcam/useWebcam`, `useFrameLoop`는 절대 자동으로 카메라를 켜지 않습니다. 반드시 사용자가 화면의 버튼을 눌러야 `start()`가 호출되도록 구현하세요 (`autoStart: false`가 기본 패턴).

## 5. 한글 타이포 규칙

- 헤드라인(`h1`, `h2` 등 큰 제목)에 새 한글 텍스트를 넣을 때는 `word-break:keep-all`을 함께 지정하세요. 지정하지 않으면 좁은 컬럼에서 단어 중간(예: "게임을" → "게" / "임을")에 줄바꿈되는 문제가 반복적으로 발생했습니다.
