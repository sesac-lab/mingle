"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowLeft, BarChart3, Camera, CheckCircle2, CircleGauge, Clock3, ImageOff, RotateCcw, Trophy, XCircle } from "lucide-react";
import { AppShell } from "@/components/common/app-shell";
import { Button } from "@/components/ui/button";
import { GAME_RESULT_STORAGE_KEY, type Game3Result } from "@/lib/games/game-result";

export default function ResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<Game3Result | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = sessionStorage.getItem(GAME_RESULT_STORAGE_KEY);
        if (raw) setResult(JSON.parse(raw) as Game3Result);
      } catch {
        setResult(null);
      } finally {
        setLoaded(true);
      }
    });
  }, []);

  const summary = useMemo(() => {
    if (!result) return null;
    const successes = result.rounds.filter((item) => item.result === "success").length;
    const successfulRounds = result.rounds.filter((item) => item.result === "success");
    const averageResponse = result.rounds.length ? result.rounds.reduce((sum, item) => sum + item.responseTimeMs, 0) / result.rounds.length : 0;
    const totalDetectionCalls = result.rounds.reduce((sum, item) => sum + item.detectionCalls, 0);
    const averageInference = totalDetectionCalls ? result.rounds.reduce((sum, item) => sum + item.avgInferenceMs * item.detectionCalls, 0) / totalDetectionCalls : 0;
    const maxInference = Math.max(...result.rounds.map((item) => item.maxInferenceMs), 0);
    const averageFps = result.rounds.length ? result.rounds.reduce((sum, item) => sum + item.avgFps, 0) / result.rounds.length : 0;
    const droppedInference = result.rounds.reduce((sum, item) => sum + item.droppedInferenceCount, 0);
    const errorCount = result.events.filter((event) => event.type.endsWith("_ERROR")).length;
    const excluded = successfulRounds.filter((item) => item.capturedImage && item.excludedReasons?.length);
    const candidates = successfulRounds.filter((item) => item.capturedImage && !item.excludedReasons?.length);
    const best = [...candidates].sort((a, b) => (b.sharpnessScore ?? 0) - (a.sharpnessScore ?? 0))[0];
    return { successes, averageResponse, averageInference, maxInference, averageFps, droppedInference, errorCount, excluded, candidates, best, successRate: result.successRate };
  }, [result]);

  if (!loaded) return <AppShell activeStep={3}><div className="result-empty">결과를 불러오는 중...</div></AppShell>;
  if (!result || !summary) {
    return (
      <AppShell activeStep={3}>
        <div className="result-empty"><ImageOff /><h2>표시할 결과가 없어요.</h2><p>CHEE-SE!를 플레이한 뒤 결과를 확인해주세요.</p><Button size="lg" onClick={() => router.push("/games/game-3")}>게임 시작하기</Button></div>
      </AppShell>
    );
  }

  const maxResponse = Math.max(...result.rounds.map((item) => item.responseTimeMs), 1);
  const maxInference = Math.max(...result.rounds.map((item) => item.avgInferenceMs), 1);
  const linePoints = result.rounds.map((item, index) => `${result.rounds.length === 1 ? 50 : (index / (result.rounds.length - 1)) * 100},${100 - (item.avgInferenceMs / maxInference) * 84 - 8}`).join(" ");

  return (
    <AppShell activeStep={3}>
      <div className="common-results">
        <section className="result-hero">
          <div className="result-hero-copy">
            <span className="result-label">CHEE-SE! COMPLETE</span>
            <div className="result-player"><img src={result.characterImage} alt="" /><span>{result.playerName}</span></div>
            <h2>{result.score}<small>P</small></h2>
            <p>{summary.successes}번의 순간을 포착했어요. 가장 흔들림 없고 선명한 사진을 골랐습니다.</p>
            <div className="result-actions"><Button variant="outline" size="lg" onClick={() => router.push("/games")}><ArrowLeft /> 다른 게임</Button><Button size="lg" onClick={() => router.push("/games/game-3")}><RotateCcw /> 다시 하기</Button></div>
          </div>
          <div className="best-shot-card">
            <div className="best-shot-heading"><span><Trophy /> BEST SHOT</span>{summary.best && <small>ROUND {summary.best.round} · {(summary.best.responseTimeMs / 1000).toFixed(2)}s</small>}</div>
            {summary.best?.capturedImage ? <img src={summary.best.capturedImage} alt={`베스트 사진, ${summary.best.round} 라운드`} /> : <div className="no-best-shot"><Camera /><b>베스트 사진 후보가 없어요</b><span>성공 사진이 없거나 품질 기준에서 제외됐어요.</span></div>}
          </div>
        </section>

        <section className="result-report game3-report">
          <div className="report-heading"><div><span>PERFORMANCE REPORT</span><h3>플레이 리포트</h3></div><BarChart3 /></div>
          <div className="score-breakdown"><div><span>성공률</span><b>{summary.successRate.toFixed(0)}</b><small>%</small></div><div><span>오류</span><b>{summary.errorCount}</b><small>건</small></div><div><span>평균 응답</span><b>{(summary.averageResponse / 1000).toFixed(2)}</b><small>sec</small></div></div>
          <div className="metric-list">
            <div className="metric-row"><span className="metric-icon memory"><CircleGauge /></span><div><b>MediaPipe 추론</b><small>평균 / 최대</small></div><strong>{summary.averageInference.toFixed(1)} ms <em>{summary.maxInference.toFixed(1)} ms</em></strong></div>
            <div className="metric-row"><span className="metric-icon fps"><Activity /></span><div><b>평균 FPS</b><small>라운드 평균</small></div><strong>{summary.averageFps.toFixed(1)}</strong></div>
            <div className="metric-row"><span className="metric-icon cpu"><XCircle /></span><div><b>Dropped inference</b><small>중복 요청 생략</small></div><strong>{summary.droppedInference}회</strong></div>
          </div>
          <div className="result-charts">
            <div className="mini-chart"><div className="chart-title"><span>회차별 응답 시간</span><em>ms</em></div><div className="chart-bars game3-bars" aria-label="회차별 응답 시간 막대차트">{result.rounds.map((item) => <i key={item.round} className={item.result} style={{ height: `${Math.max(8, (item.responseTimeMs / maxResponse) * 100)}%` }} title={`${item.round}라운드 ${item.responseTimeMs}ms`} />)}</div><div className="chart-axis"><span>R1</span><span>R{result.rounds.length}</span></div></div>
            <div className="mini-chart"><div className="chart-title"><span>MediaPipe 추론 지연</span><em>ms</em></div><svg className="latency-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="라운드별 MediaPipe 추론 지연 라인차트"><polyline points={linePoints} /></svg><div className="chart-axis"><span>R1</span><span>R{result.rounds.length}</span></div></div>
          </div>
        </section>

        <section className="round-report-card">
          <div className="section-heading"><div><span>ROUND DETAILS</span><h3>회차별 기록</h3></div><Clock3 /></div>
          <div className="round-table-wrap"><table className="round-table"><thead><tr><th>Round</th><th>Result</th><th>Response</th><th>Limit</th><th>Calls</th><th>Avg / Max Inference</th><th>Dropped</th><th>Avg FPS</th><th>Errors</th></tr></thead><tbody>{result.rounds.map((item) => <tr key={item.round}><td>{item.round}</td><td><span className={`round-status ${item.result}`}>{item.result === "success" ? <CheckCircle2 /> : <XCircle />}{item.result === "success" ? "성공" : "실패"}</span></td><td>{(item.responseTimeMs / 1000).toFixed(2)}s</td><td>{(item.timeLimitMs / 1000).toFixed(0)}s</td><td>{item.detectionCalls}</td><td>{item.avgInferenceMs.toFixed(1)} / {item.maxInferenceMs.toFixed(1)} ms</td><td>{item.droppedInferenceCount}</td><td>{item.avgFps.toFixed(1)}</td><td>{item.errorCount}</td></tr>)}</tbody></table></div>
        </section>

        <section className="photo-report-card">
          <div className="section-heading"><div><span>PHOTO GALLERY</span><h3>성공 사진</h3></div><Button variant="outline" onClick={() => setShowExcluded((value) => !value)}>{showExcluded ? "제외 사진 숨김" : `제외된 사진 확인 (${summary.excluded.length})`}</Button></div>
          <div className="photo-grid">{summary.candidates.map((item) => <figure key={item.round}><img src={item.capturedImage} alt={`${item.round}라운드 성공 사진`} /><figcaption><b>ROUND {item.round}</b><span>{(item.responseTimeMs / 1000).toFixed(2)}s</span></figcaption></figure>)}{showExcluded && summary.excluded.map((item) => <figure className="excluded" key={item.round}><img src={item.capturedImage} alt={`${item.round}라운드 제외 사진`} /><figcaption><b>ROUND {item.round}</b><span>{item.excludedReasons?.join(" · ")}</span></figcaption></figure>)}</div>
          {!summary.candidates.length && !showExcluded && <p className="empty-gallery">표시할 후보 사진이 없어요. 제외 사진을 확인해보세요.</p>}
        </section>

        <details className="event-log"><summary>주요 이벤트 로그 · {result.events.length}건</summary><div>{result.events.map((event, index) => <p key={`${event.timestamp}-${index}`}><time>{new Date(event.timestamp).toLocaleTimeString("ko-KR")}</time><b>{event.type}</b><span>{event.round ? `R${event.round}` : "-"}</span><em>{event.durationMs !== undefined ? `${event.durationMs} ms` : event.message ?? ""}</em></p>)}</div></details>
      </div>
    </AppShell>
  );
}
