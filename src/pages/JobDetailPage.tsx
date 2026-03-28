import { useState } from 'react'
import { useParams, useNavigate, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Briefcase, DollarSign, Calendar, Users, Clock,
  ChevronRight, Tag, ArrowLeft, Send, AlertCircle, CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { tables } from '../blink/client'
import { useAuth } from '../hooks/useAuth'
import { blink } from '../blink/client'
import { formatCurrency, formatDate, formatRelativeTime, safeParseJSON } from '@/lib/utils'
import type { Job } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function SkillBadge({ skill }: { skill: string }) {
  return (
    <span className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-sm">
      {skill}
    </span>
  )
}

function StatusBadge({ status }: { status: Job['status'] }) {
  const map: Record<Job['status'], string> = {
    open: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
    completed: 'bg-gray-100 text-gray-600 border-gray-200',
    cancelled: 'bg-red-100 text-red-700 border-red-200',
  }
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize border ${map[status]}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function JobDetailSkeleton() {
  return (
    <div className="page-container animate-pulse">
      <div className="h-4 bg-muted rounded w-48 mb-6" />
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="h-8 bg-muted rounded w-3/4 mb-4" />
            <div className="flex gap-3 mb-6">
              <div className="h-6 bg-muted rounded-full w-24" />
              <div className="h-6 bg-muted rounded-full w-20" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-4 bg-muted rounded" />)}
              <div className="h-4 bg-muted rounded w-2/3" />
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 h-48" />
          <div className="bg-card border border-border rounded-xl p-5 h-32" />
        </div>
      </div>
    </div>
  )
}

// ─── Proposal Form Dialog ─────────────────────────────────────────────────────
interface ProposalFormProps {
  open: boolean
  onClose: () => void
  job: Job
  userId: string
}

function ProposalFormDialog({ open, onClose, job, userId }: ProposalFormProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    coverLetter: '',
    bidAmount: job.budgetMin ? String(Number(job.budgetMin)) : '',
    estimatedDays: '',
  })
  const [submitted, setSubmitted] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.coverLetter.trim()) throw new Error('Cover letter is required')
      if (!form.bidAmount || Number(form.bidAmount) <= 0) throw new Error('Valid bid amount required')
      if (!form.estimatedDays || Number(form.estimatedDays) <= 0) throw new Error('Estimated days required')

      await tables.proposals.create({
        id: crypto.randomUUID(),
        userId,
        jobId: job.id,
        clientId: job.userId,
        coverLetter: form.coverLetter.trim(),
        bidAmount: Number(form.bidAmount),
        estimatedDays: Number(form.estimatedDays),
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      // Increment proposals count
      await tables.jobs.update(job.id, {
        proposalsCount: (Number(job.proposalsCount) || 0) + 1,
        updatedAt: new Date().toISOString(),
      })
    },
    onSuccess: () => {
      setSubmitted(true)
      queryClient.invalidateQueries({ queryKey: ['job', job.id] })
    },
  })

  const handleClose = () => {
    setSubmitted(false)
    setForm({ coverLetter: '', bidAmount: String(Number(job.budgetMin) || ''), estimatedDays: '' })
    mutation.reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        {submitted ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} className="text-emerald-600" />
            </div>
            <DialogTitle className="text-xl mb-2">Proposal Submitted!</DialogTitle>
            <DialogDescription className="text-sm">
              Your proposal has been sent to the client. You'll be notified when they respond.
            </DialogDescription>
            <Button className="mt-6 gradient-amber border-0 text-white hover:opacity-90" onClick={handleClose}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Submit a Proposal</DialogTitle>
              <DialogDescription>
                Apply for <span className="font-medium text-foreground">"{job.title}"</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Cover Letter */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Cover Letter <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={form.coverLetter}
                  onChange={e => setForm(f => ({ ...f, coverLetter: e.target.value }))}
                  placeholder="Introduce yourself and explain why you're the best fit for this project..."
                  rows={5}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
                <span className="text-xs text-muted-foreground">
                  {form.coverLetter.length}/1000 characters
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Bid Amount */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Your Bid (USD) <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="number"
                      min="1"
                      value={form.bidAmount}
                      onChange={e => setForm(f => ({ ...f, bidAmount: e.target.value }))}
                      placeholder="0"
                      className="w-full pl-8 pr-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  {job.budgetMin && (
                    <span className="text-xs text-muted-foreground">
                      Budget: {formatCurrency(Number(job.budgetMin))}
                      {Number(job.budgetMax) > Number(job.budgetMin) && ` – ${formatCurrency(Number(job.budgetMax))}`}
                    </span>
                  )}
                </div>

                {/* Estimated Days */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Delivery (days) <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="number"
                      min="1"
                      value={form.estimatedDays}
                      onChange={e => setForm(f => ({ ...f, estimatedDays: e.target.value }))}
                      placeholder="e.g. 7"
                      className="w-full pl-8 pr-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>

              {/* Error */}
              {mutation.isError && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                  <AlertCircle size={14} />
                  {mutation.error instanceof Error ? mutation.error.message : 'Something went wrong'}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button
                className="gradient-amber border-0 text-white hover:opacity-90"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !form.coverLetter.trim() || !form.bidAmount || !form.estimatedDays}
              >
                {mutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send size={14} /> Submit Proposal
                  </span>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function JobDetailPage() {
  const { jobId } = useParams({ strict: false }) as { jobId: string }
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [proposalOpen, setProposalOpen] = useState(false)

  const { data: job, isLoading, isError } = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      const jobs = await tables.jobs.list({ where: { id: jobId }, limit: 1 })
      return (jobs[0] as Job) || null
    },
    enabled: !!jobId,
  })

  const handleProposalClick = () => {
    if (!user) {
      blink.auth.login()
      return
    }
    if (profile?.role === 'freelancer') {
      setProposalOpen(true)
    } else if (profile?.role === 'client') {
      navigate({ to: '/client/post-job' })
    } else {
      blink.auth.login()
    }
  }

  if (isLoading) return <JobDetailSkeleton />

  if (isError || !job) {
    return (
      <div className="page-container">
        <div className="text-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Briefcase size={28} className="text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Job not found</h2>
          <p className="text-muted-foreground text-sm mb-6">
            This job may have been removed or is no longer available.
          </p>
          <Button onClick={() => navigate({ to: '/jobs' })}>
            <ArrowLeft size={14} /> Browse Jobs
          </Button>
        </div>
      </div>
    )
  }

  const skills = safeParseJSON<string[]>(job.skillsRequired, [])
  const budgetLabel =
    job.budgetType === 'fixed'
      ? `${formatCurrency(Number(job.budgetMin))}${Number(job.budgetMax) > Number(job.budgetMin) ? ` – ${formatCurrency(Number(job.budgetMax))}` : ''} (Fixed)`
      : `${formatCurrency(Number(job.budgetMin))}${Number(job.budgetMax) > Number(job.budgetMin) ? ` – ${formatCurrency(Number(job.budgetMax))}` : ''}/hr (Hourly)`

  const canSubmitProposal = !profile || profile.role === 'freelancer'
  const isOwnJob = profile?.userId === job.userId

  return (
    <div className="page-container animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
        <ChevronRight size={14} />
        <Link to="/jobs" className="hover:text-foreground transition-colors">Browse Jobs</Link>
        <ChevronRight size={14} />
        <span className="text-foreground line-clamp-1 max-w-xs">{job.title}</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title card */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <h1 className="text-2xl font-bold text-foreground leading-snug flex-1">{job.title}</h1>
              <StatusBadge status={job.status} />
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Tag size={12} />
                {job.category}
              </span>
              <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm capitalize">
                {job.budgetType} price
              </span>
            </div>

            <h2 className="text-base font-semibold text-foreground mb-3">Project Description</h2>
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {job.description}
            </div>
          </div>

          {/* Skills */}
          {skills.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-base font-semibold text-foreground mb-4">Skills Required</h2>
              <div className="flex flex-wrap gap-2">
                {skills.map(s => <SkillBadge key={s} skill={s} />)}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Budget & Meta card */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-foreground">Project Details</h2>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign size={14} className="text-accent" /> Budget
                </span>
                <span className="font-medium text-foreground">{budgetLabel}</span>
              </div>
              {job.deadline && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Calendar size={14} /> Deadline
                  </span>
                  <span className="font-medium text-foreground">{formatDate(job.deadline)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Users size={14} /> Proposals
                </span>
                <span className="font-medium text-foreground">
                  {Number(job.proposalsCount) || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Clock size={14} /> Posted
                </span>
                <span className="font-medium text-foreground">{formatRelativeTime(job.createdAt)}</span>
              </div>
            </div>

            {/* CTA */}
            {!isOwnJob && job.status === 'open' && (
              <div className="pt-2 border-t border-border">
                {canSubmitProposal ? (
                  <Button
                    className="w-full gradient-amber border-0 text-white hover:opacity-90"
                    onClick={handleProposalClick}
                  >
                    <Send size={15} />
                    {user ? 'Submit Proposal' : 'Sign In to Apply'}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate({ to: '/browse' })}
                  >
                    <Users size={15} /> Find Freelancers
                  </Button>
                )}
                {!user && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    You need a freelancer account to apply
                  </p>
                )}
              </div>
            )}

            {job.status !== 'open' && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle size={14} />
                  This job is no longer accepting proposals
                </div>
              </div>
            )}
          </div>

          {/* Safety callout */}
          <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Briefcase size={14} className="text-accent" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1">Escrow Protection</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Payments are held in escrow and only released when you approve the work.
                </p>
              </div>
            </div>
          </div>

          {/* Back button */}
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => navigate({ to: '/jobs' })}
          >
            <ArrowLeft size={14} /> Back to Jobs
          </Button>
        </div>
      </div>

      {/* Proposal dialog */}
      {job && user && (
        <ProposalFormDialog
          open={proposalOpen}
          onClose={() => setProposalOpen(false)}
          job={job}
          userId={user.id}
        />
      )}
    </div>
  )
}
