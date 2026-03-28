import { useState, useEffect } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import {
  DollarSign, Briefcase, Clock, CheckCircle, ArrowRight,
  TrendingUp, FileText, Wallet, ChevronRight, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { tables } from '@/blink/client'
import { formatCurrency, formatDate, getStatusColor, safeParseJSON, formatRelativeTime } from '@/lib/utils'
import type { Contract, Proposal, Wallet as WalletType } from '@/types'

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    submitted: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    accepted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    revision: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    withdrawn: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.pending}`}>
      {status}
    </span>
  )
}

function SkeletonCard() {
  return <div className="h-20 bg-muted/60 border border-border rounded-xl animate-pulse" />
}

export function FreelancerDashboard() {
  const { user, profile, isLoading } = useAuth()
  const navigate = useNavigate()

  const [contracts, setContracts] = useState<Contract[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [wallet, setWallet] = useState<WalletType | null>(null)
  const [loading, setLoading] = useState(true)

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
    setLoading(true)
    try {
      const [contractsData, proposalsData, walletData] = await Promise.all([
        tables.contracts.list({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, limit: 20 }),
        tables.proposals.list({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, limit: 20 }),
        tables.wallets.list({ where: { userId: user.id }, limit: 1 }),
      ])
      setContracts(contractsData as Contract[])
      setProposals(proposalsData as Proposal[])
      setWallet((walletData[0] as WalletType) || null)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const activeContracts = contracts.filter(c =>
    c.status === 'active' || c.status === 'submitted' || c.status === 'revision'
  )
  const activeProposals = proposals.filter(p => p.status === 'pending')
  const totalEarned = Number(wallet?.totalEarned ?? 0)
  const availableBalance = Number(wallet?.balance ?? 0)
  const pendingBalance = Number(wallet?.pendingBalance ?? 0)

  if (isLoading || !profile) {
    return (
      <div className="page-container">
        <div className="mb-8">
          <div className="h-8 w-64 bg-muted/60 rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-48 bg-muted/40 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted/60 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  const firstName = profile.displayName?.split(' ')[0] || 'Freelancer'

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Welcome back, {firstName}! 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              Here's your freelance dashboard — keep up the great work!
            </p>
          </div>
          <Button
            className="gradient-amber text-white border-0 hidden sm:flex"
            onClick={() => navigate({ to: '/freelancer/jobs' })}
          >
            <Zap size={15} className="mr-1.5" />
            Find Work
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Total Earned',
            value: formatCurrency(totalEarned),
            icon: TrendingUp,
            iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            label: 'Available Balance',
            value: formatCurrency(availableBalance),
            icon: Wallet,
            iconBg: 'bg-blue-100 dark:bg-blue-900/30',
            iconColor: 'text-blue-600 dark:text-blue-400',
          },
          {
            label: 'Active Proposals',
            value: activeProposals.length.toString(),
            icon: FileText,
            iconBg: 'bg-amber-100 dark:bg-amber-900/30',
            iconColor: 'text-amber-600 dark:text-amber-400',
          },
          {
            label: 'Active Contracts',
            value: activeContracts.length.toString(),
            icon: Briefcase,
            iconBg: 'bg-primary/10',
            iconColor: 'text-primary',
          },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-5 card-hover">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                <stat.icon size={16} className={stat.iconColor} />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground leading-none mb-1">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Pending Balance Banner */}
      {pendingBalance > 0 && (
        <div className="mb-6 flex items-center gap-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl px-5 py-3.5">
          <Clock size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-sm text-amber-800 dark:text-amber-300">
            You have <span className="font-semibold">{formatCurrency(pendingBalance)}</span> in escrow pending release.
          </span>
          <Button variant="ghost" size="sm" className="ml-auto text-amber-700 dark:text-amber-400 h-7"
            onClick={() => navigate({ to: '/freelancer/wallet' })}>
            View Wallet
          </Button>
        </div>
      )}

      {/* Two Column: Proposals + Contracts */}
      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        {/* Recent Proposals */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Proposals</h2>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground"
              onClick={() => navigate({ to: '/freelancer/jobs' })}>
              Browse Jobs <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : proposals.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <FileText size={32} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No proposals submitted yet</p>
              <Button size="sm" onClick={() => navigate({ to: '/freelancer/jobs' })}>
                Browse Jobs
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {proposals.slice(0, 5).map(proposal => (
                <div key={proposal.id} className="bg-card border border-border rounded-xl p-4 card-hover">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium text-foreground text-sm truncate">
                        {proposal.jobTitle || 'Job Proposal'}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatRelativeTime(proposal.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StatusBadge status={proposal.status} />
                      <span className="text-sm font-semibold text-foreground">
                        {formatCurrency(Number(proposal.bidAmount))}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {proposals.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{proposals.length - 5} more proposals
                </p>
              )}
            </div>
          )}
        </div>

        {/* Active Contracts */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Active Contracts</h2>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground"
              onClick={() => navigate({ to: '/freelancer/contracts' })}>
              View All <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : activeContracts.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Briefcase size={32} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No active contracts yet</p>
              <Button size="sm" onClick={() => navigate({ to: '/freelancer/jobs' })}>
                Find Work
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeContracts.slice(0, 4).map(contract => (
                <Link key={contract.id} to="/freelancer/contracts/$contractId"
                  params={{ contractId: contract.id }} className="block">
                  <div className="bg-card border border-border rounded-xl p-4 card-hover">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-medium text-foreground text-sm truncate">{contract.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Client: {contract.clientName || 'Client'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <StatusBadge status={contract.status} />
                        <span className="text-sm font-semibold text-foreground">
                          {formatCurrency(Number(contract.freelancerAmount))}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                      <Clock size={11} />
                      <span>Due: {formatDate(contract.deadline)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'Browse Jobs',
              icon: Briefcase,
              color: 'bg-primary/10 text-primary',
              onClick: () => navigate({ to: '/freelancer/jobs' }),
            },
            {
              label: 'My Contracts',
              icon: FileText,
              color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
              onClick: () => navigate({ to: '/freelancer/contracts' }),
            },
            {
              label: 'My Wallet',
              icon: DollarSign,
              color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
              onClick: () => navigate({ to: '/freelancer/wallet' }),
            },
            {
              label: 'Edit Profile',
              icon: CheckCircle,
              color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
              onClick: () => navigate({ to: '/freelancer/profile' }),
            },
          ].map(action => (
            <button
              key={action.label}
              onClick={action.onClick}
              className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-border bg-background hover:bg-muted/40 transition-colors group"
            >
              <div className={`p-2.5 rounded-lg ${action.color} group-hover:scale-110 transition-transform`}>
                <action.icon size={18} />
              </div>
              <span className="text-xs font-medium text-foreground">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
