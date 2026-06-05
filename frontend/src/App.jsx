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
  const TYPES = ['car', 'motorcycle', 'bus', 'truck']
  const [stats, setStats] = useState(() =>
    Object.fromEntries(TYPES.map(t => [t, { in: 0, out: 0 }]))
  )

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
          const TYPES = ['car', 'motorcycle', 'bus', 'truck']
          setStats(Object.fromEntries(
            TYPES.map(t => [t, {
              in:  Number(data[`${t}_IN`])  || 0,
              out: Number(data[`${t}_OUT`]) || 0,
            }])
          ))
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
