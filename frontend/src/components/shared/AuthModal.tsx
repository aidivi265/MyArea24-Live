import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, ArrowRight, RefreshCw, CheckCircle } from 'lucide-react'
import { useAuthStore } from '@/store'
import { authApi } from '@/services/apiService'

export function AuthModal() {
  const { t } = useTranslation()
  const { authModalOpen, closeAuthModal, login } = useAuthStore()
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [purpose, setPurpose] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'resident' | 'merchant'>('resident')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [devOtp, setDevOtp] = useState('')
  const [countdown, setCountdown] = useState(0)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!authModalOpen) {
      setStep('email'); setError(''); setOtp(['', '', '', '', '', '']); setDevOtp(''); setEmail(''); setFullName('')
    }
  }, [authModalOpen])

  useEffect(() => {
    if (countdown <= 0) return
    const t2 = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t2)
  }, [countdown])

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authApi.sendOtp({ email, purpose })
      if (res.dev_otp) setDevOtp(res.dev_otp)
      setStep('otp')
      setCountdown(60)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e.response?.data?.message ?? 'Failed to send OTP. Please try again.')
    } finally { setLoading(false) }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < 6) { setError('Enter the 6-digit code'); return }
    setError('')
    setLoading(true)
    try {
      const res = await authApi.verifyOtp({
        email, otp_code: code,
        ...(purpose === 'signup' ? { full_name: fullName, role } : {}),
      })
      login(res.access_token, res.user)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e.response?.data?.message ?? 'Invalid or expired OTP.')
    } finally { setLoading(false) }
  }

  function handleOtpKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus()
  }

  function handleOtpChange(i: number, val: string) {
    const v = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]; next[i] = v; setOtp(next)
    if (v && i < 5) otpRefs.current[i + 1]?.focus()
  }

  if (!authModalOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeAuthModal} />
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-br from-brand-500 to-brand-700 px-6 py-8 text-white">
            <button onClick={closeAuthModal} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/20 transition-colors">
              <X className="h-5 w-5" />
            </button>
            <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-xl font-bold">{step === 'email' ? t('auth.login_title') : t('auth.otp_title')}</h2>
            <p className="text-sm text-white/70 mt-1">
              {step === 'email' ? t('auth.login_subtitle') : `${t('auth.otp_subtitle')} ${email}`}
            </p>
          </div>

          <div className="p-6">
            {step === 'email' ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                  {(['login', 'signup'] as const).map(p => (
                    <button type="button" key={p} onClick={() => setPurpose(p)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${purpose === p ? 'bg-white shadow text-brand-600' : 'text-gray-500'}`}>
                      {t(`auth.purpose_${p}`)}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.email_label')}</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder={t('auth.email_placeholder')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-300 text-sm" />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button type="submit" disabled={loading || !email}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-colors disabled:opacity-50">
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <><span>{t('auth.send_otp')}</span><ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                {devOtp && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                    <span className="font-semibold">{t('auth.dev_otp_hint')}</span>
                    <code className="font-mono font-bold text-base tracking-widest">{devOtp}</code>
                  </div>
                )}
                <div className="flex gap-2 justify-center">
                  {otp.map((d, i) => (
                    <input key={i} ref={el => { otpRefs.current[i] = el }}
                      value={d} onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKey(i, e)}
                      maxLength={1} inputMode="numeric"
                      className="w-11 h-12 text-center text-xl font-bold rounded-xl border-2 border-gray-200 focus:outline-none focus:border-brand-400 transition-colors" />
                  ))}
                </div>

                {purpose === 'signup' && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.name_label')}</label>
                      <input value={fullName} onChange={e => setFullName(e.target.value)}
                        placeholder={t('auth.name_placeholder')}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-300 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.role_label')}</label>
                      <div className="flex gap-2">
                        {(['resident', 'merchant'] as const).map(r => (
                          <button type="button" key={r} onClick={() => setRole(r)}
                            className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${role === r ? 'border-brand-400 bg-brand-50 text-brand-600' : 'border-gray-200 text-gray-500'}`}>
                            {t(`auth.role_${r}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {error && <p className="text-sm text-red-500">{error}</p>}

                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-colors disabled:opacity-50">
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4" /><span>{t('auth.verify')}</span></>}
                </button>

                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => setStep('email')} className="text-gray-400 hover:text-gray-600">← Back</button>
                  <button type="button" disabled={countdown > 0} onClick={() => { setCountdown(60); handleSendOtp({ preventDefault: () => {} } as React.FormEvent) }}
                    className="text-brand-500 hover:text-brand-700 disabled:text-gray-400 font-medium">
                    {countdown > 0 ? `${t('auth.resend')} (${countdown}s)` : t('auth.resend')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
