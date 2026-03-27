import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import {
  User, Code2, DollarSign, Globe, Phone, MapPin,
  Plus, Trash2, ExternalLink, Save, Image,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { blink, tables } from '../../blink/client'
import { useAuth } from '../../hooks/useAuth'
import { generateId, parseJsonArray } from '../../lib/utils'
import { JOB_CATEGORIES, SKILL_OPTIONS } from '../../types'
import type { FreelancerProfile, PortfolioItem } from '../../types'

const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Available', color: 'text-green-600' },
  { value: 'busy', label: 'Busy', color: 'text-yellow-600' },
  { value: 'unavailable', label: 'Unavailable', color: 'text-red-600' },
] as const

type Tab = 'profile' | 'professional' | 'portfolio'

export function FreelancerProfile() {
  const { user, profile: userProfile, refreshProfile } = useAuth()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [saving, setSaving] = useState(false)

  // Basic info
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')

  // Professional
  const [title, setTitle] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [hourlyRate, setHourlyRate] = useState('')
  const [experienceYears, setExperienceYears] = useState('')
  const [availability, setAvailability] = useState<'available' | 'busy' | 'unavailable'>('available')

  // Portfolio new item form
  const [showPortfolioForm, setShowPortfolioForm] = useState(false)
  const [pTitle, setPTitle] = useState('')
  const [pDesc, setPDesc] = useState('')
  const [pImageUrl, setPImageUrl] = useState('')
  const [pProjectUrl, setPProjectUrl] = useState('')
  const [pTags, setPTags] = useState('')

  const { data: freelancerProfile } = useQuery({
    queryKey: ['freelancer-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const items = await tables.freelancerProfiles.list({ where: { userId: user.id }, limit: 1 })
      return (items[0] ?? null) as FreelancerProfile | null
    },
    enabled: !!user?.id,
  })

  const { data: portfolio = [] } = useQuery({
    queryKey: ['portfolio', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      return await tables.portfolioItems.list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      }) as PortfolioItem[]
    },
    enabled: !!user?.id,
  })

  // Populate form when data arrives
  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '')
      setBio(userProfile.bio || '')
      setLocation(userProfile.location || '')
      setPhone(userProfile.phone || '')
      setWebsite(userProfile.website || '')
    }
  }, [userProfile])

  useEffect(() => {
    if (freelancerProfile) {
      setTitle(freelancerProfile.title || '')
      setSelectedSkills(parseJsonArray(freelancerProfile.skills))
      setSelectedCategories(parseJsonArray(freelancerProfile.categories))
      setHourlyRate(String(freelancerProfile.hourlyRate || ''))
      setExperienceYears(String(freelancerProfile.experienceYears || ''))
      setAvailability(freelancerProfile.availability || 'available')
    }
  }, [freelancerProfile])

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

  async function saveBasicInfo() {
    if (!user?.id || !userProfile?.id) return
    setSaving(true)
    try {
      await tables.userProfiles.update(userProfile.id, {
        displayName,
        bio,
        location,
        phone,
        website,
        updatedAt: new Date().toISOString(),
      })
      await refreshProfile()
      toast.success('Profile updated!')
    } catch {
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  async function saveProfessionalInfo() {
    if (!user?.id) return
    if (!title.trim()) { toast.error('Please enter a headline'); return }
    setSaving(true)
    try {
      const payload = {
        title,
        skills: JSON.stringify(selectedSkills),
        categories: JSON.stringify(selectedCategories),
        hourlyRate: Number(hourlyRate) || 0,
        experienceYears: Number(experienceYears) || 0,
        availability,
        updatedAt: new Date().toISOString(),
      }
      if (freelancerProfile?.id) {
        await tables.freelancerProfiles.update(freelancerProfile.id, payload)
      } else {
        await tables.freelancerProfiles.create({
          id: generateId(),
          userId: user.id,
          education: '[]',
          languages: '["English"]',
          rating: 0,
          totalReviews: 0,
          totalEarnings: 0,
          completedJobs: 0,
          isFeatured: '0',
          createdAt: new Date().toISOString(),
          ...payload,
        })
      }
      qc.invalidateQueries({ queryKey: ['freelancer-profile', user.id] })
      toast.success('Professional info updated!')
    } catch {
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const addPortfolioItem = useMutation({
    mutationFn: async () => {
      if (!user?.id) return
      if (!pTitle.trim()) throw new Error('Title is required')
      await tables.portfolioItems.create({
        id: generateId(),
        userId: user.id,
        title: pTitle,
        description: pDesc,
        imageUrl: pImageUrl,
        projectUrl: pProjectUrl,
        tags: JSON.stringify(pTags.split(',').map(t => t.trim()).filter(Boolean)),
        createdAt: new Date().toISOString(),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio', user?.id] })
      toast.success('Portfolio item added!')
      setPTitle(''); setPDesc(''); setPImageUrl(''); setPProjectUrl(''); setPTags('')
      setShowPortfolioForm(false)
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to add item'),
  })

  const removePortfolioItem = useMutation({
    mutationFn: async (id: string) => {
      await tables.portfolioItems.delete(id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio', user?.id] })
      toast.success('Item removed')
    },
    onError: () => toast.error('Failed to remove item'),
  })

  const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: 'profile', label: 'Basic Info', icon: User },
    { id: 'professional', label: 'Professional', icon: Code2 },
    { id: 'portfolio', label: 'Portfolio', icon: Image },
  ]

  return (
    <div className="page-container pt-24">
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <User size={24} className="text-accent" />
          <h1 className="text-2xl font-bold text-foreground">Edit Profile</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl mb-6 w-fit">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Basic Info Tab */}
        {activeTab === 'profile' && (
          <div className="bg-card border border-border rounded-2xl p-6 max-w-2xl space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Display Name
              </label>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Bio</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={4}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm resize-none"
                placeholder="Tell clients about your background, skills, and approach..."
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground mt-1">{bio.length}/1000</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                  <MapPin size={13} /> Location
                </label>
                <input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                  placeholder="New York, USA"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                  <Phone size={13} /> Phone
                </label>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                  placeholder="+1 555 000 0000"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                <Globe size={13} /> Website
              </label>
              <input
                value={website}
                onChange={e => setWebsite(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                placeholder="https://yourwebsite.com"
              />
            </div>
            <div className="pt-2">
              <button
                onClick={saveBasicInfo}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {saving
                  ? <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  : <Save size={14} />
                }
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Professional Tab */}
        {activeTab === 'professional' && (
          <div className="bg-card border border-border rounded-2xl p-6 max-w-2xl space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Professional Headline
              </label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                placeholder="e.g. Full-Stack Developer | React & Node.js Expert"
                maxLength={120}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                  <DollarSign size={13} /> Hourly Rate (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    type="number"
                    value={hourlyRate}
                    onChange={e => setHourlyRate(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                    placeholder="50"
                    min="1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Years of Experience
                </label>
                <input
                  type="number"
                  value={experienceYears}
                  onChange={e => setExperienceYears(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                  placeholder="3"
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Availability
              </label>
              <div className="flex gap-2">
                {AVAILABILITY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setAvailability(opt.value)}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                      availability === opt.value
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    <span className={availability === opt.value ? opt.color : ''}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Skills
                <span className="text-muted-foreground font-normal ml-2">({selectedSkills.length} selected)</span>
              </label>
              <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto pr-1">
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
                Service Categories
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

            <div className="pt-2">
              <button
                onClick={saveProfessionalInfo}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {saving
                  ? <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  : <Save size={14} />
                }
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Portfolio Tab */}
        {activeTab === 'portfolio' && (
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showcase your best work to attract clients
              </p>
              <button
                onClick={() => setShowPortfolioForm(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus size={14} />
                Add Item
              </button>
            </div>

            {/* Add form */}
            {showPortfolioForm && (
              <div className="bg-card border border-primary/30 rounded-2xl p-5 space-y-4">
                <h3 className="font-semibold text-foreground">New Portfolio Item</h3>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
                  <input
                    value={pTitle}
                    onChange={e => setPTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    placeholder="Project name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                  <textarea
                    value={pDesc}
                    onChange={e => setPDesc(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                    placeholder="What did you build?"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Image URL</label>
                    <input
                      value={pImageUrl}
                      onChange={e => setPImageUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Project URL</label>
                    <input
                      value={pProjectUrl}
                      onChange={e => setPProjectUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Tags (comma separated)</label>
                  <input
                    value={pTags}
                    onChange={e => setPTags(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    placeholder="React, TypeScript, Node.js"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => addPortfolioItem.mutate()}
                    disabled={addPortfolioItem.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                  >
                    {addPortfolioItem.isPending
                      ? <div className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      : <Plus size={13} />
                    }
                    Add
                  </button>
                  <button
                    onClick={() => setShowPortfolioForm(false)}
                    className="px-4 py-2 border border-border text-foreground rounded-xl text-sm hover:bg-muted/50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Portfolio grid */}
            {portfolio.length === 0 && !showPortfolioForm ? (
              <div className="bg-card border border-border rounded-2xl p-10 text-center">
                <Image size={36} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">No portfolio items yet</p>
                <p className="text-xs text-muted-foreground mb-4">Add your best work to impress clients</p>
                <button
                  onClick={() => setShowPortfolioForm(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Add First Item
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {portfolio.map(item => (
                  <div key={item.id} className="bg-card border border-border rounded-2xl overflow-hidden card-hover group">
                    {item.imageUrl && (
                      <div className="aspect-video bg-muted overflow-hidden">
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      </div>
                    )}
                    {!item.imageUrl && (
                      <div className="aspect-video bg-muted/50 flex items-center justify-center">
                        <Image size={32} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-foreground text-sm">{item.title}</h3>
                        <div className="flex gap-1 flex-shrink-0">
                          {item.projectUrl && (
                            <a
                              href={item.projectUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                          <button
                            onClick={() => removePortfolioItem.mutate(item.id)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.description}</p>
                      )}
                      {parseJsonArray(item.tags).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {parseJsonArray(item.tags).slice(0, 4).map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-muted rounded-full text-xs text-muted-foreground">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
