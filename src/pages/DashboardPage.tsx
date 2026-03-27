import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Briefcase, FileText, DollarSign, MessageSquare,
  Plus, Search, Star, TrendingUp, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '../hooks/useAuth'
import { StatCard } from '../components/shared/StatCard'
import { EmptyState } from '../components/shared/EmptyState'
import { StatusBadge } from '../components/ui/StatusBadge'
import { blink, tables } from '../blink/client'
import { formatCurrency, formatDate, timeAgo } from '../lib/utils'
import type { Job, Proposal, Contract } from '../types'

// ─── Shared spinner ───────────────────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}

// ─── Client dashboard ─────────────────────────────────────────────────────────
function ClientDashboard({ userId }: { userId: string }) {
  const navigate = useNavigate()

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['client-jobs', userId],
    queryFn: async () => {
      const items = await tables.jobs.list({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        limit: 5,
      })
      return items as Job[]
    },
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['client-contracts', userId],
    queryFn: async () => {
      const items = await tables.contracts.list({
        where: { clientId: userId },
        orderBy: { createdAt: 'desc' },
        limit: 20,
      })
      return items as Contract[]
    },
  })

  const { data: messages = [] } = useQuery({
    queryKey: ['client-unread-messages', userId],
    queryFn: async () => {
      const items = await tables.messages.list({
        where: { recipientId: userId, isRead: '0' },
        limit: 50,
      })
      return items
    },
  })

  const activeJobs = jobs.filter(j => j.status === 'open' || j.status === 'in_progress').length
  const activeContracts = contracts.filter(c => c.status === 'active').length
  const totalSpent = contracts
    .filter(c => c.paymentStatus === 'released')
    .reduce((sum, c) => sum + (c.amount || 0), 0)
  const unreadMessages = messages.length
  const recentContracts = contracts.slice(0, 3)

  return (
    <div className="page-container space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Client Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your projects and find talent</p>
        </div>
        <Button
          className="gradient-amber border-0 text-white hover:opacity-90"
          onClick={() => navigate({ to: '/client/post-job' })}
        >
          <Plus size={16} className="mr-2" />
          Post a Job
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Jobs" value={activeJobs} icon={Briefcase} iconColor="text-blue-500" subtitle="Open for proposals" />
        <StatCard title="Active Contracts" value={activeContracts} icon={FileText} iconColor="text-green-500" subtitle="In progress" />
        <StatCard title="Total Spent" value={formatCurrency(totalSpent)} icon={DollarSign} iconColor="text-accent" subtitle="Completed projects" />
        <StatCard title="Unread Messages" value={unreadMessages} icon={MessageSquare} iconColor="text-purple-500" subtitle="Pending replies" />
      </div>

      {/* Recent Jobs */}
      <div className="bg-card border border-border rounded-xl">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Recent Jobs</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/client/projects' })}>
            View all
          </Button>
        </div>
        {jobsLoading ? (
          <div className="p-8 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No jobs posted yet"
            description="Post your first job to start receiving proposals from top freelancers."
            action={{ label: 'Post a Job', onClick: () => navigate({ to: '/client/post-job' }) }}
          />
        ) : (
          <div className="divide-y divide-border">
            {jobs.slice(0, 3).map(job => (
              <div
                key={job.id}
                className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate({ to: '/jobs/$jobId', params: { jobId: job.id } })}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{job.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(job.createdAt)} · {job.proposalsCount || 0} proposals
                  </p>
                </div>
                <StatusBadge status={job.status} className="ml-3 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Contracts */}
      {recentContracts.length > 0 && (
        <div className="bg-card border border-border rounded-xl">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Recent Contracts</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/client/projects' })}>
              View all
            </Button>
          </div>
          <div className="divide-y divide-border">
            {recentContracts.map(c => (
              <div
                key={c.id}
                className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate({ to: '/client/projects/$contractId', params: { contractId: c.id } })}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(c.createdAt)}</p>
                </div>
                <div className="ml-3 shrink-0 flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold">{formatCurrency(c.amount)}</span>
                  <StatusBadge status={c.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className="bg-card border border-border rounded-xl p-5 card-hover cursor-pointer"
          onClick={() => navigate({ to: '/browse' })}
        >
          <Search size={24} className="text-primary mb-3" />
          <h3 className="font-semibold text-foreground mb-1">Find Talent</h3>
          <p className="text-sm text-muted-foreground">Browse freelancer profiles and hire directly.</p>
        </div>
        <div
          className="bg-card border border-border rounded-xl p-5 card-hover cursor-pointer"
          onClick={() => navigate({ to: '/client/projects' })}
        >
          <FileText size={24} className="text-primary mb-3" />
          <h3 className="font-semibold text-foreground mb-1">Manage Contracts</h3>
          <p className="text-sm text-muted-foreground">Track ongoing work and release payments.</p>
        </div>
      </div>
    </div>
  )
}

// ─── Freelancer dashboard ─────────────────────────────────────────────────────
function FreelancerDashboard({ userId }: { userId: string }) {
  const navigate = useNavigate()

  const { data: proposals = [], isLoading: proposalsLoading } = useQuery({
    queryKey: ['freelancer-proposals', userId],
    queryFn: async () => {
      const items = await tables.proposals.list({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        limit: 10,
      })
      return items as Proposal[]
    },
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['freelancer-contracts', userId],
    queryFn: async () => {
      const items = await tables.contracts.list({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        limit: 20,
      })
      return items as Contract[]
    },
  })

  const { data: freelancerProfile } = useQuery({
    queryKey: ['freelancer-profile', userId],
    queryFn: async () => {
      const items = await tables.freelancerProfiles.list({ where: { userId }, limit: 1 })
      return (items[0] as any) || null
    },
  })

  const { data: wallet } = useQuery({
    queryKey: ['freelancer-wallet', userId],
    queryFn: async () => {
      const items = await tables.wallets.list({ where: { userId }, limit: 1 })
      return (items[0] as any) || null
    },
  })

  const activeContracts = contracts.filter(c => c.status === 'active').length
  const balance = wallet?.balance ?? 0
  const rating = freelancerProfile?.rating ?? 0
  const recentContracts = contracts.slice(0, 3)

  return (
    <div className="page-container space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Freelancer Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track your proposals and earnings</p>
        </div>
        <Button
          className="gradient-amber border-0 text-white hover:opacity-90"
          onClick={() => navigate({ to: '/jobs' })}
        >
          <Search size={16} className="mr-2" />
          Browse Jobs
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Proposals Sent"
          value={proposals.length}
          icon={FileText}
          iconColor="text-blue-500"
          subtitle={`${proposals.filter(p => p.status === 'pending').length} pending`}
        />
        <StatCard
          title="Active Contracts"
          value={activeContracts}
          icon={Briefcase}
          iconColor="text-green-500"
          subtitle="Currently working"
        />
        <StatCard
          title="Wallet Balance"
          value={formatCurrency(balance)}
          icon={DollarSign}
          iconColor="text-accent"
          subtitle="Available to withdraw"
        />
        <StatCard
          title="Rating"
          value={rating > 0 ? rating.toFixed(1) : '—'}
          icon={Star}
          iconColor="text-yellow-500"
          subtitle={`${freelancerProfile?.totalReviews || 0} reviews`}
        />
      </div>

      {/* Recent Proposals */}
      <div className="bg-card border border-border rounded-xl">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Recent Proposals</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/proposals' })}>
            View all
          </Button>
        </div>
        {proposalsLoading ? (
          <div className="p-8 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : proposals.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No proposals yet"
            description="Browse open jobs and submit your first proposal to get started."
            action={{ label: 'Browse Jobs', onClick: () => navigate({ to: '/jobs' }) }}
          />
        ) : (
          <div className="divide-y divide-border">
            {proposals.slice(0, 3).map(proposal => (
              <div key={proposal.id} className="px-5 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {proposal.jobTitle || 'Job Proposal'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Bid: {formatCurrency(proposal.bidAmount)} · {timeAgo(proposal.createdAt)}
                  </p>
                </div>
                <StatusBadge status={proposal.status} className="ml-3 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Contracts */}
      {recentContracts.length > 0 && (
        <div className="bg-card border border-border rounded-xl">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Recent Contracts</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/freelancer/contracts' })}>
              View all
            </Button>
          </div>
          <div className="divide-y divide-border">
            {recentContracts.map(c => (
              <div
                key={c.id}
                className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate({ to: '/freelancer/contracts/$contractId', params: { contractId: c.id } })}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(c.createdAt)}</p>
                </div>
                <div className="ml-3 shrink-0 flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold">{formatCurrency(c.freelancerAmount)}</span>
                  <StatusBadge status={c.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className="bg-card border border-border rounded-xl p-5 card-hover cursor-pointer"
          onClick={() => navigate({ to: '/jobs' })}
        >
          <Search size={24} className="text-primary mb-3" />
          <h3 className="font-semibold text-foreground mb-1">Find Jobs</h3>
          <p className="text-sm text-muted-foreground">Browse new opportunities matching your skills.</p>
        </div>
        <div
          className="bg-card border border-border rounded-xl p-5 card-hover cursor-pointer"
          onClick={() => navigate({ to: '/freelancer/wallet' })}
        >
          <TrendingUp size={24} className="text-primary mb-3" />
          <h3 className="font-semibold text-foreground mb-1">View Earnings</h3>
          <p className="text-sm text-muted-foreground">Track your income and withdraw funds.</p>
        </div>
        <div
          className="bg-card border border-border rounded-xl p-5 card-hover cursor-pointer"
          onClick={() => navigate({ to: '/freelancer/profile' })}
        >
          <Star size={24} className="text-primary mb-3" />
          <h3 className="font-semibold text-foreground mb-1">Edit Portfolio</h3>
          <p className="text-sm text-muted-foreground">Showcase your best work to attract clients.</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main export ───────────────────────────────────────────────────────────────
export function DashboardPage() {
  const { profile, isLoading, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && !profile) {
      navigate({ to: '/onboarding' as any })
    }
    if (!isLoading && profile?.role === 'admin') {
      navigate({ to: '/admin' })
    }
  }, [isLoading, profile])

  if (isLoading) return <LoadingSpinner />
  if (!profile) return null

  if (profile.role === 'freelancer') {
    return <FreelancerDashboard userId={user!.id} />
  }

  return <ClientDashboard userId={user!.id} />
}
