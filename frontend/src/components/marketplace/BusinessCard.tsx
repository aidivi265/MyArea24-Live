import { Link } from 'react-router-dom'
import { Phone, MessageCircle, MapPin, Star, Clock, BadgeCheck, Eye } from 'lucide-react'
import { cn, formatDistance } from '@/utils'
import type { Business } from '@/types'
import { useTranslation } from 'react-i18next'
import { enquiryApi } from '@/services/apiService'
import { BookmarkButton } from '@/components/shared/BookmarkButton'

interface BusinessCardProps {
  business: Business
  compact?: boolean
}

export function BusinessCard({ business, compact }: BusinessCardProps) {
  const { t } = useTranslation()

  function trackClick(event_type: string) {
    enquiryApi.trackClick({ business_id: business.id, event_type }).catch(() => {})
  }

  return (
    <div className="relative bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden group">
      <div className="absolute top-2.5 right-2.5 z-10">
        <BookmarkButton type="business" id={business.id} data={business} size="sm" />
      </div>
      {business.image_url && !compact && (
        <div className="h-40 overflow-hidden">
          <img src={business.image_url} alt={business.name} loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-gray-800 text-sm truncate">{business.name}</h3>
              {business.is_verified && <BadgeCheck className="h-4 w-4 text-brand-500 flex-shrink-0" />}
            </div>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{business.category}{business.subcategory ? ` · ${business.subcategory}` : ''}</p>
          </div>
          <span className={cn('flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full',
            business.is_open_now ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400')}>
            {business.is_open_now ? t('business.open_now') : t('business.closed')}
          </span>
        </div>

        {business.description && !compact && (
          <p className="text-xs text-gray-500 mt-2 line-clamp-2">{business.description}</p>
        )}

        <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
          {business.locality && (
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{business.locality}</span>
          )}
          {business.distance_km !== undefined && (
            <span className="text-brand-500 font-medium">{formatDistance(business.distance_km)}</span>
          )}
          {business.rating && (
            <span className="flex items-center gap-1 ml-auto">
              <Star className="h-3.5 w-3.5 text-gold-400 fill-gold-400" />
              {business.rating.toFixed(1)} <span className="text-gray-300">({business.review_count})</span>
            </span>
          )}
        </div>

        {business.opening_time && !compact && (
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />{business.opening_time} – {business.closing_time}
          </p>
        )}

        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
          {business.phone && (
            <a href={`tel:${business.phone}`} onClick={() => trackClick('call_click')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-600 text-xs font-semibold transition-colors">
              <Phone className="h-3.5 w-3.5" />{t('business.call')}
            </a>
          )}
          {business.whatsapp && (
            <a href={`https://wa.me/${business.whatsapp}`} target="_blank" rel="noopener noreferrer" onClick={() => trackClick('whatsapp_click')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 text-xs font-semibold transition-colors">
              <MessageCircle className="h-3.5 w-3.5" />{t('business.whatsapp')}
            </a>
          )}
          <Link to={`/businesses/${business.slug ?? business.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-semibold transition-colors">
            <Eye className="h-3.5 w-3.5" />{t('business.view')}
          </Link>
        </div>
      </div>
    </div>
  )
}
