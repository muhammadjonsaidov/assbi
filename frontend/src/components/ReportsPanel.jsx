import { useState } from 'react'
import config from '../config'

function formatReport(type, data) {
  if (!data || typeof data !== 'object') return String(data)

  if (type === 'forecast') {
    const trend = data.trend === 'increasing' ? '↑' : data.trend === 'decreasing' ? '↓' : '→'
    return [
      `Forecast for ${data.forecastDate}`,
      `  Predicted crossings : ${data.predictedTotal}`,
      `  Trend               : ${trend} ${data.trend}`,
      `  Confidence          : ${data.confidence}`,
      `  Method              : ${data.method}`,
      `  Historical avg      : ${data.historicalAvg} (over ${data.basedOnDays} days)`,
    ].join('\n')
  }

  // Weekly / monthly report
  const lines = [
    `Period  : ${data.period}`,
    `From    : ${data.from}   To: ${data.to}`,
    `Total   : IN ${data.total_in}  OUT ${data.total_out}`,
    '',
    'By type :',
  ]
  if (data.by_type) {
    for (const [type, counts] of Object.entries(data.by_type)) {
      lines.push(`  ${type.padEnd(12)}  IN ${counts.in ?? 0}  OUT ${counts.out ?? 0}`)
    }
  }
  return lines.join('\n')
}

export default function ReportsPanel({ stats }) {
  const [output,      setOutput]      = useState('Select a report to generate.')
  const [activeReport, setActiveReport] = useState(null)
  const [loading,     setLoading]     = useState(false)

  const fetchReport = async (type) => {
    setLoading(true)
    setActiveReport(type)
    setOutput('Generating report…')
    try {
      const res  = await fetch(`${config.backendUrl}/api/reports/${type}`)
      const data = await res.json()
      setOutput(formatReport(type, data))
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
          <button
            className={`btn-report${activeReport === 'weekly' ? ' active' : ''}`}
            onClick={() => fetchReport('weekly')}
            disabled={loading}
          >
            Weekly
          </button>
          <button
            className={`btn-report${activeReport === 'monthly' ? ' active' : ''}`}
            onClick={() => fetchReport('monthly')}
            disabled={loading}
          >
            Monthly
          </button>
          <button
            className={`btn-report${activeReport === 'forecast' ? ' active' : ''}`}
            onClick={() => fetchReport('forecast')}
            disabled={loading}
          >
            Forecast
          </button>
        </div>
        <pre className="report-output">{output}</pre>
      </div>

    </div>
  )
}