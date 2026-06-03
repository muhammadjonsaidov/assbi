import { useState, useRef, useEffect } from 'react'
import config from '../config'
import AnalyticsPanel from './AnalyticsPanel.jsx'

export default function RightPanel() {
  const [activeTab, setActiveTab] = useState('chat')

  // ── Chat state ──────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([
    { id: 0, who: 'info', text: 'Ask about your crossings — e.g. "How many vehicles last week?"' },
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy]   = useState(false)
  const msgEndRef = useRef(null)

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendChat = async () => {
    const msg = chatInput.trim()
    if (!msg || chatBusy) return
    setChatInput('')
    setChatBusy(true)

    const thinkingId = Date.now() + 1
    setMessages(m => [
      ...m,
      { id: Date.now(), who: 'user', text: msg },
      { id: thinkingId, who: 'thinking', text: 'Thinking…' },
    ])

    try {
      const res  = await fetch(`${config.backendUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
      const data = await res.json()
      setMessages(m =>
        m.filter(x => x.id !== thinkingId).concat({
          id: Date.now(),
          who: 'bot',
          text: data.response ?? JSON.stringify(data),
        })
      )
    } catch (e) {
      setMessages(m =>
        m.filter(x => x.id !== thinkingId).concat({
          id: Date.now(),
          who: 'error',
          text: 'Error: ' + e.message,
        })
      )
    } finally {
      setChatBusy(false)
    }
  }

  // ── Reports state ───────────────────────────────────────────────────────────
  const [reportOutput,  setReportOutput]  = useState('Select a report above.')
  const [reportLoading, setReportLoading] = useState(false)

  const fetchReport = async (type) => {
    setReportLoading(true)
    setReportOutput('Loading…')
    try {
      const res  = await fetch(`${config.backendUrl}/api/reports/${type}`)
      const data = await res.json()
      setReportOutput(JSON.stringify(data, null, 2))
    } catch (e) {
      setReportOutput('Error: ' + e.message)
    } finally {
      setReportLoading(false)
    }
  }

  return (
    <aside className="right-panel">
      <div className="tab-bar">
        <button className={`tab${activeTab === 'chat'      ? ' active' : ''}`} onClick={() => setActiveTab('chat')}>
          💬 Chat
        </button>
        <button className={`tab${activeTab === 'analytics' ? ' active' : ''}`} onClick={() => setActiveTab('analytics')}>
          📈 Analytics
        </button>
        <button className={`tab${activeTab === 'reports'   ? ' active' : ''}`} onClick={() => setActiveTab('reports')}>
          📊 Reports
        </button>
      </div>

      {activeTab === 'analytics' && <AnalyticsPanel />}

      {activeTab === 'chat' && (
        <div className="tab-content">
          <div className="chat-messages">
            {messages.map(m => (
              <div key={m.id} className={`msg msg-${m.who}`}>{m.text}</div>
            ))}
            <div ref={msgEndRef} />
          </div>
          <div className="chat-input-row">
            <input
              type="text"
              className="chat-input"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Ask about crossings, trends…"
              disabled={chatBusy}
            />
            <button className="btn-send" onClick={sendChat} disabled={chatBusy}>
              Send
            </button>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="tab-content">
          <button className="btn btn-report" onClick={() => fetchReport('weekly')}  disabled={reportLoading}>
            Weekly Report
          </button>
          <button className="btn btn-report" onClick={() => fetchReport('monthly')} disabled={reportLoading}>
            Monthly Report
          </button>
          <pre className="report-output">{reportOutput}</pre>
        </div>
      )}
    </aside>
  )
}