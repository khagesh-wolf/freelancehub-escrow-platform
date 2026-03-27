import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Briefcase, Search, ExternalLink, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/shared/EmptyState'
import { tables } from '../../blink/client'
import { formatCurrency, formatDate } from '../../lib/utils'
import type { Job, UserProfile } from '../../types'

type StatusFilter = 'all' | 'open' | 'in_progress' | 'completed' | 'cancelled'

export function AdminJobsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['admin-all-jobs'],
    queryFn: async () => {
      const items = await tables.jobs.list({ orderBy: { createdAt: 'desc' }, limit: 200 })
      return items as Job[]
    },
  })

  const { data: userProfiles = [] } = useQuery({
    queryKey: ['admin-profiles-jobs'],
    queryFn: () => tables.userProfiles.list({ limit: 500 }) as Promise<UserProfile[]>,
  })

  const profileMap = Object.fromEntries(userProfiles.map(p => [p.userId, p]))

  const cancelJob = useMutation({
    mutationFn: async (jobId: string) => {
      await tables.jobs.update(jobId, { status: 'cancelled' })
    },
    onSuccess: () => { toast.success('Job cancelled'); qc.invalidateQueries({ queryKey: ['admin-all-jobs'] }) },
    onError: () => toast.error('Failed to cancel job'),
  })

  const filtered = jobs.filter(j => {
    const matchStatus = statusFilter === 'all' || j.status === statusFilter
    const matchSearch = !search ||
      j.title?.toLowerCase().includes(search.toLowerCase()) ||
      j.category?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const counts: Record<StatusFilter, number> = {
    all: jobs.length,
    open: jobs.filter(j => j.status === 'open').length,
    in_progress: jobs.filter(j => j.status === 'in_progress').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    cancelled: jobs.filter(j => j.status === 'cancelled').length,
  }

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Jobs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{jobs.length} total jobs</p>
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(counts) as [StatusFilter, number][]).map(([s, count]) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'gradient-amber text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')} ({count})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by title or category…"
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-16 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No jobs found"
          description="No jobs match the current filters."
        />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Budget</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Proposals</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Posted</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(job => {
                  const client = profileMap[job.userId]
                  const canCancel = job.status !== 'cancelled' && job.status !== 'completed'
                  return (
                    <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-foreground truncate max-w-[180px]">{job.title}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                        {client?.displayName || job.userId.slice(0, 10) + '…'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-muted-foreground">{job.category}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs font-medium text-foreground">
                          {formatCurrency(job.budgetMin)} – {formatCurrency(job.budgetMax)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                        {job.proposalsCount || 0}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-xs text-muted-foreground">
                        {formatDate(job.createdAt)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => navigate({ to: '/jobs/$jobId', params: { jobId: job.id } })}
                          >
                            <ExternalLink size={12} className="mr-1" /> View
                          </Button>
                          {canCancel && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-red-600 hover:bg-red-50"
                              onClick={() => {
                                if (confirm('Cancel this job?')) cancelJob.mutate(job.id)
                              }}
                              disabled={cancelJob.isPending}
                            >
                              <XCircle size={12} className="mr-1" /> Cancel
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
          <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground">
            Showing {filtered.length} of {jobs.length} jobs
          </div>
        </div>
      )}
    </div>
  )
}
