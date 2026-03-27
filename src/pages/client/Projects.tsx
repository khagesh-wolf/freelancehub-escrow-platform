import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from '@tanstack/react-router'
import {
  FolderOpen,
  Plus,
  Briefcase,
  FileText,
  ChevronRight,
  Users,
  Calendar,
  DollarSign,
  Filter,
  X,
  AlertCircle,
} from 'lucide-react'
import { blink, tables } from '../../blink/client'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDate, timeAgo } from '../../lib/utils'
import { StatusBadge } from '../../components/ui/StatusBadge'
import type { Contract, Job, Proposal, UserProfile } from '../../types'
import toast from 'react-hot-toast'

type Tab = 'contracts' | 'jobs'
type ContractStatus = '' | 'active' | 'submitted' | 'revision' | 'pending' | 'completed' | 'disputed' | 'cancelled'

export function ClientProjectsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('contracts')
  const [contractStatusFilter, setContractStatusFilter] = useState<ContractStatus>('')
  const [jobStatusFilter, setJobStatusFilter] = useState<'' | 'open' | 'in_progress' | 'completed' | 'cancelled'>('')
  const [expandedJob, setExpandedJob] = useState<string | null>(null)

  // Contracts
  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['client-contracts-all', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      return (await tables.contracts.list({
        where: { clientId: user.id },
        orderBy: { createdAt: 'desc' },
        limit: 100,
      })) as Contract[]
    },
    enabled: !!user?.id,
  })

  // Jobs
  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['client-jobs-all', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      return (await tables.jobs.list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        limit: 100,
      })) as Job[]
    },
    enabled: !!user?.id,
  })

  // Proposals for expanded job
  const { data: jobProposals = [] } = useQuery({
    queryKey: ['job-proposals', expandedJob],
    queryFn: async () => {
      if (!expandedJob) return []
      const [proposals, userProfiles] = await Promise.all([
        tables.proposals.list({ where: { jobId: expandedJob }, orderBy: { createdAt: 'desc' }, limit: 50 }) as Promise<Proposal[]>,
        tables.userProfiles.list({ where: { role: 'freelancer' }, limit: 200 }) as Promise<UserProfile[]>,
      ])
      const uMap = new Map(userProfiles.map(u => [u.userId, u]))
      return proposals.map(p => ({
        ...p,
        freelancerName: uMap.get(p.userId)?.displayName ?? 'Freelancer',
        freelancerAvatar: uMap.get(p.userId)?.avatarUrl ?? '',
      }))
    },
    enabled: !!expandedJob,
  })

  // Close job mutation
  const closeJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      await tables.jobs.update(jobId, {
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
      })
    },
    onSuccess: () => {
      toast.success('Job closed successfully')
      qc.invalidateQueries({ queryKey: ['client-jobs-all', user?.id] })
      qc.invalidateQueries({ queryKey: ['client-jobs', user?.id] })
    },
    onError: () => toast.error('Failed to close job'),
  })

  const filteredContracts = contracts.filter(
    c => !contractStatusFilter || c.status === contractStatusFilter
  )
  const filteredJobs = jobs.filter(
    j => !jobStatusFilter || j.status === jobStatusFilter
  )

  // Counts for tabs
  const activeContractCount = contracts.filter(c =>
    ['active', 'submitted', 'revision'].includes(c.status)
  ).length
  const openJobCount = jobs.filter(j => j.status === 'open').length

  return (
    <div className="page-container pt-24 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Projects</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage your contracts and posted jobs
          </p>
        </div>
        <button
          onClick={() => navigate({ to: '/client/post-job' })}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus size={16} />
          Post a Job
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl mb-6 w-fit">
        {([
          { key: 'contracts', label: 'Contracts', count: activeContractCount, icon: FileText },
          { key: 'jobs', label: 'Posted Jobs', count: openJobCount, icon: Briefcase },
        ] as const).map(({ key, label, count, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={15} />
            {label}
            {count > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-xs ${
                  tab === key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted-foreground/20 text-muted-foreground'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Contracts tab ─── */}
      {tab === 'contracts' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter size={14} />
              <span>Filter by status:</span>
            </div>
            {(
              [
                { value: '', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'submitted', label: 'Submitted' },
                { value: 'revision', label: 'Revision' },
                { value: 'pending', label: 'Pending' },
                { value: 'completed', label: 'Completed' },
                { value: 'disputed', label: 'Disputed' },
                { value: 'cancelled', label: 'Cancelled' },
              ] as const
            ).map(f => (
              <button
                key={f.value}
                onClick={() => setContractStatusFilter(f.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  contractStatusFilter === f.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Contracts list */}
          {contractsLoading ? (
            <ContractsSkeletonList />
          ) : filteredContracts.length === 0 ? (
            <EmptyPlaceholder
              icon={FileText}
              title={contractStatusFilter ? 'No contracts with this status' : 'No contracts yet'}
              description={
                contractStatusFilter
                  ? 'Try a different filter or check other statuses.'
                  : 'When a freelancer accepts your proposal, a contract will appear here.'
              }
              action={
                !contractStatusFilter
                  ? { label: 'Post a Job', onClick: () => navigate({ to: '/client/post-job' }) }
                  : undefined
              }
            />
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              {/* Table header */}
              <div className="hidden md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <span>Project</span>
                <span>Amount</span>
                <span>Deadline</span>
                <span>Status</span>
                <span>Payment</span>
              </div>
              <div className="divide-y divide-border">
                {filteredContracts.map(c => (
                  <ContractRow
                    key={c.id}
                    contract={c}
                    onClick={() =>
                      navigate({
                        to: '/client/projects/$contractId',
                        params: { contractId: c.id },
                      })
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Summary stats */}
          {filteredContracts.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  label: 'Total Value',
                  value: formatCurrency(
                    filteredContracts.reduce((s, c) => s + Number(c.amount), 0)
                  ),
                  icon: DollarSign,
                },
                {
                  label: 'In Escrow',
                  value: formatCurrency(
                    filteredContracts
                      .filter(c => c.paymentStatus === 'paid_to_platform')
                      .reduce((s, c) => s + Number(c.amount), 0)
                  ),
                  icon: FileText,
                },
                {
                  label: 'Released',
                  value: formatCurrency(
                    filteredContracts
                      .filter(c => c.paymentStatus === 'released')
                      .reduce((s, c) => s + Number(c.amount), 0)
                  ),
                  icon: Users,
                },
              ].map(stat => (
                <div key={stat.label} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <stat.icon size={12} />
                    {stat.label}
                  </p>
                  <p className="text-lg font-bold text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Posted Jobs tab ─── */}
      {tab === 'jobs' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter size={14} />
              <span>Filter:</span>
            </div>
            {(
              [
                { value: '', label: 'All' },
                { value: 'open', label: 'Open' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ] as const
            ).map(f => (
              <button
                key={f.value}
                onClick={() => setJobStatusFilter(f.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  jobStatusFilter === f.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Jobs list */}
          {jobsLoading ? (
            <div className="space-y-3">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
                  <div className="flex justify-between mb-3">
                    <div className="h-5 bg-muted rounded w-1/2" />
                    <div className="h-5 bg-muted rounded-full w-16" />
                  </div>
                  <div className="h-4 bg-muted rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : filteredJobs.length === 0 ? (
            <EmptyPlaceholder
              icon={Briefcase}
              title={jobStatusFilter ? 'No jobs with this status' : "You haven't posted any jobs"}
              description={
                jobStatusFilter
                  ? 'Try a different filter.'
                  : 'Post a job to start receiving proposals from talented freelancers.'
              }
              action={
                !jobStatusFilter
                  ? { label: 'Post a Job', onClick: () => navigate({ to: '/client/post-job' }) }
                  : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredJobs.map(j => (
                <JobCard
                  key={j.id}
                  job={j}
                  isExpanded={expandedJob === j.id}
                  proposals={expandedJob === j.id ? jobProposals : []}
                  onToggleExpand={() => setExpandedJob(v => (v === j.id ? null : j.id))}
                  onClose={() => {
                    if (window.confirm('Close this job? Freelancers will no longer be able to apply.')) {
                      closeJobMutation.mutate(j.id)
                    }
                  }}
                  navigate={navigate}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ContractRow({ contract: c, onClick }: { contract: Contract; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 md:gap-4 items-center px-5 py-4 hover:bg-muted/40 cursor-pointer transition-colors group"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
          {c.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Posted {timeAgo(c.createdAt)}
        </p>
      </div>
      <div className="flex items-center gap-1 text-sm font-bold text-foreground">
        <DollarSign size={13} className="text-muted-foreground" />
        {Number(c.amount).toLocaleString()}
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Calendar size={12} />
        {formatDate(c.deadline)}
      </div>
      <StatusBadge status={c.status} />
      <div className="flex items-center gap-2">
        <StatusBadge status={c.paymentStatus} />
        <ChevronRight size={15} className="text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </div>
  )
}

function JobCard({
  job,
  isExpanded,
  proposals,
  onToggleExpand,
  onClose,
  navigate,
}: {
  job: Job
  isExpanded: boolean
  proposals: Array<Proposal & { freelancerName: string; freelancerAvatar: string }>
  onToggleExpand: () => void
  onClose: () => void
  navigate: any
}) {
  const isOpen = job.status === 'open'
  const proposalCount = Number(job.proposalsCount) || 0

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      {/* Job header */}
      <div className="flex items-start gap-3 p-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap mb-2">
            <p className="font-semibold text-foreground">{job.title}</p>
            <StatusBadge status={job.status} />
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{job.description}</p>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users size={12} />
              {proposalCount} proposal{proposalCount !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <DollarSign size={12} />
              {Number(job.budgetMin) > 0
                ? `$${Number(job.budgetMin).toLocaleString()} – $${Number(job.budgetMax).toLocaleString()}`
                : `Up to $${Number(job.budgetMax).toLocaleString()}`}
              {job.budgetType === 'hourly' ? '/hr' : ''}
            </span>
            {job.deadline && (
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                Due {formatDate(job.deadline)}
              </span>
            )}
            <span className="flex items-center gap-1">
              Posted {timeAgo(job.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          {isOpen && (
            <button
              onClick={e => {
                e.stopPropagation()
                onClose()
              }}
              className="text-xs text-destructive hover:underline"
            >
              Close Job
            </button>
          )}
          {proposalCount > 0 && (
            <button
              onClick={onToggleExpand}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-semibold hover:bg-primary/20 transition-colors"
            >
              {isExpanded ? 'Hide' : 'View'} Proposals
              <ChevronRight
                size={13}
                className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Proposals panel */}
      {isExpanded && (
        <div className="border-t border-border bg-muted/20">
          <div className="px-5 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">
              {proposals.length} Proposal{proposals.length !== 1 ? 's' : ''}
            </p>
          </div>
          {proposals.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-sm text-muted-foreground">Loading proposals...</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {proposals.map(p => (
                <ProposalRow key={p.id} proposal={p} navigate={navigate} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ProposalRow({
  proposal: p,
  navigate,
}: {
  proposal: Proposal & { freelancerName: string; freelancerAvatar: string }
  navigate: any
}) {
  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {p.freelancerAvatar ? (
          <img src={p.freelancerAvatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-primary font-semibold text-sm">
            {getInitials(p.freelancerName || 'F')}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{p.freelancerName}</p>
        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{p.coverLetter}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <p className="text-sm font-bold text-foreground">{formatCurrency(Number(p.bidAmount))}</p>
          <p className="text-xs text-muted-foreground">{p.estimatedDays}d delivery</p>
        </div>
        <StatusBadge status={p.status} />
        <button
          onClick={() => navigate({ to: '/freelancer/$userId', params: { userId: p.userId } })}
          className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors"
        >
          View
        </button>
      </div>
    </div>
  )
}

function ContractsSkeletonList() {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm divide-y divide-border">
      {Array(4).fill(0).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="h-3 bg-muted rounded w-1/3" />
          </div>
          <div className="h-4 bg-muted rounded w-20" />
          <div className="h-5 bg-muted rounded-full w-16" />
        </div>
      ))}
    </div>
  )
}

function EmptyPlaceholder({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: any
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="bg-card border border-border rounded-2xl py-16 text-center shadow-sm">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
        <Icon size={32} className="text-muted-foreground" />
      </div>
      <p className="font-semibold text-foreground mb-2">{title}</p>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus size={15} />
          {action.label}
        </button>
      )}
    </div>
  )
}
