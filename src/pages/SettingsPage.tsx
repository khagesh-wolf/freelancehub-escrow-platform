import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  User,
  Lock,
  Bell,
  Save,
  CheckCircle2,
  AlertCircle,
  Info,
  ExternalLink,
  Eye,
  EyeOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/useAuth'
import { blink, tables } from '@/blink/client'
import { formatRelativeTime } from '@/lib/utils'
import type { Notification } from '@/types'

// ─── Notification type config ─────────────────────────────────────────────────
const NOTIF_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  info:    { icon: Info,         color: 'text-blue-600',   bg: 'bg-blue-100 dark:bg-blue-900/20' },
  success: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/20' },
  warning: { icon: AlertCircle,  color: 'text-amber-600',  bg: 'bg-amber-100 dark:bg-amber-900/20' },
  error:   { icon: AlertCircle,  color: 'text-red-600',    bg: 'bg-red-100 dark:bg-red-900/20' },
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────
function ProfileTab() {
  const { user, profile, refreshProfile } = useAuth()
  const qc = useQueryClient()

  const [form, setForm] = useState({
    displayName: '',
    bio: '',
    location: '',
    phone: '',
    website: '',
  })

  // Load profile into form
  useEffect(() => {
    if (profile) {
      setForm({
        displayName: profile.displayName ?? '',
        bio: profile.bio ?? '',
        location: profile.location ?? '',
        phone: profile.phone ?? '',
        website: profile.website ?? '',
      })
    }
  }, [profile?.id])

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const mutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error('Profile not found')
      if (!form.displayName.trim()) throw new Error('Display name is required')
      await tables.userProfiles.update(profile.id, {
        displayName: form.displayName.trim(),
        bio: form.bio.trim(),
        location: form.location.trim(),
        phone: form.phone.trim(),
        website: form.website.trim(),
      })
    },
    onSuccess: async () => {
      toast.success('Profile updated successfully!')
      await refreshProfile()
      qc.invalidateQueries({ queryKey: ['profile', user?.id] })
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update profile'),
  })

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-base font-semibold text-foreground mb-5 flex items-center gap-2">
          <User size={16} className="text-primary" />
          Personal Information
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1.5">Display Name *</label>
            <Input
              value={form.displayName}
              onChange={set('displayName')}
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Location</label>
            <Input
              value={form.location}
              onChange={set('location')}
              placeholder="City, Country"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Phone</label>
            <Input
              value={form.phone}
              onChange={set('phone')}
              placeholder="+1 (555) 000-0000"
              type="tel"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1.5">Website</label>
            <Input
              value={form.website}
              onChange={set('website')}
              placeholder="https://yourwebsite.com"
              type="url"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1.5">Bio</label>
            <Textarea
              value={form.bio}
              onChange={set('bio')}
              placeholder="Tell clients about yourself, your expertise, and what makes you unique..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">{form.bio.length} characters</p>
          </div>
        </div>
      </div>

      {/* Account info (read-only) */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-base font-semibold text-foreground mb-4">Account Info</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Email</label>
            <p className="text-sm text-foreground font-medium">{user?.email ?? '—'}</p>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Role</label>
            <p className="text-sm text-foreground font-medium capitalize">{profile?.role ?? '—'}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="gradient-amber text-white border-0 gap-2"
        >
          <Save size={16} />
          {mutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}

// ─── Security Tab ─────────────────────────────────────────────────────────────
function SecurityTab() {
  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      if (!oldPass) throw new Error('Current password is required')
      if (newPass.length < 8) throw new Error('New password must be at least 8 characters')
      if (newPass !== confirmPass) throw new Error('Passwords do not match')
      await (blink.auth as any).changePassword(oldPass, newPass)
    },
    onSuccess: () => {
      toast.success('Password changed successfully!')
      setOldPass('')
      setNewPass('')
      setConfirmPass('')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to change password'),
  })

  const strength = (() => {
    if (!newPass) return 0
    let score = 0
    if (newPass.length >= 8) score++
    if (/[A-Z]/.test(newPass)) score++
    if (/[0-9]/.test(newPass)) score++
    if (/[^A-Za-z0-9]/.test(newPass)) score++
    return score
  })()

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength]
  const strengthColor = ['', 'bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500'][strength]

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-base font-semibold text-foreground mb-5 flex items-center gap-2">
          <Lock size={16} className="text-primary" />
          Change Password
        </h3>
        <div className="space-y-4 max-w-md">
          {/* Current password */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Current Password</label>
            <div className="relative">
              <Input
                type={showOld ? 'text' : 'password'}
                value={oldPass}
                onChange={e => setOldPass(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showOld ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">New Password</label>
            <div className="relative">
              <Input
                type={showNew ? 'text' : 'password'}
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {newPass && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map(n => (
                    <div
                      key={n}
                      className={`h-1 flex-1 rounded-full transition-colors ${n <= strength ? strengthColor : 'bg-muted'}`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{strengthLabel} password</p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Confirm New Password</label>
            <div className="relative">
              <Input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                placeholder="••••••••"
                className={`pr-10 ${confirmPass && confirmPass !== newPass ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {confirmPass && confirmPass !== newPass && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !oldPass || !newPass || !confirmPass}
          className="gradient-amber text-white border-0 gap-2"
        >
          <Lock size={16} />
          {mutation.isPending ? 'Changing...' : 'Change Password'}
        </Button>
      </div>
    </div>
  )
}

// ─── Notifications Tab ────────────────────────────────────────────────────────
function NotificationsTab({ userId }: { userId: string }) {
  const qc = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications', userId],
    queryFn: () => tables.notifications.list({ where: { userId }, orderBy: { createdAt: 'desc' } }) as Promise<Notification[]>,
    enabled: !!userId,
  })

  const markRead = useMutation({
    mutationFn: (id: string) => tables.notifications.update(id, { isRead: '1' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', userId] }),
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => n.isRead === '0')
      await Promise.all(unread.map(n => tables.notifications.update(n.id, { isRead: '1' })))
    },
    onSuccess: () => {
      toast.success('All notifications marked as read')
      qc.invalidateQueries({ queryKey: ['notifications', userId] })
    },
  })

  const unreadCount = notifications.filter(n => n.isRead === '0').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
        </p>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            Mark all as read
          </Button>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 animate-pulse flex gap-3">
                <div className="w-8 h-8 bg-muted rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 bg-muted rounded" />
                  <div className="h-3 w-56 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bell size={36} className="text-muted-foreground opacity-30 mb-3" />
            <p className="text-sm font-medium text-foreground">No notifications</p>
            <p className="text-xs text-muted-foreground mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map(notif => {
              const cfg = NOTIF_CONFIG[notif.type] ?? NOTIF_CONFIG.info
              const NIcon = cfg.icon
              return (
                <div
                  key={notif.id}
                  className={`p-4 flex gap-3 transition-colors ${notif.isRead === '0' ? 'bg-primary/5' : ''}`}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${cfg.bg}`}>
                    <NIcon size={15} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${notif.isRead === '0' ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[11px] text-muted-foreground">{formatRelativeTime(notif.createdAt)}</span>
                          {notif.link && (
                            <a
                              href={notif.link}
                              className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                            >
                              View <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                      {notif.isRead === '0' && (
                        <button
                          onClick={() => markRead.mutate(notif.id)}
                          disabled={markRead.isPending}
                          className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="Mark as read"
                        >
                          <CheckCircle2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  {notif.isRead === '0' && (
                    <div className="w-2 h-2 rounded-full gradient-amber shrink-0 mt-1.5" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && !user) navigate({ to: '/auth/login' })
  }, [isLoading, user])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account preferences</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList className="mb-6">
          <TabsTrigger value="profile" className="gap-2">
            <User size={14} />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Lock size={14} />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell size={14} />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>

        <TabsContent value="notifications">
          {user && <NotificationsTab userId={user.id} />}
        </TabsContent>
      </Tabs>
    </div>
  )
}
