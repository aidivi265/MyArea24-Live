import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Home } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  to?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  fallbackTo?: string
  showBackButton?: boolean
}

export function Breadcrumbs({ items, fallbackTo, showBackButton = true }: BreadcrumbsProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1)
    } else if (fallbackTo) {
      navigate(fallbackTo)
    } else if (items.length >= 2 && items[items.length - 2].to) {
      navigate(items[items.length - 2].to!)
    } else {
      navigate('/')
    }
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center justify-between gap-2 py-1 text-xs text-gray-500">
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {showBackButton && (
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 active:scale-95 transition-all font-semibold shadow-2xs mr-1 shrink-0"
            title="Go back to previous page"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Back</span>
          </button>
        )}

        <Link
          to="/"
          className="inline-flex items-center text-gray-400 hover:text-brand-600 transition-colors shrink-0"
          title="Home"
        >
          <Home className="h-3.5 w-3.5" />
        </Link>

        {items.map((item, idx) => {
          const isLast = idx === items.length - 1
          return (
            <div key={idx} className="flex items-center gap-1.5 shrink-0">
              <ChevronRight className="h-3 w-3 text-gray-300" />
              {isLast || !item.to ? (
                <span className="font-semibold text-gray-800 max-w-[180px] sm:max-w-[280px] truncate" title={item.label}>
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.to}
                  className="hover:text-brand-600 transition-colors max-w-[140px] truncate"
                  title={item.label}
                >
                  {item.label}
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
