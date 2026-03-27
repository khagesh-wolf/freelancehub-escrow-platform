import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Briefcase,
  Search,
  Filter,
  RefreshCw,
  XCircle,
  CheckCircle,
  MoreHorizontal,
  DollarSign,
  FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { blink, tables } from '../../blink/client'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDate } from '../../lib/utils'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { AdminLayout } from '../../components/layout/AdminLayout'
import type { Job, UserProfile } from '../../types'

type StatusFilter = 'all' | 'open' | 'in_progress' | 'completed' | 'cancelled'

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All Jobs' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

export function AdminJobs() {
  const { profile: adminProfile } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  if (adminProfile && adminProfile.role !== 'admin') {
    navigate({ to: '/' })
    return null
  }

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['admin-jobs'],
    queryFn: () =>
      tables.jobs.list({
        orderBy: { createdAt: 'desc' },
        limit: 500,
      }) as Promise<Job[]>,
  })

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => tables.userProfiles.list({ limit: 500 }) as Promise<UserProfile[]>,
  })

  const userMap = new Map(users.map(u => [u.userId, u]))

  // ── Filters ────────────────────────────────────────────────────────────────
  const filtered = jobs.filter(j => {
    const matchesStatus = statusFilter === 'all' || j.status === statusFilter
    const q = search.toLowerCase()
    const poster = userMap.get(j.userId)
    const matchesSearch =
      !q ||
      j.title?.toLowerCase().includes(q) ||
      j.category?.toLowerCase().includes(q) ||
      poster?.displayName?.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  const statusCounts: Record<StatusFilter, number> = {
    all: jobs.length,
    open: jobs.filter(j => j.status === 'open').length,
    in_progress: jobs.filter(j => j.status === 'in_progress').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    cancelled: jobs.filter(j => j.status === 'cancelled').length,
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateJobStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Job['status'] }) => {
      await tables.jobs.update(id, {
        status,
        updatedAt: new Date().toISOString(),
      })
    },
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ['admin-jobs'] })
      toast.success(`Job ${status === 'cancelled' ? 'closed' : 'reopened'} successfully`)
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to update job'),
  })

  return (
    <AdminLayout active="/admin/jobs">
      <div className="page-container">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Briefcase size={22} className="text-primary" />
              Manage Jobs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {jobs.length} total jobs · Review, close, or reopen listings
            </p>
          </div>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['admin-jobs'] })}
            className="p-2 rounded-xl border border-border hover:bg-muted/50 transition-colors text-muted-foreground"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Stats chips */}
        <div className="flex flex-wrap gap-3 mb-5">
          {[
            { label: 'Open', count: statusCounts.open, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { label: 'In Progress', count: statusCounts.in_progress, color: 'bg-blue-50 text-blue-700 border-blue-200' },
            { label: 'Completed', count: statusCounts.completed, color: 'bg-gray-50 text-gray-700 border-gray-200' },
            { label: 'Cancelled', count: statusCounts.cancelled, color: 'bg-red-50 text-red-700 border-red-200' },
          ].map(s => (
            <div key={s.label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${s.color}`}>
              <span>{s.label}</span>
              <span className="font-bold">{s.count}</span>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by title, category, or poster…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
            />
          </div>

          <div className="flex items-center bg-muted/50 rounded-xl p-1 border border-border gap-0.5 overflow-x-auto">
            <Filter size={14} className="text-muted-foreground ml-2 mr-1 flex-shrink-0" />
            {STATUS_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  statusFilter === t.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-border">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 bg-muted rounded w-48" />
                    <div className="h-3 bg-muted rounded w-32" />
                  </div>
                  <div className="h-6 bg-muted rounded-full w-20" />
                  <div className="h-6 bg-muted rounded w-16" />
                  <div className="h-8 bg-muted rounded-lg w-24" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <FileText size={36} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No jobs found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search ? 'Try adjusting your search or filter' : 'No jobs in this status yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {['Title & Category', 'Posted By', 'Budget', 'Status', 'Proposals', 'Posted', 'Actions'].map(h => (
                      <th
                        key={h}
                        className={`px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide ${
                          h === 'Actions' || h === 'Proposals' || h === 'Budget'
                            ? 'text-right'
                            : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(j => {
                    const poster = userMap.get(j.userId)
                    const canClose = j.status === 'open' || j.status === 'in_progress'
                    const canReopen = j.status === 'cancelled'

                    return (
                      <tr
                        key={j.id}
                        className="border-b border-border hover:bg-muted/20 transition-colors"
                      >
                        {/* Title */}
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-medium text-foreground max-w-[220px] truncate">
                            {j.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{j.category}</p>
                        </td>

                        {/* Posted By */}
                        <td className="px-5 py-3.5 text-sm text-muted-foreground">
                          {poster?.displayName ?? (
                            <span className="text-xs font-mono">{j.userId.slice(0, 8)}…</span>
                          )}
                        </td>

                        {/* Budget */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1 text-sm font-medium text-foreground">
                            <DollarSign size={13} className="text-muted-foreground" />
                            {j.budgetType === 'fixed'
                              ? formatCurrency(j.budgetMax ?? j.budgetMin)
                              : `${formatCurrency(j.budgetMin)}–${formatCurrency(j.budgetMax)}/hr`}
                          </div>
                          <p className="text-xs text-muted-foreground text-right capitalize mt-0.5">
                            {j.budgetType}
                          </p>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <StatusBadge status={j.status} />
                        </td>

                        {/* Proposals */}
                        <td className="px-5 py-3.5 text-sm text-right font-semibold text-foreground">
                          {j.proposalsCount ?? 0}
                        </td>

                        {/* Date */}
                        <td className="px-5 py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(j.createdAt)}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            {canClose && (
                              <button
                                onClick={() =>
                                  updateJobStatus.mutate({ id: j.id, status: 'cancelled' })
                                }
                                disabled={updateJobStatus.isPending}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                              >
                                <XCircle size={13} /> Close
                              </button>
                            )}
                            {canReopen && (
                              <button
                                onClick={() =>
                                  updateJobStatus.mutate({ id: j.id, status: 'open' })
                                }
                                disabled={updateJobStatus.isPending}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                              >
                                <CheckCircle size={13} /> Reopen
                              </button>
                            )}
                            {!canClose && !canReopen && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <MoreHorizontal size={13} /> —
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

          {!isLoading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-border bg-muted/20">
              <p className="text-xs text-muted-foreground">
                Showing {filtered.length} of {jobs.length} jobs
              </p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
