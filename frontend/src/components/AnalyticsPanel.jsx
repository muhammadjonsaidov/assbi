import { useState, useEffect, useCallback } from 'react'
import config from '../config'

const CHART_W = 560
const CHART_H = 110
const PAD_L   = 28
const PAD_B   = 18

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

  const cx = 80, cy = 80, R = 62, ri = 34
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
    <svg viewBox="0 0 220 165" style={{ width: '100%', display: 'block' }}>
      {slices.map(s => (
        <path key={s.type} d={s.d} fill={TYPE_COLORS[s.type]} opacity="0.88" />
      ))}
      <text x={cx} y={cy - 7} textAnchor="middle" fontSize="17" fill="#e2e8f0" fontWeight="bold">
        {total}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="#4a5568">crossings</text>

      {slices.map((s, i) => (
        <g key={s.type} transform={`translate(170, ${16 + i * 42})`}>
          <rect width="9" height="9" fill={TYPE_COLORS[s.type]} rx="2" />
          <text x="13" y="8" fontSize="9" fill="#94a3b8">{s.type}</text>
          <text x="13" y="20" fontSize="12" fill="#e2e8f0" fontWeight="bold">{s.pct}%</text>
          <text x="13" y="31" fontSize="8" fill="#4a5568">{s.count} events</text>
        </g>
      ))}
    </svg>
  )
}

// ── Line chart ─────────────────────────────────────────────────────────────────

function LineChart({ data }) {
  if (!data.length) return <p className="hint-text">No traffic data for last 24h</p>

  const n      = data.length
  const maxVal = Math.max(...TYPES.flatMap(t => data.map(d => d[`${t}In`] + d[`${t}Out`])), 1)

  const px = i => PAD_L + Math.round(i * (CHART_W - PAD_L) / Math.max(n - 1, 1))
  const py = v => CHART_H - PAD_B - Math.round((v / maxVal) * (CHART_H - PAD_B))

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H + 4}`}
      style={{ width: '100%', height: '100%', display: 'block' }}
      role="img"
      aria-label="Hourly traffic line chart"
      preserveAspectRatio="none"
    >
      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const y = py(frac * maxVal)
        return (
          <g key={frac}>
            <line x1={PAD_L} y1={y} x2={CHART_W} y2={y} stroke="#161630" strokeWidth={1} />
            {frac > 0 && (
              <text x={PAD_L - 3} y={y + 3} textAnchor="end" fontSize="7" fill="#2d3a5a">
                {Math.round(frac * maxVal)}
              </text>
            )}
          </g>
        )
      })}

      {TYPES.map(type => {
        const pts = data.map((d, i) => [px(i), py(d[`${type}In`] + d[`${type}Out`])])
        const color = TYPE_COLORS[type]
        return (
          <g key={type}>
            <polyline
              points={[`${px(0)},${py(0)}`, ...pts.map(([x, y]) => `${x},${y}`), `${px(n - 1)},${py(0)}`].join(' ')}
              fill={color} fillOpacity="0.06" stroke="none"
            />
            <polyline
              points={pts.map(([x, y]) => `${x},${y}`).join(' ')}
              fill="none" stroke={color} strokeWidth="1.5"
              strokeLinejoin="round" strokeLinecap="round" opacity="0.9"
            />
            {pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="2.5" fill={color} opacity="0.85" />
            ))}
          </g>
        )
      })}

      {data.map((d, i) => {
        if (n > 12 && i % Math.max(1, Math.round(n / 8)) !== 0) return null
        return (
          <text key={i} x={px(i)} y={CHART_H + 2} textAnchor="middle" fontSize="7" fill="#3d5070">
            {(d.hour || '').substring(11, 13)}h
          </text>
        )
      })}
    </svg>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export default function AnalyticsPanel() {
  const [hourlyData, setHourlyData] = useState([])
  const [liveCounts, setLiveCounts] = useState({})
  const [error,      setError]      = useState(null)

  const refreshLive = useCallback(() => {
    fetch(`${config.backendUrl}/api/events/counts?minutes=60`)
      .then(r => r.json())
      .then(data => setLiveCounts(data))
      .catch(() => {})
  }, [])

  const refreshSlow = useCallback(() => {
    fetch(`${config.backendUrl}/api/events/hourly-summary?hours=24`)
      .then(r => r.json())
      .then(hourly => {
        setHourlyData(Array.isArray(hourly) ? hourly : [])
        setError(null)
      })
      .catch(e => setError(e.message))
  }, [])

  useEffect(() => {
    refreshLive()
    refreshSlow()
    const liveId = setInterval(refreshLive, 1_000)
    const slowId = setInterval(refreshSlow, 10_000)
    return () => {
      clearInterval(liveId)
      clearInterval(slowId)
    }
  }, [refreshLive, refreshSlow])

  return (
    <div className="analytics-body">

      <div className="chart-legend">
        <span><span style={{ color: '#f59e0b' }}>■</span> Car</span>
        <span><span style={{ color: '#10b981' }}>■</span> Bus</span>
        <span><span style={{ color: '#38bdf8' }}>■</span> Truck</span>
      </div>

      {error && <p className="error-text">Backend unreachable: {error}</p>}

      <div style={{ display: 'flex', gap: 14, alignItems: 'stretch', flex: 1, minHeight: 0 }}>

        <div style={{ flex: '0 0 220px', display: 'flex', flexDirection: 'column' }}>
          <div className="section-label">Live Distribution — Last 60 min</div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PieChart counts={liveCounts} />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="section-label">Hourly Traffic — Last 24h</div>
          <div className="chart-wrap" style={{ flex: 1, minHeight: 0 }}>
            <LineChart data={hourlyData} />
          </div>
        </div>

      </div>

    </div>
  )
}
