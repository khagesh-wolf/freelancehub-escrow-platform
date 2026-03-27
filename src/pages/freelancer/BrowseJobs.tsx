import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Search, Filter, X, Clock, DollarSign, Users,
  Briefcase, ChevronDown, Send, AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { blink, tables } from '../../blink/client'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDate, parseJsonArray, truncate, generateId } from '../../lib/utils'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { createNotification } from '../../hooks/useNotifications'
import { JOB_CATEGORIES } from '../../types'
import type { Job, Proposal } from '../../types'

type SortOption = 'newest' | 'budget_high' | 'deadline'

interface ProposalModal {
  job: Job
}

export function BrowseJobs() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  // Filters
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [budgetType, setBudgetType] = useState<'all' | 'fixed' | 'hourly'>('all')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [sort, setSort] = useState<SortOption>('newest')
  const [showFilters, setShowFilters] = useState(false)

  // Proposal modal
  const [modal, setModal] = useState<ProposalModal | null>(null)
  const [coverLetter, setCoverLetter] = useState('')
  const [bidAmount, setBidAmount] = useState('')
  const [estimatedDays, setEstimatedDays] = useState('')

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['browse-jobs'],
    queryFn: async () => {
      const items = await tables.jobs.list({
        where: { status: 'open' },
        orderBy: { createdAt: 'desc' },
        limit: 100,
      })
      return items as Job[]
    },
  })

  const { data: myProposals = [] } = useQuery({
    queryKey: ['my-proposals', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      return await tables.proposals.list({ where: { userId: user.id } }) as Proposal[]
    },
    enabled: !!user?.id,
  })

  const appliedJobIds = useMemo(() =>
    new Set(myProposals.map(p => p.jobId)),
    [myProposals]
  )

  const filteredJobs = useMemo(() => {
    let list = [...jobs]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q) ||
        j.category.toLowerCase().includes(q)
      )
    }
    if (category) list = list.filter(j => j.category === category)
    if (budgetType !== 'all') list = list.filter(j => j.budgetType === budgetType)
    if (budgetMin) list = list.filter(j => j.budgetMax >= Number(budgetMin))
    if (budgetMax) list = list.filter(j => j.budgetMin <= Number(budgetMax))

    if (sort === 'newest') list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (sort === 'budget_high') list.sort((a, b) => b.budgetMax - a.budgetMax)
    if (sort === 'deadline') list.sort((a, b) => a.deadline.localeCompare(b.deadline))

    return list
  }, [jobs, search, category, budgetType, budgetMin, budgetMax, sort])

  function openProposalModal(job: Job) {
    if (!user) {
      toast.error('Please sign in to submit proposals')
      navigate({ to: '/auth/login' })
      return
    }
    if (profile?.role !== 'freelancer') {
      toast.error('Only freelancers can submit proposals')
      return
    }
    setModal({ job })
    setCoverLetter('')
    setBidAmount(String(job.budgetMin || ''))
    setEstimatedDays('')
  }

  function closeModal() {
    setModal(null)
    setCoverLetter('')
    setBidAmount('')
    setEstimatedDays('')
  }

  const submitProposal = useMutation({
    mutationFn: async () => {
      if (!modal || !user?.id) throw new Error('Not authenticated')
      if (!coverLetter.trim()) throw new Error('Cover letter is required')
      if (!bidAmount || Number(bidAmount) <= 0) throw new Error('Enter a valid bid amount')
      if (!estimatedDays || Number(estimatedDays) <= 0) throw new Error('Enter estimated delivery days')

      const proposalId = generateId()
      await tables.proposals.create({
        id: proposalId,
        userId: user.id,
        jobId: modal.job.id,
        clientId: modal.job.userId,
        coverLetter,
        bidAmount: Number(bidAmount),
        estimatedDays: Number(estimatedDays),
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      // Increment proposals count
      await tables.jobs.update(modal.job.id, {
        proposalsCount: (modal.job.proposalsCount || 0) + 1,
        updatedAt: new Date().toISOString(),
      })

      // Notify client
      await createNotification(
        modal.job.userId,
        'New Proposal Received',
        `You received a new proposal for "${modal.job.title}"`,
        'info',
        `/client/projects`
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-proposals', user?.id] })
      qc.invalidateQueries({ queryKey: ['browse-jobs'] })
      toast.success('Proposal submitted successfully!')
      closeModal()
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to submit proposal'),
  })

  function clearFilters() {
    setSearch('')
    setCategory('')
    setBudgetType('all')
    setBudgetMin('')
    setBudgetMax('')
    setSort('newest')
  }

  const hasActiveFilters = search || category || budgetType !== 'all' || budgetMin || budgetMax

  return (
    <div className="page-container pt-24">
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Browse Jobs</h1>
            <p className="text-muted-foreground mt-1">
              {isLoading ? 'Loading...' : `${filteredJobs.length} jobs available`}
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortOption)}
              className="px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="newest">Newest first</option>
              <option value="budget_high">Highest budget</option>
              <option value="deadline">Earliest deadline</option>
            </select>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                showFilters || hasActiveFilters
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-foreground hover:bg-muted/50'
              }`}
            >
              <Filter size={15} />
              Filters
              {hasActiveFilters && (
                <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  !
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs by title, description, or category..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="bg-card border border-border rounded-2xl p-4 mb-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Category</label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none pr-8"
                  >
                    <option value="">All Categories</option>
                    {JOB_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Budget Type</label>
                <div className="flex gap-1">
                  {(['all', 'fixed', 'hourly'] as const).map(bt => (
                    <button
                      key={bt}
                      onClick={() => setBudgetType(bt)}
                      className={`flex-1 py-2 text-xs rounded-lg border transition-colors font-medium capitalize ${
                        budgetType === bt
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {bt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Min Budget ($)</label>
                <input
                  type="number"
                  value={budgetMin}
                  onChange={e => setBudgetMin(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Max Budget ($)</label>
                <input
                  type="number"
                  value={budgetMax}
                  onChange={e => setBudgetMax(e.target.value)}
                  placeholder="Any"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={12} /> Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Jobs list */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-muted rounded w-1/2" />
                    <div className="h-4 bg-muted rounded w-full" />
                    <div className="h-4 bg-muted rounded w-3/4" />
                  </div>
                  <div className="h-8 bg-muted rounded-xl w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <Briefcase size={40} className="text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {hasActiveFilters ? 'No jobs match your filters' : 'No open jobs available'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {hasActiveFilters ? 'Try adjusting your search criteria' : 'Check back soon for new opportunities'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredJobs.map(job => {
              const hasApplied = appliedJobIds.has(job.id)
              const skills = parseJsonArray(job.skillsRequired)

              return (
                <div
                  key={job.id}
                  className="bg-card border border-border rounded-2xl p-5 card-hover"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Category + status */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                          {job.category}
                        </span>
                        <StatusBadge status={job.status} />
                        <span className="text-xs text-muted-foreground capitalize">
                          {job.budgetType} price
                        </span>
                      </div>

                      {/* Title */}
                      <h3
                        onClick={() => navigate({ to: '/jobs/$jobId', params: { jobId: job.id } })}
                        className="text-base font-semibold text-foreground hover:text-primary cursor-pointer transition-colors mb-2"
                      >
                        {job.title}
                      </h3>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground mb-3">
                        {truncate(job.description, 200)}
                      </p>

                      {/* Skills */}
                      {skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {skills.slice(0, 6).map(skill => (
                            <span
                              key={skill}
                              className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs"
                            >
                              {skill}
                            </span>
                          ))}
                          {skills.length > 6 && (
                            <span className="px-2 py-0.5 text-muted-foreground text-xs">
                              +{skills.length - 6} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DollarSign size={12} />
                          {formatCurrency(job.budgetMin)} – {formatCurrency(job.budgetMax)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          Due {formatDate(job.deadline)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {job.proposalsCount || 0} proposals
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-2">
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">
                          {job.budgetType === 'hourly'
                            ? `${formatCurrency(job.budgetMin)}/hr`
                            : formatCurrency(job.budgetMax)
                          }
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">{job.budgetType}</p>
                      </div>

                      {hasApplied ? (
                        <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl text-xs font-medium border border-green-200 dark:border-green-800">
                          <AlertCircle size={12} />
                          Applied
                        </span>
                      ) : (
                        <button
                          onClick={() => openProposalModal(job)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                          <Send size={14} />
                          Apply Now
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Proposal Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl animate-fade-in">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">Submit Proposal</h2>
                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                  {modal.job.title}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-5 space-y-4">
              {/* Budget info */}
              <div className="bg-muted/50 rounded-xl p-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Client's budget</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(modal.job.budgetMin)} – {formatCurrency(modal.job.budgetMax)}
                  {modal.job.budgetType === 'hourly' ? '/hr' : ''}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Cover Letter <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={coverLetter}
                  onChange={e => setCoverLetter(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm resize-none"
                  placeholder="Introduce yourself and explain why you're the best fit for this project..."
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground mt-1">{coverLetter.length}/2000</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Your Bid (USD) <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <input
                      type="number"
                      value={bidAmount}
                      onChange={e => setBidAmount(e.target.value)}
                      className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                      placeholder="500"
                      min="1"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Delivery (days) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    value={estimatedDays}
                    onChange={e => setEstimatedDays(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                    placeholder="14"
                    min="1"
                  />
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
              <button
                onClick={closeModal}
                className="px-4 py-2 border border-border text-foreground rounded-xl text-sm hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => submitProposal.mutate()}
                disabled={submitProposal.isPending}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {submitProposal.isPending
                  ? <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  : <Send size={14} />
                }
                Submit Proposal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
