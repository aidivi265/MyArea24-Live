import React, { useState } from 'react';
import type { AssistantResponse } from '../../types/intelligence';
import { fetchAssistantResponse } from '../../services/api';

interface AssistantViewProps {
  selectedArea: string;
  isLiveSupported: boolean;
  onNavigateToLocation: () => void;
}

interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  response?: AssistantResponse;
}

const PRESET_QUERIES = [
  'Is it safe to drive right now?',
  'What is the traffic situation around my corridor?',
  'Are there any active government weather alerts?',
  'Current weather conditions and rain forecast',
  'Air quality status and CAAQMS station telemetry',
  'Executive multi-signal local safety briefing',
];

export const AssistantView: React.FC<AssistantViewProps> = ({
  selectedArea,
  isLiveSupported,
  onNavigateToLocation,
}) => {
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: selectedArea
        ? `Hello! I am MyArea24 Assistant for ${selectedArea}. I am grounded directly in live WeatherAPI, TomTom Traffic v5, NDMA SACHET, and CPCB database telemetry. How can I assist you with your neighborhood today?`
        : 'Welcome to Ask MyArea24! Please select a locality to get grounded, evidence-backed local intelligence with zero synthetic hallucinations.',
    },
  ]);

  const handleSend = async (queryText: string) => {
    const q = queryText.trim();
    if (!q || loading) return;

    const userMsg: MessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: q,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const resp = await fetchAssistantResponse({
        query: q,
        area: selectedArea || undefined,
      });

      const assistantMsg: MessageItem = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: resp.response_text,
        response: resp,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          text: 'Unable to connect to the intelligence assistant engine. Please verify that the backend is active.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view-container assistant-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Ask MyArea24 — Grounded AI Assistant</h1>
          <p className="view-subtitle">
            Evidence-grounded local intelligence. Citations from real WeatherAPI, TomTom v5, and NDMA SACHET observations.
          </p>
        </div>
        <div className="active-locality-pill-group">
          <span className="locality-label-text">Active Corridor:</span>
          <strong>{selectedArea || 'All Pilot Areas'}</strong>
          {!isLiveSupported && (
            <span className="badge-unsupported-sm" onClick={onNavigateToLocation} style={{ cursor: 'pointer' }}>
              Unmonitored (Switch to Pilot)
            </span>
          )}
        </div>
      </div>

      {!isLiveSupported && (
        <div className="status-banner banner-unsupported">
          <div className="status-banner-content">
            <span className="status-banner-icon">⚠️</span>
            <div>
              <strong>Unmonitored Location Notice</strong>
              <p>
                Live automated sensor telemetry is not deployed for '{selectedArea}'. The assistant enforces our strict
                zero-hallucination policy and will explain coverage status rather than generating synthetic data.
              </p>
            </div>
          </div>
          <button type="button" className="switch-pilot-btn" onClick={onNavigateToLocation}>
            Switch to Delhi Pilot
          </button>
        </div>
      )}

      {/* Preset Query Chips */}
      <div className="preset-chips-container">
        <span className="chips-title">Suggested questions:</span>
        <div className="chips-list">
          {PRESET_QUERIES.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              className="query-chip"
              disabled={loading}
              onClick={() => handleSend(preset)}
            >
              💬 {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="chat-window">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            <div className="message-avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
            <div className="message-bubble">
              <p className="message-text">{msg.text}</p>

              {msg.response && (
                <div className="grounded-metadata-box">
                  {msg.response.key_findings && msg.response.key_findings.length > 0 && (
                    <div className="meta-section">
                      <span className="meta-heading">📊 Key Grounded Findings:</span>
                      <ul className="meta-list">
                        {msg.response.key_findings.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {msg.response.recommendations && msg.response.recommendations.length > 0 && (
                    <div className="meta-section">
                      <span className="meta-heading">💡 Actionable Recommendations:</span>
                      <ul className="meta-list">
                        {msg.response.recommendations.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="meta-footer">
                    <div className="sources-pills-row">
                      <span className="source-label">Provenance Sources:</span>
                      {msg.response.grounded_sources.length > 0 ? (
                        msg.response.grounded_sources.map((src, i) => (
                          <span key={i} className="source-tag">
                            {src}
                          </span>
                        ))
                      ) : (
                        <span className="source-tag-none">None (Zero Hallucination Guaranteed)</span>
                      )}
                    </div>
                    <span className="confidence-pill">
                      Confidence: <strong>{msg.response.confidence}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="chat-message assistant">
            <div className="message-avatar">🤖</div>
            <div className="message-bubble loading-bubble">
              <span className="spinner-sm" /> Querying local sensor database and correlating signals…
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        className="chat-input-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(inputQuery);
        }}
      >
        <input
          type="text"
          className="chat-input"
          placeholder={
            isLiveSupported
              ? `Ask anything about ${selectedArea || 'your corridor'} (traffic, weather, alerts, routes)...`
              : 'Ask a question (responses will reflect verified coverage status)...'
          }
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="action-btn-primary chat-send-btn" disabled={loading || !inputQuery.trim()}>
          Send Query ↵
        </button>
      </form>
    </div>
  );
};
