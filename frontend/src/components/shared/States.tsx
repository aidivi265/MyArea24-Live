import { AlertCircle, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ErrorStateProps { message?: string; onRetry?: () => void }
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      <AlertCircle className="h-12 w-12 text-red-400" />
      <div>
        <p className="font-semibold text-gray-700">{t('common.error')}</p>
        {message && <p className="text-sm text-gray-500 mt-1">{message}</p>}
      </div>
      {onRetry && (
        <button onClick={onRetry} className="flex items-center gap-2 text-sm text-brand-500 hover:text-brand-700 font-medium">
          <RefreshCw className="h-4 w-4" /> {t('common.try_again')}
        </button>
      )}
    </div>
  )
}

interface EmptyStateProps {
  title?: string
  description?: string
  icon?: React.ReactNode
  action?: { label: string; onClick: () => void }
}
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      {icon ?? <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">📭</div>}
      <p className="font-semibold text-gray-600">{title ?? t('common.empty')}</p>
      {description && <p className="text-sm text-gray-400 max-w-sm">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-95 text-white text-xs font-bold transition-all shadow-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

interface UnavailableStateProps { message?: string }
export function UnavailableState({ message }: UnavailableStateProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-400 py-3 px-4 rounded-lg bg-gray-50 border border-gray-100">
      <span className="h-2 w-2 rounded-full bg-gray-300 flex-shrink-0" />
      {message ?? 'Data unavailable — sensor offline or no recent telemetry.'}
    </div>
  )
}
