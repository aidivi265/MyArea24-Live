import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Send, User, RefreshCw, Lightbulb, AlertCircle,
  Volume2, VolumeX, Mic, MicOff, Globe, Sparkles
} from 'lucide-react'
import { intelligenceApi } from '@/services/apiService'
import { useLocationStore } from '@/store'
import { SEOMeta } from '@/components/shared/SEOMeta'
import type { AssistantResponse } from '@/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
  data?: AssistantResponse
}

const SUGGESTIONS = [
  '🚗 Bhai, office jane ka kya scene hai? Traffic batao',
  '🌧️ Chhaata leke niklu kya? Mausam kaisa hai?',
  '🚨 Koi emergency alert ya waterlogging hai aas-paas?',
  '🥬 Mandi me taaza sabziyon ke bhav kya chal rahe hain?',
  '🏥 Aas-paas emergency hospital ya 24/7 trauma center?',
  '💨 Subah walk ke liye hawa (AQI) kaisa hai?',
]

export default function AssistantPage() {
  const { selectedArea, selectedLat, selectedLon } = useLocationStore()
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Namaste dost! Main hoon aapka **MyArea24 Saathi (साथी)** — aapke ilaqe (**${selectedArea}**) ka sachha dost, local guide aur guardian. 🤝\n\nMausam, traffic jams, raste ki halat, sabzi mandi bhav ya emergency madad — jo bhi baat ho, bejhijhak poochiye. You can also click the mic to speak or the audio icon to listen aloud!`,
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null)
  const [speechLang, setSpeechLang] = useState<'en-IN' | 'hi-IN'>('en-IN')
  const [searchParams, setSearchParams] = useSearchParams()
  const initialSent = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 1 && prev[0].role === 'assistant' && !prev[0].data) {
        return [{
          role: 'assistant',
          content: `Namaste dost! Main hoon aapka **MyArea24 Saathi (साथी)** — aapke ilaqe (**${selectedArea}**) ka sachha dost, local guide aur guardian. 🤝\n\nMausam, traffic jams, raste ki halat, sabzi mandi bhav ya emergency madad — jo bhi baat ho, bejhijhak poochiye. You can also click the mic to speak or the audio icon to listen aloud!`,
        }]
      }
      return prev
    })
  }, [selectedArea])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q && !initialSent.current) {
      initialSent.current = true
      send(q)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  async function send(q?: string) {
    const query = q ?? input.trim()
    if (!query) return
    setInput('')
    setMessages(m => [...m, { role: 'user', content: query }])
    setLoading(true)
    try {
      const res = await intelligenceApi.assistant(query, selectedArea, selectedLat, selectedLon)
      setMessages(m => [...m, {
        role: 'assistant',
        content: res.response_text ?? 'I could not find specific information for your query.',
        data: res,
      }])
    } catch {
      setMessages(m => [...m, {
        role: 'assistant',
        content: 'Dost, abhi thoda network issue lagta hai ya server busy hai. Ek baar dobara pooch kar dekho, main yahin hoon!'
      }])
    } finally {
      setLoading(false)
    }
  }

  function toggleListen() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const windowAny = window as any
    const SpeechRecognition = windowAny.SpeechRecognition || windowAny.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Voice recognition is not supported in this browser. Please use Chrome or Edge.')
      return
    }
    if (isListening) {
      setIsListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = speechLang
    recognition.interimResults = false
    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript
      if (transcript) {
        setInput(transcript)
        send(transcript)
      }
    }
    recognition.start()
  }

  function toggleSpeak(text: string, index: number) {
    if (!('speechSynthesis' in window)) return
    if (speakingIndex === index) {
      window.speechSynthesis.cancel()
      setSpeakingIndex(null)
      return
    }
    window.speechSynthesis.cancel()
    const cleanText = text.replace(/[*_#`]/g, '')
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = speechLang
    utterance.rate = 0.95
    utterance.onend = () => setSpeakingIndex(null)
    utterance.onerror = () => setSpeakingIndex(null)
    setSpeakingIndex(index)
    window.speechSynthesis.speak(utterance)
  }

  return (
    <>
      <SEOMeta title="MyArea24 Saathi (लोकल साथी) — AI Companion" description={`Voice & text local companion & intelligence guide for ${selectedArea}`} />
      <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-9rem)]">
        {/* Header with Language Switcher */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md relative flex-shrink-0">
              <Bot className="h-6 w-6" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-emerald-500 border-2 border-white rounded-full" title="Online & Ready" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-bold text-gray-900 text-base md:text-lg">MyArea24 Saathi (साथी)</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                  Dost, Guide & Guardian
                </span>
              </div>
              <p className="text-xs text-gray-500">Live Grounded Telemetry · Multilingual Voice · {selectedArea}</p>
            </div>
          </div>

          {/* Voice Language Selector */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl p-1 text-xs font-medium">
            <Globe className="h-3.5 w-3.5 text-gray-400 ml-1" />
            <button
              onClick={() => setSpeechLang('en-IN')}
              className={`px-2.5 py-1 rounded-lg transition-all ${speechLang === 'en-IN' ? 'bg-purple-600 text-white font-bold' : 'text-gray-600 hover:text-gray-900'}`}
            >
              English
            </button>
            <button
              onClick={() => setSpeechLang('hi-IN')}
              className={`px-2.5 py-1 rounded-lg transition-all ${speechLang === 'hi-IN' ? 'bg-purple-600 text-white font-bold' : 'text-gray-600 hover:text-gray-900'}`}
            >
              हिंदी
            </button>
          </div>
        </div>

        {/* Suggestions */}
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-xs px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-100 transition-colors flex items-center gap-1"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-white ${
                    msg.role === 'user' ? 'bg-brand-500' : 'bg-purple-600'
                  }`}
                >
                  {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === 'user'
                      ? 'bg-brand-500 text-white rounded-tr-sm'
                      : 'bg-white border border-gray-100 shadow-sm text-gray-700 rounded-tl-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="leading-relaxed whitespace-pre-wrap flex-1">{msg.content}</p>
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => toggleSpeak(msg.content, i)}
                        title={speakingIndex === i ? 'Stop Speaking' : 'Listen Aloud'}
                        className={`p-1.5 rounded-lg border transition-all flex-shrink-0 ${
                          speakingIndex === i
                            ? 'bg-purple-100 border-purple-300 text-purple-700 animate-pulse'
                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:text-purple-600 hover:bg-purple-50'
                        }`}
                      >
                        {speakingIndex === i ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>

                  {msg.data && (
                    <div className="mt-3 space-y-2">
                      {msg.data.key_findings && msg.data.key_findings.length > 0 && (
                        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                          <p className="text-xs font-semibold text-blue-700 mb-1">Key Findings</p>
                          {msg.data.key_findings.map((f, j) => (
                            <p key={j} className="text-xs text-blue-600 leading-relaxed">• {f}</p>
                          ))}
                        </div>
                      )}
                      {msg.data.recommendations && msg.data.recommendations.length > 0 && (
                        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                          <p className="text-xs font-semibold text-emerald-700 mb-1">Recommendations</p>
                          {msg.data.recommendations.map((r, j) => (
                            <p key={j} className="text-xs text-emerald-700 leading-relaxed">• {r}</p>
                          ))}
                        </div>
                      )}
                      {msg.data.grounded_sources && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {msg.data.grounded_sources.map(s => (
                            <span key={s} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                              {s}
                            </span>
                          ))}
                          {msg.data.confidence && (
                            <span className="text-[11px] text-purple-700 font-semibold px-2 py-0.5 bg-purple-50 rounded-full border border-purple-100">
                              {msg.data.confidence}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0 text-white">
                <RefreshCw className="h-4 w-4 animate-spin" />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1.5 items-center h-4">
                  <span className="h-2 w-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input & Voice Controls */}
        <form onSubmit={e => { e.preventDefault(); send() }} className="flex items-center gap-2 pt-4 border-t border-gray-100">
          <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-2xl bg-white border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-purple-300 focus-within:border-purple-300 transition-all">
            <AlertCircle className="h-4 w-4 text-gray-300 flex-shrink-0" />
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
              placeholder={speechLang === 'hi-IN' ? 'साथी से पूछें या बोलें (जैसे: भाई, आज का क्या सीन है?)...' : 'Saathi se kuch bhi poochiye ya boliye (e.g. "Bhai office jana safe hai kya?")...'}
              className="flex-1 text-sm bg-transparent outline-none text-gray-700"
            />
          </div>

          {/* Voice Input Button */}
          <button
            type="button"
            onClick={toggleListen}
            title={isListening ? 'Stop Listening' : 'Speak your query'}
            className={`p-3 rounded-2xl transition-all shadow-md ${
              isListening
                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                : 'bg-purple-100 hover:bg-purple-200 text-purple-700'
            }`}
          >
            {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white shadow-md transition-colors disabled:opacity-40"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </>
  )
}
