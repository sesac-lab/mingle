"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Check, Gamepad2, Trophy, UserRound, Video, type LucideIcon } from "lucide-react";

const steps: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "player", label: "PLAYER", icon: UserRound },
  { key: "games", label: "SELECT", icon: Gamepad2 },
  { key: "ready", label: "READY", icon: Video },
  { key: "result", label: "RESULT", icon: Trophy },
];

type AppShellProps = {
  children: ReactNode;
  /** 0=PLAYER, 1=SELECT, 2=READY, 3=RESULT. -1이면 스텝퍼를 숨긴다. */
  activeStep?: number;
  /** 화면 전환 시 진입 애니메이션을 다시 트리거하기 위한 key */
  stageKey?: string | number;
};

export function AppShell({ children, activeStep = -1, stageKey }: AppShellProps) {
  return (
    <main className="app-shell">
      <div className="grid-bg" aria-hidden="true" />
      <header className="site-header">
        <Link className="brand" href="/" aria-label="처음 화면으로 이동">
          <span className="brand-symbol">
            <span />
          </span>
          <span>
            <b>MINGLE</b>
            <small>WEBCAM MINI GAMES</small>
          </span>
        </Link>

        {activeStep >= 0 && (
          <nav className="stepper" aria-label="게임 시작 단계">
            {steps.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={item.key} className={`step ${index === activeStep ? "current" : ""} ${index < activeStep ? "done" : ""}`}>
                  <span>{index < activeStep ? <Check /> : <Icon />}</span>
                  <small>{item.label}</small>
                </div>
              );
            })}
          </nav>
        )}

        <div className="system-badge">
          <i /> SYSTEM ONLINE
        </div>
      </header>

      <section className="screen-stage" key={stageKey}>
        {children}
      </section>

      <footer className="site-footer">
        <span>MINGLE / WEBCAM ARCADE</span>
        <span>PLAY THE GAME · MONITOR THE MACHINE</span>
      </footer>
    </main>
  );
}
