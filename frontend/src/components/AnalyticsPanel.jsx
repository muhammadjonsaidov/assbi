import { useState, useEffect, useCallback } from 'react'
import config from '../config'

// ── SVG bar chart — always fills container width ───────────────────────────────

const CHART_W = 600   // SVG coordinate space; CSS width:100% scales it to container
const CHART_H = 100

function BarChart({ data }) {
  if (!data.length) return <p className="hint-text">No traffic data for last 24h</p>

  const n      = data.length
  const maxVal = Math.max(...data.map(d => d.total), 1)
  const barW   = Math.max(2, Math.floor(CHART_W / n) - 2)

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H + 20}`}
      style={{ width: '100%', height: CHART_H + 20, display: 'block' }}
      role="img"
      aria-label="Hourly traffic bar chart"
    >
      {/* grid lines */}
      {[0.25, 0.5, 0.75, 1].map(frac => {
        const y = CHART_H - Math.round(frac * CHART_H)
        return <line key={frac} x1={0} y1={y} x2={CHART_W} y2={y} stroke="#161630" strokeWidth={1} />
      })}

      {data.map((d, i) => {
        const personH  = Math.round(((d.personIn  + d.personOut)  / maxVal) * CHART_H)
        const vehicleH = Math.round(((d.vehicleIn + d.vehicleOut) / maxVal) * CHART_H)
        const x     = Math.round(i * (CHART_W / n))
        const label = (d.hour || '').substring(11, 13)
        const showLabel = n <= 12 || i % Math.max(1, Math.round(n / 8)) === 0
        return (
          <g key={d.hour || i}>
            <rect x={x} y={CHART_H - vehicleH}           width={barW} height={vehicleH} fill="#f59e0b" opacity="0.85" rx="1" />
            <rect x={x} y={CHART_H - vehicleH - personH} width={barW} height={personH}  fill="#10b981" opacity="0.85" rx="1" />
            {showLabel && (
              <text x={x + barW / 2} y={CHART_H + 13} textAnchor="middle" fontSize="8" fill="#3d5070">
                {label}h
              </text>
            )}
          </g>
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
        <span><span style={{ color: '#10b981' }}>■</span> Person</span>
        <span><span style={{ color: '#f59e0b' }}>■</span> Vehicle</span>
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
          <BarChart data={hourlyData} />
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