import React, { useState } from 'react'
import { Heart } from 'lucide-react'
import { useSavedStore } from '@/store/savedStore'
import type { SaveItemType } from '@/types'
import { cn } from '@/utils'

interface BookmarkButtonProps {
  type: SaveItemType
  id: number
  data?: any
  size?: 'sm' | 'md' | 'lg'
  variant?: 'icon' | 'pill'
  className?: string
  showLabel?: boolean
}

export function BookmarkButton({
  type,
  id,
  data,
  size = 'md',
  variant = 'icon',
  className,
  showLabel = false,
}: BookmarkButtonProps) {
  const isSaved = useSavedStore((state) => state.isSaved(type, id))
  const toggleSave = useSavedStore((state) => state.toggleSave)
  const [animating, setAnimating] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    setAnimating(true)
    setTimeout(() => setAnimating(false), 300)

    const nowSaved = await toggleSave(type, id, data)
    setFeedback(nowSaved ? 'Saved!' : 'Removed')
    setTimeout(() => setFeedback(null), 1200)
  }

  const iconSizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  const buttonPadding = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  }

  if (variant === 'pill') {
    return (
      <button
        onClick={handleClick}
        title={isSaved ? 'Remove from bookmarks' : 'Save to bookmarks'}
        aria-label={isSaved ? 'Remove from bookmarks' : 'Save to bookmarks'}
        className={cn(
          'relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border',
          isSaved
            ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-sm'
            : 'bg-white border-gray-200 text-gray-600 hover:border-rose-200 hover:text-rose-500 hover:bg-rose-50/50',
          animating && 'scale-105',
          className
        )}
      >
        <Heart
          className={cn(
            iconSizes[size],
            'transition-transform duration-200',
            isSaved ? 'fill-rose-500 text-rose-500' : 'text-current',
            animating && 'scale-125'
          )}
        />
        <span>{isSaved ? 'Saved' : 'Save'}</span>
        {feedback && (
          <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gray-900 text-white text-[10px] rounded shadow pointer-events-none whitespace-nowrap animate-fade-in z-20">
            {feedback}
          </span>
        )}
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      title={isSaved ? 'Remove from bookmarks' : 'Save to bookmarks'}
      aria-label={isSaved ? 'Remove from bookmarks' : 'Save to bookmarks'}
      className={cn(
        'relative rounded-full transition-all duration-200 flex items-center justify-center backdrop-blur-sm',
        buttonPadding[size],
        isSaved
          ? 'bg-white/95 text-rose-500 shadow-sm border border-rose-100 hover:bg-rose-50'
          : 'bg-white/80 text-gray-500 hover:text-rose-500 hover:bg-white shadow-sm border border-gray-100',
        animating && 'scale-115',
        className
      )}
    >
      <Heart
        className={cn(
          iconSizes[size],
          'transition-transform duration-200',
          isSaved ? 'fill-rose-500 text-rose-500' : 'text-current',
          animating && 'scale-125'
        )}
      />
      {showLabel && (
        <span className="text-xs font-medium ml-1.5">
          {isSaved ? 'Saved' : 'Save'}
        </span>
      )}
      {feedback && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gray-900 text-white text-[10px] rounded shadow pointer-events-none whitespace-nowrap animate-fade-in z-20">
          {feedback}
        </span>
      )}
    </button>
  )
}
