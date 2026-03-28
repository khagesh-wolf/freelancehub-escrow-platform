import { useState, useMemo } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Search, Briefcase, DollarSign, Clock, Users,
  ChevronRight, Calendar, X, SlidersHorizontal, Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { tables } from '../blink/client'
import { JOB_CATEGORIES } from '../types'
import { formatCurrency, formatRelativeTime, safeParseJSON } from '@/lib/utils'
import type { Job } from '../types'

const PAGE_SIZE = 15

// ─── Skill / Category Badge ───────────────────────────────────────────────────
function CategoryBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
      <Tag size={10} />
      {label}
    </span>
  )
}

function SkillBadge({ skill }: { skill: string }) {
  return (
    <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs">
      {skill}
    </span>
  )
}

function StatusBadge({ status }: { status: Job['status'] }) {
  const map: Record<Job['status'], string> = {
    open: 'bg-emerald-100 text-emerald-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[status]}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function JobCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="h-5 bg-muted rounded w-2/3" />
        <div className="h-5 bg-muted rounded-full w-14" />
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-3/4" />
      </div>
      <div className="flex gap-2 mb-4">
        {[1, 2].map(i => <div key={i} className="h-5 bg-muted rounded-full w-16" />)}
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex gap-4">
          <div className="h-4 bg-muted rounded w-20" />
          <div className="h-4 bg-muted rounded w-20" />
        </div>
        <div className="h-8 bg-muted rounded w-28" />
      </div>
    </div>
  )
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ job }: { job: Job }) {
  const navigate = useNavigate()
  const skills = safeParseJSON<string[]>(job.skillsRequired, [])
  const displaySkills = skills.slice(0, 3)

  const budgetLabel =
    job.budgetType === 'fixed'
      ? `${formatCurrency(Number(job.budgetMin))}${job.budgetMax && Number(job.budgetMax) !== Number(job.budgetMin) ? ` – ${formatCurrency(Number(job.budgetMax))}` : ''}`
      : `${formatCurrency(Number(job.budgetMin))}${job.budgetMax && Number(job.budgetMax) !== Number(job.budgetMin) ? ` – ${formatCurrency(Number(job.budgetMax))}` : ''}/hr`

  const snippet =
    job.description.length > 160
      ? job.description.slice(0, 160) + '…'
      : job.description

  return (
    <article
      className="bg-card border border-border rounded-xl p-5 card-hover cursor-pointer"
      onClick={() => navigate({ to: '/jobs/$jobId', params: { jobId: job.id } as any })}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold text-foreground leading-snug hover:text-accent transition-colors line-clamp-2">
          {job.title}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={job.status} />
        </div>
      </div>

      {/* Category + budget type */}
      <div className="flex flex-wrap gap-2 mb-3">
        <CategoryBadge label={job.category} />
        <span className="px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs capitalize">
          {job.budgetType}
        </span>
      </div>

      {/* Description snippet */}
      <p className="text-sm text-muted-foreground leading-relaxed mb-3">{snippet}</p>

      {/* Skills */}
      {displaySkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {displaySkills.map(s => <SkillBadge key={s} skill={s} />)}
          {skills.length > 3 && (
            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">
              +{skills.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <DollarSign size={12} className="text-accent" />
            {budgetLabel}
          </span>
          {job.deadline && (
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              Due {new Date(job.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users size={12} />
            {Number(job.proposalsCount) || 0} proposal{Number(job.proposalsCount) !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {formatRelativeTime(job.createdAt)}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-8 shrink-0"
          onClick={e => {
          e.stopPropagation()
          navigate({ to: '/jobs/$jobId', params: { jobId: job.id } as any })
          }}
        >
          View Details <ChevronRight size={13} />
        </Button>
      </div>
    </article>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="text-center py-24">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
        <Briefcase size={28} className="text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">No jobs found</h3>
      <p className="text-muted-foreground text-sm max-w-xs mx-auto">
        Try adjusting your filters or check back later for new opportunities.
      </p>
    </div>
  )
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────
interface JobFilters {
  search: string
  category: string
  budgetType: string
  minBudget: string
  maxBudget: string
  status: string
}

function FilterBar({
  filters,
  onChange,
  onReset,
}: {
  filters: JobFilters
  onChange: (key: keyof JobFilters, value: string) => void
  onReset: () => void
}) {
  const hasActive = Object.values(filters).some(v => v !== '')

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-4">
      {/* Search row */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search jobs by title or keyword..."
            value={filters.search}
            onChange={e => onChange('search', e.target.value)}
            className="w-full pl-9 pr-9 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {filters.search && (
            <button
              onClick={() => onChange('search', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {hasActive && (
          <Button variant="outline" size="sm" onClick={onReset} className="shrink-0">
            <X size={14} /> Clear
          </Button>
        )}
      </div>

      {/* Filter controls */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Filters:</span>
        </div>

        {/* Category */}
        <select
          value={filters.category}
          onChange={e => onChange('category', e.target.value)}
          className="text-xs bg-background border border-input rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Categories</option>
          {JOB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Budget Type */}
        <select
          value={filters.budgetType}
          onChange={e => onChange('budgetType', e.target.value)}
          className="text-xs bg-background border border-input rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Any Budget Type</option>
          <option value="fixed">Fixed Price</option>
          <option value="hourly">Hourly Rate</option>
        </select>

        {/* Budget range */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Budget:</span>
          <input
            type="number"
            placeholder="Min"
            value={filters.minBudget}
            onChange={e => onChange('minBudget', e.target.value)}
            className="w-20 text-xs bg-background border border-input rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.maxBudget}
            onChange={e => onChange('maxBudget', e.target.value)}
            className="w-20 text-xs bg-background border border-input rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Status */}
        <select
          value={filters.status}
          onChange={e => onChange('status', e.target.value)}
          className="text-xs bg-background border border-input rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function BrowseJobsPage() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<JobFilters>({
    search: '',
    category: '',
    budgetType: '',
    minBudget: '',
    maxBudget: '',
    status: '',
  })

  const handleFilterChange = (key: keyof JobFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const resetFilters = () => {
    setFilters({ search: '', category: '', budgetType: '', minBudget: '', maxBudget: '', status: '' })
    setPage(1)
  }

  const { data: rawJobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => tables.jobs.list({ limit: 500, orderBy: { createdAt: 'desc' } }),
  })

  // Client-side filtering
  const filtered = useMemo(() => {
    return (rawJobs as Job[]).filter(job => {
      const skills = safeParseJSON<string[]>(job.skillsRequired, [])

      if (filters.search) {
        const q = filters.search.toLowerCase()
        const matchTitle = job.title.toLowerCase().includes(q)
        const matchDesc = job.description.toLowerCase().includes(q)
        const matchSkill = skills.some(s => s.toLowerCase().includes(q))
        if (!matchTitle && !matchDesc && !matchSkill) return false
      }
      if (filters.category && job.category !== filters.category) return false
      if (filters.budgetType && job.budgetType !== filters.budgetType) return false
      if (filters.status && job.status !== filters.status) return false
      if (filters.minBudget && Number(job.budgetMin) < Number(filters.minBudget)) return false
      if (filters.maxBudget && Number(job.budgetMax) > Number(filters.maxBudget)) return false
      return true
    })
  }, [rawJobs, filters])

  const paginated = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = page * PAGE_SIZE < filtered.length

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight size={14} />
          <span className="text-foreground">Browse Jobs</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Browse Jobs</h1>
            <p className="text-muted-foreground mt-1">
              Discover projects from clients looking for skilled freelancers
            </p>
          </div>
          {!isLoading && (
            <span className="text-sm text-muted-foreground shrink-0">
              {filtered.length} job{filtered.length !== 1 ? 's' : ''} found
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <FilterBar filters={filters} onChange={handleFilterChange} onReset={resetFilters} />

      {/* List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <JobCardSkeleton key={i} />)}
        </div>
      ) : paginated.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="space-y-4">
            {paginated.map(job => <JobCard key={job.id} job={job} />)}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="text-center mt-10">
              <Button
                variant="outline"
                onClick={() => setPage(p => p + 1)}
                className="min-w-[160px]"
              >
                Load More
                <span className="ml-2 text-xs text-muted-foreground">
                  ({paginated.length}/{filtered.length})
                </span>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
