import { useState } from 'react'
import { Share2, MessageCircle, Copy, Check, X } from 'lucide-react'

interface WhatsAppShareModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  category?: string
  locality?: string
  city?: string
  messageBody: string
  url?: string
}

export function WhatsAppShareModal({
  isOpen,
  onClose,
  title,
  category,
  locality,
  city,
  messageBody,
  url,
}: WhatsAppShareModalProps) {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const shareUrl = url || window.location.href
  const locationTag = locality ? `${locality}${city ? `, ${city}` : ''}` : city || 'Pan-India'
  
  const formattedText = `*🚨 MyArea24 Local Intelligence Alert*
📌 *${title}*
📍 Location: ${locationTag}
${category ? `🏷️ Category: ${category}\n` : ''}
${messageBody}

🔗 View full details & live map:
${shareUrl}

_Powered by MyArea24 — India's Hyperlocal Intelligence & Commerce Network_`

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleWhatsApp = () => {
    const encoded = encodeURIComponent(formattedText)
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank')
  }

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({
        title,
        text: formattedText,
        url: shareUrl,
      }).catch(() => {})
    } else {
      handleWhatsApp()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 text-card-foreground">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-base">
            <MessageCircle className="w-5 h-5 text-emerald-500" />
            <span>Share via WhatsApp & Community</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close share dialog"
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Broadcast this hyperlocal intelligence card directly to your neighborhood WhatsApp group, family, or customers:
        </p>

        {/* Preformatted Preview */}
        <div className="bg-secondary/40 border border-border p-3.5 rounded-xl font-sans text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
          {formattedText}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
          <button
            onClick={handleWhatsApp}
            className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs transition-colors shadow-sm"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Send to WhatsApp</span>
          </button>

          <button
            onClick={handleCopy}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium rounded-xl text-xs transition-colors border border-border"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied!' : 'Copy Text'}</span>
          </button>

          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              onClick={handleNativeShare}
              className="w-full sm:w-auto inline-flex items-center justify-center p-2.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-xl text-xs transition-colors border border-border"
              title="Native Device Share"
              aria-label="Native device share"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
