import { useState } from 'react'

const SOURCE_DEFAULTS = {
  webcam:  '0',
  file:    '',
  rtsp:    'rtsp://192.168.1.10:554/stream',
  youtube: 'https://www.youtube.com/watch?v=...',
}

const SOURCE_PLACEHOLDERS = {
  webcam:  'Device index  (0, 1 …)',
  file:    '/path/to/video.mp4',
  rtsp:    'rtsp://host:554/stream',
  youtube: 'https://youtube.com/watch?v=…',
}

export default function HeaderBar({ workerRunning, drawMode, onStart, onStop, onToggleDrawMode }) {
  const [sourceType,  setSourceType]  = useState('webcam')
  const [sourceValue, setSourceValue] = useState('0')
  const [starting,    setStarting]    = useState(false)
  const [error,       setError]       = useState(null)

  const handleTypeChange = (type) => {
    setSourceType(type)
    setSourceValue(SOURCE_DEFAULTS[type])
    setError(null)
  }

  const handleStart = async () => {
    setStarting(true)
    setError(null)
    try {
      await onStart(sourceValue.trim() || '0')
    } catch (e) {
      setError(e.message)
    } finally {
      setStarting(false)
    }
  }

  const busy = workerRunning || starting

  return (
    <header className="app-header">

      <div className="brand">
        <span className="brand-name">ASSBI</span>
        <span className="brand-badge">Smart Surveillance BI</span>
      </div>

      <div className="header-divider" />

      <select
        className="source-select"
        value={sourceType}
        onChange={e => handleTypeChange(e.target.value)}
        disabled={workerRunning}
      >
        <option value="webcam">Webcam</option>
        <option value="file">File</option>
        <option value="rtsp">RTSP</option>
        <option value="youtube">YouTube</option>
      </select>

      <input
        type="text"
        className="source-input"
        value={sourceValue}
        onChange={e => setSourceValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && !busy && handleStart()}
        placeholder={SOURCE_PLACEHOLDERS[sourceType]}
        disabled={workerRunning}
      />

      <button
        className="btn-hdr btn-start"
        onClick={handleStart}
        disabled={busy}
      >
        {starting ? '…' : '▶ Start'}
      </button>

      <button
        className="btn-hdr btn-stop"
        onClick={onStop}
        disabled={!workerRunning}
      >
        ■ Stop
      </button>

      <div className="header-divider" />

      <button
        className={`btn-hdr btn-draw${drawMode ? ' active' : ''}`}
        onClick={onToggleDrawMode}
        disabled={!workerRunning}
        title="Click and drag on the video to reposition the crossing line"
      >
        {drawMode ? '✏ Drawing…' : '✏ Draw Line'}
      </button>

      {error && <span className="header-error">⚠ {error}</span>}

      <div className="header-nav">
        <span className="nav-tab">Live Feed</span>
        <span className="nav-tab active">Analytics &amp; Intelligence</span>
        <span className="nav-tab">AI Surveillance Assistant</span>
        <span className="nav-tab">Reports &amp; Live Stats</span>
      </div>

      <div className="worker-status">
        <span className={`status-dot${workerRunning ? ' running' : ''}`} />
        <span className="status-text">
          {workerRunning ? 'Worker running' : 'Worker stopped'}
        </span>
      </div>

    </header>
  )
}
