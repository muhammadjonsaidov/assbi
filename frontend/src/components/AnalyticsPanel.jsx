import { useState, useEffect, useCallback, useRef } from 'react'
import config from '../config'

const COLORS = { car: '#00d4f5', bus: '#00e5a0', truck: '#b46fff' }
const TYPES  = ['car', 'bus', 'truck']

function useAnimated(target, duration = 500) {
  const [val, setVal] = useState(target)
  const from = useRef(target)
  const raf  = useRef(null)
  useEffect(() => {
    const start = from.current, end = target
    if (start === end) return
    const t0 = performance.now()
    cancelAnimationFrame(raf.current)
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(start + (end - start) * e))
      if (p < 1) raf.current = requestAnimationFrame(tick)
      else from.current = end
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])
  return val
}

function DonutChart({ counts }) {
  const totals = TYPES.map(t => (counts[`${t}_IN`] || 0) + (counts[`${t}_OUT`] || 0))
  const grand  = totals.reduce((s, v) => s + v, 0)

  if (grand === 0) return <p className="ana-empty">No crossings in last 60 min</p>

  const cx = 70, cy = 70, R = 56, ri = 30, gap = 0.05
  let angle = -Math.PI / 2

  const slices = TYPES.map((type, i) => {
    const sweep = totals[i] / grand * 2 * Math.PI - gap
    const a0 = angle + gap / 2
    const a1 = angle + gap / 2 + sweep
    angle += totals[i] / grand * 2 * Math.PI
    const large = sweep > Math.PI ? 1 : 0
    const d = [
      `M ${(cx + R * Math.cos(a0)).toFixed(2)} ${(cy + R * Math.sin(a0)).toFixed(2)}`,
      `A ${R} ${R} 0 ${large} 1 ${(cx + R * Math.cos(a1)).toFixed(2)} ${(cy + R * Math.sin(a1)).toFixed(2)}`,
      `L ${(cx + ri * Math.cos(a1)).toFixed(2)} ${(cy + ri * Math.sin(a1)).toFixed(2)}`,
      `A ${ri} ${ri} 0 ${large} 0 ${(cx + ri * Math.cos(a0)).toFixed(2)} ${(cy + ri * Math.sin(a0)).toFixed(2)}`,
      'Z',
    ].join(' ')
    return { type, d, pct: Math.round(totals[i] / grand * 100), count: totals[i] }
  })

  return (
    <div className="ana-donut-wrap">
      <svg viewBox="0 0 140 140" className="ana-donut-svg">
        <circle cx={cx} cy={cy} r={(R + ri) / 2} fill="none"
          stroke="#0a1625" strokeWidth={R - ri + 2} />
        {slices.map(s => (
          <path key={s.type} d={s.d} fill={COLORS[s.type]} />
        ))}
        <text x={cx} y={cy - 7} textAnchor="middle" className="ana-donut-num">{grand}</text>
        <text x={cx} y={cy + 9} textAnchor="middle" className="ana-donut-sub">crossings</text>
      </svg>
      <div className="ana-donut-legend">
        {slices.map(s => (
          <div key={s.type} className="ana-legend-row">
            <span className="ana-legend-dot" style={{ background: COLORS[s.type] }} />
            <span className="ana-legend-type">{s.type}</span>
            <span className="ana-legend-pct" style={{ color: COLORS[s.type] }}>{s.pct}%</span>
            <span className="ana-legend-count">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function smoothLine(pts) {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i], mx = (p.x + c.x) / 2
    d += ` C ${mx.toFixed(1)} ${p.y.toFixed(1)} ${mx.toFixed(1)} ${c.y.toFixed(1)} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`
  }
  return d
}

function LineChart({ hourly }) {
  if (!hourly || hourly.length < 2) return <p className="ana-empty">No hourly data</p>

  const W = 280, H = 110
  const P = { top: 8, right: 6, bottom: 20, left: 24 }
  const iW = W - P.left - P.right
  const iH = H - P.top  - P.bottom
  const n  = hourly.length

  const series = TYPES.map(type => ({
    type,
    vals: hourly.map(h => (h[`${type}In`] || 0) + (h[`${type}Out`] || 0)),
  }))

  const maxVal = Math.max(...series.flatMap(s => s.vals), 1)
  const toPoints = vals => vals.map((v, i) => ({
    x: P.left + (i / (n - 1)) * iW,
    y: P.top  + (1 - v / maxVal) * iH,
  }))

  const gridVals = [0, Math.round(maxVal * 0.5), maxVal]
  const labelEvery = Math.max(1, Math.ceil(n / 5))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        {TYPES.map(type => (
          <linearGradient key={type} id={`ag-${type}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={COLORS[type]} stopOpacity="0.18" />
            <stop offset="100%" stopColor={COLORS[type]} stopOpacity="0"    />
          </linearGradient>
        ))}
      </defs>

      {gridVals.map(v => {
        const y = P.top + (1 - v / maxVal) * iH
        return (
          <g key={v}>
            <line x1={P.left} x2={P.left + iW} y1={y} y2={y}
              stroke="#0a1828" strokeWidth="1" />
            {v > 0 && (
              <text x={P.left - 3} y={y + 3} textAnchor="end" fontSize="7" fill="#1e3050">{v}</text>
            )}
          </g>
        )
      })}

      {hourly.map((h, i) => {
        if (i % labelEvery !== 0) return null
        const x = P.left + (i / (n - 1)) * iW
        return (
          <text key={i} x={x} y={H - 4} textAnchor="middle" fontSize="7" fill="#1e3050">
            {h.hour ? h.hour.slice(11, 16) : ''}
          </text>
        )
      })}

      {series.map(({ type, vals }) => {
        const pts  = toPoints(vals)
        const line = smoothLine(pts)
        const last = `L ${pts[pts.length-1].x.toFixed(1)} ${(P.top + iH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(P.top + iH).toFixed(1)} Z`
        return (
          <g key={type}>
            <path d={line + last} fill={`url(#ag-${type})`} />
            <path d={line} fill="none" stroke={COLORS[type]} strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r="2.5" fill={COLORS[type]} />
          </g>
        )
      })}
    </svg>
  )
}

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

  const animTotal = useAnimated(total)
  const animIn    = useAnimated(totalIn)
  const animOut   = useAnimated(totalOut)

  const inPct  = total > 0 ? Math.round(totalIn  / total * 100) : 50
  const outPct = total > 0 ? Math.round(totalOut / total * 100) : 50

  return (
    <div className="analytics-body">

      {error && (
        <div className="ana-error">
          <span className="ana-error-icon">⬥</span>
          Backend unreachable: {error}
        </div>
      )}

      <div className="ana-kpis">
        <div className="ana-kpi ana-kpi-total">
          <div className="ana-kpi-num">{animTotal.toLocaleString()}</div>
          <div className="ana-kpi-lbl">Total · 1H</div>
        </div>
        <div className="ana-kpi ana-kpi-in">
          <div className="ana-kpi-num">{animIn.toLocaleString()}</div>
          <div className="ana-kpi-lbl">In · 1H</div>
        </div>
        <div className="ana-kpi ana-kpi-out">
          <div className="ana-kpi-num">{animOut.toLocaleString()}</div>
          <div className="ana-kpi-lbl">Out · 1H</div>
        </div>
      </div>

      <div className="ana-flow">
        <div className="ana-flow-bar">
          <div className="ana-flow-in"  style={{ width: `${inPct}%`  }} />
          <div className="ana-flow-out" style={{ width: `${outPct}%` }} />
        </div>
        <div className="ana-flow-labels">
          <span style={{ color: '#00c853' }}>▶ IN {inPct}%</span>
          <span style={{ color: '#f59e0b' }}>OUT {outPct}% ◀</span>
        </div>
      </div>

      <div className="ana-charts">

        <div className="ana-chart-box ana-chart-donut">
          <div className="ana-chart-title">Distribution · 60min</div>
          <DonutChart counts={liveCounts} />
        </div>

        <div className="ana-chart-box ana-chart-line">
          <div className="ana-chart-title ana-chart-title-row">
            <span>Hourly Trend · 12H</span>
            <span className="ana-line-legend">
              {TYPES.map(t => (
                <span key={t} style={{ color: COLORS[t] }}>■ {t}</span>
              ))}
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <LineChart hourly={hourly} />
          </div>
        </div>

      </div>
    </div>
  )
}