export default function ReportsPanel({ stats }) {
  const TYPES = ['car', 'motorcycle', 'bus', 'truck']

  return (
    <div className="reports-body">
      <div className="live-stats-section">
        <div className="section-label">Real-time — Last 60 min</div>
        <table className="vehicle-stats-table">
          <thead>
            <tr>
              <th>Type</th>
              <th className="live-stat-in">IN</th>
              <th className="live-stat-out">OUT</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {TYPES.map(type => {
              const s = stats[type] || { in: 0, out: 0 }
              return (
                <tr key={type}>
                  <td className="vehicle-type-label">{type}</td>
                  <td className="live-stat-in">{s.in}</td>
                  <td className="live-stat-out">{s.out}</td>
                  <td className="vehicle-total">{s.in + s.out}</td>
                </tr>
              )
            })}
            <tr className="vehicle-stats-total-row">
              <td>Total</td>
              <td className="live-stat-in">
                {TYPES.reduce((s, t) => s + (stats[t]?.in || 0), 0)}
              </td>
              <td className="live-stat-out">
                {TYPES.reduce((s, t) => s + (stats[t]?.out || 0), 0)}
              </td>
              <td className="vehicle-total">
                {TYPES.reduce((s, t) => s + (stats[t]?.in || 0) + (stats[t]?.out || 0), 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
