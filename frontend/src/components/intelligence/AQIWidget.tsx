import { getAQIInfo } from '@/utils'
import type { AirQualityStatus } from '@/types'
import { UnavailableState } from '@/components/shared/States'
import { useTranslation } from 'react-i18next'

export function AQIBadge({ data }: { data?: AirQualityStatus }) {
  const { t } = useTranslation()
  if (!data || (!data.is_available && data.aqi_value == null)) return <UnavailableState message={t('aqi.unavailable')} />
  const info = getAQIInfo(data.aqi_value)
  return (
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-sm"
        style={{ backgroundColor: info.color }}>
        {data.aqi_value}
      </div>
      <div>
        <p className="font-semibold text-sm" style={{ color: info.color }}>{info.label}</p>
        <p className="text-xs text-gray-400">{data.aqi_category ?? info.label}</p>
        {data.prominent_pollutant && (
          <p className="text-xs text-gray-400">↑ {data.prominent_pollutant}</p>
        )}
      </div>
    </div>
  )
}

export function AQIGauge({ aqi }: { aqi?: number }) {
  const info = getAQIInfo(aqi)
  const pct = Math.min((aqi ?? 0) / 500, 1)
  const r = 40, cx = 50, cy = 50
  const circ = 2 * Math.PI * r
  const arc = circ * 0.75
  const dash = arc * pct

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 100" className="w-32 h-32">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="8"
          strokeDasharray={`${arc} ${circ}`} strokeDashoffset={-circ * 0.125}
          strokeLinecap="round" transform="rotate(-90 50 50)" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={info.color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={-circ * 0.125}
          strokeLinecap="round" transform="rotate(-90 50 50)" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#1f2328">{aqi ?? '—'}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="7" fill="#6b7280">AQI</text>
      </svg>
      <p className="text-sm font-semibold mt-1" style={{ color: info.color }}>{info.label}</p>
    </div>
  )
}
