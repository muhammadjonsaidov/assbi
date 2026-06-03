import { useState, useEffect, useCallback } from 'react'
import config from '../config'

// ── SVG bar chart ──────────────────────────────────────────────────────────────

function BarChart({ data }) {
  if (!data.length) return <p className="hint-text">No traffic data for last 24h</p>

  const maxVal = Math.max(...data.map(d => d.total), 1)
  const chartH = 100
  const n      = data.length
  const barW   = Math.max(5, Math.floor(260 / n) - 2)
  const totalW = n * (barW + 2)

  return (
    <svg
      viewBox={`0 0 ${totalW} ${chartH + 20}`}
      style={{ width: '100%', height: chartH + 20, display: 'block' }}
      role="img"
      aria-label="Hourly traffic bar chart"
    >
      {/* Horizontal grid lines */}
      {[0.25, 0.5, 0.75, 1].map(frac => {
        const y = chartH - Math.round(frac * chartH)
        return (
          <line key={frac} x1={0} y1={y} x2={totalW} y2={y}
            stroke="#161630" strokeWidth={1} />
        )
      })}

      {data.map((d, i) => {
        const personH  = Math.round(((d.personIn  + d.personOut)  / maxVal) * chartH)
        const vehicleH = Math.round(((d.vehicleIn + d.vehicleOut) / maxVal) * chartH)
        const x     = i * (barW + 2)
        const label = (d.hour || '').substring(11, 13)
        const showLabel = i % Math.max(1, Math.round(n / 8)) === 0
        return (
          <g key={d.hour || i}>
            <rect x={x} y={chartH - vehicleH}           width={barW} height={vehicleH} fill="#f59e0b" opacity="0.8" rx="1" />
            <rect x={x} y={chartH - vehicleH - personH} width={barW} height={personH}  fill="#10b981" opacity="0.8" rx="1" />
            {showLabel && (
              <text x={x + barW / 2} y={chartH + 13} textAnchor="middle" fontSize="7" fill="#2d3a5a">
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
  const trendColor = f.trend === 'increasing' ? '#10b981'
                   : f.trend === 'decreasing' ? '#f59e0b'
                   : '#4a5568'
  const trendIcon  = f.trend === 'increasing' ? '↑'
                   : f.trend === 'decreasing' ? '↓'
                   : '→'
  return (
    <div className="forecast-card">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span className="forecast-number">{f.predictedTotal}</span>
        <span className="forecast-trend" style={{ color: trendColor }}>
          {trendIcon} {f.trend}
        </span>
      </div>
      <div className="forecast-meta">
        Method: {f.method} · Confidence: {f.confidence}
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

      {/* Legend + refresh */}
      <div className="chart-legend">
        <span><span style={{ color: '#10b981' }}>■</span> Person</span>
        <span><span style={{ color: '#f59e0b' }}>■</span> Vehicle</span>
        {loading && <span style={{ marginLeft: 'auto', color: '#2d3a5a' }}>Refreshing…</span>}
        <button className="refresh-btn" onClick={refresh} style={loading ? { marginLeft: 0 } : {}}>
          ↻ Refresh
        </button>
      </div>

      {error && <p className="error-text">Backend unreachable: {error}</p>}

      {/* Hourly bar chart */}
      <div>
        <div className="section-label">Hourly Traffic — Last 24h</div>
        <div className="chart-wrap">
          <BarChart data={hourlyData} />
        </div>
      </div>

      {/* Anomaly detection */}
      <div>
        <div className="section-label">Anomaly Detection</div>
        {anomalies.length === 0
          ? <p className="hint-text">No anomalies in last 24h (threshold: mean + 2σ)</p>
          : anomalies.map((a, i) => <AnomalyBadge key={i} a={a} />)
        }
      </div>

      {/* Predictive forecast */}
      <div>
        <div className="section-label">Tomorrow's Forecast</div>
        {forecast
          ? <ForecastCard f={forecast} />
          : <p className="hint-text">Insufficient historical data for forecast</p>
        }
      </div>

    </div>
  )
}