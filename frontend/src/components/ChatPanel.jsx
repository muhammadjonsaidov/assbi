import { useState, useRef, useEffect } from 'react'
import config from '../config'

const SUGGESTIONS = [
  'How many vehicles in last hour?',
  'Any anomalies today?',
  'Show people count trend this week',
  'What is peak traffic time today?',
]

export default function ChatPanel() {
  const [messages, setMessages] = useState([
    { id: 0, who: 'info', text: 'Ask anything about crossing events, anomalies, and traffic trends.' },
  ])
  const [input,  setInput]  = useState('')
  const [busy,   setBusy]   = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (msg = input.trim()) => {
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
      if (!res.ok) throw new Error(res.statusText)
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

  const showSuggestions = messages.length <= 1

  return (
    <div className="chat-body">
      <div className="chat-messages">
        {messages.map(m => (
          <div key={m.id} className={`msg msg-${m.who}`}>{m.text}</div>
        ))}

        {showSuggestions && (
          <div className="chat-chips">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                className="chat-chip"
                onClick={() => send(s)}
                disabled={busy}
              >
                {s}
              </button>
            ))}
          </div>
        )}

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
        <button className="btn-send" onClick={() => send()} disabled={busy}>
          {busy ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}