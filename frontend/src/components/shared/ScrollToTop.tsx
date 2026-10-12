import { useState, useEffect } from 'react'
import { ArrowUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 320)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          transition={{ duration: 0.18 }}
          onClick={scrollToTop}
          aria-label="Scroll to top of page"
          title="Scroll to top"
          className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-30 p-2.5 sm:p-3 rounded-full bg-brand-600 hover:bg-brand-700 active:scale-90 text-white shadow-lg shadow-brand-900/20 border border-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <ArrowUp className="h-4 w-4 sm:h-5 sm:w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
