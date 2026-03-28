import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Briefcase, User, Building2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { blink, tables } from '@/blink/client'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

export function RegisterPage() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [role, setRole] = useState<'client' | 'freelancer'>('client')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!user) return
    if (!displayName.trim()) { toast.error('Please enter your name'); return }
    setIsSubmitting(true)
    try {
      await tables.userProfiles.create({
        userId: user.id,
        role,
        displayName: displayName.trim(),
        avatarUrl: user.photoURL || '',
        bio: bio.trim(),
        location: location.trim(),
        phone: '',
        website: '',
        isApproved: '1',
        isSuspended: '0',
        stripeCustomerId: '',
      })
      if (role === 'freelancer') {
        await tables.freelancerProfiles.create({
          userId: user.id,
          title: '',
          skills: '[]',
          categories: '[]',
          hourlyRate: 0,
          experienceYears: 0,
          education: '[]',
          languages: '["English"]',
          availability: 'available',
          rating: 0,
          totalReviews: 0,
          totalEarnings: 0,
          completedJobs: 0,
          isFeatured: '0',
        })
        await tables.wallets.create({
          userId: user.id,
          balance: 0,
          pendingBalance: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
        })
      }
      await refreshProfile()
      toast.success('Profile created! Welcome to FreelanceHub')
      navigate({ to: role === 'client' ? '/client/dashboard' : '/freelancer/dashboard' })
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create profile')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl gradient-amber mb-4">
            <Briefcase size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Set up your account</h1>
          <p className="text-muted-foreground mt-1">Just a few details to get you started</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">I want to...</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: 'client', label: 'Hire Freelancers', icon: Building2, desc: 'Post jobs and hire talent' },
                  { value: 'freelancer', label: 'Find Work', icon: User, desc: 'Offer services and earn' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    className={`p-4 border-2 rounded-xl text-left transition-all ${role === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                    onClick={() => setRole(opt.value as 'client' | 'freelancer')}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <opt.icon size={20} className={role === opt.value ? 'text-primary' : 'text-muted-foreground'} />
                      {role === opt.value && <Check size={16} className="text-primary" />}
                    </div>
                    <div className="font-semibold text-foreground text-sm">{opt.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
              <Button className="w-full gradient-amber border-0 text-white hover:opacity-90 h-11" onClick={() => setStep(2)}>
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Your profile</h2>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Full Name *</label>
                <Input placeholder="John Smith" value={displayName} onChange={e => setDisplayName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Bio</label>
                <Textarea placeholder="Tell us about yourself..." value={bio} onChange={e => setBio(e.target.value)} rows={3} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Location</label>
                <Input placeholder="New York, USA" value={location} onChange={e => setLocation(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 h-11" onClick={() => setStep(1)}>Back</Button>
                <Button
                  className="flex-1 gradient-amber border-0 text-white hover:opacity-90 h-11"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create Profile'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
