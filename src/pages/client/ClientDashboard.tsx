import { useEffect } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Briefcase,
  FileText,
  DollarSign,
  Users,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { tables } from '@/blink/client'
import { formatCurrency, formatDate, formatRelativeTime, getStatusColor } from '@/lib/utils'
import type { Contract, Job, Proposal, Wallet } from '@/types'

// ─── Loading skeleton ────────────────────────────────────────────────────────
function StatSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-6 animate-pulse">
      <div className="h-4 w-24 bg-muted rounded mb-3" />
      <div className="h-8 w-16 bg-muted rounded" />
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="h-4 w-3/4 bg-muted rounded mb-2" />
      <div className="h-3 w-1/2 bg-muted rounded" />
    </div>
  )
}

// ─── Auth guard spinner ──────────────────────────────────────────────────────
function AuthSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}

export function ClientDashboard() {
  const { user, profile, isLoading } = useAuth()
  const navigate = useNavigate()

  // Auth guard
  useEffect(() => {
    if (!isLoading && !user) navigate({ to: '/auth/login' })
    if (!isLoading && profile && profile.role !== 'client') navigate({ to: '/freelancer/dashboard' })
  }, [isLoading, user, profile])

  // Fetch jobs
  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ['client-jobs', user?.id],
    queryFn: () => tables.jobs.list({ where: { userId: user!.id }, orderBy: { createdAt: 'desc' } }) as Promise<Job[]>,
    enabled: !!user,
  })

  // Fetch contracts
  const { data: contracts = [], isLoading: contractsLoading } = useQuery<Contract[]>({
    queryKey: ['client-contracts', user?.id],
    queryFn: () => tables.contracts.list({ where: { clientId: user!.id }, orderBy: { createdAt: 'desc' } }) as Promise<Contract[]>,
    enabled: !!user,
  })

  // Fetch proposals
  const { data: proposals = [], isLoading: proposalsLoading } = useQuery<Proposal[]>({
    queryKey: ['client-proposals', user?.id],
    queryFn: () => tables.proposals.list({ where: { clientId: user!.id }, orderBy: { createdAt: 'desc' } }) as Promise<Proposal[]>,
    enabled: !!user,
  })

  // Fetch wallet
  const { data: walletData = [] } = useQuery<Wallet[]>({
    queryKey: ['client-wallet', user?.id],
    queryFn: () => tables.wallets.list({ where: { userId: user!.id }, limit: 1 }) as Promise<Wallet[]>,
    enabled: !!user,
  })

  if (isLoading) return <AuthSpinner />

  const wallet = walletData[0] || null
  const activeJobs = jobs.filter(j => j.status === 'open' || j.status === 'in_progress')
  const pendingProposals = proposals.filter(p => p.status === 'pending')
  const activeContracts = contracts.filter(c => c.status === 'active' || c.status === 'submitted' || c.status === 'revision')
  const totalSpent = contracts
    .filter(c => c.status === 'completed')
    .reduce((sum, c) => sum + Number(c.amount || 0), 0)

  const stats = [
    {
      label: 'Active Jobs',
      value: activeJobs.length.toString(),
      icon: Briefcase,
      colorClass: 'text-primary',
      bgClass: 'bg-primary/10',
    },
    {
      label: 'Total Proposals',
      value: pendingProposals.length.toString(),
      icon: FileText,
      colorClass: 'text-amber-600',
      bgClass: 'bg-amber-100 dark:bg-amber-900/20',
    },
    {
      label: 'Active Contracts',
      value: activeContracts.length.toString(),
      icon: Users,
      colorClass: 'text-blue-600',
      bgClass: 'bg-blue-100 dark:bg-blue-900/20',
    },
    {
      label: 'Total Spent',
      value: formatCurrency(totalSpent || Number(wallet?.totalEarned || 0)),
      icon: DollarSign,
      colorClass: 'text-emerald-600',
      bgClass: 'bg-emerald-100 dark:bg-emerald-900/20',
    },
  ]

  const isDataLoading = jobsLoading || contractsLoading || proposalsLoading

  return (
    <div className="page-container animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {profile?.displayName?.split(' ')[0] ?? 'Client'} 👋
          </h1>
          <p className="text-muted-foreground mt-1">Here's your project overview</p>
        </div>
        <Button
          onClick={() => navigate({ to: '/client/post-job' })}
          className="gradient-amber text-white border-0 shrink-0"
        >
          <Plus size={16} />
          Post New Job
        </Button>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isDataLoading
          ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          : stats.map(stat => (
              <div key={stat.label} className="bg-card border border-border rounded-xl p-6 card-hover">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${stat.bgClass}`}>
                    <stat.icon size={18} className={stat.colorClass} />
                  </div>
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              </div>
            ))}
      </div>

      {/* ── Quick Actions ──────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-6 mb-8">
        <h2 className="text-base font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate({ to: '/client/post-job' })} className="gradient-amber text-white border-0">
            <Plus size={15} /> Post New Job
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate({ to: '/client/projects' })}
          >
            <FileText size={15} /> View All Proposals
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate({ to: '/client/projects' })}
          >
            <Briefcase size={15} /> View Contracts
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* ── Recent Jobs ───────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Jobs</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: '/client/projects' })}
              className="text-muted-foreground hover:text-foreground"
            >
              View All <ArrowRight size={14} />
            </Button>
          </div>

          {isDataLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : jobs.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-10 text-center">
              <Briefcase size={36} className="mx-auto text-muted-foreground mb-3 opacity-50" />
              <p className="text-muted-foreground text-sm mb-4">You haven't posted any jobs yet</p>
              <Button size="sm" onClick={() => navigate({ to: '/client/post-job' })}>
                <Plus size={14} /> Post Your First Job
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.slice(0, 5).map(job => {
                const jobProposals = proposals.filter(p => p.jobId === job.id)
                return (
                  <Link
                    key={job.id}
                    to="/client/projects"
                    className="block"
                  >
                    <div className="bg-card border border-border rounded-xl p-4 card-hover">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <h3 className="font-medium text-foreground truncate text-sm">{job.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{job.category}</p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${getStatusColor(job.status)}`}
                        >
                          {job.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText size={11} />
                          {jobProposals.length} proposal{jobProposals.length !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {formatRelativeTime(job.createdAt)}
                        </span>
                        <span className="flex items-center gap-1 ml-auto font-medium text-foreground">
                          <DollarSign size={11} />
                          {formatCurrency(Number(job.budgetMax || 0))}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Active Contracts ──────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Active Contracts</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: '/client/projects' })}
              className="text-muted-foreground hover:text-foreground"
            >
              View All <ArrowRight size={14} />
            </Button>
          </div>

          {isDataLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : activeContracts.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-10 text-center">
              <CheckCircle2 size={36} className="mx-auto text-muted-foreground mb-3 opacity-50" />
              <p className="text-muted-foreground text-sm">No active contracts yet</p>
              <p className="text-xs text-muted-foreground mt-1">Accept a proposal to start a contract</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeContracts.slice(0, 5).map(contract => (
                <Link
                  key={contract.id}
                  to="/client/projects/$contractId"
                  params={{ contractId: contract.id } as any}
                  className="block"
                >
                  <div className="bg-card border border-border rounded-xl p-4 card-hover">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h3 className="font-medium text-foreground truncate text-sm">{contract.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Freelancer: {contract.freelancerName || 'Freelancer'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(contract.status)}`}
                        >
                          {contract.status}
                        </span>
                        <div className="text-sm font-semibold text-foreground mt-1">
                          {formatCurrency(Number(contract.amount || 0))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock size={11} />
                      <span>Due: {formatDate(contract.deadline)}</span>
                      <span
                        className={`ml-auto px-2 py-0.5 rounded-full text-xs ${getStatusColor(contract.paymentStatus)}`}
                      >
                        {contract.paymentStatus?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Proposals ────────────────────────────────────────────── */}
      {proposals.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Proposals</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: '/client/projects' })}
              className="text-muted-foreground hover:text-foreground"
            >
              View All <ArrowRight size={14} />
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {proposals.slice(0, 6).map(proposal => (
              <div key={proposal.id} className="bg-card border border-border rounded-xl p-4 card-hover">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground truncate">
                    {proposal.freelancerName || 'Freelancer'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(proposal.status)}`}>
                    {proposal.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <TrendingUp size={11} />
                    {formatCurrency(Number(proposal.bidAmount || 0))}
                  </span>
                  <span>{formatRelativeTime(proposal.createdAt)}</span>
                </div>
                {proposal.freelancerTitle && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{proposal.freelancerTitle}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
