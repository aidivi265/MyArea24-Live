import { Link } from 'react-router-dom'
import { TrendingDown, Package, Store } from 'lucide-react'
import { formatCurrency, cn } from '@/utils'
import type { Product } from '@/types'
import { useTranslation } from 'react-i18next'
import { BookmarkButton } from '@/components/shared/BookmarkButton'

interface ProductCardProps { product: Product }

const STOCK_STYLES = {
  in_stock: 'text-green-600 bg-green-50',
  low_stock: 'text-amber-600 bg-amber-50',
  confirm_with_seller: 'text-blue-600 bg-blue-50',
  out_of_stock: 'text-red-500 bg-red-50',
}

export function ProductCard({ product }: ProductCardProps) {
  const { t } = useTranslation()
  const stockStyle = STOCK_STYLES[product.availability_status] ?? STOCK_STYLES.confirm_with_seller

  return (
    <Link to={`/products/${product.id}`} className="block bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden group">
      <div className="relative h-40 bg-gray-50 flex items-center justify-center overflow-hidden">
        <div className="absolute top-2 right-2 z-10">
          <BookmarkButton type="product" id={product.id} data={product} size="sm" />
        </div>
        {product.image_url
          ? <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-300" />
          : <Package className="h-10 w-10 text-gray-200" />}
      </div>
      <div className="p-3">
        <p className="font-semibold text-gray-800 text-sm line-clamp-2 leading-snug">{product.name}</p>
        {product.brand && <p className="text-xs text-gray-400 mt-0.5">{product.brand}</p>}

        <div className="flex items-end justify-between mt-2">
          <div>
            <p className="text-base font-bold text-brand-600">{formatCurrency(product.local_price)}</p>
            {product.mrp && product.mrp !== product.local_price && (
              <p className="text-xs text-gray-400 line-through">{formatCurrency(product.mrp)}</p>
            )}
          </div>
          {product.better_offline && product.savings_percent && (
            <div className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              <TrendingDown className="h-3.5 w-3.5" />Save {product.savings_percent.toFixed(0)}%
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-2">
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', stockStyle)}>
            {t(`product.${product.availability_status}`)}
          </span>
          {product.business && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Store className="h-3 w-3" />{product.business.name}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
