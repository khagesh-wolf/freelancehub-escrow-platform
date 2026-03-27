import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  UserCheck, ChevronRight, ChevronLeft, Check,
  Briefcase, Code2, DollarSign, Rocket,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { blink, tables } from '../../blink/client'
import { useAuth } from '../../hooks/useAuth'
import { generateId } from '../../lib/utils'
import { JOB_CATEGORIES, SKILL_OPTIONS } from '../../types'

const STEPS = [
  { id: 1, label: 'Headline & Bio', icon: UserCheck },
  { id: 2, label: 'Skills', icon: Code2 },
  { id: 3, label: 'Rate & Experience', icon: DollarSign },
  { id: 4, label: 'Done!', icon: Rocket },
]

const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Available', desc: 'Ready to take on new projects' },
  { value: 'busy', label: 'Busy', desc: 'Currently working, limited capacity' },
  { value: 'unavailable', label: 'Unavailable', desc: 'Not accepting new projects' },
] as const

export function FreelancerProfileSetup() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1
  const [title, setTitle] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')

  // Step 2
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  // Step 3
  const [hourlyRate, setHourlyRate] = useState('')
  const [experienceYears, setExperienceYears] = useState('')
  const [availability, setAvailability] = useState<'available' | 'busy' | 'unavailable'>('available')

  function toggleSkill(skill: string) {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    )
  }

  function toggleCategory(cat: string) {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  function validateStep() {
    if (step === 1) {
      if (!title.trim()) { toast.error('Please enter a professional headline'); return false }
      if (!bio.trim()) { toast.error('Please enter a bio'); return false }
    }
    if (step === 2) {
      if (selectedSkills.length === 0) { toast.error('Select at least one skill'); return false }
      if (selectedCategories.length === 0) { toast.error('Select at least one category'); return false }
    }
    if (step === 3) {
      if (!hourlyRate || Number(hourlyRate) <= 0) { toast.error('Enter a valid hourly rate'); return false }
      if (!experienceYears || Number(experienceYears) < 0) { toast.error('Enter valid experience years'); return false }
    }
    return true
  }

  async function handleFinish() {
    if (!user?.id) return
    setSaving(true)
    try {
      // Upsert user_profiles (bio, location)
      const existingProfiles = await tables.userProfiles.list({ where: { userId: user.id }, limit: 1 })
      if (existingProfiles.length > 0) {
        await tables.userProfiles.update(existingProfiles[0].id, {
          bio,
          location,
          updatedAt: new Date().toISOString(),
        })
      }

      // Upsert freelancer_profiles
      const existingFP = await tables.freelancerProfiles.list({ where: { userId: user.id }, limit: 1 })
      const payload = {
        userId: user.id,
        title,
        skills: JSON.stringify(selectedSkills),
        categories: JSON.stringify(selectedCategories),
        hourlyRate: Number(hourlyRate),
        experienceYears: Number(experienceYears),
        availability,
        education: '[]',
        languages: '["English"]',
        rating: 0,
        totalReviews: 0,
        totalEarnings: 0,
        completedJobs: 0,
        isFeatured: '0',
        updatedAt: new Date().toISOString(),
      }

      if (existingFP.length > 0) {
        await tables.freelancerProfiles.update(existingFP[0].id, payload)
      } else {
        await tables.freelancerProfiles.create({
          id: generateId(),
          createdAt: new Date().toISOString(),
          ...payload,
        })
      }

      // Ensure wallet exists
      const existingWallet = await tables.wallets.list({ where: { userId: user.id }, limit: 1 })
      if (existingWallet.length === 0) {
        await tables.wallets.create({
          id: generateId(),
          userId: user.id,
          balance: 0,
          pendingBalance: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }

      await refreshProfile()
      setStep(4)
    } catch (err) {
      toast.error('Failed to save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleNext() {
    if (!validateStep()) return
    if (step === 3) {
      handleFinish()
    } else {
      setStep(s => s + 1)
    }
  }

  const progressPct = ((step - 1) / (STEPS.length - 1)) * 100

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserCheck size={24} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Set Up Your Freelancer Profile</h1>
          <p className="text-muted-foreground mt-2">
            Complete your profile to start receiving job offers
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-between mb-8 relative">
          <div className="absolute left-0 right-0 top-4 h-0.5 bg-border z-0">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {STEPS.map((s) => {
            const Icon = s.icon
            const isCompleted = step > s.id
            const isCurrent = step === s.id
            return (
              <div key={s.id} className="flex flex-col items-center z-10 relative">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300
                  ${isCompleted ? 'bg-primary border-primary' : isCurrent ? 'bg-card border-primary' : 'bg-card border-border'}
                `}>
                  {isCompleted
                    ? <Check size={14} className="text-primary-foreground" />
                    : <Icon size={14} className={isCurrent ? 'text-primary' : 'text-muted-foreground'} />
                  }
                </div>
                <span className={`text-xs mt-2 font-medium hidden sm:block ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden animate-fade-in">
          {/* Step 1: Headline & Bio */}
          {step === 1 && (
            <div className="p-6 space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Tell us about yourself</h2>
                <p className="text-sm text-muted-foreground">Your headline and bio will appear on your public profile</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Professional Headline <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Full-Stack React Developer | 5+ Years Experience"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition-colors"
                  maxLength={120}
                />
                <p className="text-xs text-muted-foreground mt-1">{title.length}/120</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Bio <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Describe your experience, skills, and what makes you stand out..."
                  rows={5}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition-colors resize-none"
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground mt-1">{bio.length}/1000</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. New York, USA"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition-colors"
                />
              </div>
            </div>
          )}

          {/* Step 2: Skills & Categories */}
          {step === 2 && (
            <div className="p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Skills & Categories</h2>
                <p className="text-sm text-muted-foreground">Select the skills and categories that best represent your work</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Skills <span className="text-destructive">*</span>
                  <span className="text-muted-foreground font-normal ml-2">({selectedSkills.length} selected)</span>
                </label>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                  {SKILL_OPTIONS.map(skill => (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        selectedSkills.includes(skill)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Service Categories <span className="text-destructive">*</span>
                  <span className="text-muted-foreground font-normal ml-2">({selectedCategories.length} selected)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {JOB_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left ${
                        selectedCategories.includes(cat)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Rate & Experience */}
          {step === 3 && (
            <div className="p-6 space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Rate & Experience</h2>
                <p className="text-sm text-muted-foreground">Set your pricing and experience level</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Hourly Rate (USD) <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <input
                      type="number"
                      value={hourlyRate}
                      onChange={e => setHourlyRate(e.target.value)}
                      placeholder="50"
                      min="1"
                      max="999"
                      className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Per hour in USD</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Years of Experience <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    value={experienceYears}
                    onChange={e => setExperienceYears(e.target.value)}
                    placeholder="3"
                    min="0"
                    max="50"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Current Availability
                </label>
                <div className="space-y-2">
                  {AVAILABILITY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setAvailability(opt.value)}
                      className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                        availability === opt.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-background hover:border-primary/30'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center ${
                        availability === opt.value ? 'border-primary' : 'border-border'
                      }`}>
                        {availability === opt.value && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <div className="p-10 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <Check size={32} className="text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Profile Complete! 🎉</h2>
              <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
                Your freelancer profile has been set up successfully. Start browsing jobs and submit proposals to clients.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => navigate({ to: '/jobs' })}
                  className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Briefcase size={16} />
                  Browse Jobs
                </button>
                <button
                  onClick={() => navigate({ to: '/freelancer/dashboard' })}
                  className="px-6 py-2.5 border border-border text-foreground rounded-xl font-medium hover:bg-muted/50 transition-colors"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          )}

          {/* Navigation footer */}
          {step < 4 && (
            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <button
                onClick={() => setStep(s => Math.max(1, s - 1))}
                disabled={step === 1}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
                Back
              </button>
              <span className="text-xs text-muted-foreground">
                Step {step} of {STEPS.length - 1}
              </span>
              <button
                onClick={handleNext}
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Saving...
                  </>
                ) : step === 3 ? (
                  <>Finish <Rocket size={14} /></>
                ) : (
                  <>Next <ChevronRight size={16} /></>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
