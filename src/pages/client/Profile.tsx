import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  User,
  MapPin,
  Phone,
  Globe,
  Camera,
  Save,
  AlertCircle,
  CheckCircle2,
  Mail,
  FileText,
  Briefcase,
  ArrowLeft,
} from 'lucide-react'
import { blink, tables } from '../../blink/client'
import { useAuth } from '../../hooks/useAuth'
import { generateId, formatDate } from '../../lib/utils'
import type { UserProfile, Contract, Job } from '../../types'
import toast from 'react-hot-toast'
import { useNavigate } from '@tanstack/react-router'

interface ProfileForm {
  displayName: string
  bio: string
  location: string
  phone: string
  website: string
  avatarUrl: string
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function ClientProfile() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [form, setForm] = useState<ProfileForm>({
    displayName: '',
    bio: '',
    location: '',
    phone: '',
    website: '',
    avatarUrl: '',
  })
  const [isDirty, setIsDirty] = useState(false)

  // Populate form once profile loads
  useEffect(() => {
    if (profile) {
      setForm({
        displayName: profile.displayName || '',
        bio: profile.bio || '',
        location: profile.location || '',
        phone: profile.phone || '',
        website: profile.website || '',
        avatarUrl: profile.avatarUrl || '',
      })
    }
  }, [profile])

