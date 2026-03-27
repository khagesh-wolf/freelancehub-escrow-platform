import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Users, Search, ShieldAlert, ExternalLink, UserCheck, UserX } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '../../components/shared/EmptyState'
import { tables } from '../../blink/client'
import { formatDate, getInitials } from '../../lib/utils'
import type { UserProfile } from '../../types'

type RoleFilter = 'all' | 'client' | 'freelancer' | 'admin'
type StatusFilter = 'all' | 'active' | 'suspended'

function roleBadgeClass(role: string) {
  if (role === 'admin') return 'badge-admin'
  if (role === 'freelancer') return 'badge-freelancer'
  return 'badge-client'
}

export function AdminUsersPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-all-users'],
    queryFn: () => tables.userProfiles.list({ limit: 500, orderBy: { createdAt: 'desc' } }) as Promise<UserProfile[]>,
  })

  const suspendUser = useMutation({
    mutationFn: async (userId: string) => {
      const profiles = await tables.userProfiles.list({ where: { userId }, limit: 1 })
      if (!profiles[0]) throw new Error('Profile not found')
      await tables.userProfiles.update((profiles[0] as UserProfile).id, { isSuspended: '1' })
    },
    onSuccess: () => { toast.success('User suspended'); qc.invalidateQueries({ queryKey: ['admin-all-users'] }) },
    onError: () => toast.error('Failed to suspend user'),
  })

  const unsuspendUser = useMutation({
    mutationFn: async (userId: string) => {
      const profiles = await tables.userProfiles.list({ where: { userId }, limit: 1 })
      if (!profiles[0]) throw new Error('Profile not found')
      await tables.userProfiles.update((profiles[0] as UserProfile).id, { isSuspended: '0' })
    },
    onSuccess: () => { toast.success('User unsuspended'); qc.invalidateQueries({ queryKey: ['admin-all-users'] }) },
    onError: () => toast.error('Failed to unsuspend user'),
  })

  const promoteToAdmin = useMutation({
    mutationFn: async (profileId: string) => {
      await tables.userProfiles.update(profileId, { role: 'admin' })
    },
    onSuccess: () => { toast.success('User promoted to admin'); qc.invalidateQueries({ queryKey: ['admin-all-users'] }) },
    onError: () => toast.error('Failed to promote user'),
  })

  const hasAdmins = users.some(u => u.role === 'admin')

  const filtered = users.filter(u => {
    const name = (u.displayName || '').toLowerCase()
    const matchSearch = !search || name.includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    const isSuspended = Number(u.isSuspended) > 0
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && !isSuspended) ||
      (statusFilter === 'suspended' && isSuspended)
    return matchSearch && matchRole && matchStatus
  })

  return (
    <div className="page-container space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{users.length} total users</p>
        </div>
      </div>

      {/* First-admin tip */}
      {!hasAdmins && users.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex gap-3 items-start dark:bg-amber-900/20 dark:border-amber-800">
          <ShieldAlert size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <strong>First admin tip:</strong> No admin users exist yet. Promote a user to admin so you can manage the platform.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name…"
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={v => setRoleFilter(v as RoleFilter)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="freelancer">Freelancer</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users found"
            description={search ? 'Try a different search term.' : 'No users match the selected filters.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Joined</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(u => {
                  const suspended = Number(u.isSuspended) > 0
                  return (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8 shrink-0">
                            {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt={u.displayName} /> : null}
                            <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                              {getInitials(u.displayName || '?')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate max-w-[180px]">
                              {u.displayName || 'Unknown'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                              ID: {u.userId.slice(0, 12)}…
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleBadgeClass(u.role)}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {suspended ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {u.role === 'freelancer' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => navigate({ to: '/freelancer/$userId', params: { userId: u.userId } })}
                            >
                              <ExternalLink size={13} className="mr-1" /> Profile
                            </Button>
                          )}
                          {u.role !== 'admin' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                              onClick={() => promoteToAdmin.mutate(u.id)}
                              disabled={promoteToAdmin.isPending}
                            >
                              <ShieldAlert size={13} className="mr-1" /> Promote
                            </Button>
                          )}
                          {suspended ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-green-700 hover:bg-green-50"
                              onClick={() => unsuspendUser.mutate(u.userId)}
                              disabled={unsuspendUser.isPending}
                            >
                              <UserCheck size={13} className="mr-1" /> Unsuspend
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-red-600 hover:bg-red-50"
                              onClick={() => suspendUser.mutate(u.userId)}
                              disabled={suspendUser.isPending}
                            >
                              <UserX size={13} className="mr-1" /> Suspend
                            </Button>
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
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          Showing {filtered.length} of {users.length} users
        </p>
      )}
    </div>
  )
}
