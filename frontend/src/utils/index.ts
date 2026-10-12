import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

export function formatDistance(km?: number): string {
  if (km === undefined || km === null) return ''
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

export function safeParseDate(dateStr?: string): Date | null {
  if (!dateStr) return null
  let s = dateStr.trim()
  if (s.endsWith(' IST')) {
    s = s.slice(0, -4).replace(/,\s*/, ' ') + ' +05:30'
  }
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d
  const fallback = new Date(dateStr)
  return isNaN(fallback.getTime()) ? null : fallback
}

export function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return ''
  const d = safeParseDate(dateStr)
  if (!d) return dateStr
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  const d = safeParseDate(dateStr)
  if (!d) return dateStr
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
}

export function formatTime(dateStr?: string): string {
  if (!dateStr) return ''
  const d = safeParseDate(dateStr)
  if (!d) return dateStr
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(d)
}

export const AQI_CATEGORIES = [
  { max: 50, label: 'Good', color: '#22c55e', bg: '#dcfce7' },
  { max: 100, label: 'Satisfactory', color: '#84cc16', bg: '#f7fee7' },
  { max: 200, label: 'Moderate', color: '#eab308', bg: '#fefce8' },
  { max: 300, label: 'Poor', color: '#f97316', bg: '#fff7ed' },
  { max: 400, label: 'Very Poor', color: '#ef4444', bg: '#fef2f2' },
  { max: Infinity, label: 'Severe', color: '#7f1d1d', bg: '#fef2f2' },
]

export function getAQIInfo(aqi?: number) {
  if (!aqi) return AQI_CATEGORIES[0]
  return AQI_CATEGORIES.find(c => aqi <= c.max) ?? AQI_CATEGORIES[AQI_CATEGORIES.length - 1]
}

export const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  minor:    { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  moderate: { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  high:     { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  severe:   { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
}

export const CRITICALITY_STYLES: Record<string, { dot: string; text: string }> = {
  critical: { dot: 'bg-red-500',    text: 'text-red-700' },
  major:    { dot: 'bg-orange-500', text: 'text-orange-700' },
  moderate: { dot: 'bg-amber-500',  text: 'text-amber-700' },
  minor:    { dot: 'bg-yellow-500', text: 'text-yellow-700' },
  low:      { dot: 'bg-green-500',  text: 'text-green-700' },
  unknown:  { dot: 'bg-gray-400',   text: 'text-gray-600' },
}

export function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max) + '…'
}
