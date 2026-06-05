import { useState, useEffect, useCallback } from 'react'
import config from '../config'

const TYPE_COLORS = {
  car:   '#f59e0b',
  bus:   '#10b981',
  truck: '#38bdf8',
}
const TYPES = ['car', 'bus', 'truck']

// ── Donut pie chart ────────────────────────────────────────────────────────────

function PieChart({ counts }) {
  const totals = TYPES.map(t => (counts[`${t}_IN`] || 0) + (counts[`${t}_OUT`] || 0))
  const total  = totals.reduce((s, v) => s + v, 0)

  if (total === 0) {
    return <p className="hint-text" style={{ marginTop: 24 }}>No crossings in last 60 min</p>
  }

  const cx = 110, cy = 110, R = 88, ri = 50
  let angle = -Math.PI / 2

  const slices = TYPES.map((type, i) => {
    const sweep = totals[i] / total * 2 * Math.PI
    const a0 = angle
    const a1 = angle + sweep
    angle = a1
    const large = sweep > Math.PI ? 1 : 0
    const d = [
      `M ${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)}`,
      `A ${R} ${R} 0 ${large} 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)}`,
      `L ${cx + ri * Math.cos(a1)} ${cy + ri * Math.sin(a1)}`,
      `A ${ri} ${ri} 0 ${large} 0 ${cx + ri * Math.cos(a0)} ${cy + ri * Math.sin(a0)}`,
      'Z',
    ].join(' ')
    return { type, d, pct: Math.round(totals[i] / total * 100), count: totals[i] }
  })

  return (
    <svg viewBox="0 0 360 220" style={{ width: '100%', display: 'block' }}>
      {slices.map(s => (
        <path key={s.type} d={s.d} fill={TYPE_COLORS[s.type]} opacity="0.88" />
      ))}
      <text x={cx} y={cy - 10} textAnchor="middle" fontSize="24" fill="#e2e8f0" fontWeight="bold">
        {total}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="11" fill="#4a5568">crossings</text>

      {slices.map((s, i) => (
        <g key={s.type} transform={`translate(240, ${28 + i * 60})`}>
          <rect width="12" height="12" fill={TYPE_COLORS[s.type]} rx="3" />
          <text x="18" y="11" fontSize="13" fill="#94a3b8">{s.type}</text>
          <text x="18" y="28" fontSize="20" fill="#e2e8f0" fontWeight="bold">{s.pct}%</text>
          <text x="18" y="42" fontSize="10" fill="#4a5568">{s.count} events</text>
        </g>
      ))}
    </svg>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export default function AnalyticsPanel() {
  const [liveCounts, setLiveCounts] = useState({})
  const [error,      setError]      = useState(null)

  const refreshLive = useCallback(() => {
    fetch(`${config.backendUrl}/api/events/counts?minutes=60`)
      .then(r => r.json())
      .then(data => { setLiveCounts(data); setError(null) })
      .catch(e => setError(e.message))
  }, [])

  useEffect(() => {
    refreshLive()
    const id = setInterval(refreshLive, 1_000)
    return () => clearInterval(id)
  }, [refreshLive])

  return (
    <div className="analytics-body">

      <div className="chart-legend">
        <span><span style={{ color: '#f59e0b' }}>■</span> Car</span>
        <span><span style={{ color: '#10b981' }}>■</span> Bus</span>
        <span><span style={{ color: '#38bdf8' }}>■</span> Truck</span>
      </div>

      {error && <p className="error-text">Backend unreachable: {error}</p>}

      <div className="section-label">Live Distribution — Last 60 min</div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        <PieChart counts={liveCounts} />
      </div>

    </div>
  )
}
