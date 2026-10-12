import { Tag, Clock, Copy, Share2, Store, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDate, cn, formatDistance } from '@/utils'
import type { Offer } from '@/types'
import { useState } from 'react'
import { WhatsAppShareModal } from '@/components/shared/WhatsAppShareModal'

import { BookmarkButton } from '@/components/shared/BookmarkButton'

interface OfferCardProps { offer: Offer }

export function OfferCard({ offer }: OfferCardProps) {
  const [copied, setCopied] = useState(false)
  const [showShare, setShowShare] = useState(false)

  function copy(code: string) {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const distance = offer.business?.distance_km ?? (offer as any).distance_km

  return (
    <>
      <div className={cn('bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow', offer.days_left !== undefined && offer.days_left <= 3 ? 'border-red-200' : 'border-gray-100')}>
        {offer.banner_image_url && (
          <div className="h-32 overflow-hidden">
            <img src={offer.banner_image_url} alt={offer.title} loading="lazy" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-4 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-start gap-2 justify-between">
              <h3 className="font-semibold text-gray-800 text-sm line-clamp-2 flex-1">{offer.title}</h3>
              {offer.discount_text && (
                <span className="flex-shrink-0 text-sm font-bold text-gold-600 bg-gold-50 px-2.5 py-1 rounded-xl border border-gold-200">{offer.discount_text}</span>
              )}
            </div>
            {offer.description && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{offer.description}</p>}

            {/* Merchant info & distance */}
            {offer.business && (
              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-100 text-xs">
                <Link
                  to={`/businesses/${offer.business.slug || offer.business.id}`}
                  className="flex items-center gap-1.5 font-semibold text-gray-700 hover:text-brand-600 truncate max-w-[65%]"
                >
                  <Store className="h-3.5 w-3.5 text-brand-500 flex-shrink-0" />
                  <span className="truncate">{offer.business.name}</span>
                </Link>
                <div className="flex items-center gap-1 text-gray-400 flex-shrink-0 text-[11px]">
                  {offer.business.locality && (
                    <span className="truncate max-w-[90px]">{offer.business.locality}</span>
                  )}
                  {distance !== undefined && (
                    <span className="text-brand-500 font-medium">
                      • {formatDistance(distance)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" />{offer.category}</span>
              {offer.days_left !== undefined && (
                <span className={cn('flex items-center gap-1 font-medium', offer.days_left <= 3 ? 'text-red-500' : 'text-gray-500')}>
                  <Clock className="h-3.5 w-3.5" />
                  {offer.days_left > 0 ? `${offer.days_left}d left` : 'Ends today'}
                </span>
              )}
            </div>

            {offer.coupon_code && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <code className="flex-1 text-sm font-mono font-bold text-brand-600 tracking-widest">{offer.coupon_code}</code>
                <button onClick={() => copy(offer.coupon_code!)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-500">
                  <Copy className="h-3.5 w-3.5" />{copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}

            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <BookmarkButton type="offer" id={offer.id} data={offer} size="sm" />
              <div className="flex items-center gap-3">
                {offer.business?.phone && (
                  <a
                    href={`tel:${offer.business.phone}`}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>Call Store</span>
                  </a>
                )}
                <button
                  onClick={() => setShowShare(true)}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Share</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <WhatsAppShareModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        title={offer.title}
        category={offer.category}
        locality={offer.business?.locality}
        city={offer.business?.city}
        messageBody={`🔥 Local Deal: ${offer.discount_text || 'Special Discount'} available at ${offer.business?.name || 'Local Merchant'}! ${offer.coupon_code ? `Use Coupon Code: *${offer.coupon_code}*` : ''}`}
        url={window.location.origin + '/offers'}
      />
    </>
  )
}
