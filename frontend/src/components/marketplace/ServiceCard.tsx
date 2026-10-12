import { MapPin, Star, Phone, MessageCircle, Wrench, BadgeCheck } from 'lucide-react'
import { formatCurrency, formatDistance, cn } from '@/utils'
import type { ServiceListing } from '@/types'
import { BookmarkButton } from '@/components/shared/BookmarkButton'

interface ServiceCardProps { service: ServiceListing }

export function ServiceCard({ service }: ServiceCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
          <Wrench className="h-5 w-5 text-brand-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-gray-800 text-sm truncate">{service.provider_name}</h3>
            {service.is_verified && <BadgeCheck className="h-4 w-4 text-brand-500 flex-shrink-0" />}
          </div>
          <p className="text-xs text-gray-400">{service.category}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {service.experience_years && (
            <span className="text-xs bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full font-medium">
              {service.experience_years}yr exp
            </span>
          )}
          <BookmarkButton type="service" id={service.id} data={service} size="sm" />
        </div>
      </div>

      {service.description && <p className="text-xs text-gray-500 mt-2.5 line-clamp-2">{service.description}</p>}

      <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
        {service.locality && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{service.locality}</span>}
        {service.distance_km !== undefined && <span className="text-brand-500 font-medium">{formatDistance(service.distance_km)}</span>}
        {service.rating && (
          <span className="flex items-center gap-1 ml-auto">
            <Star className="h-3.5 w-3.5 text-gold-400 fill-gold-400" />{service.rating.toFixed(1)}
          </span>
        )}
      </div>

      {service.price_starting_at && (
        <p className="text-sm font-semibold text-brand-600 mt-2">
          From {formatCurrency(service.price_starting_at)}
          {service.price_unit && <span className="text-xs font-normal text-gray-400"> /{service.price_unit}</span>}
        </p>
      )}

      <div className={cn('flex gap-2 mt-3 pt-3 border-t border-gray-50')}>
        {service.phone && (
          <a href={`tel:${service.phone}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-600 text-xs font-semibold transition-colors">
            <Phone className="h-3.5 w-3.5" />Call
          </a>
        )}
        {service.whatsapp && (
          <a href={`https://wa.me/${service.whatsapp}`} target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 text-xs font-semibold transition-colors">
            <MessageCircle className="h-3.5 w-3.5" />WhatsApp
          </a>
        )}
      </div>
    </div>
  )
}
