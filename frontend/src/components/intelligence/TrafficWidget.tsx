import { Car, AlertTriangle, Clock } from 'lucide-react'
import { CRITICALITY_STYLES, cn } from '@/utils'
import type { TrafficStatus } from '@/types'
import { UnavailableState } from '@/components/shared/States'
import { useTranslation } from 'react-i18next'

export function TrafficWidget({ data }: { data?: TrafficStatus }) {
  const { t } = useTranslation()
  if (!data?.is_available) return <UnavailableState message={t('traffic.unavailable')} />
  const top = data.incidents?.slice(0, 2) ?? []

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Car className="h-5 w-5 text-orange-500" />
          <span className="font-semibold text-sm text-gray-700">
            {data.total_incidents} {t('traffic.incidents')}
          </span>
        </div>
        {data.cumulative_delay_minutes ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
            <Clock className="h-3 w-3" />
            ~{data.cumulative_delay_minutes}m delay
          </span>
        ) : null}
      </div>

      {top.map((inc, i) => {
        const style = CRITICALITY_STYLES[inc.criticality] ?? CRITICALITY_STYLES.low
        return (
          <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
            <span className={cn('mt-1 h-2 w-2 rounded-full flex-shrink-0', style.dot)} />
            <div className="flex-1 min-w-0">
              <span className="line-clamp-1 font-medium">{inc.road_name ?? inc.description ?? inc.incident_type}</span>
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                {inc.distance_km !== undefined && (
                  <span>{inc.distance_km < 1 ? '<1 km away' : `${inc.distance_km.toFixed(1)} km away`}</span>
                )}
                {inc.delay_seconds ? (
                  <span>· {Math.round(inc.delay_seconds / 60)}m delay</span>
                ) : null}
              </div>
            </div>
          </div>
        )
      })}

      {data.total_incidents === 0 && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50/60 p-2 rounded-lg">
          <AlertTriangle className="h-4 w-4" />
          <span>Roads are clear in this vicinity</span>
        </div>
      )}
    </div>
  )
}
