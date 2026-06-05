export default function ReportsPanel({ stats }) {
  const TYPES = ['car', 'bus', 'truck']

  const totalIn  = TYPES.reduce((s, t) => s + (stats[t]?.in  || 0), 0)
  const totalOut = TYPES.reduce((s, t) => s + (stats[t]?.out || 0), 0)

  return (
    <div className="reports-body">
      <div className="live-stats-section">
        <div className="section-label">Real-time — Last 60 min</div>

        <div className="stats-grid">
          {TYPES.map(type => {
            const s = stats[type] || { in: 0, out: 0 }
            return (
              <div key={type} className="stats-row">
                <div className="stats-type-label">{type}</div>
                <div className="stats-in">{s.in}<span className="stats-dir">IN</span></div>
                <div className="stats-out">{s.out}<span className="stats-dir">OUT</span></div>
                <div className="stats-total">{s.in + s.out}<span className="stats-dir">TOTAL</span></div>
              </div>
            )
          })}

          <div className="stats-row stats-row-total">
            <div className="stats-type-label">Total</div>
            <div className="stats-in">{totalIn}<span className="stats-dir">IN</span></div>
            <div className="stats-out">{totalOut}<span className="stats-dir">OUT</span></div>
            <div className="stats-total">{totalIn + totalOut}<span className="stats-dir">TOTAL</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
