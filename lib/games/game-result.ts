export type Game3RoundResult = {
  round: number;
  result: "success" | "fail";
  scoreDelta: number;
  totalScore: number;
  responseTimeMs: number;
  timeLimitMs: number;
  detectionCalls: number;
  avgInferenceMs: number;
  maxInferenceMs: number;
  droppedInferenceCount: number;
  avgFps: number;
  errorCount: number;
  capturedImage?: string;
  sharpnessScore?: number;
  excludedReasons?: string[];
};

export type GameEventType =
  | "CAMERA_CONNECTED"
  | "CAMERA_ERROR"
  | "MODEL_READY"
  | "MODEL_ERROR"
  | "GAME_STARTED"
  | "GAME_ENDED"
  | "ROUND_STARTED"
  | "ROUND_SUCCESS"
  | "ROUND_TIMEOUT"
  | "ROUND_ENDED"
  | "CAPTURE_ERROR"
  | "AUDIO_ERROR"
  | "RESOURCE_CLEANUP"
  | "RESOURCE_CLEANUP_ERROR";

export type GameEvent = {
  timestamp: number;
  type: GameEventType;
  round?: number;
  durationMs?: number;
  message?: string;
};

export type Game3Result = {
  game: "game-3";
  playerName: string;
  characterImage: string;
  score: number;
  startedAt: number;
  endedAt: number;
  successRate: number;
  cameraReadyMs: number;
  modelReadyMs: number;
  rounds: Game3RoundResult[];
  events: GameEvent[];
};

export const GAME_RESULT_STORAGE_KEY = "mingle:last-game-result";
