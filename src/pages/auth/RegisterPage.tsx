import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Briefcase, User, Code2, Eye, EyeOff, Check, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { blink, tables } from '../../blink/client'
import { generateId } from '../../lib/utils'

type Role = 'client' | 'freelancer'
type Step = 1 | 2

interface FormData {
  displayName: string
  email: string
  password: string
  confirmPassword: string
}

const BENEFITS = [
  'Secure escrow payments — always protected',
  'Admin-verified freelancers you can trust',
  'Zero hidden fees — transparent pricing',
  '24/7 dispute resolution support',
]

export function RegisterPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [role, setRole] = useState<Role>('client')
  const [form, setForm] = useState<FormData>({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRoleSelect = (r: Role) => {
    setRole(r)
    setStep(2)
    setError('')
  }

  const updateField = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await blink.auth.signUp({
        email: form.email,
        password: form.password,
      })

      const user = await blink.auth.me()
      if (!user) throw new Error('Registration failed — please try again')

      const now = new Date().toISOString()

      // Create user profile
      await tables.userProfiles.create({
        id: generateId(),
        userId: user.id,
        role,
        displayName: form.displayName,
        avatarUrl: '',
        bio: '',
        location: '',
        phone: '',
        website: '',
        isApproved: '1',
        isSuspended: '0',
        stripeCustomerId: '',
        createdAt: now,
        updatedAt: now,
      })

      // Create wallet
      await tables.wallets.create({
        id: generateId(),
        userId: user.id,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        createdAt: now,
        updatedAt: now,
      })

      // If freelancer, create profile stub
      if (role === 'freelancer') {
        await tables.freelancerProfiles.create({
          id: generateId(),
          userId: user.id,
          title: '',
          skills: '[]',
          categories: '[]',
          hourlyRate: 0,
          experienceYears: 0,
          education: '[]',
          languages: '[]',
          availability: 'available',
          rating: 0,
          totalReviews: 0,
          totalEarnings: 0,
          completedJobs: 0,
          isFeatured: '0',
          createdAt: now,
          updatedAt: now,
        })
        navigate({ to: '/freelancer/profile/setup' })
      } else {
        navigate({ to: '/client/dashboard' })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  /* Password strength indicator */
  const pwStrength = (() => {
    const p = form.password
    if (!p) return 0
    let score = 0
    if (p.length >= 8) score++
    if (/[A-Z]/.test(p)) score++
    if (/[0-9]/.test(p)) score++
    if (/[^A-Za-z0-9]/.test(p)) score++
    return score
  })()

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][pwStrength]
  const strengthColor = ['', 'bg-destructive', 'bg-amber-400', 'bg-amber-500', 'bg-green-500'][pwStrength]

  return (
    <div className="min-h-screen flex">
      {/* ── Left: Form panel ───────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md animate-fade-in">
          {/* Brand */}
          <Link to="/" className="inline-flex items-center gap-2 mb-8 group">
            <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-105">
              <Briefcase size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold text-foreground tracking-tight">FreelanceHub</span>
          </Link>

          {/* Step 1 — Role selection */}
          {step === 1 && (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-1">Join FreelanceHub</h1>
              <p className="text-muted-foreground text-sm mb-8">
                How would you like to use the platform?
              </p>

              <div className="space-y-4">
                {[
                  {
                    role: 'client' as Role,
                    icon: User,
                    title: 'I want to hire',
                    desc: 'Post jobs, find talent, and manage projects with secure escrow payments.',
                    badge: 'For businesses & individuals',
                  },
                  {
                    role: 'freelancer' as Role,
                    icon: Code2,
                    title: 'I want to work',
                    desc: 'Showcase your skills, find great projects, and get paid securely.',
                    badge: 'For professionals',
                  },
                ].map(opt => (
                  <button
                    key={opt.role}
                    onClick={() => handleRoleSelect(opt.role)}
                    className="w-full flex items-start gap-4 p-5 border-2 border-border rounded-xl hover:border-primary hover:bg-primary/5 active:scale-[0.99] transition-all text-left group cursor-pointer"
                  >
                    <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center group-hover:bg-primary/15 transition-colors flex-shrink-0 mt-0.5">
                      <opt.icon size={22} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-foreground">{opt.title}</p>
                        <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{opt.desc}</p>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 border-border group-hover:border-primary flex items-center justify-center flex-shrink-0 mt-1 transition-colors">
                      <div className="w-2.5 h-2.5 rounded-full bg-transparent group-hover:bg-primary transition-colors" />
                    </div>
                  </button>
                ))}
              </div>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{' '}
                <Link to="/auth/login" className="text-primary font-semibold hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}

          {/* Step 2 — Account details */}
          {step === 2 && (
            <>
              <button
                onClick={() => { setStep(1); setError('') }}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
              >
                <ArrowLeft size={14} /> Back
              </button>

              <h1 className="text-2xl font-bold text-foreground mb-1">Create your account</h1>
              <p className="text-muted-foreground text-sm mb-6">
                Joining as a{' '}
                <span className="text-primary font-semibold capitalize">{role}</span>
              </p>

              {/* Error banner */}
              {error && (
                <div className="mb-5 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">⚠</span>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Full name
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={form.displayName}
                    onChange={updateField('displayName')}
                    placeholder="Jane Smith"
                    autoComplete="name"
                    className="w-full px-3.5 py-2.5 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm transition-shadow"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={updateField('email')}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full px-3.5 py-2.5 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm transition-shadow"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      value={form.password}
                      onChange={updateField('password')}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                      className="w-full px-3.5 py-2.5 pr-10 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm transition-shadow"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {/* Strength meter */}
                  {form.password && (
                    <div className="mt-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map(i => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i <= pwStrength ? strengthColor : 'bg-border'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{strengthLabel}</p>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      required
                      value={form.confirmPassword}
                      onChange={updateField('confirmPassword')}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className={`w-full px-3.5 py-2.5 pr-10 border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm transition-shadow ${
                        form.confirmPassword && form.password !== form.confirmPassword
                          ? 'border-destructive'
                          : 'border-input'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {form.confirmPassword && form.password !== form.confirmPassword && (
                    <p className="text-xs text-destructive mt-1">Passwords don't match</p>
                  )}
                </div>

                {/* Terms */}
                <div className="flex items-start gap-2.5 pt-1">
                  <div className="w-4 h-4 rounded border border-primary bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check size={10} className="text-white" strokeWidth={3} />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    By creating an account, you agree to our{' '}
                    <a href="#" className="text-primary hover:underline font-medium">
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="#" className="text-primary hover:underline font-medium">
                      Privacy Policy
                    </a>
                  </p>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Creating account…
                    </span>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-4">
                Already have an account?{' '}
                <Link to="/auth/login" className="text-primary font-semibold hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── Right: Illustration panel ──────────────────────────── */}
      <div className="hidden lg:flex flex-1 gradient-primary flex-col items-center justify-center p-12 text-white relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-white/5" />

        <div className="relative max-w-md text-center z-10">
          <h2 className="text-3xl font-bold mb-4 leading-tight">
            Start earning or hiring today
          </h2>
          <p className="text-white/75 text-sm mb-10 leading-relaxed">
            Join thousands of professionals using our secure, admin-protected platform.
          </p>

          <div className="space-y-3 mb-10">
            {BENEFITS.map(item => (
              <div
                key={item}
                className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 text-left border border-white/10"
              >
                <CheckCircle2 size={18} className="text-amber-400 shrink-0" />
                <span className="text-sm text-white/90">{item}</span>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
            <div className="flex items-center justify-center gap-3 mb-3">
              {['A', 'B', 'C', 'D'].map((letter, i) => (
                <div
                  key={letter}
                  className="w-8 h-8 rounded-full bg-white/25 border-2 border-white/30 flex items-center justify-center text-xs font-bold"
                  style={{ marginLeft: i > 0 ? '-8px' : '0' }}
                >
                  {letter}
                </div>
              ))}
              <span className="text-sm font-semibold text-white/90 ml-1">+10,000</span>
            </div>
            <p className="text-white/70 text-xs">
              professionals already on the platform
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
