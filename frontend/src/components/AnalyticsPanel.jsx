import { useState, useEffect, useCallback } from 'react'
import config from '../config'

// ── SVG bar chart (pure, no deps) ─────────────────────────────────────────────

function BarChart({ data }) {
  if (!data.length) return <p className="hint-text">No traffic data for last 24h</p>

  const maxVal  = Math.max(...data.map(d => d.total), 1)
  const chartH  = 110
  const n       = data.length
  const barW    = Math.max(4, Math.floor(220 / n) - 1)
  const totalW  = n * (barW + 1)

  return (
    <svg
      viewBox={`0 0 ${totalW} ${chartH + 22}`}
      style={{ width: '100%', height: chartH + 22, display: 'block' }}
    >
      {data.map((d, i) => {
        const personH  = Math.round(((d.personIn  + d.personOut)  / maxVal) * chartH)
        const vehicleH = Math.round(((d.vehicleIn + d.vehicleOut) / maxVal) * chartH)
        const x = i * (barW + 1)
        const label = (d.hour || '').substring(11, 13)
        return (
          <g key={d.hour || i}>
            <rect x={x} y={chartH - vehicleH}          width={barW} height={vehicleH} fill="#f97316" opacity="0.85" />
            <rect x={x} y={chartH - vehicleH - personH} width={barW} height={personH} fill="#22c55e" opacity="0.85" />
            {i % Math.max(1, Math.round(n / 8)) === 0 && (
              <text x={x + barW / 2} y={chartH + 14} textAnchor="middle" fontSize="7" fill="#555">
                {label}h
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Anomaly badge ─────────────────────────────────────────────────────────────

function AnomalyBadge({ a }) {
  const bg    = a.severity === 'HIGH' ? '#7f1d1d' : '#78350f'
  const color = a.severity === 'HIGH' ? '#fca5a5' : '#fcd34d'
  const hour  = (a.hour || '').substring(11, 16)
  return (
    <div style={{ background: bg, color, borderRadius: 6, padding: '6px 10px', fontSize: 12 }}>
      ⚠ {a.severity} — {hour} UTC — {a.count} crossings
      <span style={{ color: '#aaa', marginLeft: 8 }}>
        (avg {a.mean}, threshold {a.threshold})
      </span>
    </div>
  )
}

// ── Forecast card ─────────────────────────────────────────────────────────────

function ForecastCard({ f }) {
  const trendColor = f.trend === 'increasing' ? '#22c55e'
                   : f.trend === 'decreasing' ? '#f97316'
                   : '#aaa'
  const trendIcon  = f.trend === 'increasing' ? '↑'
                   : f.trend === 'decreasing' ? '↓'
                   : '→'
  return (
    <div className="stat-card" style={{ textAlign: 'left', padding: '10px 12px' }}>
      <div className="stat-label">Tomorrow's Predicted Crossings</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: '#4db8ff' }}>{f.predictedTotal}</span>
        <span style={{ color: trendColor, fontSize: 18 }}>{trendIcon} {f.trend}</span>
      </div>
      <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>
        Method: {f.method} · Confidence: <span style={{ color: '#aaa' }}>{f.confidence}</span>
        {' '}· Based on {f.basedOnDays} days · 7-day avg: {f.historicalAvg}
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

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
    <div className="tab-content">

      {/* KPI legend */}
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#888' }}>
        <span><span style={{ color: '#22c55e' }}>■</span> Person</span>
        <span><span style={{ color: '#f97316' }}>■</span> Vehicle</span>
        {loading && <span style={{ marginLeft: 'auto', color: '#555' }}>Refreshing…</span>}
        <button
          onClick={refresh}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#4db8ff',
                   cursor: 'pointer', fontSize: 11, padding: 0 }}
        >
          ↻ Refresh
        </button>
      </div>

      {error && <p className="error-text">Backend unreachable: {error}</p>}

      {/* Hourly bar chart */}
      <div>
        <div className="panel-title" style={{ marginBottom: 6 }}>Hourly Traffic — Last 24h</div>
        <BarChart data={hourlyData} />
      </div>

      {/* Anomaly alerts */}
      <div>
        <div className="panel-title" style={{ marginBottom: 6 }}>Anomaly Detection</div>
        {anomalies.length === 0
          ? <p className="hint-text">No anomalies in last 24h (threshold: mean + 2σ)</p>
          : anomalies.map((a, i) => <AnomalyBadge key={i} a={a} />)
        }
      </div>

      {/* Predictive forecast */}
      <div>
        <div className="panel-title" style={{ marginBottom: 6 }}>Predictive Analytics</div>
        {forecast
          ? <ForecastCard f={forecast} />
          : <p className="hint-text">Loading forecast…</p>
        }
      </div>

    </div>
  )
}