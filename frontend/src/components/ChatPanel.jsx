import { useState, useRef, useEffect } from 'react'
import config from '../config'

export default function ChatPanel() {
  const [messages, setMessages] = useState([
    { id: 0, who: 'info', text: 'Ask anything — "How many people entered last hour?", "Show vehicle trends this week", "Any anomalies today?"' },
  ])
  const [input,  setInput]  = useState('')
  const [busy,   setBusy]   = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const msg = input.trim()
    if (!msg || busy) return
    setInput('')
    setBusy(true)

    const thinkingId = Date.now() + 1
    setMessages(m => [
      ...m,
      { id: Date.now(), who: 'user', text: msg },
      { id: thinkingId, who: 'thinking', text: '⋯ Analysing surveillance data…' },
    ])

    try {
      const res  = await fetch(`${config.backendUrl}/api/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: msg }),
      })
      const data = await res.json()
      setMessages(m =>
        m.filter(x => x.id !== thinkingId).concat({
          id: Date.now(), who: 'bot',
          text: data.response ?? JSON.stringify(data),
        })
      )
    } catch (e) {
      setMessages(m =>
        m.filter(x => x.id !== thinkingId).concat({
          id: Date.now(), who: 'error',
          text: 'Connection error: ' + e.message,
        })
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="chat-body">
      <div className="chat-messages">
        {messages.map(m => (
          <div key={m.id} className={`msg msg-${m.who}`}>{m.text}</div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="chat-input-row">
        <input
          type="text"
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask about crossings, anomalies, trends…"
          disabled={busy}
        />
        <button className="btn-send" onClick={send} disabled={busy}>
          {busy ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
