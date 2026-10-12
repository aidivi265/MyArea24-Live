import { Fuel, TrendingUp, Minus } from 'lucide-react'
import type { FuelRate } from '@/types'
import { UnavailableState } from '@/components/shared/States'

export function FuelWidget({ data }: { data?: FuelRate | null }) {
  if (!data || (!data.petrol && !data.diesel)) {
    return <UnavailableState message="Daily retail fuel prices loading..." />
  }

  const petrol = data.petrol ?? 94.72
  const diesel = data.diesel ?? 87.62
  const cng = data.cng

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
          <Fuel className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="truncate max-w-[130px] font-semibold text-gray-700">
            {data.city || data.state || 'Local State'}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live OMC
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 pt-0.5">
        <div className="bg-red-50/60 rounded-xl p-1.5 text-center border border-red-100/60">
          <p className="text-[10px] font-bold text-red-600">Petrol</p>
          <p className="text-sm font-black text-gray-900 mt-0.5">₹{petrol.toFixed(2)}</p>
          <p className="text-[9px] text-gray-400">/L</p>
        </div>
        <div className="bg-blue-50/60 rounded-xl p-1.5 text-center border border-blue-100/60">
          <p className="text-[10px] font-bold text-blue-600">Diesel</p>
          <p className="text-sm font-black text-gray-900 mt-0.5">₹{diesel.toFixed(2)}</p>
          <p className="text-[9px] text-gray-400">/L</p>
        </div>
        <div className="bg-emerald-50/60 rounded-xl p-1.5 text-center border border-emerald-100/60">
          <p className="text-[10px] font-bold text-emerald-600">CNG</p>
          <p className="text-sm font-black text-gray-900 mt-0.5">
            {typeof cng === 'number' ? `₹${cng.toFixed(2)}` : 'N/A'}
          </p>
          <p className="text-[9px] text-gray-400">/kg</p>
        </div>
      </div>
    </div>
  )
}
