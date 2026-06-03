import { useState, useRef } from 'react'
import config from '../config'

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

const VIDEO_ACCEPT = '.mp4,.mkv,.avi,.mov,.webm,.flv,.ts,.m4v,.wmv,video/*'

export default function HeaderBar({ workerRunning, drawMode, onStart, onStop, onToggleDrawMode }) {
  const [sourceType,  setSourceType]  = useState('webcam')
  const [sourceValue, setSourceValue] = useState('0')
  const [starting,    setStarting]    = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [error,       setError]       = useState(null)
  const fileInputRef = useRef(null)

  const handleTypeChange = (type) => {
    setSourceType(type)
    setSourceValue(SOURCE_DEFAULTS[type])
    setError(null)
  }

  const handleBrowse = () => fileInputRef.current?.click()

  const handleFileChosen = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''           // reset so same file can be re-picked
    setUploading(true)
    setError(null)
    setSourceValue(`Uploading ${file.name}…`)
    try {
      const form = new FormData()
      form.append('file', file)
      const res  = await fetch(`${config.backendUrl}/api/worker/upload`, { method: 'POST', body: form })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSourceValue(data.path)
    } catch (e) {
      setError(e.message)
      setSourceValue('')
    } finally {
      setUploading(false)
    }
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

  const busy = workerRunning || starting || uploading

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

      {/* hidden native file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept={VIDEO_ACCEPT}
        style={{ display: 'none' }}
        onChange={handleFileChosen}
        disabled={workerRunning}
      />

      {sourceType === 'file' && (
        <button
          className="btn-hdr btn-browse"
          onClick={handleBrowse}
          disabled={workerRunning || uploading}
          title="Pick a video file"
        >
          {uploading ? '⏳' : '📂 Browse'}
        </button>
      )}

      <input
        type="text"
        className="source-input"
        value={sourceValue}
        onChange={e => setSourceValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && !busy && handleStart()}
        placeholder={SOURCE_PLACEHOLDERS[sourceType]}
        disabled={workerRunning || uploading}
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

      <div className="worker-status">
        <span className={`status-dot${workerRunning ? ' running' : ''}`} />
        <span className="status-text">
          {workerRunning ? 'Worker running' : 'Worker stopped'}
        </span>
      </div>

    </header>
  )
}