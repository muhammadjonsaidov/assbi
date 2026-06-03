import { useState, useEffect } from 'react'
import HeaderBar     from './components/HeaderBar.jsx'
import VideoCanvas   from './components/VideoCanvas.jsx'
import AnalyticsPanel from './components/AnalyticsPanel.jsx'
import ChatPanel     from './components/ChatPanel.jsx'
import ReportsPanel  from './components/ReportsPanel.jsx'
import config from './config'

export default function App() {
  const [workerRunning, setWorkerRunning] = useState(false)
  const [drawMode,      setDrawMode]      = useState(false)
  const [stats, setStats] = useState({ personIn: 0, personOut: 0, vehicleIn: 0, vehicleOut: 0 })

  useEffect(() => {
    fetch(`${config.backendUrl}/api/worker/status`)
      .then(r => r.json())
      .then(d => setWorkerRunning(Boolean(d.running)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const poll = () => {
      fetch(`${config.backendUrl}/api/events/counts?minutes=${config.statsWindowMinutes}`)
        .then(r => r.json())
        .then(data => {
          const VEHICLE_TYPES = ['car', 'truck', 'bus', 'motorcycle']
          const sumVehicle = (dir) =>
            VEHICLE_TYPES.reduce((s, t) => s + (Number(data[`${t}_${dir}`]) || 0), 0)
          setStats({
            personIn:   Number(data['person_IN'])  || 0,
            personOut:  Number(data['person_OUT']) || 0,
            vehicleIn:  sumVehicle('IN'),
            vehicleOut: sumVehicle('OUT'),
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

      <HeaderBar
        workerRunning={workerRunning}
        drawMode={drawMode}
        onStart={handleStart}
        onStop={handleStop}
        onToggleDrawMode={() => setDrawMode(m => !m)}
      />

      <div className="app-grid">

        {/* Top-left: live video feed */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title-text">Live Feed</span>
            {workerRunning && <span className="live-dot" />}
          </div>
          <div className="panel-body">
            <VideoCanvas
              active={workerRunning}
              drawMode={drawMode}
              onLineSent={() => setDrawMode(false)}
            />
          </div>
        </div>

        {/* Top-right: analytics & intelligence */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title-text">Analytics &amp; Intelligence</span>
          </div>
          <div className="panel-body">
            <AnalyticsPanel />
          </div>
        </div>

        {/* Bottom-left: AI chat assistant */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title-text">AI Surveillance Assistant</span>
          </div>
          <div className="panel-body">
            <ChatPanel />
          </div>
        </div>

        {/* Bottom-right: reports & live KPIs */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title-text">Reports &amp; Live Stats</span>
          </div>
          <div className="panel-body">
            <ReportsPanel stats={stats} />
          </div>
        </div>

      </div>
    </div>
  )
}
