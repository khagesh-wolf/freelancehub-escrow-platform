import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Users,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  StarOff,
  UserCheck,
  UserX,
  Filter,
  RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { blink, tables } from '../../blink/client'
import { useAuth } from '../../hooks/useAuth'
import { createNotification } from '../../hooks/useNotifications'
import { formatDate, getInitials } from '../../lib/utils'
import { AdminLayout } from '../../components/layout/AdminLayout'
import type { UserProfile, FreelancerProfile } from '../../types'

type RoleTab = 'all' | 'client' | 'freelancer'

export function AdminUsers() {
  const { profile: adminProfile } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [roleTab, setRoleTab] = useState<RoleTab>('all')

  if (adminProfile && adminProfile.role !== 'admin') {
    navigate({ to: '/' })
    return null
  }

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => tables.userProfiles.list({ limit: 500 }) as Promise<UserProfile[]>,
  })

  const { data: freelancerProfiles = [] } = useQuery({
    queryKey: ['admin-freelancer-profiles'],
    queryFn: () =>
      tables.freelancerProfiles.list({ limit: 500 }) as Promise<FreelancerProfile[]>,
  })

  const fpMap = new Map(freelancerProfiles.map(fp => [fp.userId, fp]))

  // ── Filters ────────────────────────────────────────────────────────────────
  const filtered = users.filter(u => {
    const matchesRole = roleTab === 'all' || u.role === roleTab
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      u.displayName?.toLowerCase().includes(q) ||
      u.userId?.toLowerCase().includes(q) ||
      u.location?.toLowerCase().includes(q)
    return matchesRole && matchesSearch
  })

  // ── Suspend / Unsuspend ────────────────────────────────────────────────────
  const toggleSuspend = useMutation({
    mutationFn: async (user: UserProfile) => {
      const newVal = Number(user.isSuspended) > 0 ? '0' : '1'
      await tables.userProfiles.update(user.id, {
        isSuspended: newVal,
        updatedAt: new Date().toISOString(),
      })
      if (newVal === '1') {
        await createNotification(
          user.userId,
          'Account Suspended',
          'Your account has been suspended. Please contact support for more information.',
          'error',
          '/',
        )
      } else {
        await createNotification(
          user.userId,
          'Account Reinstated',
          'Your account has been reinstated. You can now access all platform features.',
          'success',
          '/',
        )
      }
    },
    onSuccess: (_, user) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      const wasSuspended = Number(user.isSuspended) > 0
      toast.success(wasSuspended ? 'User unsuspended' : 'User suspended')
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to update user'),
  })

  // ── Feature / Unfeature freelancer ────────────────────────────────────────
  const toggleFeatured = useMutation({
    mutationFn: async ({ fp, user }: { fp: FreelancerProfile; user: UserProfile }) => {
      const newVal = Number(fp.isFeatured) > 0 ? '0' : '1'
      await tables.freelancerProfiles.update(fp.id, {
        isFeatured: newVal,
        updatedAt: new Date().toISOString(),
      })
      if (newVal === '1') {
        await createNotification(
          user.userId,
          '⭐ You\'ve Been Featured!',
          'Congratulations! Your profile is now featured on FreelanceHub, giving you increased visibility.',
          'success',
          `/freelancer/${user.userId}`,
        )
      }
    },
    onSuccess: (_, { fp }) => {
      qc.invalidateQueries({ queryKey: ['admin-freelancer-profiles'] })
      toast.success(Number(fp.isFeatured) > 0 ? 'Removed from featured' : 'Freelancer featured!')
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to update freelancer'),
  })

  const roleCounts = {
    all: users.length,
    client: users.filter(u => u.role === 'client').length,
    freelancer: users.filter(u => u.role === 'freelancer').length,
  }

  const tabs: { key: RoleTab; label: string }[] = [
    { key: 'all', label: 'All Users' },
    { key: 'client', label: 'Clients' },
    { key: 'freelancer', label: 'Freelancers' },
  ]

  return (
    <AdminLayout active="/admin/users">
      <div className="page-container">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users size={22} className="text-primary" />
              Manage Users
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {users.length} total users · Suspend, feature, or review accounts
            </p>
          </div>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['admin-users'] })}
            className="p-2 rounded-xl border border-border hover:bg-muted/50 transition-colors text-muted-foreground"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, ID, or location…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
            />
          </div>

          {/* Role Tabs */}
          <div className="flex items-center bg-muted/50 rounded-xl p-1 border border-border gap-0.5">
            <Filter size={14} className="text-muted-foreground ml-2 mr-1" />
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setRoleTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  roleTab === t.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                  roleTab === t.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  {roleCounts[t.key]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-border">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                  <div className="w-9 h-9 bg-muted rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 bg-muted rounded w-40" />
                    <div className="h-3 bg-muted rounded w-56" />
                  </div>
                  <div className="h-6 bg-muted rounded-full w-16" />
                  <div className="h-8 bg-muted rounded-lg w-24" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <UserX size={36} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No users found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search ? 'Try adjusting your search' : 'No users in this category yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {['User', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                      <th
                        key={h}
                        className={`px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide ${
                          h === 'Actions' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => {
                    const isSuspended = Number(u.isSuspended) > 0
                    const fp = fpMap.get(u.userId)
                    const isFeatured = fp ? Number(fp.isFeatured) > 0 : false
                    const initials = getInitials(u.displayName || 'U')

                    return (
                      <tr
                        key={u.id}
                        className="border-b border-border hover:bg-muted/20 transition-colors"
                      >
                        {/* User Info */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                u.role === 'client'
                                  ? 'bg-blue-100 text-blue-700'
                                  : u.role === 'freelancer'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-violet-100 text-violet-700'
                              }`}
                            >
                              {u.avatarUrl ? (
                                <img
                                  src={u.avatarUrl}
                                  alt={u.displayName}
                                  className="w-9 h-9 rounded-full object-cover"
                                />
                              ) : (
                                initials
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {u.displayName || 'Unnamed User'}
                                {isFeatured && (
                                  <Star size={12} className="inline ml-1 text-amber-500 fill-amber-500" />
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground truncate font-mono">
                                {u.userId}
                              </p>
                              {u.location && (
                                <p className="text-xs text-muted-foreground">{u.location}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                              u.role === 'client'
                                ? 'badge-client'
                                : u.role === 'freelancer'
                                ? 'badge-freelancer'
                                : 'badge-admin'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                isSuspended ? 'bg-red-500' : 'bg-emerald-500'
                              }`}
                            />
                            <span
                              className={`text-xs font-medium ${
                                isSuspended ? 'text-red-600' : 'text-emerald-600'
                              }`}
                            >
                              {isSuspended ? 'Suspended' : 'Active'}
                            </span>
                          </div>
                        </td>

                        {/* Joined */}
                        <td className="px-5 py-3.5 text-sm text-muted-foreground">
                          {formatDate(u.createdAt)}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            {/* Feature toggle (freelancer only) */}
                            {u.role === 'freelancer' && fp && (
                              <button
                                onClick={() => toggleFeatured.mutate({ fp, user: u })}
                                disabled={toggleFeatured.isPending}
                                title={isFeatured ? 'Remove from featured' : 'Feature freelancer'}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                                  isFeatured
                                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                    : 'border border-border text-muted-foreground hover:bg-muted/50'
                                }`}
                              >
                                {isFeatured ? (
                                  <>
                                    <StarOff size={13} /> Unfeature
                                  </>
                                ) : (
                                  <>
                                    <Star size={13} /> Feature
                                  </>
                                )}
                              </button>
                            )}

                            {/* Suspend toggle */}
                            {u.role !== 'admin' && (
                              <button
                                onClick={() => toggleSuspend.mutate(u)}
                                disabled={toggleSuspend.isPending}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                                  isSuspended
                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                                }`}
                              >
                                {isSuspended ? (
                                  <>
                                    <UserCheck size={13} /> Unsuspend
                                  </>
                                ) : (
                                  <>
                                    <ShieldAlert size={13} /> Suspend
                                  </>
                                )}
                              </button>
                            )}

                            {u.role === 'admin' && (
                              <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground">
                                <ShieldCheck size={13} /> Admin
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer count */}
          {!isLoading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-border bg-muted/20">
              <p className="text-xs text-muted-foreground">
                Showing {filtered.length} of {users.length} users
              </p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
