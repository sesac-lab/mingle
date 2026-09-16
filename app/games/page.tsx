"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/common/app-shell";
import { usePlayer } from "@/lib/player-context";
import { gameRegistry } from "@/lib/games/registry";

export default function GameSelectPage() {
  const { playerName, characterImage } = usePlayer();

  return (
    <AppShell activeStep={1}>
      <div className="flow-layout games-layout">
        <div className="flow-intro games-intro">
          <span className="screen-count">02 / 03</span>
          <h2>
            플레이할 게임을
            <br />
            선택하세요.
          </h2>
          <p className="player-greeting">
            <img src={characterImage} alt="" />
            <b>{playerName}</b> 님, 어떤 게임을 해볼까요?
          </p>
        </div>
        <div className="game-grid">
          {gameRegistry.map((item, index) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.slug}
                href={`/games/${item.slug}`}
                className="select-game-card"
                style={{ "--choice": item.accent } as React.CSSProperties}
              >
                <span className="game-card-top">
                  <small>0{index + 1}</small>
                  <span>{item.tag}</span>
                </span>
                <span className="select-icon">
                  <Icon />
                </span>
                <strong>{item.title}</strong>
                <p>{item.short}</p>
                <span className="select-link">
                  선택하기 <ChevronRight />
                </span>
              </Link>
            );
          })}
          <Button variant="ghost" size="lg" className="games-back" asChild>
            <Link href="/player">
              <ArrowLeft /> 플레이어 설정으로
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
