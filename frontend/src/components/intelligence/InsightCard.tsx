import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, AlertTriangle, Info, ShieldAlert, Zap, Users, CheckCircle2 } from 'lucide-react'
import { formatRelativeTime, SEVERITY_STYLES, cn } from '@/utils'
import type { IntelligenceInsight } from '@/types'
import { useTranslation } from 'react-i18next'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  weather_traffic_correlation: <Zap className="h-4 w-4" />,
  event_weather_traffic_correlation: <Zap className="h-4 w-4 text-purple-600" />,
  severe_public_alert: <ShieldAlert className="h-4 w-4" />,
  single_signal_traffic_notice: <AlertTriangle className="h-4 w-4" />,
  single_signal_weather_notice: <AlertTriangle className="h-4 w-4 text-blue-500" />,
  air_quality_alert: <AlertTriangle className="h-4 w-4 text-emerald-600" />,
  community_ground_truth_correlation: <Users className="h-4 w-4 text-amber-600" />,
}

interface SignalBadgeItem {
  key: string
  emoji: string
  label: string
  color: string
}

function buildSignalChain(insight: IntelligenceInsight, t: (key: string) => string): SignalBadgeItem[] {
  const badges: SignalBadgeItem[] = []
  const seen = new Set<string>()
  const add = (key: string, emoji: string, label: string, color: string) => {
    if (!seen.has(key)) {
      seen.add(key)
      badges.push({ key, emoji, label, color })
    }
  }

  for (const sig of insight.signals ?? []) {
    const st = (sig.type || '').toLowerCase()
    if (st === 'weather') {
      add('weather', '🌧️', t('home.chain_rain'), 'bg-blue-50 text-blue-700 border-blue-200/80')
    } else if (st === 'traffic') {
      add('traffic', '🚗', t('home.chain_traffic'), 'bg-orange-50 text-orange-700 border-orange-200/80')
    } else if (st === 'event') {
      add('event', '🎪', t('home.chain_event'), 'bg-purple-50 text-purple-700 border-purple-200/80')
    } else if (st === 'community') {
      add('community', '👥', t('home.chain_citizen'), 'bg-amber-50 text-amber-800 border-amber-200/80')
    } else if (st === 'air_quality' || st === 'aqi') {
      add('aqi', '💨', t('home.chain_aqi'), 'bg-emerald-50 text-emerald-700 border-emerald-200/80')
    } else if (st === 'alert') {
      add('alert', '🚨', t('home.chain_alert'), 'bg-rose-50 text-rose-700 border-rose-200/80')
    }
  }

  // Ensure canonical multi-signal chains per scenario (Slides 02–03)
  if (insight.insight_type === 'event_weather_traffic_correlation') {
    add('weather', '🌧️', t('home.chain_rain'), 'bg-blue-50 text-blue-700 border-blue-200/80')
    add('traffic', '🚗', t('home.chain_traffic'), 'bg-orange-50 text-orange-700 border-orange-200/80')
    add('event', '🎪', t('home.chain_event'), 'bg-purple-50 text-purple-700 border-purple-200/80')
    add('parking', '🅿️', t('home.chain_parking'), 'bg-indigo-50 text-indigo-700 border-indigo-200/80')
  } else if (insight.insight_type === 'weather_traffic_correlation') {
    add('weather', '🌧️', t('home.chain_rain'), 'bg-blue-50 text-blue-700 border-blue-200/80')
    add('traffic', '🚗', t('home.chain_traffic'), 'bg-orange-50 text-orange-700 border-orange-200/80')
  } else if (insight.insight_type === 'community_ground_truth_correlation') {
    add('community', '👥', t('home.chain_citizen'), 'bg-amber-50 text-amber-800 border-amber-200/80')
    if (badges.length === 1) {
      add('traffic', '🚗', t('home.chain_traffic'), 'bg-orange-50 text-orange-700 border-orange-200/80')
    }
  } else if (badges.length === 0) {
    if (insight.insight_type === 'air_quality_alert') {
      add('aqi', '💨', t('home.chain_aqi'), 'bg-emerald-50 text-emerald-700 border-emerald-200/80')
    } else if (insight.insight_type === 'severe_public_alert') {
      add('alert', '🚨', t('home.chain_alert'), 'bg-rose-50 text-rose-700 border-rose-200/80')
    } else if (insight.insight_type === 'single_signal_weather_notice') {
      add('weather', '🌧️', t('home.chain_rain'), 'bg-blue-50 text-blue-700 border-blue-200/80')
    } else {
      add('traffic', '🚗', t('home.chain_traffic'), 'bg-orange-50 text-orange-700 border-orange-200/80')
    }
  }

  return badges
}

