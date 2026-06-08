import { useState, useEffect, useCallback } from 'react'
import config from '../config'

const TYPE_COLORS = {
  car:   '#00b4d8',
  bus:   '#00bfa5',
  truck: '#9b4dff',
}
const TYPES = ['car', 'bus', 'truck']

// ── Donut pie chart ────────────────────────────────────────────────────────────

function PieChart({ counts }) {
  const totals = TYPES.map(t => (counts[`${t}_IN`] || 0) + (counts[`${t}_OUT`] || 0))
  const total  = totals.reduce((s, v) => s + v, 0)

  if (total === 0) {
    return <p className="hint-text" style={{ marginTop: 24 }}>No crossings in last 60 min</p>
  }

  const cx = 90, cy = 90, R = 72, ri = 40
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
    <svg viewBox="0 0 180 180" style={{ width: '100%', height: '100%', display: 'block' }}>
      {slices.map(s => (
        <path key={s.type} d={s.d} fill={TYPE_COLORS[s.type]} opacity="0.9" />
      ))}
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="22" fill="#e2e8f0" fontWeight="bold">
        {total}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#4a5568">crossings</text>
    </svg>
  )
}

// ── Line chart ─────────────────────────────────────────────────────────────────

function LineChart({ hourly }) {
  if (!hourly || hourly.length === 0) {
    return <p className="hint-text" style={{ marginTop: 24 }}>No hourly data</p>
  }

  const W = 300, H = 140, PAD = { top: 10, right: 10, bottom: 24, left: 28 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const totals = hourly.map(h => h.carIn + h.carOut + h.busIn + h.busOut + h.truckIn + h.truckOut)
  const maxVal = Math.max(...totals, 1)
  const n = hourly.length

  const pts = totals.map((v, i) => ({
    x: PAD.left + (i / (n - 1 || 1)) * innerW,
    y: PAD.top  + (1 - v / maxVal) * innerH,
  }))

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaD = pathD + ` L ${pts[pts.length-1].x.toFixed(1)} ${(PAD.top + innerH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`

  const tickCount = 4
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round(maxVal * i / tickCount))

  const labelEvery = Math.ceil(n / 6)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', display: 'block' }}>
      {ticks.map(tick => {
        const y = PAD.top + (1 - tick / maxVal) * innerH
        return (
          <g key={tick}>
            <line x1={PAD.left} x2={PAD.left + innerW} y1={y} y2={y} stroke="#0e1e36" strokeWidth="1" />
            <text x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize="8" fill="#2a4060">{tick}</text>
          </g>
        )
      })}

      {hourly.map((h, i) => {
        if (i % labelEvery !== 0) return null
        const x = PAD.left + (i / (n - 1 || 1)) * innerW
        const label = h.hour ? h.hour.slice(11, 16) : ''
        return (
          <text key={i} x={x} y={H - 4} textAnchor="middle" fontSize="8" fill="#2a4060">{label}</text>
        )
      })}

      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00b4d8" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#00b4d8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#lineGrad)" />
      <path d={pathD} fill="none" stroke="#00b4d8" strokeWidth="1.5" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#00b4d8" />
      ))}
    </svg>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export default function AnalyticsPanel() {
  const [liveCounts, setLiveCounts] = useState({})
  const [hourly,     setHourly]     = useState([])
  const [error,      setError]      = useState(null)

  const refreshLive = useCallback(() => {
    fetch(`${config.backendUrl}/api/events/counts?minutes=60`)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })
      .then(data => { setLiveCounts(data); setError(null) })
      .catch(e => setError(e.message))
  }, [])

  const refreshHourly = useCallback(() => {
    fetch(`${config.backendUrl}/api/events/hourly-summary?hours=12`)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })
      .then(data => setHourly(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshLive()
    refreshHourly()
    const id1 = setInterval(refreshLive, 1_000)
    const id2 = setInterval(refreshHourly, 10_000)
    return () => { clearInterval(id1); clearInterval(id2) }
  }, [refreshLive, refreshHourly])

  const totalIn  = TYPES.reduce((s, t) => s + (liveCounts[`${t}_IN`]  || 0), 0)
  const totalOut = TYPES.reduce((s, t) => s + (liveCounts[`${t}_OUT`] || 0), 0)
  const total    = totalIn + totalOut

  return (
    <div className="analytics-body">

      {error && <p className="error-text">Backend unreachable: {error}</p>}

      <div className="analytics-kpis">
        <div className="analytics-kpi">
          <div className="analytics-kpi-value analytics-kpi-total">{total}</div>
          <div className="analytics-kpi-label">Total (1h)</div>
        </div>
        <div className="analytics-kpi">
          <div className="analytics-kpi-value analytics-kpi-in">{totalIn}</div>
          <div className="analytics-kpi-label">IN (1h)</div>
        </div>
        <div className="analytics-kpi">
          <div className="analytics-kpi-value analytics-kpi-out">{totalOut}</div>
          <div className="analytics-kpi-label">OUT (1h)</div>
        </div>
      </div>

      <div className="section-label">Live Distribution — Last 60 min</div>

      <div className="analytics-charts">
        <div className="chart-wrap" style={{ flex: '0 0 180px' }}>
          <div className="pie-legend">
            {TYPES.map(t => (
              <span key={t} style={{ color: TYPE_COLORS[t], fontSize: 9 }}>
                ■ {t}
              </span>
            ))}
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <PieChart counts={liveCounts} />
          </div>
        </div>

        <div className="chart-wrap" style={{ flex: 1 }}>
          <div className="section-label" style={{ marginBottom: 4 }}>Hourly — Last 12h</div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <LineChart hourly={hourly} />
          </div>
        </div>
      </div>

    </div>
  )
}