import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft, Clock, DollarSign, Users, Briefcase,
  MapPin, Calendar, Send, X, CheckCircle, AlertCircle,
  Tag,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { blink, tables } from '../../blink/client'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDate, parseJsonArray, generateId } from '../../lib/utils'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { createNotification } from '../../hooks/useNotifications'
import type { Job, Proposal } from '../../types'

export function JobDetail() {
  const { jobId } = useParams({ strict: false }) as { jobId: string }
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [showProposalForm, setShowProposalForm] = useState(false)
  const [coverLetter, setCoverLetter] = useState('')
  const [bidAmount, setBidAmount] = useState('')
  const [estimatedDays, setEstimatedDays] = useState('')

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      if (!jobId) return null
      return await tables.jobs.get(jobId) as Job | null
    },
    enabled: !!jobId,
  })

  const { data: myProposal } = useQuery({
    queryKey: ['my-proposal', jobId, user?.id],
    queryFn: async () => {
      if (!user?.id || !jobId) return null
      const results = await tables.proposals.list({
        where: { userId: user.id, jobId },
        limit: 1,
      })
      return (results[0] ?? null) as Proposal | null
    },
    enabled: !!user?.id && !!jobId,
  })

  const submitProposal = useMutation({
    mutationFn: async () => {
      if (!job || !user?.id) throw new Error('Not authenticated')
      if (!coverLetter.trim()) throw new Error('Cover letter is required')
      if (!bidAmount || Number(bidAmount) <= 0) throw new Error('Enter a valid bid amount')
      if (!estimatedDays || Number(estimatedDays) <= 0) throw new Error('Enter estimated delivery days')

      await tables.proposals.create({
        id: generateId(),
        userId: user.id,
        jobId: job.id,
        clientId: job.userId,
        coverLetter,
        bidAmount: Number(bidAmount),
        estimatedDays: Number(estimatedDays),
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      await tables.jobs.update(job.id, {
        proposalsCount: (job.proposalsCount || 0) + 1,
        updatedAt: new Date().toISOString(),
      })

      await createNotification(
        job.userId,
        'New Proposal Received',
        `You received a new proposal for "${job.title}"`,
        'info',
        '/client/projects'
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-proposal', jobId, user?.id] })
      qc.invalidateQueries({ queryKey: ['browse-jobs'] })
      qc.invalidateQueries({ queryKey: ['job', jobId] })
      toast.success('Proposal submitted!')
      setShowProposalForm(false)
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to submit proposal'),
  })

  if (isLoading) {
    return (
      <div className="page-container pt-24 max-w-3xl animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/2" />
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-4 bg-muted rounded" style={{ width: `${80 - i * 8}%` }} />
          ))}
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="page-container pt-24 text-center">
        <Briefcase size={40} className="text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Job Not Found</h2>
        <p className="text-muted-foreground mb-4">This job may have been closed or removed.</p>
        <button
          onClick={() => navigate({ to: '/jobs' })}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Browse Jobs
        </button>
      </div>
    )
  }

  const skills = parseJsonArray(job.skillsRequired)
  const hasApplied = !!myProposal
  const isOpen = job.status === 'open'

  return (
    <div className="page-container pt-24">
      <div className="max-w-3xl animate-fade-in">
        {/* Back */}
        <button
          onClick={() => navigate({ to: '/jobs' })}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          Back to Jobs
        </button>

        {/* Job header card */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
              {job.category}
            </span>
            <StatusBadge status={job.status} />
            <span className="text-xs text-muted-foreground capitalize">{job.budgetType}</span>
          </div>

          <h1 className="text-xl font-bold text-foreground mb-4">{job.title}</h1>

          {/* Stats row */}
          <div className="flex flex-wrap gap-5 text-sm text-muted-foreground border-t border-border pt-4">
            <div className="flex items-center gap-1.5">
              <DollarSign size={15} className="text-green-600" />
              <span className="font-medium text-foreground">
                {formatCurrency(job.budgetMin)} – {formatCurrency(job.budgetMax)}
              </span>
              {job.budgetType === 'hourly' && <span>/hr</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar size={15} />
              Deadline: {formatDate(job.deadline)}
            </div>
            <div className="flex items-center gap-1.5">
              <Users size={15} />
              {job.proposalsCount || 0} proposals
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={15} />
              Posted {formatDate(job.createdAt)}
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-4">
          <h2 className="font-semibold text-foreground mb-3">Job Description</h2>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {job.description}
          </div>
        </div>

        {/* Skills */}
        {skills.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-6 mb-4">
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Tag size={16} />
              Required Skills
            </h2>
            <div className="flex flex-wrap gap-2">
              {skills.map(skill => (
                <span
                  key={skill}
                  className="px-3 py-1 bg-muted text-foreground rounded-full text-xs font-medium border border-border"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Apply section */}
        {!isOpen ? (
          <div className="bg-muted/50 border border-border rounded-2xl p-6 text-center">
            <p className="text-sm text-muted-foreground">
              This job is no longer accepting proposals.
            </p>
          </div>
        ) : hasApplied ? (
          <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <CheckCircle size={20} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-800 dark:text-green-300">
                  You've applied to this job
                </p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  Bid: <strong>{formatCurrency(myProposal.bidAmount)}</strong> ·
                  Delivery: <strong>{myProposal.estimatedDays} days</strong> ·
                  Status: <strong>{myProposal.status}</strong>
                </p>
              </div>
            </div>
          </div>
        ) : !user ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <AlertCircle size={24} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">Sign in to submit a proposal</p>
            <button
              onClick={() => navigate({ to: '/auth/login' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Sign In
            </button>
          </div>
        ) : profile?.role !== 'freelancer' ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <p className="text-sm text-muted-foreground">Only freelancers can submit proposals.</p>
          </div>
        ) : !showProposalForm ? (
          <div className="flex justify-center">
            <button
              onClick={() => { setShowProposalForm(true); setBidAmount(String(job.budgetMin || '')) }}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
            >
              <Send size={16} />
              Submit Proposal
            </button>
          </div>
        ) : (
          <div className="bg-card border border-primary/30 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Submit Your Proposal</h2>
              <button
                onClick={() => setShowProposalForm(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-muted/50 rounded-xl p-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Client budget</span>
              <span className="font-medium text-foreground">
                {formatCurrency(job.budgetMin)} – {formatCurrency(job.budgetMax)}
                {job.budgetType === 'hourly' ? '/hr' : ''}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Cover Letter <span className="text-destructive">*</span>
              </label>
              <textarea
                value={coverLetter}
                onChange={e => setCoverLetter(e.target.value)}
                rows={6}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm resize-none"
                placeholder="Introduce yourself, explain your relevant experience, and describe your approach to this project..."
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground mt-1">{coverLetter.length}/2000</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Your Bid <span className="text-destructive">*</span>
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

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => submitProposal.mutate()}
                disabled={submitProposal.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {submitProposal.isPending
                  ? <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  : <Send size={14} />
                }
                Submit Proposal
              </button>
              <button
                onClick={() => setShowProposalForm(false)}
                className="px-4 py-2.5 border border-border text-foreground rounded-xl text-sm hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
