import { useState, useEffect } from 'react'
import LeftPanel from './components/LeftPanel.jsx'
import VideoCanvas from './components/VideoCanvas.jsx'
import RightPanel from './components/RightPanel.jsx'
import config from './config'

export default function App() {
  const [workerRunning, setWorkerRunning] = useState(false)
  const [drawMode, setDrawMode] = useState(false)
  const [stats, setStats] = useState({ personIn: 0, personOut: 0, vehicleIn: 0, vehicleOut: 0 })

  // Restore worker status on mount
  useEffect(() => {
    fetch(`${config.backendUrl}/api/worker/status`)
      .then(r => r.json())
      .then(d => setWorkerRunning(Boolean(d.running)))
      .catch(() => {})
  }, [])

  // Poll live stats
  useEffect(() => {
    const poll = () => {
      fetch(`${config.backendUrl}/api/events/counts?minutes=${config.statsWindowMinutes}`)
        .then(r => r.json())
        .then(data => {
          const sum = (suffix) =>
            Object.entries(data)
              .filter(([k]) => k.endsWith(suffix))
              .reduce((s, [, v]) => s + Number(v), 0)

          setStats({
            personIn:   data['person_IN']  || 0,
            personOut:  data['person_OUT'] || 0,
            vehicleIn:  sum('vehicle_IN'),
            vehicleOut: sum('vehicle_OUT'),
          })
        })
        .catch(() => {})
    }
    poll()
    const id = setInterval(poll, config.statsPollingMs)
    return () => clearInterval(id)
  }, [])

  const handleStart = async (source) => {
    const res = await fetch(
      `${config.backendUrl}/api/worker/start?source=${encodeURIComponent(source)}`,
      { method: 'POST' }
    )
    const d = await res.json()
    if (!d.error) setWorkerRunning(true)
    else throw new Error(d.error)
  }

  const handleStop = async () => {
    await fetch(`${config.backendUrl}/api/worker/stop`, { method: 'POST' })
    setWorkerRunning(false)
    setDrawMode(false)
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">ASSBI</span>
        <span className="app-badge">Smart Surveillance BI</span>
        <div className="worker-status">
          <span className={`status-dot${workerRunning ? ' running' : ''}`} />
          <span className="status-text">
            {workerRunning ? 'Worker running' : 'Worker stopped'}
          </span>
        </div>
      </header>

      <main className="app-main">
        <LeftPanel
          workerRunning={workerRunning}
          drawMode={drawMode}
          stats={stats}
          onStart={handleStart}
          onStop={handleStop}
          onToggleDrawMode={() => setDrawMode(m => !m)}
        />
        <VideoCanvas
          active={workerRunning}
          drawMode={drawMode}
          onLineSent={() => setDrawMode(false)}
        />
        <RightPanel />
      </main>
    </div>
  )
}