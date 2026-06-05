export default function ReportsPanel({ stats }) {
  const TYPES = ['car', 'bus', 'truck']

  const totalIn  = TYPES.reduce((s, t) => s + (stats[t]?.in  || 0), 0)
  const totalOut = TYPES.reduce((s, t) => s + (stats[t]?.out || 0), 0)

  return (
    <div className="reports-body">
      <div className="section-label" style={{ marginBottom: 6 }}>Today — Last 24h</div>
      <div className="kpi-cards">
        {TYPES.map(type => {
          const s = stats[type] || { in: 0, out: 0 }
          return (
            <div key={type} className={`kpi-card kpi-card-${type}`}>
              <div className="kpi-card-name">{type}</div>
              <div className="kpi-card-number">{s.in + s.out}</div>
              <div className="kpi-card-sub">
                <span className="kpi-in">{s.in} IN</span>
                <span className="kpi-out">{s.out} OUT</span>
              </div>
            </div>
          )
        })}

        <div className="kpi-card kpi-card-total">
          <div className="kpi-card-name">Total</div>
          <div className="kpi-card-number">{totalIn + totalOut}</div>
          <div className="kpi-card-sub">
            <span className="kpi-in">{totalIn} IN</span>
            <span className="kpi-out">{totalOut} OUT</span>
          </div>
        </div>
      </div>
    </div>
  )
}