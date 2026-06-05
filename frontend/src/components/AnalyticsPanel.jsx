import { useState, useEffect, useCallback } from 'react'
import config from '../config'

// ── SVG line chart ─────────────────────────────────────────────────────────────

const CHART_W = 600
const CHART_H = 110
const PAD_L   = 28
const PAD_B   = 18

const TYPE_COLORS = {
  car:        '#f59e0b',
  motorcycle: '#a78bfa',
  bus:        '#10b981',
  truck:      '#38bdf8',
}
const TYPES = ['car', 'motorcycle', 'bus', 'truck']

function LineChart({ data }) {
  if (!data.length) return <p className="hint-text">No traffic data for last 24h</p>

  const n      = data.length
  const maxVal = Math.max(...TYPES.flatMap(t => data.map(d => d[`${t}In`] + d[`${t}Out`])), 1)

  const px = i => PAD_L + Math.round(i * (CHART_W - PAD_L) / Math.max(n - 1, 1))
  const py = v => CHART_H - PAD_B - Math.round((v / maxVal) * (CHART_H - PAD_B))

  const gridVals = [0, 0.25, 0.5, 0.75, 1]

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H + 4}`}
      style={{ width: '100%', height: CHART_H + 4, display: 'block' }}
      role="img"
      aria-label="Hourly traffic line chart"
    >
      {/* grid lines + y-labels */}
      {gridVals.map(frac => {
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

      {/* lines + dots per type */}
      {TYPES.map(type => {
        const pts = data.map((d, i) => [px(i), py(d[`${type}In`] + d[`${type}Out`])])
        const polyline = pts.map(([x, y]) => `${x},${y}`).join(' ')
        const color = TYPE_COLORS[type]

        return (
          <g key={type}>
            {/* area fill */}
            <polyline
              points={[
                `${px(0)},${py(0)}`,
                ...pts.map(([x, y]) => `${x},${y}`),
                `${px(n - 1)},${py(0)}`,
              ].join(' ')}
              fill={color}
              fillOpacity="0.06"
              stroke="none"
            />
            {/* line */}
            <polyline
              points={polyline}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.9"
            />
            {/* dots */}
            {pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="2.5" fill={color} opacity="0.85" />
            ))}
          </g>
        )
      })}

      {/* x-axis labels */}
      {data.map((d, i) => {
        const show = n <= 12 || i % Math.max(1, Math.round(n / 8)) === 0
        if (!show) return null
        return (
          <text key={i} x={px(i)} y={CHART_H + 2} textAnchor="middle" fontSize="7" fill="#3d5070">
            {(d.hour || '').substring(11, 13)}h
          </text>
        )
      })}
    </svg>
  )
}

// ── Anomaly badge ──────────────────────────────────────────────────────────────

function AnomalyBadge({ a }) {
  const cls  = a.severity === 'HIGH' ? 'anomaly-badge anomaly-high' : 'anomaly-badge anomaly-medium'
  const hour = (a.hour || '').substring(11, 16)
  return (
    <div className={cls}>
      ⚠ {a.severity} — {hour} UTC — {a.count} crossings
      <span style={{ color: '#4a5568', marginLeft: 8 }}>
        (avg {a.mean}, threshold {a.threshold})
      </span>
    </div>
  )
}

// ── Forecast card ──────────────────────────────────────────────────────────────

function ForecastCard({ f }) {
  if (!f || f.basedOnDays === 0) {
    return (
      <div className="forecast-card forecast-nodata">
        <div style={{ fontSize: 13, color: '#3d5070', marginBottom: 4 }}>Insufficient historical data</div>
        <div style={{ fontSize: 11, color: '#2d3a5a' }}>
          Forecast activates after 2+ days of crossing events are stored.
        </div>
      </div>
    )
  }

  const trendColor = f.trend === 'increasing' ? '#10b981'
                   : f.trend === 'decreasing' ? '#f59e0b'
                   : '#4a5568'
  const trendIcon  = f.trend === 'increasing' ? '↑'
                   : f.trend === 'decreasing' ? '↓'
                   : '→'
  return (
    <div className="forecast-card">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
        <span className="forecast-number">{f.predictedTotal}</span>
        <span className="forecast-trend" style={{ color: trendColor }}>
          {trendIcon} {f.trend}
        </span>
      </div>
      <div className="forecast-meta">
        Method: {f.method} · Confidence: <span style={{ color: '#64748b' }}>{f.confidence}</span>
        {' '}· Based on {f.basedOnDays} days · 7-day avg: {f.historicalAvg}
      </div>
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export default function AnalyticsPanel() {
  const [hourlyData, setHourlyData] = useState([])
  const [anomalies,  setAnomalies]  = useState([])
  const [forecast,   setForecast]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetch(`${config.backendUrl}/api/events/hourly-summary?hours=24`).then(r => r.json()),
      fetch(`${config.backendUrl}/api/events/anomalies`).then(r => r.json()),
      fetch(`${config.backendUrl}/api/reports/forecast`).then(r => r.json()),
    ])
      .then(([hourly, anoms, fore]) => {
        setHourlyData(Array.isArray(hourly) ? hourly : [])
        setAnomalies(Array.isArray(anoms)   ? anoms  : [])
        setForecast(fore)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 60_000)
    return () => clearInterval(id)
  }, [refresh])

  return (
    <div className="analytics-body">

      {/* legend + refresh */}
      <div className="chart-legend">
        <span><span style={{ color: '#f59e0b' }}>■</span> Car</span>
        <span><span style={{ color: '#a78bfa' }}>■</span> Motorcycle</span>
        <span><span style={{ color: '#10b981' }}>■</span> Bus</span>
        <span><span style={{ color: '#38bdf8' }}>■</span> Truck</span>
        {loading && <span style={{ marginLeft: 'auto', color: '#2d3a5a' }}>Refreshing…</span>}
        <button className="refresh-btn" onClick={refresh} style={loading ? { marginLeft: 0 } : {}}>
          ↻ Refresh
        </button>
      </div>

      {error && <p className="error-text">Backend unreachable: {error}</p>}

      {/* hourly bar chart */}
      <div>
        <div className="section-label">Hourly Traffic — Last 24h</div>
        <div className="chart-wrap">
          <LineChart data={hourlyData} />
        </div>
      </div>

      {/* anomaly detection */}
      <div>
        <div className="section-label">Anomaly Detection</div>
        {anomalies.length === 0
          ? <p className="hint-text">No anomalies in last 24h (threshold: mean + 2σ)</p>
          : anomalies.map((a, i) => <AnomalyBadge key={i} a={a} />)
        }
      </div>

      {/* predictive forecast */}
      <div>
        <div className="section-label">Tomorrow's Forecast</div>
        <ForecastCard f={forecast} />
      </div>

    </div>
  )
}