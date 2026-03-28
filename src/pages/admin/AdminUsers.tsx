import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Search,
  Users,
  ShieldCheck,
  ShieldOff,
  CheckCircle2,
  Clock,
  Filter,
  UserX,
  UserCheck,
} from 'lucide-react'
import { AdminLayout } from './AdminLayout'
import { tables } from '@/blink/client'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import type { UserProfile } from '@/types'

type RoleFilter = 'all' | 'client' | 'freelancer' | 'admin'

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    admin: 'bg-purple-50 text-purple-700 border-purple-200',
    client: 'bg-blue-50 text-blue-700 border-blue-200',
    freelancer: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${map[role] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {role}
    </span>
  )
}

function StatusBadge({ isApproved, isSuspended }: { isApproved: string; isSuspended: string }) {
  if (isSuspended === '1') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-red-50 text-red-700 border-red-200">
        <ShieldOff size={10} />
        Suspended
      </span>
    )
  }
  if (isApproved === '1') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">
        <CheckCircle2 size={10} />
        Active
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200">
      <Clock size={10} />
      Pending
    </span>
  )
}

export function AdminUsers() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')

  const { data: users = [], isLoading } = useQuery<UserProfile[]>({
    queryKey: ['admin-users-full'],
    queryFn: () => tables.userProfiles.list({ orderBy: { createdAt: 'desc' }, limit: 200 }) as Promise<UserProfile[]>,
  })

  const suspendMutation = useMutation({
    mutationFn: async ({ id, suspend }: { id: string; suspend: boolean }) => {
      await tables.userProfiles.update(id, { isSuspended: suspend ? '1' : '0' })
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-full'] })
      toast.success(vars.suspend ? 'User suspended' : 'User unsuspended')
    },
    onError: () => toast.error('Action failed'),
  })

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await tables.userProfiles.update(id, { isApproved: '1' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-full'] })
      toast.success('User approved')
    },
    onError: () => toast.error('Failed to approve user'),
  })

  const filtered = users.filter(u => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    const matchesSearch = !search || u.displayName?.toLowerCase().includes(search.toLowerCase())
    return matchesRole && matchesSearch
  })

  const counts = {
    all: users.length,
    client: users.filter(u => u.role === 'client').length,
    freelancer: users.filter(u => u.role === 'freelancer').length,
    admin: users.filter(u => u.role === 'admin').length,
  }

  const roleFilters: { value: RoleFilter; label: string }[] = [
    { value: 'all', label: `All (${counts.all})` },
    { value: 'client', label: `Clients (${counts.client})` },
    { value: 'freelancer', label: `Freelancers (${counts.freelancer})` },
    { value: 'admin', label: `Admins (${counts.admin})` },
  ]

  return (
    <AdminLayout title="User Management" subtitle="Manage platform users, approve accounts, and moderate access">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,16%,55%)]" />
          <input
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-[hsl(214,32%,91%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-[hsl(215,28%,17%)] placeholder:text-[hsl(215,16%,60%)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-[hsl(215,16%,55%)]" />
          <div className="flex bg-white border border-[hsl(214,32%,91%)] rounded-lg overflow-hidden">
            {roleFilters.map(f => (
              <button
                key={f.value}
                onClick={() => setRoleFilter(f.value)}
                className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  roleFilter === f.value
                    ? 'bg-[hsl(215,42%,12%)] text-white'
                    : 'text-[hsl(215,16%,47%)] hover:bg-[hsl(210,40%,97%)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[hsl(214,32%,91%)] shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-[3px] border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users size={36} className="text-[hsl(215,16%,75%)] mb-3" />
            <p className="font-medium text-[hsl(215,28%,17%)]">No users found</p>
            <p className="text-sm text-[hsl(215,16%,55%)] mt-1">Try adjusting your search or filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[hsl(210,40%,98%)] border-b border-[hsl(214,32%,91%)]">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">User</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Role</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Joined</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(214,32%,93%)]">
                {filtered.map((user, i) => (
                  <tr
                    key={user.id}
                    className={`hover:bg-[hsl(210,40%,98.5%)] transition-colors ${i % 2 !== 0 ? 'bg-[hsl(210,40%,99.5%)]' : ''}`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center bg-[hsl(215,42%,12%)] text-white text-sm font-semibold">
                          {user.displayName?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <p className="font-medium text-[hsl(215,28%,17%)]">{user.displayName ?? '—'}</p>
                          <p className="text-xs text-[hsl(215,16%,55%)]">ID: {user.id.slice(-8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge isApproved={user.isApproved} isSuspended={user.isSuspended} />
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[hsl(215,16%,55%)] whitespace-nowrap">
                      {user.createdAt ? format(new Date(user.createdAt), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        {user.isApproved !== '1' && user.isSuspended !== '1' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400"
                            onClick={() => approveMutation.mutate(user.id)}
                            disabled={approveMutation.isPending}
                          >
                            <UserCheck size={13} />
                            Approve
                          </Button>
                        )}
                        {user.isSuspended === '1' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                            onClick={() => suspendMutation.mutate({ id: user.id, suspend: false })}
                            disabled={suspendMutation.isPending}
                          >
                            <ShieldCheck size={13} />
                            Unsuspend
                          </Button>
                        ) : (
                          user.role !== 'admin' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50"
                              onClick={() => suspendMutation.mutate({ id: user.id, suspend: true })}
                              disabled={suspendMutation.isPending}
                            >
                              <UserX size={13} />
                              Suspend
                            </Button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-[hsl(214,32%,91%)] bg-[hsl(210,40%,98.5%)]">
              <p className="text-xs text-[hsl(215,16%,55%)]">
                Showing {filtered.length} of {users.length} users
              </p>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