interface InsightCardProps {
  insight: IntelligenceInsight
  compact?: boolean
  index?: number
}

export function InsightCard({ insight, compact, index = 0 }: InsightCardProps) {
  const { t } = useTranslation()
  const style = SEVERITY_STYLES[insight.composite_severity] ?? SEVERITY_STYLES.minor
  const icon = TYPE_ICONS[insight.insight_type] ?? <Info className="h-4 w-4" />
  const signalChain = buildSignalChain(insight, t)
  const cleanRecommendation = insight.recommendation
    ? insight.recommendation.replace(/^[•\-*]\s*/gm, '').split('\n')[0]
    : undefined

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn('bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow overflow-hidden group flex flex-col justify-between', style.border)}
    >
      <div>
        <div className={cn('px-4 py-2 flex items-center gap-2 text-xs font-semibold', style.bg, style.text)}>
          {icon}
          <span className="uppercase tracking-wide">{insight.composite_severity}</span>
          <span className="ml-auto text-gray-400 font-normal">{formatRelativeTime(insight.created_at)}</span>
        </div>

        {/* Connected Signal Chain Badges (Slides 02–03: Data -> Context -> Impact Alert -> Action) */}
        <div className="px-4 pt-2.5 pb-1 flex items-center flex-wrap gap-1 text-[11px]">
          {signalChain.map((b, idx) => (
            <span key={b.key} className="inline-flex items-center gap-1">
              {idx > 0 && <span className="text-gray-400 font-bold">+</span>}
              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold border', b.color)}>
                <span>{b.emoji}</span>
                <span>{b.label}</span>
              </span>
            </span>
          ))}
          <span className="text-gray-400 font-bold mx-0.5">➔</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
            <span>⚠️</span>
            <span>{t('home.chain_impact')}</span>
          </span>
          <span className="text-gray-400 font-bold mx-0.5">➔</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <span>✅</span>
            <span>{t('home.chain_action')}</span>
          </span>
        </div>

        <div className="px-4 py-2.5">
          <p className="font-semibold text-gray-800 text-sm leading-snug line-clamp-2">{insight.headline}</p>
          {!compact && insight.summary && (
            <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{insight.summary}</p>
          )}

          {/* Impact & Action Pipeline Strip */}
          {!compact && (insight.potential_impact || cleanRecommendation) && (
            <div className="mt-2.5 space-y-1.5">
              {insight.potential_impact && (
                <div className="bg-amber-50/70 border border-amber-100 rounded-lg px-2.5 py-1.5 text-[11px] text-amber-900 flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="line-clamp-1">
                    <span className="font-bold">{t('home.chain_impact')}: </span>
                    {insight.potential_impact}
                  </p>
                </div>
              )}
              {cleanRecommendation && (
                <div className="bg-emerald-50/70 border border-emerald-100 rounded-lg px-2.5 py-1.5 text-[11px] text-emerald-900 flex items-start gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="line-clamp-1">
                    <span className="font-bold">{t('home.chain_action')}: </span>
                    {cleanRecommendation}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-3 pt-1 flex items-center justify-between border-t border-gray-50">
        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full truncate max-w-[65%]">{insight.area?.label}</span>
        <Link to={`/intelligence/${insight.id}`}
          className="flex items-center gap-1 text-xs font-medium text-brand-500 hover:text-brand-700 group-hover:gap-2 transition-all shrink-0">
          {t('insight.view_detail')} <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </motion.div>
  )
}

