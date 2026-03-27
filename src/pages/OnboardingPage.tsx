import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Briefcase, User, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import toast from 'react-hot-toast'
import { blink, tables } from '../blink/client'
import { useAuth } from '../hooks/useAuth'
import { CATEGORIES, SKILLS } from '../lib/utils'
import type { UserRole } from '../types'

type Step = 'role' | 'profile' | 'freelancer-details'

const roles = [
  {
    id: 'client' as UserRole,
    label: 'I want to Hire',
    description: 'Post jobs, hire freelancers, manage projects',
    icon: Briefcase,
    color: 'border-blue-500 bg-blue-50 dark:bg-blue-950',
  },
  {
    id: 'freelancer' as UserRole,
    label: 'I want to Work',
    description: 'Apply to jobs, showcase skills, earn money',
    icon: User,
    color: 'border-amber-500 bg-amber-50 dark:bg-amber-950',
  },
]

export function OnboardingPage() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('role')
  const [role, setRole] = useState<UserRole>('client')
  const [loading, setLoading] = useState(false)

  const [profile, setProfile] = useState({
    displayName: '',
    bio: '',
    location: '',
    phone: '',
    website: '',
  })

  const [freelancerDetails, setFreelancerDetails] = useState({
    title: '',
    skills: [] as string[],
    categories: [] as string[],
    hourlyRate: '',
    experienceYears: '',
  })

  const toggleSkill = (skill: string) => {
    setFreelancerDetails(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill],
    }))
  }

  const toggleCategory = (cat: string) => {
    setFreelancerDetails(prev => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories, cat],
    }))
  }

  const handleFinish = async () => {
    if (!user) return
    if (!profile.displayName.trim()) {
      toast.error('Please enter your name')
      return
    }

    setLoading(true)
    try {
      await tables.userProfiles.create({
        userId: user.id,
        role,
        displayName: profile.displayName,
        bio: profile.bio,
        location: profile.location,
        phone: profile.phone,
        website: profile.website,
        isApproved: '1',
        isSuspended: '0',
      })

      if (role === 'freelancer') {
        await tables.freelancerProfiles.create({
          userId: user.id,
          title: freelancerDetails.title,
          skills: JSON.stringify(freelancerDetails.skills),
          categories: JSON.stringify(freelancerDetails.categories),
          hourlyRate: parseFloat(freelancerDetails.hourlyRate) || 0,
          experienceYears: parseInt(freelancerDetails.experienceYears) || 0,
          availability: 'available',
          rating: 0,
          totalReviews: 0,
          totalEarnings: 0,
          completedJobs: 0,
          isFeatured: '0',
        })
      }

      await tables.wallets.create({
        userId: user.id,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      })

      await tables.notifications.create({
        userId: user.id,
        title: 'Welcome to FreelanceHub! 🎉',
        message:
          role === 'freelancer'
            ? 'Your freelancer profile is live. Start browsing jobs and send proposals.'
            : 'Your account is ready. Post your first job and hire top talent.',
        type: 'success',
        link: '/dashboard',
        isRead: '0',
      })

      await refreshProfile()
      toast.success('Profile created! Welcome to FreelanceHub.')
      navigate({ to: '/dashboard' as any })
    } catch (err) {
      toast.error('Failed to create profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const progressSteps = role === 'freelancer'
    ? ['role', 'profile', 'freelancer-details']
    : ['role', 'profile']

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl gradient-amber flex items-center justify-center">
              <Briefcase size={20} className="text-white" />
            </div>
            <span className="text-2xl font-bold">FreelanceHub</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {step === 'role'
              ? 'How will you use FreelanceHub?'
              : step === 'profile'
                ? 'Tell us about yourself'
                : 'Your freelancer details'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {step === 'role'
              ? 'Choose your primary role to get started'
              : 'This helps clients find you and builds trust'}
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mb-8">
          {progressSteps.map(s => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                s === step || progressSteps.indexOf(s) < progressSteps.indexOf(step)
                  ? 'gradient-amber'
                  : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
          {/* Step 1: Role selection */}
          {step === 'role' && (
            <div className="space-y-4">
              {roles.map(({ id, label, description, icon: Icon, color }) => (
                <button
                  key={id}
                  onClick={() => setRole(id)}
                  className={`w-full flex items-center gap-4 p-5 rounded-xl border-2 text-left transition-all ${
                    role === id ? color : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      role === id ? 'gradient-amber' : 'bg-muted'
                    }`}
                  >
                    <Icon size={22} className={role === id ? 'text-white' : 'text-muted-foreground'} />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-foreground">{label}</div>
                    <div className="text-muted-foreground text-sm">{description}</div>
                  </div>
                  {role === id && <Check size={20} className="text-primary shrink-0" />}
                </button>
              ))}
              <Button
                className="w-full gradient-amber border-0 text-white hover:opacity-90 h-11 mt-4"
                onClick={() => setStep('profile')}
              >
                Continue <ArrowRight size={18} className="ml-2" />
              </Button>
            </div>
          )}

          {/* Step 2: Basic profile */}
          {step === 'profile' && (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Full Name *
                </label>
                <Input
                  placeholder="John Smith"
                  value={profile.displayName}
                  onChange={e => setProfile(p => ({ ...p, displayName: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Bio</label>
                <Textarea
                  placeholder="Tell us about yourself..."
                  rows={3}
                  value={profile.bio}
                  onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">Location</label>
                  <Input
                    placeholder="New York, USA"
                    value={profile.location}
                    onChange={e => setProfile(p => ({ ...p, location: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">Website</label>
                  <Input
                    placeholder="https://yoursite.com"
                    value={profile.website}
                    onChange={e => setProfile(p => ({ ...p, website: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Button variant="outline" className="flex-1" onClick={() => setStep('role')}>
                  Back
                </Button>
                <Button
                  className="flex-1 gradient-amber border-0 text-white hover:opacity-90"
                  onClick={() =>
                    role === 'freelancer' ? setStep('freelancer-details') : handleFinish()
                  }
                  disabled={loading}
                >
                  {role === 'freelancer'
                    ? 'Continue'
                    : loading
                      ? 'Creating...'
                      : 'Finish Setup'}
                  <ArrowRight size={18} className="ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Freelancer details */}
          {step === 'freelancer-details' && (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Professional Title *
                </label>
                <Input
                  placeholder="e.g. Full Stack Developer, UI/UX Designer"
                  value={freelancerDetails.title}
                  onChange={e => setFreelancerDetails(p => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">
                    Hourly Rate (USD)
                  </label>
                  <Input
                    type="number"
                    placeholder="50"
                    value={freelancerDetails.hourlyRate}
                    onChange={e =>
                      setFreelancerDetails(p => ({ ...p, hourlyRate: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">
                    Years of Experience
                  </label>
                  <Input
                    type="number"
                    placeholder="3"
                    value={freelancerDetails.experienceYears}
                    onChange={e =>
                      setFreelancerDetails(p => ({ ...p, experienceYears: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Categories (select up to 3)
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.slice(0, 12).map(cat => (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                        freelancerDetails.categories.includes(cat)
                          ? 'gradient-amber border-transparent text-white'
                          : 'border-border hover:border-primary/50 text-muted-foreground'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Skills (select all that apply)
                </label>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {SKILLS.map(skill => (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                        freelancerDetails.skills.includes(skill)
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-border hover:border-primary/50 text-muted-foreground'
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep('profile')}>
                  Back
                </Button>
                <Button
                  className="flex-1 gradient-amber border-0 text-white hover:opacity-90"
                  onClick={handleFinish}
                  disabled={loading || !freelancerDetails.title.trim()}
                >
                  {loading ? 'Creating Profile...' : 'Complete Setup'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
