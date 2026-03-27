import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from '@tanstack/react-router'
import {
  Briefcase, DollarSign, Clock, CheckCircle,
  Search, User, AlertTriangle, ChevronRight, Wallet,
} from 'lucide-react'
import { blink, tables } from '../../blink/client'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDate } from '../../lib/utils'
import { StatusBadge } from '../../components/ui/StatusBadge'
import type { Contract, Proposal, Wallet as WalletType } from '../../types'

export function FreelancerDashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['freelancer-contracts', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      return await tables.contracts.list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        limit: 10,
      }) as Contract[]
    },
    enabled: !!user?.id,
  })

  const { data: proposals = [], isLoading: proposalsLoading } = useQuery({
    queryKey: ['freelancer-proposals', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      return await tables.proposals.list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        limit: 10,
      }) as Proposal[]
    },
    enabled: !!user?.id,
  })

  const { data: wallet } = useQuery({
    queryKey: ['wallet', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const ws = await tables.wallets.list({ where: { userId: user.id }, limit: 1 })
      return (ws[0] ?? null) as WalletType | null
    },
    enabled: !!user?.id,
  })

  const activeContracts = contracts.filter(c =>
    ['active', 'submitted', 'revision'].includes(c.status)
  )
  const pendingProposals = proposals.filter(p => p.status === 'pending')
  const completedContracts = contracts.filter(c => c.status === 'completed')

  const stats = [
    {
      label: 'Active Contracts',
      value: contractsLoading ? '—' : activeContracts.length,
      icon: Briefcase,
      color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400',
      href: '/freelancer/contracts',
    },
    {
      label: 'Pending Proposals',
      value: proposalsLoading ? '—' : pendingProposals.length,
      icon: Clock,
      color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400',
      href: null,
    },
    {
      label: 'Available Balance',
      value: formatCurrency(wallet?.balance ?? 0),
      icon: DollarSign,
      color: 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400',
      href: '/freelancer/wallet',
    },
    {
      label: 'Completed Jobs',
      value: contractsLoading ? '—' : completedContracts.length,
      icon: CheckCircle,
      color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400',
      href: '/freelancer/contracts',
    },
  ]

  const firstName = profile?.displayName?.split(' ')[0] ?? 'there'

  return (
    <div className="page-container pt-24">
      <div className="animate-fade-in">
        {/* Suspension warning */}
        {Number(profile?.isSuspended) > 0 && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3">
            <AlertTriangle size={20} className="text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">Account Suspended</p>
              <p className="text-sm text-destructive/80">
                Your account has been suspended. Please contact support for assistance.
              </p>
            </div>
          </div>
        )}

        {/* Approval pending warning */}
        {Number(profile?.isApproved) === 0 && Number(profile?.isSuspended) === 0 && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl flex items-start gap-3">
            <AlertTriangle size={20} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-800 dark:text-yellow-300">Profile Pending Approval</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                Your profile is under review. You can browse jobs and submit proposals while you wait.
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Welcome back, {firstName}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your work and earnings
            </p>
          </div>
          <button
            onClick={() => navigate({ to: '/jobs' })}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors self-start sm:self-auto"
          >
            <Search size={16} />
            Find Jobs
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((s) => (
            <div
              key={s.label}
              onClick={() => s.href && navigate({ to: s.href as any })}
              className={`bg-card border border-border rounded-2xl p-5 ${s.href ? 'cursor-pointer card-hover' : ''}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
                <s.icon size={20} />
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Main content grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Active Contracts */}
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Active Contracts</h2>
              <Link
                to="/freelancer/contracts"
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                View all <ChevronRight size={12} />
              </Link>
            </div>

            {contractsLoading ? (
              <div className="divide-y divide-border">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="px-5 py-4 flex items-center gap-3 animate-pulse">
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                    <div className="h-6 bg-muted rounded-full w-20" />
                  </div>
                ))}
              </div>
            ) : activeContracts.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Briefcase size={36} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">No active contracts</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Submit proposals on jobs to get started
                </p>
                <button
                  onClick={() => navigate({ to: '/jobs' })}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Browse Jobs
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {activeContracts.map((c) => (
                  <div
                    key={c.id}
                    onClick={() =>
                      navigate({
                        to: '/freelancer/contracts/$contractId',
                        params: { contractId: c.id },
                      })
                    }
                    className="flex items-center gap-3 px-5 py-4 hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Due: {formatDate(c.deadline)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm font-semibold text-foreground">
                        {formatCurrency(c.freelancerAmount)}
                      </span>
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Quick Actions */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h2 className="font-semibold text-foreground mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <button
                  onClick={() => navigate({ to: '/jobs' })}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors text-left group"
                >
                  <Search size={18} className="text-primary" />
                  <span className="text-sm font-medium text-foreground">Browse Jobs</span>
                  <ChevronRight size={14} className="text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <button
                  onClick={() => navigate({ to: '/freelancer/profile' })}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors text-left group"
                >
                  <User size={18} className="text-primary" />
                  <span className="text-sm font-medium text-foreground">Edit Profile</span>
                  <ChevronRight size={14} className="text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <button
                  onClick={() => navigate({ to: '/freelancer/wallet' })}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors text-left group"
                >
                  <Wallet size={18} className="text-primary" />
                  <span className="text-sm font-medium text-foreground">View Wallet</span>
                  <ChevronRight size={14} className="text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            </div>

            {/* Recent Proposals */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-semibold text-foreground">Recent Proposals</h2>
              </div>
              {proposalsLoading ? (
                <div className="px-5 py-4 space-y-3 animate-pulse">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="h-4 bg-muted rounded w-1/2" />
                      <div className="h-5 bg-muted rounded-full w-16" />
                    </div>
                  ))}
                </div>
              ) : proposals.length === 0 ? (
                <div className="px-5 py-6 text-center">
                  <p className="text-sm text-muted-foreground">No proposals yet</p>
                  <button
                    onClick={() => navigate({ to: '/jobs' })}
                    className="mt-3 text-xs text-primary hover:underline"
                  >
                    Browse jobs →
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {proposals.slice(0, 4).map((p) => (
                    <div key={p.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {formatCurrency(p.bidAmount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.estimatedDays}d delivery
                          </p>
                        </div>
                        <StatusBadge status={p.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
