import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Search, Briefcase, Clock, DollarSign, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { tables } from '../blink/client'
import { formatCurrency, parseJsonArray, timeAgo, CATEGORIES } from '../lib/utils'
import { StatusBadge } from '../components/ui/StatusBadge'
import type { Job } from '../types'

const PAGE_SIZE = 20

function JobCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-pulse">
      <div className="h-5 bg-muted rounded w-3/4 mb-3" />
      <div className="h-3 bg-muted rounded w-full mb-2" />
      <div className="h-3 bg-muted rounded w-2/3 mb-4" />
      <div className="flex gap-2">
        {[1, 2, 3].map(i => <div key={i} className="h-5 bg-muted rounded-full w-16" />)}
      </div>
    </div>
  )
}

export function BrowseJobsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [budgetType, setBudgetType] = useState('all')
  const [minBudget, setMinBudget] = useState('')
  const [maxBudget, setMaxBudget] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs', 'open'],
    queryFn: () => tables.jobs.list({ where: { status: 'open' }, limit: 500, orderBy: { createdAt: 'desc' } }),
  })

  const filtered = useMemo(() => {
    let list = [...(jobs as Job[])]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(j =>
        j.title?.toLowerCase().includes(q) ||
        j.description?.toLowerCase().includes(q) ||
        parseJsonArray(j.skillsRequired).some(s => s.toLowerCase().includes(q))
      )
    }
    if (category !== 'all') list = list.filter(j => j.category === category)
    if (budgetType !== 'all') list = list.filter(j => j.budgetType === budgetType)
    if (minBudget) list = list.filter(j => j.budgetMax >= Number(minBudget))
    if (maxBudget) list = list.filter(j => j.budgetMin <= Number(maxBudget))
    list.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (sortBy === 'budget_high') return b.budgetMax - a.budgetMax
      if (sortBy === 'budget_low') return a.budgetMin - b.budgetMin
      return 0
    })
    return list
  }, [jobs, search, category, budgetType, minBudget, maxBudget, sortBy])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const hasFilters = search || category !== 'all' || budgetType !== 'all' || minBudget || maxBudget

  return (
    <div className="page-container pt-24 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Browse Jobs</h1>
        <p className="text-muted-foreground">Find your next freelance opportunity</p>
      </div>

      {/* Search + controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onValueChange={v => { if (v) { setSortBy(v); setPage(1) } }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="budget_high">Highest Budget</SelectItem>
            <SelectItem value="budget_low">Lowest Budget</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setFiltersOpen(!filtersOpen)} className="gap-2">
          <Filter size={16} /> Filters
          {hasFilters && <span className="w-2 h-2 rounded-full bg-accent" />}
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => {
            setSearch(''); setCategory('all'); setBudgetType('all')
            setMinBudget(''); setMaxBudget(''); setPage(1)
          }} className="text-muted-foreground gap-1">
            <X size={14} /> Clear
          </Button>
        )}
      </div>

      {/* Filters */}
      {filtersOpen && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
            <Select value={category} onValueChange={v => { if (v) { setCategory(v); setPage(1) } }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Budget Type</label>
            <Select value={budgetType} onValueChange={v => { if (v) { setBudgetType(v); setPage(1) } }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                <SelectItem value="fixed">Fixed Price</SelectItem>
                <SelectItem value="hourly">Hourly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Min Budget ($)</label>
            <Input type="number" placeholder="e.g. 500" value={minBudget} onChange={e => { setMinBudget(e.target.value); setPage(1) }} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Max Budget ($)</label>
            <Input type="number" placeholder="e.g. 5000" value={maxBudget} onChange={e => { setMaxBudget(e.target.value); setPage(1) }} />
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground mb-5">
        {isLoading ? 'Loading...' : `${filtered.length} open jobs`}
      </p>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => <JobCardSkeleton key={i} />)}
        </div>
      ) : paginated.length === 0 ? (
        <div className="text-center py-16">
          <Briefcase size={48} className="text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No jobs found</h3>
          <p className="text-muted-foreground text-sm">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginated.map(job => {
            const skills = parseJsonArray(job.skillsRequired)
            return (
              <div key={job.id} className="bg-card border border-border rounded-xl p-5 card-hover">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground text-lg">{job.title}</h3>
                      <StatusBadge status={job.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      {job.category} • Posted {timeAgo(job.createdAt)}
                    </p>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{job.description}</p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {skills.slice(0, 5).map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <DollarSign size={13} />
                        {job.budgetType === 'fixed'
                          ? `${formatCurrency(job.budgetMin)} – ${formatCurrency(job.budgetMax)}`
                          : `${formatCurrency(job.budgetMin)}/hr – ${formatCurrency(job.budgetMax)}/hr`}
                        <Badge variant="outline" className="text-xs ml-1">{job.budgetType}</Badge>
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase size={13} />
                        {job.proposalsCount || 0} proposals
                      </span>
                      {job.deadline && (
                        <span className="flex items-center gap-1">
                          <Clock size={13} />
                          Due {new Date(job.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    className="gradient-amber border-0 text-white hover:opacity-90 shrink-0"
                    onClick={() => navigate({ to: '/jobs/$jobId', params: { jobId: job.id } })}
                  >
                    View Job
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-10">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  )
}
