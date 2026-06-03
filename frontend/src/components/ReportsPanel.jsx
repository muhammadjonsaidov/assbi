import { useState } from 'react'
import config from '../config'

export default function ReportsPanel({ stats }) {
  const [output,  setOutput]  = useState('Select a report to generate.')
  const [loading, setLoading] = useState(false)

  const fetchReport = async (type) => {
    setLoading(true)
    setOutput('Generating report…')
    try {
      const res  = await fetch(`${config.backendUrl}/api/reports/${type}`)
      const data = await res.json()
      setOutput(JSON.stringify(data, null, 2))
    } catch (e) {
      setOutput('Error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="reports-body">

      {/* ── Live real-time KPI counters ─────────────────────────────────────── */}
      <div className="live-stats-section">
        <div className="section-label">Real-time — Last 60 min</div>
        <div className="live-stats-grid">
          <div className="live-stat">
            <div className="live-stat-label">Person IN</div>
            <div className="live-stat-value live-stat-in">{stats.personIn}</div>
          </div>
          <div className="live-stat">
            <div className="live-stat-label">Person OUT</div>
            <div className="live-stat-value live-stat-out">{stats.personOut}</div>
          </div>
          <div className="live-stat">
            <div className="live-stat-label">Vehicle IN</div>
            <div className="live-stat-value live-stat-in">{stats.vehicleIn}</div>
          </div>
          <div className="live-stat">
            <div className="live-stat-label">Vehicle OUT</div>
            <div className="live-stat-value live-stat-out">{stats.vehicleOut}</div>
          </div>
        </div>
      </div>

      {/* ── Report generation ──────────────────────────────────────────────── */}
      <div className="report-section">
        <div className="section-label" style={{ marginBottom: 8 }}>Generate Report</div>
        <div className="report-btns">
          <button className="btn-report" onClick={() => fetchReport('weekly')}  disabled={loading}>
            📅 Weekly
          </button>
          <button className="btn-report" onClick={() => fetchReport('monthly')} disabled={loading}>
            📅 Monthly
          </button>
          <button className="btn-report" onClick={() => fetchReport('forecast')} disabled={loading}>
            🔮 Forecast
          </button>
        </div>
        <pre className="report-output">{output}</pre>
      </div>

    </div>
  )
}
