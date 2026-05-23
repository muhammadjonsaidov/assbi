import { useState } from 'react'

const SOURCE_DEFAULTS = {
  webcam:  '0',
  file:    '',
  rtsp:    'rtsp://192.168.1.10:554/stream',
  youtube: 'https://www.youtube.com/watch?v=...',
}

const SOURCE_LABELS = {
  webcam:  'Device index',
  file:    'File path',
  rtsp:    'RTSP URL',
  youtube: 'YouTube URL',
}

export default function LeftPanel({ workerRunning, drawMode, stats, onStart, onStop, onToggleDrawMode }) {
  const [sourceType, setSourceType] = useState('webcam')
  const [sourceValue, setSourceValue] = useState('0')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState(null)

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

  return (
    <aside className="left-panel">

      <div className="panel-section">
        <div className="panel-title">Video Source</div>

        <label>Source type</label>
        <select value={sourceType} onChange={e => handleTypeChange(e.target.value)} disabled={workerRunning}>
          <option value="webcam">Webcam</option>
          <option value="file">File</option>
          <option value="rtsp">RTSP</option>
          <option value="youtube">YouTube</option>
        </select>

        <label>{SOURCE_LABELS[sourceType]}</label>
        <input
          type="text"
          value={sourceValue}
          onChange={e => setSourceValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !workerRunning && handleStart()}
          placeholder={SOURCE_DEFAULTS[sourceType] || ''}
          disabled={workerRunning}
        />

        {error && <div className="error-text">{error}</div>}

        <div className="btn-row">
          <button className="btn btn-start" onClick={handleStart} disabled={workerRunning || starting}>
            {starting ? '…' : '▶ Start'}
          </button>
          <button className="btn btn-stop" onClick={onStop} disabled={!workerRunning}>
            ■ Stop
          </button>
        </div>
      </div>

      <hr className="divider" />

      <div className="panel-section">
        <div className="panel-title">Crossing Line</div>
        <button
          className={`btn btn-line${drawMode ? ' active' : ''}`}
          onClick={onToggleDrawMode}
          disabled={!workerRunning}
        >
          {drawMode ? '✏ Drawing… (drag)' : '✏ Draw Line'}
        </button>
        <div className="hint-text">
          {workerRunning ? 'Click to reposition crossing line' : 'Start worker first'}
        </div>
      </div>

      <hr className="divider" />

      <div className="panel-section">
        <div className="panel-title">Last {60} min</div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Person IN</div>
            <div className="stat-value stat-in">{stats.personIn}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Person OUT</div>
            <div className="stat-value stat-out">{stats.personOut}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Vehicle IN</div>
            <div className="stat-value stat-in">{stats.vehicleIn}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Vehicle OUT</div>
            <div className="stat-value stat-out">{stats.vehicleOut}</div>
          </div>
        </div>
      </div>

    </aside>
  )
}
