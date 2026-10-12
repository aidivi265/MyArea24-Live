import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Zap, MapPin, Clock, ShieldAlert, AlertTriangle, Info, CheckCircle2, AlertCircle, Users } from 'lucide-react'
import { intelligenceApi } from '@/services/apiService'
import { PageSkeleton } from '@/components/shared/Skeleton'
import { ErrorState } from '@/components/shared/States'
import { SEOMeta } from '@/components/shared/SEOMeta'
import { Breadcrumbs } from '@/components/shared/Breadcrumbs'
import { formatRelativeTime, formatDate, SEVERITY_STYLES, cn } from '@/utils'
import type { InsightType } from '@/types'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  weather_traffic_correlation: <Zap className="h-5 w-5" />,
  event_weather_traffic_correlation: <Zap className="h-5 w-5 text-purple-600" />,
  severe_public_alert: <ShieldAlert className="h-5 w-5" />,
  air_quality_alert: <AlertTriangle className="h-5 w-5 text-emerald-600" />,
  single_signal_traffic_notice: <AlertTriangle className="h-5 w-5" />,
  single_signal_weather_notice: <AlertTriangle className="h-5 w-5 text-blue-500" />,
  community_ground_truth_correlation: <Users className="h-5 w-5 text-amber-600" />,
}

const TYPE_LABELS: Record<string, string> = {
  weather_traffic_correlation: 'Weather + Traffic Correlation',
  event_weather_traffic_correlation: 'Event Commute & Crowd Correlation',
  severe_public_alert: 'Severe Public Alert',
  air_quality_alert: 'Air Quality Advisory',
  single_signal_traffic_notice: 'Traffic Notice',
  single_signal_weather_notice: 'Weather Notice',
  community_ground_truth_correlation: 'Citizen Ground-Truth Signal Mesh',
}

const SIGNAL_TYPE_COLOR: Record<string, string> = {
  weather: 'bg-blue-50 text-blue-700',
  traffic: 'bg-orange-50 text-orange-700',
  alert: 'bg-red-50 text-red-600',
  aqi: 'bg-green-50 text-green-700',
  air_quality: 'bg-emerald-50 text-emerald-700',
  event: 'bg-purple-50 text-purple-700',
  community: 'bg-amber-50 text-amber-700',
}

