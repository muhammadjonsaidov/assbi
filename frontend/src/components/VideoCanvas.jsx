import { useRef, useEffect, useCallback, useState } from 'react'
import config from '../config'

export default function VideoCanvas({ active, drawMode, onLineSent }) {
  const canvasRef   = useRef(null)
  const frameW      = useRef(1280)
  const frameH      = useRef(720)
  const fetching    = useRef(false)
  const timerRef    = useRef(null)
  const pollerRef   = useRef(null)
  const lastObjUrl  = useRef(null)
  const drawing     = useRef(false)
  const p1          = useRef(null)
  const p2          = useRef(null)
  const fpsTick     = useRef(0)
  const fpsLast     = useRef(Date.now())

  const [streamReady, setStreamReady] = useState(false)
  const [fps, setFps] = useState(0)
  const [workerError, setWorkerError] = useState(null)

  // ── Coordinate helpers ──────────────────────────────────────────────────────

  const clientToCanvas = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  // Canvas display coords → original frame pixel coords (letterbox-aware)
  const canvasToFrame = (cx, cy) => {
    const canvas = canvasRef.current
    if (!canvas) return [cx, cy]
    const cw = canvas.width, ch = canvas.height
    const fw = frameW.current, fh = frameH.current
    const scale = Math.min(cw / fw, ch / fh)
    const rw = fw * scale, rh = fh * scale
    const rx = (cw - rw) / 2, ry = (ch - rh) / 2
    return [
      Math.max(0, Math.min(fw, Math.round((cx - rx) / scale))),
      Math.max(0, Math.min(fh, Math.round((cy - ry) / scale))),
    ]
  }

  // ── Drawing helpers ─────────────────────────────────────────────────────────

  const drawLinePreview = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !p1.current || !p2.current) return
    const ctx = canvas.getContext('2d')
    ctx.save()
    ctx.setLineDash([10, 7])
    ctx.strokeStyle = 'rgba(255, 60, 60, 0.9)'
    ctx.lineWidth   = 2.5
    ctx.lineCap     = 'round'
    ctx.beginPath()
    ctx.moveTo(p1.current.x, p1.current.y)
    ctx.lineTo(p2.current.x, p2.current.y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#ff3030'
    ;[p1.current, p2.current].forEach(pt => {
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.restore()
  }, [])

  const drawFrame = useCallback((img) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const cw = canvas.width, ch = canvas.height
    const fw = img.naturalWidth, fh = img.naturalHeight
    frameW.current = fw
    frameH.current = fh
    const scale = Math.min(cw / fw, ch / fh)
    const rw = fw * scale, rh = fh * scale
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, cw, ch)
    ctx.drawImage(img, (cw - rw) / 2, (ch - rh) / 2, rw, rh)
  }, [])

  // ── Frame fetch loop ────────────────────────────────────────────────────────

  const fetchAndDraw = useCallback(() => {
    if (fetching.current) return
    fetching.current = true

    fetch(`${config.frameServerUrl}/frame?t=${Date.now()}`)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.blob() })
      .then(blob => {
        if (lastObjUrl.current) URL.revokeObjectURL(lastObjUrl.current)
        lastObjUrl.current = URL.createObjectURL(blob)
        const img = new Image()
        img.onload = () => {
          drawFrame(img)
          if (p1.current && p2.current) drawLinePreview()

          fpsTick.current++
          const now = Date.now()
          if (now - fpsLast.current >= 1000) {
            setFps(Math.round(fpsTick.current * 1000 / (now - fpsLast.current)))
            fpsTick.current = 0
            fpsLast.current = now
          }
          fetching.current = false
        }
        img.onerror = () => { fetching.current = false }
        img.src = lastObjUrl.current
      })
      .catch(() => { fetching.current = false })
  }, [drawFrame, drawLinePreview])

  // ── Start / stop on active change ───────────────────────────────────────────

  useEffect(() => {
    if (!active) {
      clearInterval(timerRef.current)
      clearInterval(pollerRef.current)
      timerRef.current = pollerRef.current = null
      fetching.current = false
      setStreamReady(false)
      setFps(0)
      setWorkerError(null)
      const canvas = canvasRef.current
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
      return
    }

    let failCount = 0
    // Poll /ready until Python has produced at least one frame
    pollerRef.current = setInterval(() => {
      fetch(`${config.frameServerUrl}/ready`)
        .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })
        .then(d => {
          failCount = 0
          setWorkerError(null)
          if (d.ready) {
            clearInterval(pollerRef.current)
            timerRef.current = setInterval(fetchAndDraw, config.framePollMs)
            setStreamReady(true)
          }
        })
        .catch(() => {
          failCount++
          if (failCount >= 45) {
            setWorkerError('Worker unreachable — check logs/worker.log')
          }
        })
    }, 1000)

    return () => {
      clearInterval(timerRef.current)
      clearInterval(pollerRef.current)
    }
  }, [active, fetchAndDraw])

  // ── Sync canvas buffer size to its CSS size ─────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const obs = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    })
    obs.observe(canvas)
    return () => obs.disconnect()
  }, [])

  // ── Mouse handlers ──────────────────────────────────────────────────────────

  const handleMouseDown = (e) => {
    if (!drawMode) return
    drawing.current = true
    p1.current = clientToCanvas(e)
    p2.current = { ...p1.current }
  }

  const handleMouseMove = (e) => {
    if (!drawMode || !drawing.current) return
    p2.current = clientToCanvas(e)
  }

  const handleMouseUp = (e) => {
    if (!drawMode || !drawing.current) return
    drawing.current = false
    p2.current = clientToCanvas(e)

    const [x1, y1] = canvasToFrame(p1.current.x, p1.current.y)
    const [x2, y2] = canvasToFrame(p2.current.x, p2.current.y)

    fetch(`${config.frameServerUrl}/line`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x1, y1, x2, y2 }),
    }).catch(console.error)

    p1.current = p2.current = null
    onLineSent()
  }

  return (
    <div className="video-wrap">
      {!streamReady && (
        <div className="stream-placeholder">
          <div className="placeholder-icon">📷</div>
          {workerError
            ? <span style={{ color: '#ff6b6b' }}>{workerError}</span>
            : active ? 'Waiting for first frame…' : 'Select a source and click Start'
          }
        </div>
      )}
      {streamReady && <div className="fps-badge">{fps} fps</div>}
      {drawMode && streamReady && (
        <div className="draw-hint">Click and drag to draw crossing line</div>
      )}
      <canvas
        ref={canvasRef}
        className={`video-canvas${drawMode ? ' draw-mode' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
    </div>
  )
}