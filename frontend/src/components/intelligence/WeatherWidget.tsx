import { Cloud, Droplets, Wind, Thermometer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { WeatherStatus } from '@/types'
import { UnavailableState } from '@/components/shared/States'

export function WeatherWidget({ data }: { data?: WeatherStatus }) {
  const { t } = useTranslation()
  if (!data?.is_available) return <UnavailableState message={t('weather.unavailable')} />

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <Cloud className="h-8 w-8 text-blue-400" />
        <div>
          <p className="text-2xl font-bold text-gray-800">{data.temperature_c?.toFixed(1)}°C</p>
          <p className="text-xs text-gray-500">{data.condition_text}</p>
        </div>
      </div>
      <div className="flex gap-3 text-sm text-gray-600">
        <span className="flex items-center gap-1"><Droplets className="h-4 w-4 text-blue-400" />{data.humidity}%</span>
        <span className="flex items-center gap-1"><Wind className="h-4 w-4 text-gray-400" />{data.wind_kph} km/h</span>
        {(data.precipitation_mm ?? 0) > 0 && (
          <span className="flex items-center gap-1"><Thermometer className="h-4 w-4 text-blue-400" />{data.precipitation_mm}mm</span>
        )}
      </div>
    </div>
  )
}