  const updateField = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm(p => ({ ...p, [key]: value }))
    setIsDirty(true)
  }

  // Stats queries
  const { data: contracts = [] } = useQuery({
    queryKey: ['client-profile-contracts', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      return (await tables.contracts.list({
        where: { clientId: user.id },
        limit: 200,
      })) as Contract[]
    },
    enabled: !!user?.id,
  })

  const { data: jobs = [] } = useQuery({
    queryKey: ['client-profile-jobs', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      return (await tables.jobs.list({
        where: { userId: user.id },
        limit: 200,
      })) as Job[]
    },
    enabled: !!user?.id,
  })

  const totalSpent = contracts
    .filter(c => c.paymentStatus === 'released')
    .reduce((s, c) => s + Number(c.amount), 0)
  const completedContracts = contracts.filter(c => c.status === 'completed').length
  const totalJobs = jobs.length

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated')
      const now = new Date().toISOString()

      if (profile) {
        await tables.userProfiles.update(profile.id, {
          displayName: form.displayName.trim(),
          bio: form.bio.trim(),
          location: form.location.trim(),
          phone: form.phone.trim(),
          website: form.website.trim(),
          avatarUrl: form.avatarUrl.trim(),
          updatedAt: now,
        })
      } else {
        await tables.userProfiles.create({
          id: generateId(),
          userId: user.id,
          role: 'client',
          displayName: form.displayName.trim(),
          bio: form.bio.trim(),
          location: form.location.trim(),
          phone: form.phone.trim(),
          website: form.website.trim(),
          avatarUrl: form.avatarUrl.trim(),
          isApproved: '1',
          isSuspended: '0',
          stripeCustomerId: '',
          createdAt: now,
          updatedAt: now,
        })
      }
    },
    onSuccess: async () => {
      toast.success('Profile updated successfully!')
      setIsDirty(false)
      await refreshProfile()
      qc.invalidateQueries({ queryKey: ['client-profile-contracts', user?.id] })
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Failed to save profile')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.displayName.trim()) {
      toast.error('Display name is required')
      return
    }
    saveMutation.mutate()
  }

  return (
    <div className="page-container pt-24 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate({ to: '/client/dashboard' })}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft size={15} />
            Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account information and preferences
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left sidebar — avatar + stats */}
          <div className="space-y-5">
            {/* Avatar card */}
            <div className="bg-card border border-border rounded-2xl p-6 text-center shadow-sm">
              <div className="relative inline-block mb-4">
                <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden border-2 border-border mx-auto">
                  {form.avatarUrl ? (
                    <img
                      src={form.avatarUrl}
                      alt={form.displayName}
                      className="w-full h-full object-cover"
                      onError={e => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <span className="text-primary font-bold text-2xl">
                      {form.displayName ? getInitials(form.displayName) : '?'}
                    </span>
                  )}
                </div>
              </div>
              <p className="font-bold text-foreground text-lg leading-tight">
                {form.displayName || 'Your Name'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Client</p>
              {form.location && (
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-2">
                  <MapPin size={11} />
                  {form.location}
                </p>
              )}
              {user?.email && (
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                  <Mail size={11} />
                  {user.email}
                </p>
              )}
              {profile && (
                <p className="text-xs text-muted-foreground mt-2">
                  Member since {formatDate(profile.createdAt)}
                </p>
              )}
            </div>

            {/* Stats card */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground mb-4">Activity Summary</h3>
              <div className="space-y-3">
                {[
                  {
                    label: 'Jobs Posted',
                    value: totalJobs,
                    icon: Briefcase,
                    colorClass: 'text-primary',
                  },
                  {
                    label: 'Completed Projects',
                    value: completedContracts,
                    icon: CheckCircle2,
                    colorClass: 'text-emerald-600',
                  },
                  {
                    label: 'Total Spent',
                    value: `$${totalSpent.toLocaleString()}`,
                    icon: FileText,
                    colorClass: 'text-amber-600',
                  },
                ].map(stat => (
                  <div
                    key={stat.label}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <stat.icon size={14} className={stat.colorClass} />
                      <span className="text-xs text-muted-foreground">{stat.label}</span>
                    </div>
                    <span className="text-sm font-bold text-foreground">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Account status */}
            {profile && (
              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Account Status
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    {Number(profile.isApproved) > 0 ? (
                      <CheckCircle2 size={14} className="text-emerald-600" />
                    ) : (
                      <AlertCircle size={14} className="text-amber-600" />
                    )}
                    <span className="text-foreground">
                      {Number(profile.isApproved) > 0 ? 'Approved' : 'Pending Approval'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span className="text-foreground">Email Verified</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right — edit form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Basic info */}
              <div className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-sm">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <User size={15} className="text-primary" />
                  </div>
                  Basic Information
                </h2>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Display Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={e => updateField('displayName', e.target.value)}
                    placeholder="Your full name or company name"
                    maxLength={80}
                    className="w-full px-3.5 py-2.5 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Bio</label>
                  <textarea
                    value={form.bio}
                    onChange={e => updateField('bio', e.target.value)}
                    placeholder="Tell freelancers about yourself, your company, and the type of projects you work on..."
                    rows={4}
                    maxLength={1000}
                    className="w-full px-3.5 py-2.5 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y transition-colors"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {form.bio.length}/1000 characters
                  </p>
                </div>
              </div>

              {/* Contact info */}
              <div className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-sm">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <MapPin size={15} className="text-emerald-600" />
                  </div>
                  Contact &amp; Location
                </h2>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                      <MapPin size={13} className="text-muted-foreground" />
                      Location
                    </label>
                    <input
                      type="text"
                      value={form.location}
                      onChange={e => updateField('location', e.target.value)}
                      placeholder="e.g. New York, USA"
                      className="w-full px-3.5 py-2.5 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                      <Phone size={13} className="text-muted-foreground" />
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => updateField('phone', e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-3.5 py-2.5 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                    <Globe size={13} className="text-muted-foreground" />
                    Website
                  </label>
                  <input
                    type="url"
                    value={form.website}
                    onChange={e => updateField('website', e.target.value)}
                    placeholder="https://yourcompany.com"
                    className="w-full px-3.5 py-2.5 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                  />
                </div>
              </div>

              {/* Avatar */}
              <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                    <Camera size={15} className="text-purple-600" />
                  </div>
                  Profile Picture
                </h2>

                <p className="text-xs text-muted-foreground">
                  Enter a public URL for your avatar image (e.g. from Gravatar, LinkedIn, or any
                  image host).
                </p>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Avatar Image URL
                  </label>
                  <input
                    type="url"
                    value={form.avatarUrl}
                    onChange={e => updateField('avatarUrl', e.target.value)}
                    placeholder="https://example.com/your-photo.jpg"
                    className="w-full px-3.5 py-2.5 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                  />
                </div>

                {/* Preview */}
                {form.avatarUrl && (
                  <div className="flex items-center gap-3 pt-1">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted border border-border">
                      <img
                        src={form.avatarUrl}
                        alt="Avatar preview"
                        className="w-full h-full object-cover"
                        onError={e => {
                          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Preview of your avatar</p>
                  </div>
                )}
              </div>

              {/* Save actions */}
              <div className="flex items-center justify-between gap-3 pb-4">
                {isDirty && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle size={12} />
                    You have unsaved changes
                  </p>
                )}
                <div className="flex gap-3 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      if (profile) {
                        setForm({
                          displayName: profile.displayName || '',
                          bio: profile.bio || '',
                          location: profile.location || '',
                          phone: profile.phone || '',
                          website: profile.website || '',
                          avatarUrl: profile.avatarUrl || '',
                        })
                        setIsDirty(false)
                      }
                    }}
                    disabled={!isDirty}
                    className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    disabled={saveMutation.isPending || !isDirty}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 shadow-sm"
                  >
                    {saveMutation.isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={15} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
