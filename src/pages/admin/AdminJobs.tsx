import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Briefcase, Filter } from 'lucide-react'
import { AdminLayout } from './AdminLayout'
import { tables } from '@/blink/client'
import { format } from 'date-fns'
import type { Job } from '@/types'

type StatusFilter = 'all' | 'open' | 'in_progress' | 'completed' | 'cancelled'

function JobStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-gray-50 text-gray-600 border-gray-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
  }
  const label: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {label[status] ?? status}
    </span>
  )
}

export function AdminJobs() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ['admin-jobs-full'],
    queryFn: () => tables.jobs.list({ orderBy: { createdAt: 'desc' }, limit: 300 }) as Promise<Job[]>,
  })

  const filtered = jobs.filter(j => {
    const matchesStatus = statusFilter === 'all' || j.status === statusFilter
    const matchesSearch = !search || j.title?.toLowerCase().includes(search.toLowerCase()) || j.category?.toLowerCase().includes(search.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const counts: Record<StatusFilter, number> = {
    all: jobs.length,
    open: jobs.filter(j => j.status === 'open').length,
    in_progress: jobs.filter(j => j.status === 'in_progress').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    cancelled: jobs.filter(j => j.status === 'cancelled').length,
  }

  const filterOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: `All (${counts.all})` },
    { value: 'open', label: `Open (${counts.open})` },
    { value: 'in_progress', label: `In Progress (${counts.in_progress})` },
    { value: 'completed', label: `Completed (${counts.completed})` },
    { value: 'cancelled', label: `Cancelled (${counts.cancelled})` },
  ]

  return (
    <AdminLayout title="Job Management" subtitle="Monitor all jobs posted on the platform">
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,16%,55%)]" />
          <input
            type="text"
            placeholder="Search by title or category…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-[hsl(214,32%,91%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-[hsl(215,28%,17%)] placeholder:text-[hsl(215,16%,60%)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-[hsl(215,16%,55%)]" />
          <div className="flex bg-white border border-[hsl(214,32%,91%)] rounded-lg overflow-hidden">
            {filterOptions.map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === f.value
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

      <div className="bg-white rounded-xl border border-[hsl(214,32%,91%)] shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-[3px] border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Briefcase size={36} className="text-[hsl(215,16%,75%)] mb-3" />
            <p className="font-medium text-[hsl(215,28%,17%)]">No jobs found</p>
            <p className="text-sm text-[hsl(215,16%,55%)] mt-1">Try adjusting your search or filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[hsl(210,40%,98%)] border-b border-[hsl(214,32%,91%)]">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Title</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Category</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Proposals</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Posted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(214,32%,93%)]">
                {filtered.map((j, i) => (
                  <tr key={j.id} className={`hover:bg-[hsl(210,40%,98.5%)] transition-colors ${i % 2 !== 0 ? 'bg-[hsl(210,40%,99.5%)]' : ''}`}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-[hsl(215,28%,17%)] max-w-[220px] truncate">{j.title}</p>
                      <p className="text-[10px] text-[hsl(215,16%,55%)] mt-0.5">ID: {j.id.slice(-8)}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[hsl(215,42%,95%)] text-[hsl(215,42%,35%)]">
                        {j.category ?? '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-[hsl(215,28%,17%)]">
                      {Number(j.proposalsCount ?? 0)}
                    </td>
                    <td className="px-5 py-3.5"><JobStatusBadge status={j.status} /></td>
                    <td className="px-5 py-3.5 text-xs text-[hsl(215,16%,55%)] whitespace-nowrap">
                      {j.createdAt ? format(new Date(j.createdAt), 'MMM d, yyyy') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-[hsl(214,32%,91%)] bg-[hsl(210,40%,98.5%)]">
              <p className="text-xs text-[hsl(215,16%,55%)]">Showing {filtered.length} of {jobs.length} jobs</p>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