export default function InsightDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['insight', id],
    queryFn: () => intelligenceApi.get(Number(id)),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  })

  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorState onRetry={refetch} />
  if (!data) return (
    <div className="text-center py-16">
      <Info className="h-12 w-12 text-gray-200 mx-auto mb-3" />
      <p className="font-semibold text-gray-600">Insight not found.</p>
      <Link to="/intelligence" className="text-sm text-brand-500 mt-2 inline-block">← Back to Intelligence Feed</Link>
    </div>
  )

  const style = SEVERITY_STYLES[data.composite_severity] ?? SEVERITY_STYLES.minor
  const icon = TYPE_ICONS[data.insight_type] ?? <Info className="h-5 w-5" />
  const typeLabel = TYPE_LABELS[data.insight_type] ?? data.insight_type

  return (
    <>
      <SEOMeta
        title={data.headline}
        description={data.summary ?? `Intelligence insight: ${data.headline}`}
      />

      <div className="space-y-4 max-w-3xl mx-auto">
        {/* Breadcrumbs & Smart Back */}
        <Breadcrumbs
          items={[
            { label: 'Intelligence Feed', to: '/intelligence' },
            { label: data.headline },
          ]}
          fallbackTo="/intelligence"
        />

        {/* Severity banner */}
        <div className={cn('rounded-2xl overflow-hidden border shadow-sm', style.border)}>
          <div className={cn('px-5 py-3 flex items-center gap-3', style.bg, style.text)}>
            {icon}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-widest">{data.composite_severity}</span>
                <span className="text-xs opacity-70">·</span>
                <span className="text-xs font-medium opacity-80">{typeLabel}</span>
              </div>
            </div>
            <span className="text-xs opacity-60 flex-shrink-0 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />{formatRelativeTime(data.created_at)}
            </span>
          </div>

          <div className="bg-white px-5 py-5 space-y-4">
            {/* Headline */}
            <h1 className="text-xl font-bold text-gray-800 leading-snug">{data.headline}</h1>

            {/* Visual Signal Pipeline Chain (Slide 02-03) */}
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-xs space-y-1.5">
              <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">
                Intelligence Pipeline (Data ➔ Context ➔ Intelligence ➔ Action):
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 font-semibold text-xs flex items-center gap-1">
                  📊 Raw Signals ({data.signals?.length || 1})
                </span>
                <span className="text-slate-400 font-bold">➔</span>
                <span className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-800 font-semibold text-xs flex items-center gap-1">
                  🔄 Hyperlocal Context
                </span>
                <span className="text-slate-400 font-bold">➔</span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-semibold text-xs flex items-center gap-1">
                  ⚠️ {data.composite_severity.toUpperCase()} Impact
                </span>
                <span className="text-slate-400 font-bold">➔</span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-semibold text-xs flex items-center gap-1">
                  ✅ Actionable Advice
                </span>
              </div>
            </div>

            {/* Area chip */}
            {data.area && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span>{data.area.label}</span>
                {data.area.radius_km && (
                  <span className="text-xs text-gray-400">({data.area.radius_km} km radius)</span>
                )}
              </div>
            )}

            {/* Summary */}
            {data.summary && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Summary</p>
                <p className="text-sm text-gray-700 leading-relaxed">{data.summary}</p>
              </div>
            )}

            {/* Recommendation */}
            {data.recommendation && (
              <div className="bg-brand-50 border border-brand-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />Recommendation
                </p>
                <p className="text-sm text-brand-800 leading-relaxed">{data.recommendation}</p>
              </div>
            )}
          </div>
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Evidence', value: data.evidence_quality === 'supported' ? 'Supported' : 'Insufficient', icon: <CheckCircle2 className="h-4 w-4 text-green-500" /> },
            {
              label: 'Confidence',
              value:
                data.confidence_level !== undefined
                  ? typeof data.confidence_level === 'number'
                    ? `${(data.confidence_level * 100).toFixed(0)}%`
                    : String(data.confidence_level)
                  : '—',
              icon: <AlertCircle className="h-4 w-4 text-blue-500" />,
            },
            { label: 'Observed', value: data.observed_at ? formatDate(data.observed_at) : '—', icon: <Clock className="h-4 w-4 text-gray-400" /> },
            { label: 'Expires', value: data.expires_at ? formatDate(data.expires_at) : 'No expiry', icon: <Clock className="h-4 w-4 text-amber-400" /> },
          ].map(({ label, value, icon: metaIcon }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
              <div className="flex items-center gap-1.5 mb-1">
                {metaIcon}
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
              </div>
              <p className="text-sm font-semibold text-gray-700 capitalize">{value}</p>
            </div>
          ))}
        </div>

        {/* Signals */}
        {data.signals && data.signals.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-brand-500" />Signal Provenance ({data.signals.length})
            </h2>
            <div className="space-y-2">
              {data.signals.map((signal, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-start gap-3">
                  <span className={cn(
                    'text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 capitalize',
                    SIGNAL_TYPE_COLOR[signal.type] ?? 'bg-gray-50 text-gray-600'
                  )}>
                    {signal.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-700">{signal.source}</p>
                      {signal.freshness_minutes !== undefined && (
                        <span className="text-xs text-gray-400">{signal.freshness_minutes}m ago</span>
                      )}
                    </div>
                    {signal.metric_summary && (
                      <p className="text-xs text-gray-500 mt-0.5">{signal.metric_summary}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rule identifier (debug) */}
        {data.rule_identifier && (
          <p className="text-xs text-gray-300 text-center">Rule: {data.rule_identifier}</p>
        )}
      </div>
    </>
  )
}
