import { useState, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Search, Filter, Clock, DollarSign, ChevronDown,
  Briefcase, CheckCircle2, Send, X, SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import { tables } from '@/blink/client'
import { formatCurrency, formatRelativeTime, safeParseJSON } from '@/lib/utils'
import type { Job, Proposal } from '@/types'
import { JOB_CATEGORIES } from '@/types'
import { toast } from 'sonner'

const PAGE_SIZE = 10

interface ApplyDialogState {
  open: boolean
  job: Job | null
}

export function FreelancerBrowseJobs() {
  const { user, profile, isLoading } = useAuth()
  const navigate = useNavigate()

  const [jobs, setJobs] = useState<Job[]>([])
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set())
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Filters
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [budgetType, setBudgetType] = useState('')
  const [minBudget, setMinBudget] = useState('')
  const [maxBudget, setMaxBudget] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Proposal dialog
  const [dialog, setDialog] = useState<ApplyDialogState>({ open: false, job: null })
  const [coverLetter, setCoverLetter] = useState('')
  const [bidAmount, setBidAmount] = useState('')
  const [estimatedDays, setEstimatedDays] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) navigate({ to: '/auth/login' })
    if (!isLoading && profile && profile.role !== 'freelancer') navigate({ to: '/client/dashboard' })
  }, [isLoading, user, profile])

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  async function loadData() {
    if (!user) return
    setLoadingJobs(true)
    try {
      const [jobsData, proposalsData] = await Promise.all([
        tables.jobs.list({ where: { status: 'open' }, orderBy: { createdAt: 'desc' }, limit: 100 }),
        tables.proposals.list({ where: { userId: user.id } }),
      ])
      setJobs(jobsData as Job[])
      const applied = new Set((proposalsData as Proposal[]).map(p => p.jobId))
      setAppliedJobIds(applied)
    } catch {
      // silently fail
    } finally {
      setLoadingJobs(false)
    }
  }

  const filtered = jobs.filter(j => {
    const skills = safeParseJSON<string[]>(j.skillsRequired, [])
    const matchSearch = !search ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.description.toLowerCase().includes(search.toLowerCase()) ||
      skills.some(s => s.toLowerCase().includes(search.toLowerCase()))
    const matchCat = !selectedCategory || j.category === selectedCategory
    const matchBudgetType = !budgetType || j.budgetType === budgetType
    const min = minBudget ? Number(minBudget) : null
    const max = maxBudget ? Number(maxBudget) : null
    const matchMin = !min || Number(j.budgetMax) >= min
    const matchMax = !max || Number(j.budgetMin) <= max
    return matchSearch && matchCat && matchBudgetType && matchMin && matchMax
  })

  const visible = filtered.slice(0, visibleCount)
  const hasMore = filtered.length > visibleCount

  function openApplyDialog(job: Job, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setCoverLetter('')
    setBidAmount(String(Math.round((Number(job.budgetMin) + Number(job.budgetMax)) / 2) || Number(job.budgetMax)))
    setEstimatedDays('')
    setDialog({ open: true, job })
  }

  async function submitProposal() {
    if (!user || !dialog.job) return
    if (!coverLetter.trim()) { toast.error('Cover letter is required'); return }
    if (!bidAmount || Number(bidAmount) <= 0) { toast.error('Enter a valid bid amount'); return }
    if (!estimatedDays || Number(estimatedDays) <= 0) { toast.error('Enter estimated days'); return }

    setSubmitting(true)
    try {
      await tables.proposals.create({
        userId: user.id,
        jobId: dialog.job.id,
        clientId: dialog.job.userId,
        coverLetter: coverLetter.trim(),
        bidAmount: Number(bidAmount),
        estimatedDays: Number(estimatedDays),
        status: 'pending',
      })
      setAppliedJobIds(prev => new Set([...prev, dialog.job!.id]))
      setDialog({ open: false, job: null })
      toast.success('Proposal submitted!', { description: 'The client will review your proposal.' })
    } catch {
      toast.error('Failed to submit proposal', { description: 'Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const hasActiveFilters = !!selectedCategory || !!budgetType || !!minBudget || !!maxBudget

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-1">Browse Jobs</h1>
        <p className="text-muted-foreground">Find your next freelance opportunity</p>
      </div>

      {/* Search + Filter Bar */}
      <div className="mb-6 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-2xl">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search jobs, skills, keywords..."
              value={search}
              onChange={e => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE) }}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(v => !v)}
            className={hasActiveFilters ? 'border-primary text-primary' : ''}
          >
            <SlidersHorizontal size={15} className="mr-1.5" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 w-4 h-4 rounded-full gradient-amber text-white text-[10px] flex items-center justify-center font-bold">
                {[selectedCategory, budgetType, minBudget, maxBudget].filter(Boolean).length}
              </span>
            )}
          </Button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={13} className="text-muted-foreground" />
          {['', ...JOB_CATEGORIES].map(cat => (
            <button
              key={cat}
              className={`px-3 py-1 rounded-full text-xs border transition-all font-medium ${
                selectedCategory === cat
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground bg-card hover:border-muted-foreground'
              }`}
              onClick={() => { setSelectedCategory(cat); setVisibleCount(PAGE_SIZE) }}
            >
              {cat === '' ? 'All' : cat.replace(' Development', ' Dev').replace(' & ', ' ')}
            </button>
          ))}
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="bg-card border border-border rounded-xl p-4 animate-fade-in">
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Budget Type</label>
                <div className="flex gap-2">
                  {[{ val: '', label: 'All' }, { val: 'fixed', label: 'Fixed' }, { val: 'hourly', label: 'Hourly' }].map(opt => (
                    <button
                      key={opt.val}
                      className={`flex-1 py-1.5 rounded-lg text-xs border font-medium transition-colors ${
                        budgetType === opt.val
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground hover:text-foreground bg-background'
                      }`}
                      onClick={() => setBudgetType(opt.val)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Min Budget ($)</label>
                <Input
                  type="number"
                  placeholder="e.g. 100"
                  value={minBudget}
                  onChange={e => setMinBudget(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Max Budget ($)</label>
                <Input
                  type="number"
                  placeholder="e.g. 5000"
                  value={maxBudget}
                  onChange={e => setMaxBudget(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-muted-foreground h-7"
                onClick={() => { setSelectedCategory(''); setBudgetType(''); setMinBudget(''); setMaxBudget('') }}
              >
                <X size={13} className="mr-1" /> Clear All Filters
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Results Count */}
      {!loadingJobs && (
        <p className="text-sm text-muted-foreground mb-4">
          {filtered.length} job{filtered.length !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Job Cards */}
      {loadingJobs ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-40 bg-muted/60 border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-foreground mb-2">No jobs found</h3>
          <p className="text-muted-foreground mb-6">Try adjusting your search or filters</p>
          <Button variant="outline" onClick={() => {
            setSearch(''); setSelectedCategory(''); setBudgetType(''); setMinBudget(''); setMaxBudget('')
          }}>
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map(job => {
            const skills = safeParseJSON<string[]>(job.skillsRequired, [])
            const isApplied = appliedJobIds.has(job.id)
            const budgetDisplay = job.budgetType === 'fixed'
              ? formatCurrency(Number(job.budgetMax))
              : `${formatCurrency(Number(job.budgetMin))} – ${formatCurrency(Number(job.budgetMax))}/hr`

            return (
              <div
                key={job.id}
                className="bg-card border border-border rounded-xl p-6 card-hover cursor-pointer"
                onClick={() => navigate({ to: '/freelancer/jobs/$jobId', params: { jobId: job.id } })}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-base font-semibold text-foreground">{job.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        job.budgetType === 'fixed'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {job.budgetType === 'fixed' ? 'Fixed' : 'Hourly'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-2">
                    <div className="text-lg font-bold text-foreground">{budgetDisplay}</div>
                    {isApplied ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={13} /> Applied
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        className="h-8 gradient-amber text-white border-0"
                        onClick={e => openApplyDialog(job, e)}
                      >
                        <Send size={13} className="mr-1.5" /> Apply
                      </Button>
                    )}
                  </div>
                </div>

                {/* Skills */}
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {skills.slice(0, 5).map(s => (
                      <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                    {skills.length > 5 && (
                      <Badge variant="outline" className="text-xs">+{skills.length - 5} more</Badge>
                    )}
                  </div>
                )}

                {/* Meta */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <Clock size={11} /> {formatRelativeTime(job.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign size={11} /> {job.proposalsCount || 0} proposals
                  </span>
                  {job.deadline && (
                    <span className="flex items-center gap-1">
                      <Briefcase size={11} /> Due {new Date(job.deadline).toLocaleDateString()}
                    </span>
                  )}
                  <Badge variant="outline" className="text-xs">{job.category}</Badge>
                </div>
              </div>
            )
          })}

          {/* Load More */}
          {hasMore && (
            <div className="text-center pt-2">
              <Button
                variant="outline"
                onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
              >
                Load More <ChevronDown size={15} className="ml-1.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Apply Proposal Dialog */}
      <Dialog open={dialog.open} onOpenChange={open => !submitting && setDialog({ open, job: dialog.job })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Proposal</DialogTitle>
          </DialogHeader>

          {dialog.job && (
            <div className="space-y-4 py-1">
              {/* Job Summary */}
              <div className="bg-muted/40 rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-foreground line-clamp-1">{dialog.job.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Budget: {dialog.job.budgetType === 'fixed'
                    ? formatCurrency(Number(dialog.job.budgetMax))
                    : `${formatCurrency(Number(dialog.job.budgetMin))} – ${formatCurrency(Number(dialog.job.budgetMax))}/hr`}
                </p>
              </div>

              {/* Bid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Your Bid Amount ($) *
                  </label>
                  <Input
                    type="number"
                    placeholder="e.g. 500"
                    value={bidAmount}
                    onChange={e => setBidAmount(e.target.value)}
                    min={1}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Estimated Days *
                  </label>
                  <Input
                    type="number"
                    placeholder="e.g. 7"
                    value={estimatedDays}
                    onChange={e => setEstimatedDays(e.target.value)}
                    min={1}
                  />
                </div>
              </div>

              {/* Cover Letter */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Cover Letter *
                </label>
                <Textarea
                  placeholder="Introduce yourself, explain your approach and why you're the best fit..."
                  value={coverLetter}
                  onChange={e => setCoverLetter(e.target.value)}
                  rows={6}
                  className="resize-none text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">{coverLetter.length} characters</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialog({ open: false, job: null })} disabled={submitting}>
              Cancel
            </Button>
            <Button
              className="gradient-amber text-white border-0"
              onClick={submitProposal}
              disabled={submitting}
            >
              {submitting ? (
                <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Submitting...</>
              ) : (
                <><Send size={14} className="mr-1.5" />Submit Proposal</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
