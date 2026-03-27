import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, User, Lock, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { blink, tables } from '../blink/client'
import { useAuth } from '../hooks/useAuth'
import { getInitials, parseJsonArray, CATEGORIES, SKILLS } from '../lib/utils'
import type { FreelancerProfile } from '../types'
import toast from 'react-hot-toast'

type Tab = 'profile' | 'security'

function SecurityTab() {
  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Lock size={16} className="text-accent" /> Password & Security
        </h3>
        <p className="text-sm text-muted-foreground">
          Password management is handled by your authentication provider.
          Contact support if you need to change your password.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => blink.auth.login()}>
          Manage via Auth Provider
        </Button>
      </div>
    </div>
  )
}

export function SettingsPage() {
  const { user, profile, isAuthenticated, refreshProfile } = useAuth()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  // Profile form
  const [displayName, setDisplayName] = useState(profile?.displayName || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [location, setLocation] = useState(profile?.location || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [website, setWebsite] = useState(profile?.website || '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || '')

  // Freelancer extras
  const [title, setTitle] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [experienceYears, setExperienceYears] = useState('')
  const [availability, setAvailability] = useState<'available' | 'busy' | 'unavailable'>('available')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')

  const isFreelancer = profile?.role === 'freelancer'

  const { data: fpArr } = useQuery({
    queryKey: ['myFreelancerProfile', user?.id],
    queryFn: () => tables.freelancerProfiles.list({ where: { userId: user!.id }, limit: 1 }),
    enabled: !!user?.id && isFreelancer,
  })
  const fp = (fpArr as FreelancerProfile[] | undefined)?.[0]

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '')
      setBio(profile.bio || '')
      setLocation(profile.location || '')
      setPhone(profile.phone || '')
      setWebsite(profile.website || '')
      setAvatarUrl(profile.avatarUrl || '')
    }
  }, [profile])

  useEffect(() => {
    if (fp) {
      setTitle(fp.title || '')
      setHourlyRate(String(fp.hourlyRate || ''))
      setExperienceYears(String(fp.experienceYears || ''))
      setAvailability(fp.availability || 'available')
      setSelectedSkills(parseJsonArray(fp.skills))
      setSelectedCategories(parseJsonArray(fp.categories))
    }
  }, [fp])

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Profile not found')
      await tables.userProfiles.update(profile.id, {
        displayName: displayName.trim(),
        bio: bio.trim(),
        location: location.trim(),
        phone: phone.trim(),
        website: website.trim(),
        avatarUrl: avatarUrl.trim(),
        updatedAt: new Date().toISOString(),
      })
      if (isFreelancer) {
        const fpPayload = {
          title: title.trim(),
          hourlyRate: Number(hourlyRate) || 0,
          experienceYears: Number(experienceYears) || 0,
          availability,
          skills: JSON.stringify(selectedSkills),
          categories: JSON.stringify(selectedCategories),
          updatedAt: new Date().toISOString(),
        }
        if (fp) {
          await tables.freelancerProfiles.update(fp.id, fpPayload)
        } else {
          await tables.freelancerProfiles.create({
            userId: user!.id,
            ...fpPayload,
            rating: 0,
            totalReviews: 0,
            totalEarnings: 0,
            completedJobs: 0,
            isFeatured: '0',
            createdAt: new Date().toISOString(),
          })
        }
      }
      await refreshProfile()
    },
    onSuccess: () => {
      toast.success('Profile updated!')
      qc.invalidateQueries({ queryKey: ['myFreelancerProfile', user?.id] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill])
  }
  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])
  }
  const addCustomSkill = () => {
    const s = skillInput.trim()
    if (s && !selectedSkills.includes(s)) {
      setSelectedSkills(prev => [...prev, s])
      setSkillInput('')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="page-container pt-24 flex flex-col items-center justify-center py-24">
        <Settings size={48} className="text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
        <Button className="gradient-amber border-0 text-white" onClick={() => blink.auth.login()}>Sign In</Button>
      </div>
    )
  }

  return (
    <div className="page-container pt-24 animate-fade-in">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center">
            <Settings size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground text-sm">Manage your account preferences</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-muted rounded-lg p-1 w-fit">
          {([{ key: 'profile' as Tab, label: 'Profile', icon: User }, { key: 'security' as Tab, label: 'Security', icon: Lock }]).map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'security' ? (
          <SecurityTab />
        ) : (
          <div className="space-y-6">
            {/* Avatar preview */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-4 mb-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="text-xl font-bold gradient-hero text-white">
                    {getInitials(displayName || profile?.displayName || 'U')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{displayName || 'Your Name'}</p>
                  <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Avatar URL</Label>
                <Input placeholder="https://..." value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} />
              </div>
            </div>

            {/* Basic info */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <User size={16} className="text-accent" /> Basic Information
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Display Name</Label>
                  <Input value={displayName} onChange={e => setDisplayName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Location</Label>
                  <Input placeholder="City, Country" value={location} onChange={e => setLocation(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input type="tel" placeholder="+1 234 567 8900" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input type="url" placeholder="https://" value={website} onChange={e => setWebsite(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Bio</Label>
                <Textarea placeholder="Tell clients about yourself..." rows={3} value={bio} onChange={e => setBio(e.target.value)} />
              </div>
            </div>

            {/* Freelancer specific */}
            {isFreelancer && (
              <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                <h3 className="font-semibold">Freelancer Profile</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Professional Title</Label>
                    <Input placeholder="e.g. Full-Stack Developer" value={title} onChange={e => setTitle(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Hourly Rate ($)</Label>
                    <Input type="number" placeholder="75" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Years of Experience</Label>
                    <Input type="number" placeholder="5" value={experienceYears} onChange={e => setExperienceYears(e.target.value)} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Availability</Label>
                    <Select value={availability} onValueChange={v => setAvailability(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="busy">Busy</SelectItem>
                        <SelectItem value="unavailable">Unavailable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Skills */}
                <div className="space-y-2">
                  <Label>Skills</Label>
                  <div className="flex flex-wrap gap-2 p-3 border border-border rounded-lg min-h-[50px]">
                    {selectedSkills.map(s => (
                      <Badge key={s} variant="secondary" className="gap-1 cursor-pointer" onClick={() => toggleSkill(s)}>
                        {s} <X size={11} />
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Add skill..." value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomSkill())} />
                    <Button variant="outline" size="sm" onClick={addCustomSkill}><Plus size={16} /></Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SKILLS.filter(s => !selectedSkills.includes(s)).slice(0, 15).map(s => (
                      <button key={s} onClick={() => toggleSkill(s)} className="px-2 py-0.5 text-xs rounded-full border border-border hover:bg-secondary transition-colors">
                        + {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Categories */}
                <div className="space-y-2">
                  <Label>Categories</Label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(c => (
                      <button
                        key={c}
                        onClick={() => toggleCategory(c)}
                        className={`px-3 py-1 text-xs rounded-full border transition-all ${
                          selectedCategories.includes(c)
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-border hover:bg-muted'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <Button
              className="w-full gradient-amber border-0 text-white hover:opacity-90 h-11"
              onClick={() => saveProfile.mutate()}
              disabled={saveProfile.isPending}
            >
              {saveProfile.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
