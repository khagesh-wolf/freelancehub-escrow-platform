import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  User, Briefcase, DollarSign, Clock, CheckCircle,
  X, Plus, Save, Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import { tables } from '@/blink/client'
import { safeParseJSON } from '@/lib/utils'
import type { FreelancerProfile } from '@/types'
import { JOB_CATEGORIES, SKILL_OPTIONS } from '@/types'
import { toast } from 'sonner'

const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Available', desc: 'Ready to take on new projects' },
  { value: 'busy', label: 'Busy', desc: 'Currently occupied, limited availability' },
  { value: 'unavailable', label: 'Unavailable', desc: 'Not accepting new work' },
]

export function FreelancerProfileSetup() {
  const { user, profile, isLoading, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [fpData, setFpData] = useState<FreelancerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [title, setTitle] = useState('')
  const [bio, setBio] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [experienceYears, setExperienceYears] = useState('')
  const [availability, setAvailability] = useState<'available' | 'busy' | 'unavailable'>('available')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [skillSearch, setSkillSearch] = useState('')

  useEffect(() => {
    if (!isLoading && !user) navigate({ to: '/auth/login' })
    if (!isLoading && profile && profile.role !== 'freelancer') navigate({ to: '/client/dashboard' })
  }, [isLoading, user, profile])

  useEffect(() => {
    if (!user) return
    loadProfile()
  }, [user])

  async function loadProfile() {
    if (!user) return
    setLoading(true)
    try {
      const fps = await tables.freelancerProfiles.list({ where: { userId: user.id }, limit: 1 })
      const fp = fps[0] as FreelancerProfile | undefined
      if (fp) {
        setFpData(fp)
        setTitle(fp.title || '')
        setHourlyRate(String(fp.hourlyRate || ''))
        setExperienceYears(String(fp.experienceYears || ''))
        setAvailability(fp.availability || 'available')
        setSelectedSkills(safeParseJSON<string[]>(fp.skills, []))
        setSelectedCategories(safeParseJSON<string[]>(fp.categories, []))
      }
      // load bio from userProfile
      if (profile?.bio) setBio(profile.bio)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

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

  async function handleSave() {
    if (!user) return
    if (!title.trim()) { toast.error('Professional title is required'); return }
    if (selectedSkills.length === 0) { toast.error('Add at least one skill'); return }
    if (selectedCategories.length === 0) { toast.error('Select at least one category'); return }

    setSaving(true)
    try {
      const fpPayload = {
        title: title.trim(),
        skills: JSON.stringify(selectedSkills),
        categories: JSON.stringify(selectedCategories),
        hourlyRate: Number(hourlyRate) || 0,
        experienceYears: Number(experienceYears) || 0,
        availability,
      }

      if (fpData) {
        await tables.freelancerProfiles.update(fpData.id, fpPayload)
      } else {
        await tables.freelancerProfiles.create({
          userId: user.id,
          ...fpPayload,
          education: JSON.stringify([]),
          languages: JSON.stringify([]),
          rating: 0,
          totalReviews: 0,
          totalEarnings: 0,
          completedJobs: 0,
        })
      }

      // Update bio in userProfile
      if (profile?.id) {
        const profileId = profile.id
        await tables.userProfiles.update(profileId, { bio: bio.trim() })
      }

      await refreshProfile()
      toast.success('Profile saved!', { description: 'Your freelancer profile is up to date.' })
      navigate({ to: '/freelancer/dashboard' })
    } catch {
      toast.error('Failed to save profile', { description: 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const filteredSkills = skillSearch
    ? SKILL_OPTIONS.filter(s => s.toLowerCase().includes(skillSearch.toLowerCase()))
    : SKILL_OPTIONS

  if (loading || isLoading) {
    return (
      <div className="page-container">
        <div className="h-8 w-64 bg-muted/60 rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted/60 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="page-container animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          {fpData ? 'Edit Profile' : 'Set Up Your Profile'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {fpData
            ? 'Keep your profile updated to attract the best clients.'
            : 'Complete your profile to start applying for jobs and winning contracts.'}
        </p>
      </div>

      <div className="space-y-6">
        {/* Basic Info */}
        <section className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-5 flex items-center gap-2">
            <User size={16} className="text-muted-foreground" />
            Basic Information
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Professional Title *
              </label>
              <Input
                placeholder="e.g. Full Stack Developer | React & Node.js Expert"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground mt-1">{title.length}/100 characters</p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Professional Bio
              </label>
              <Textarea
                placeholder="Describe your expertise, experience, and what makes you the right freelancer..."
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={5}
                className="resize-none text-sm"
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground mt-1">{bio.length}/1000 characters</p>
            </div>
          </div>
        </section>

        {/* Work Details */}
        <section className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-5 flex items-center gap-2">
            <Briefcase size={16} className="text-muted-foreground" />
            Work Details
          </h2>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                <DollarSign size={12} className="inline mr-0.5" />
                Hourly Rate (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  placeholder="50"
                  value={hourlyRate}
                  onChange={e => setHourlyRate(e.target.value)}
                  min={0}
                  className="pl-7"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                <Star size={12} className="inline mr-0.5" />
                Years of Experience
              </label>
              <Input
                type="number"
                placeholder="3"
                value={experienceYears}
                onChange={e => setExperienceYears(e.target.value)}
                min={0}
                max={50}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                <Clock size={12} className="inline mr-0.5" />
                Availability
              </label>
              <select
                value={availability}
                onChange={e => setAvailability(e.target.value as typeof availability)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {AVAILABILITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Availability Details */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {AVAILABILITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAvailability(opt.value as typeof availability)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  availability === opt.value
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-border bg-background hover:border-muted-foreground'
                }`}
              >
                <div className={`text-xs font-semibold mb-0.5 ${
                  opt.value === 'available' ? 'text-emerald-600 dark:text-emerald-400' :
                  opt.value === 'busy' ? 'text-amber-600 dark:text-amber-400' :
                  'text-red-600 dark:text-red-400'
                }`}>{opt.label}</div>
                <div className="text-xs text-muted-foreground leading-snug">{opt.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Skills */}
        <section className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
            <CheckCircle size={16} className="text-muted-foreground" />
            Skills
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Select all skills that apply to your work. ({selectedSkills.length} selected)
          </p>

          {/* Selected Skills */}
          {selectedSkills.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4 p-3 bg-muted/30 rounded-lg border border-border/50">
              {selectedSkills.map(skill => (
                <span
                  key={skill}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className="hover:opacity-70 transition-opacity"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="relative mb-3">
            <Input
              placeholder="Search skills..."
              value={skillSearch}
              onChange={e => setSkillSearch(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* All Skills Grid */}
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
            {filteredSkills.map(skill => {
              const selected = selectedSkills.includes(skill)
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    selected
                      ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground bg-background'
                  }`}
                >
                  {selected ? <><CheckCircle size={10} className="inline mr-1" />{skill}</> : skill}
                </button>
              )
            })}
          </div>
        </section>

        {/* Categories */}
        <section className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
            <Briefcase size={16} className="text-muted-foreground" />
            Service Categories
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Pick the categories that match your work. ({selectedCategories.length} selected)
          </p>

          <div className="grid sm:grid-cols-2 gap-2">
            {JOB_CATEGORIES.map(cat => {
              const selected = selectedCategories.includes(cat)
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium text-left transition-all ${
                    selected
                      ? 'border-primary bg-primary/5 dark:bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground bg-background'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selected ? 'border-primary bg-primary' : 'border-muted-foreground'
                  }`}>
                    {selected && <CheckCircle size={10} className="text-primary-foreground" />}
                  </div>
                  {cat}
                </button>
              )
            })}
          </div>
        </section>

        {/* Save */}
        <div className="flex items-center justify-between pt-2 pb-4">
          <Button
            variant="ghost"
            onClick={() => navigate({ to: '/freelancer/dashboard' })}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="gradient-amber text-white border-0 min-w-[140px]"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Saving...</>
            ) : (
              <><Save size={15} className="mr-1.5" />Save Profile</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
