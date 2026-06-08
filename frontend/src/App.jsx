import { useState, useEffect, useCallback } from 'react'
import HeaderBar      from './components/HeaderBar.jsx'
import VideoCanvas    from './components/VideoCanvas.jsx'
import AnalyticsPanel from './components/AnalyticsPanel.jsx'
import ChatPanel      from './components/ChatPanel.jsx'
import ReportsPanel   from './components/ReportsPanel.jsx'
import config from './config'

export default function App() {
  const [workerRunning, setWorkerRunning] = useState(false)
  const [drawMode,      setDrawMode]      = useState(false)
  const [stats,         setStats]         = useState({})

  useEffect(() => {
    fetch(`${config.backendUrl}/api/worker/status`)
      .then(r => r.json())
      .then(d => setWorkerRunning(Boolean(d.running)))
      .catch(() => {})
  }, [])

  const refreshStats = useCallback(() => {
    fetch(`${config.backendUrl}/api/events/counts?minutes=1440`)
      .then(r => r.json())
      .then(data => {
        const s = {}
        for (const type of ['car', 'bus', 'truck']) {
          s[type] = {
            in:  data[`${type}_IN`]  || 0,
            out: data[`${type}_OUT`] || 0,
          }
        }
        setStats(s)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshStats()
    const id = setInterval(refreshStats, 10_000)
    return () => clearInterval(id)
  }, [refreshStats])

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
    try {
      await fetch(`${config.backendUrl}/api/worker/stop`, { method: 'POST' })
    } catch (_) {}
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

        <div className="panel panel-video">
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

        <div className="panel panel-analytics">
          <div className="panel-header">
            <span className="panel-title-text">Analytics &amp; Intelligence</span>
          </div>
          <div className="panel-body">
            <AnalyticsPanel />
          </div>
        </div>

        <div className="panel panel-chat">
          <div className="panel-header">
            <span className="panel-title-text">AI Surveillance Assistant</span>
          </div>
          <div className="panel-body">
            <ChatPanel />
          </div>
        </div>

        <div className="panel panel-stats" style={{ gridColumn: '1 / -1' }}>
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