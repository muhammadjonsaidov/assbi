import { useState, useEffect } from 'react'
import HeaderBar      from './components/HeaderBar.jsx'
import VideoCanvas    from './components/VideoCanvas.jsx'
import AnalyticsPanel from './components/AnalyticsPanel.jsx'
import ChatPanel      from './components/ChatPanel.jsx'
import config from './config'

export default function App() {
  const [workerRunning, setWorkerRunning] = useState(false)
  const [drawMode,      setDrawMode]      = useState(false)

  useEffect(() => {
    fetch(`${config.backendUrl}/api/worker/status`)
      .then(r => r.json())
      .then(d => setWorkerRunning(Boolean(d.running)))
      .catch(() => {})
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

        {/* Bottom: AI chat assistant (full width) */}
        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-header">
            <span className="panel-title-text">AI Surveillance Assistant</span>
          </div>
          <div className="panel-body">
            <ChatPanel />
          </div>
        </div>

      </div>
    </div>
  )
}
