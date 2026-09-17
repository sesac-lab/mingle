'use client'

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SecondTick } from '@/lib/telemetry/second-ticks'
import styles from './game-1.module.css'

type ChartKey = 'avgFps' | 'maxFrameMs' | 'avgInferenceMs'

// 지표 3개를 한 그래프에 같이 그리면 값이 작은 지표(추론 시간 등)는 변화가 잘 안 보인다.
// 그래서 그래프를 따로따로 그리고, Y축도 0부터가 아니라 그 지표의 실제 값 범위(dataMin~dataMax)로 좁혀서
// 작은 변화도 크게 보이도록 한다.
const charts: Array<{ key: ChartKey; label: string; color: string; unit: string }> = [
  { key: 'avgFps', label: '평균 FPS', color: '#67518f', unit: '' },
  { key: 'maxFrameMs', label: '최대 프레임(ms)', color: '#e24c60', unit: 'ms' },
  { key: 'avgInferenceMs', label: '추론 시간(ms)', color: '#35a36a', unit: 'ms' },
]

export function ResourceChart({ ticks }: { ticks: SecondTick[] }) {
  return (
    <div className={styles.chartGrid}>
      {charts.map((chart) => (
        <div key={chart.key}>
          <span className={styles.chartLabel} style={{ color: chart.color }}>{chart.label}</span>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={ticks} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e6dff2" />
              <XAxis dataKey="second" tickFormatter={(second) => `${second}초`} tick={{ fontSize: 11, fill: '#887d97' }} />
              <YAxis domain={['dataMin', 'dataMax']} allowDecimals={false} tick={{ fontSize: 11, fill: '#887d97' }} width={36} />
              <Tooltip labelFormatter={(second) => `${second}초`} formatter={(value) => [`${value}${chart.unit}`, chart.label]} contentStyle={{ borderRadius: 12, border: '1px solid #dacdeb', fontSize: 12 }} />
              <Line type="monotone" dataKey={chart.key} stroke={chart.color} strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  )
}
