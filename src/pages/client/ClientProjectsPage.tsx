import { useEffect, useState } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Briefcase,
  FileText,
  DollarSign,
  Clock,
  Check,
  X,
  Plus,
  Star,
  AlertCircle,
  ChevronRight,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { tables } from '@/blink/client'
import { formatCurrency, formatDate, formatRelativeTime, getStatusColor, safeParseJSON } from '@/lib/utils'
import type { Contract, Job, Proposal } from '@/types'
import { PLATFORM_FEE_PERCENT } from '@/types'

type TabId = 'jobs' | 'proposals' | 'contracts'

// ─── Auth spinner ─────────────────────────────────────────────────────────────
function AuthSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}

function EmptyCard({ icon: Icon, title, description, action }: { icon: React.ElementType; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-12 text-center">
      <Icon size={40} className="mx-auto text-muted-foreground mb-4 opacity-40" />
      <h3 className="font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      {action}
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/5 bg-muted rounded" />
          <div className="h-3 w-2/5 bg-muted rounded" />
        </div>
        <div className="h-6 w-16 bg-muted rounded-full" />
      </div>
    </div>
  )
}

export function ClientProjectsPage() {
  const { user, profile, isLoading } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabId>('jobs')
  const [acceptingId, setAcceptingId] = useState<string | null>(null)

  // Auth guard
  useEffect(() => {
    if (!isLoading && !user) navigate({ to: '/auth/login' })
    if (!isLoading && profile && profile.role !== 'client') navigate({ to: '/freelancer/dashboard' })
  }, [isLoading, user, profile])

  // ── Data fetching ────────────────────────────────────────────────────────
  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ['client-jobs', user?.id],
    queryFn: () => tables.jobs.list({ where: { userId: user!.id }, orderBy: { createdAt: 'desc' } }) as Promise<Job[]>,
    enabled: !!user,
  })

  const { data: proposals = [], isLoading: proposalsLoading } = useQuery<Proposal[]>({
    queryKey: ['client-proposals', user?.id],
    queryFn: () => tables.proposals.list({ where: { clientId: user!.id }, orderBy: { createdAt: 'desc' } }) as Promise<Proposal[]>,
    enabled: !!user,
  })

  const { data: contracts = [], isLoading: contractsLoading } = useQuery<Contract[]>({
    queryKey: ['client-contracts', user?.id],
    queryFn: () => tables.contracts.list({ where: { clientId: user!.id }, orderBy: { createdAt: 'desc' } }) as Promise<Contract[]>,
    enabled: !!user,
  })

  // ── Accept proposal mutation ─────────────────────────────────────────────
  const acceptProposalMutation = useMutation({
    mutationFn: async (proposal: Proposal) => {
      setAcceptingId(proposal.id)
      // 1. Accept this proposal
      await tables.proposals.update(proposal.id, { status: 'accepted' } as any)

      // 2. Find the parent job
      const jobList = await tables.jobs.list({ where: { id: proposal.jobId }, limit: 1 }) as Job[]
      const job = jobList[0]

      // 3. Create contract
      await tables.contracts.create({
        userId: proposal.userId,
        clientId: user!.id,
        jobId: proposal.jobId,
        proposalId: proposal.id,
        title: job?.title || 'Contract',
        description: job?.description || '',
        amount: Number(proposal.bidAmount),
        platformFee: Number(proposal.bidAmount) * (PLATFORM_FEE_PERCENT / 100),
        freelancerAmount: Number(proposal.bidAmount) * (1 - PLATFORM_FEE_PERCENT / 100),
        deadline: proposal.estimatedDays
          ? new Date(Date.now() + Number(proposal.estimatedDays) * 86400000).toISOString().split('T')[0]
          : new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        status: 'pending',
        paymentStatus: 'unpaid',
        freelancerName: proposal.freelancerName || '',
      } as any)

      // 4. Reject all other pending proposals for the same job
      const siblingProposals = proposals.filter(
        p => p.jobId === proposal.jobId && p.id !== proposal.id && p.status === 'pending',
      )
      await Promise.all(siblingProposals.map(p => tables.proposals.update(p.id, { status: 'rejected' } as any)))

      // 5. Update job status
      await tables.jobs.update(proposal.jobId, { status: 'in_progress' } as any)
    },
    onSuccess: () => {
      toast.success('Proposal accepted!', { description: 'A contract has been created. Fund escrow to get started.' })
      queryClient.invalidateQueries({ queryKey: ['client-proposals', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['client-contracts', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['client-jobs', user?.id] })
      setAcceptingId(null)
      setActiveTab('contracts')
    },
    onError: () => {
      toast.error('Failed to accept proposal', { description: 'Please try again.' })
      setAcceptingId(null)
    },
  })

  // ── Reject proposal ──────────────────────────────────────────────────────
  const rejectProposalMutation = useMutation({
    mutationFn: (proposalId: string) =>
      tables.proposals.update(proposalId, { status: 'rejected' } as any),
    onSuccess: () => {
      toast.success('Proposal rejected')
      queryClient.invalidateQueries({ queryKey: ['client-proposals', user?.id] })
    },
    onError: () => toast.error('Failed to reject proposal'),
  })

  // ── Cancel job ───────────────────────────────────────────────────────────
  const cancelJobMutation = useMutation({
    mutationFn: (jobId: string) =>
      tables.jobs.update(jobId, { status: 'cancelled' } as any),
    onSuccess: () => {
      toast.success('Job cancelled')
      queryClient.invalidateQueries({ queryKey: ['client-jobs', user?.id] })
    },
    onError: () => toast.error('Failed to cancel job'),
  })

  if (isLoading) return <AuthSpinner />

  const tabs: { id: TabId; label: string; count: number; icon: React.ElementType }[] = [
    { id: 'jobs', label: 'My Jobs', count: jobs.length, icon: Briefcase },
    { id: 'proposals', label: 'Proposals', count: proposals.filter(p => p.status === 'pending').length, icon: FileText },
    { id: 'contracts', label: 'Contracts', count: contracts.length, icon: Users },
  ]

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Projects</h1>
          <p className="text-muted-foreground mt-1">Manage your jobs, proposals, and contracts</p>
        </div>
        <Button
          onClick={() => navigate({ to: '/client/post-job' })}
          className="gradient-amber text-white border-0 shrink-0"
        >
          <Plus size={15} /> Post New Job
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl mb-6 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-card shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── JOBS TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'jobs' && (
        <div className="space-y-3">
          {jobsLoading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
            : jobs.length === 0
              ? (
                <EmptyCard
                  icon={Briefcase}
                  title="No jobs posted yet"
                  description="Post your first job to start receiving proposals from talented freelancers."
                  action={
                    <Button onClick={() => navigate({ to: '/client/post-job' })} className="gradient-amber text-white border-0">
                      <Plus size={14} /> Post a Job
                    </Button>
                  }
                />
              )
              : jobs.map(job => {
                  const jobProposals = proposals.filter(p => p.jobId === job.id)
                  const pendingCount = jobProposals.filter(p => p.status === 'pending').length
                  const skills = safeParseJSON<string[]>(job.skillsRequired, [])

                  return (
                    <div key={job.id} className="bg-card border border-border rounded-xl p-5 card-hover">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-semibold text-foreground">{job.title}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                              {job.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold text-foreground">
                            {formatCurrency(Number(job.budgetMax || 0))}
                          </div>
                          <div className="text-xs text-muted-foreground capitalize">{job.budgetType}</div>
                        </div>
                      </div>

                      {/* Skills */}
                      {skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {skills.slice(0, 5).map(s => (
                            <span key={s} className="px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground">
                              {s}
                            </span>
                          ))}
                          {skills.length > 5 && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-secondary text-muted-foreground">
                              +{skills.length - 5}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <FileText size={11} />
                            {jobProposals.length} proposals
                            {pendingCount > 0 && (
                              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs">
                                {pendingCount} new
                              </span>
                            )}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {formatRelativeTime(job.createdAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={11} />
                            Due {formatDate(job.deadline)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {pendingCount > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setActiveTab('proposals')}
                              className="text-xs"
                            >
                              <FileText size={12} /> View Proposals
                            </Button>
                          )}
                          {job.status === 'open' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => cancelJobMutation.mutate(job.id)}
                              disabled={cancelJobMutation.isPending}
                              className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <X size={12} /> Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
        </div>
      )}

      {/* ── PROPOSALS TAB ───────────────────────────────────────────────── */}
      {activeTab === 'proposals' && (
        <div className="space-y-3">
          {proposalsLoading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
            : proposals.length === 0
              ? (
                <EmptyCard
                  icon={FileText}
                  title="No proposals received yet"
                  description="Post a job and freelancers will start submitting proposals."
                />
              )
              : proposals.map(proposal => {
                  const relatedJob = jobs.find(j => j.id === proposal.jobId)
                  const isAccepting = acceptingId === proposal.id

                  return (
                    <div key={proposal.id} className="bg-card border border-border rounded-xl p-5">
                      <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full gradient-hero flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {(proposal.freelancerName || 'F')[0].toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Top row */}
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div>
                              <span className="font-semibold text-foreground">
                                {proposal.freelancerName || 'Freelancer'}
                              </span>
                              {proposal.freelancerTitle && (
                                <span className="text-sm text-muted-foreground ml-2">
                                  · {proposal.freelancerTitle}
                                </span>
                              )}
                              {proposal.freelancerRating && Number(proposal.freelancerRating) > 0 && (
                                <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-amber-600">
                                  <Star size={10} className="fill-amber-500 text-amber-500" />
                                  {Number(proposal.freelancerRating).toFixed(1)}
                                </span>
                              )}
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${getStatusColor(proposal.status)}`}>
                              {proposal.status}
                            </span>
                          </div>

                          {/* Job reference */}
                          {relatedJob && (
                            <p className="text-xs text-muted-foreground mb-2">
                              For: <span className="text-foreground">{relatedJob.title}</span>
                            </p>
                          )}

                          {/* Cover letter */}
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {proposal.coverLetter}
                          </p>

                          {/* Bid details + actions */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-4 text-sm">
                              <span className="flex items-center gap-1 font-semibold text-foreground">
                                <DollarSign size={14} className="text-emerald-600" />
                                {formatCurrency(Number(proposal.bidAmount || 0))}
                              </span>
                              <span className="flex items-center gap-1 text-muted-foreground text-xs">
                                <Clock size={11} />
                                {proposal.estimatedDays} days
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeTime(proposal.createdAt)}
                              </span>
                            </div>

                            {proposal.status === 'pending' && (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => acceptProposalMutation.mutate(proposal)}
                                  disabled={isAccepting}
                                  className="gradient-amber text-white border-0 text-xs"
                                >
                                  {isAccepting ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                                  ) : (
                                    <Check size={13} />
                                  )}
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => rejectProposalMutation.mutate(proposal.id)}
                                  disabled={rejectProposalMutation.isPending}
                                  className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                                >
                                  <X size={13} /> Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
        </div>
      )}

      {/* ── CONTRACTS TAB ───────────────────────────────────────────────── */}
      {activeTab === 'contracts' && (
        <div className="space-y-3">
          {contractsLoading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
            : contracts.length === 0
              ? (
                <EmptyCard
                  icon={Users}
                  title="No contracts yet"
                  description="Accept a freelancer's proposal to create your first contract."
                  action={
                    <Button variant="outline" onClick={() => setActiveTab('proposals')}>
                      View Proposals
                    </Button>
                  }
                />
              )
              : contracts.map(contract => (
                  <Link
                    key={contract.id}
                    to="/client/projects/$contractId"
                    params={{ contractId: contract.id } as any}
                    className="block"
                  >
                    <div className="bg-card border border-border rounded-xl p-5 card-hover">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-semibold text-foreground">{contract.title}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(contract.status)}`}>
                              {contract.status}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(contract.paymentStatus)}`}>
                              {contract.paymentStatus?.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Freelancer: {contract.freelancerName || 'Freelancer'}
                          </p>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-2">
                          <div>
                            <div className="font-bold text-foreground">{formatCurrency(Number(contract.amount || 0))}</div>
                            <div className="text-xs text-muted-foreground">Due {formatDate(contract.deadline)}</div>
                          </div>
                          <ChevronRight size={16} className="text-muted-foreground" />
                        </div>
                      </div>

                      {/* Action hint for pending unpaid contracts */}
                      {contract.status === 'pending' && contract.paymentStatus === 'unpaid' && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
                          <AlertCircle size={12} />
                          Fund escrow to activate this contract
                        </div>
                      )}

                      {contract.status === 'submitted' && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-xs text-purple-700 dark:text-purple-400">
                          <AlertCircle size={12} />
                          Work submitted — review and approve to release payment
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
        </div>
      )}
    </div>
  )
}

// Tiny inline Calendar icon (used inside the component)
function Calendar({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}
