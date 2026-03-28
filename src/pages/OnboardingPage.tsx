import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { Briefcase, Code2, CheckCircle2, ArrowRight, Zap, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { tables } from '@/blink/client'

type SelectedRole = 'client' | 'freelancer' | null

// ─── Role Card ────────────────────────────────────────────────────────────────
interface RoleCardProps {
  role: 'client' | 'freelancer'
  title: string
  subtitle: string
  description: string
  icon: React.ElementType
  features: string[]
  selected: boolean
  onSelect: () => void
}

function RoleCard({
  title,
  subtitle,
  description,
  icon: Icon,
  features,
  selected,
  onSelect,
}: RoleCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`
        relative w-full text-left rounded-2xl border-2 p-7 transition-all duration-200 cursor-pointer group
        ${selected
          ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
          : 'border-border bg-card hover:border-primary/40 hover:shadow-md'
        }
      `}
    >
      {/* Selected indicator */}
      {selected && (
        <div className="absolute top-4 right-4">
          <div className="w-6 h-6 rounded-full gradient-amber flex items-center justify-center">
            <CheckCircle2 size={14} className="text-white" />
          </div>
        </div>
      )}

      {/* Icon */}
      <div className={`
        w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all
        ${selected ? 'gradient-amber' : 'bg-muted group-hover:bg-primary/10'}
      `}>
        <Icon size={26} className={selected ? 'text-white' : 'text-muted-foreground group-hover:text-primary'} />
      </div>

      {/* Text */}
      <h3 className="text-xl font-bold text-foreground mb-1">{title}</h3>
      <p className={`text-sm font-medium mb-3 ${selected ? 'text-primary' : 'text-muted-foreground'}`}>{subtitle}</p>
      <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{description}</p>

      {/* Features */}
      <div className="space-y-2.5">
        {features.map(feature => (
          <div key={feature} className="flex items-center gap-2.5">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${selected ? 'gradient-amber' : 'bg-muted'}`}>
              <CheckCircle2 size={10} className={selected ? 'text-white' : 'text-muted-foreground'} />
            </div>
            <span className="text-sm text-foreground">{feature}</span>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className={`
        mt-6 flex items-center gap-2 text-sm font-semibold transition-colors
        ${selected ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}
      `}>
        {selected ? 'Selected' : 'Choose this'}
        <ArrowRight size={15} />
      </div>
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function OnboardingPage() {
  const { user, profile, isLoading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState<SelectedRole>(null)

  // If user already has profile, redirect
  useEffect(() => {
    if (!isLoading) {
      if (!user) navigate({ to: '/auth/login' })
      else if (profile?.role === 'client') navigate({ to: '/client/dashboard' })
      else if (profile?.role === 'freelancer') navigate({ to: '/freelancer/dashboard' })
    }
  }, [isLoading, user, profile])

  const mutation = useMutation({
    mutationFn: async (role: 'client' | 'freelancer') => {
      if (!user) throw new Error('Not authenticated')

      // Create user profile
      await tables.userProfiles.create({
        userId: user.id,
        role,
        displayName: user.email?.split('@')[0] ?? 'User',
        avatarUrl: '',
        bio: '',
        location: '',
        phone: '',
        website: '',
        isApproved: '1',
        isSuspended: '0',
        stripeCustomerId: '',
      })

      // Create wallet
      await tables.wallets.create({
        userId: user.id,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      })

      await refreshProfile()
      return role
    },
    onSuccess: async (role) => {
      toast.success(`Welcome to FreelanceHub! 🎉`, {
        description: role === 'client' ? 'Start posting jobs and hiring talent.' : 'Complete your profile to attract clients.',
      })
      if (role === 'client') navigate({ to: '/client/dashboard' })
      else navigate({ to: '/freelancer/profile/setup' })
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create account. Please try again.'),
  })

  const handleContinue = () => {
    if (!selectedRole) return
    mutation.mutate(selectedRole)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const roles = [
    {
      role: 'client' as const,
      title: "I'm a Client",
      subtitle: 'I want to hire freelancers',
      description:
        'Post jobs, review proposals from talented freelancers, and manage your projects all in one place with secure escrow payments.',
      icon: Briefcase,
      features: [
        'Post unlimited jobs for free',
        'Review proposals from vetted freelancers',
        'Secure escrow payment protection',
        'Milestone-based project management',
      ],
    },
    {
      role: 'freelancer' as const,
      title: "I'm a Freelancer",
      subtitle: 'I want to find work',
      description:
        'Browse job opportunities, submit proposals, and grow your freelance business with secure payments and a professional portfolio.',
      icon: Code2,
      features: [
        'Browse hundreds of job listings',
        'Build a professional portfolio',
        'Get paid securely via escrow',
        'Build your reputation with reviews',
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl gradient-amber flex items-center justify-center">
            <Briefcase size={16} className="text-white" />
          </div>
          <span className="font-bold text-foreground text-lg">FreelanceHub</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Shield size={14} className="text-primary" />
          Secured by escrow
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-3xl">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-5">
              <Zap size={14} />
              One last step
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
              How will you use FreelanceHub?
            </h1>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              Choose your role to personalize your experience. You can always change this later.
            </p>
          </div>

          {/* Role cards */}
          <div className="grid sm:grid-cols-2 gap-5 mb-8">
            {roles.map(r => (
              <RoleCard
                key={r.role}
                {...r}
                selected={selectedRole === r.role}
                onSelect={() => setSelectedRole(r.role)}
              />
            ))}
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center gap-4">
            <Button
              onClick={handleContinue}
              disabled={!selectedRole || mutation.isPending}
              className="gradient-amber text-white border-0 h-12 px-10 text-base font-semibold gap-2 disabled:opacity-40"
            >
              {mutation.isPending ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Setting up your account...
                </>
              ) : (
                <>
                  Get Started
                  <ArrowRight size={18} />
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="border-t border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-center gap-8 text-center">
          {[
            { value: '50K+', label: 'Freelancers' },
            { value: '$2M+', label: 'Paid out' },
            { value: '98%', label: 'Satisfaction' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-lg font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
