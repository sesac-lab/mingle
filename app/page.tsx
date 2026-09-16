import Link from "next/link";
import { ArrowRight, CircleGauge, Clock3, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/common/app-shell";
import { DEFAULT_CHARACTER } from "@/lib/player-context";

export default function Home() {
  return (
    <AppShell activeStep={-1}>
      <div className="welcome-screen">
        <div className="welcome-copy">
          <div className="kicker">PLAY · TRACK · COMPARE</div>
          <h1>
            오늘의 할 일:
            <br />
            <em>Mingle이랑 놀기.</em>
          </h1>
          <p>
            웹캠으로 즐기는 미니게임.
            <br />
            게임이 끝나면 점수와 시스템 성능을 함께 보여드려요.
          </p>
          <Button size="lg" className="primary-cta" asChild>
            <Link href="/player">
              아케이드 입장하기 <ArrowRight />
            </Link>
          </Button>
          <div className="quick-facts">
            <span>
              <Clock3 /> 빠른 플레이
            </span>
            <span>
              <Video /> 웹캠 인터랙션
            </span>
            <span>
              <CircleGauge /> 실시간 모니터링
            </span>
          </div>
        </div>
        <div className="welcome-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="scanner-card">
            <div className="scanner-corners">
              <i />
              <i />
              <i />
              <i />
            </div>
            <img className="welcome-character" src={DEFAULT_CHARACTER} alt="" />
            <span>
              PLAYER
              <br />
              DETECTED
            </span>
            <div className="scan-line" />
          </div>
          <div className="floating-stat stat-a">
            <small>FPS</small>
            <b>29.4</b>
          </div>
          <div className="floating-stat stat-b">
            <small>CPU</small>
            <b>42%</b>
          </div>
          <div className="floating-tag">CV / ACTIVE</div>
        </div>
      </div>
    </AppShell>
  );
}
