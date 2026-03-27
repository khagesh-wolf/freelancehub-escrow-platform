import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from '@tanstack/react-router'
import {
  Briefcase,
  Plus,
  Search,
  DollarSign,
  FileCheck,
  Clock,
  Bell,
  ArrowRight,
  TrendingUp,
  Users,
} from 'lucide-react'
import { blink, tables } from '../../blink/client'
import { useAuth } from '../../hooks/useAuth'
import { useNotifications } from '../../hooks/useNotifications'
import { formatCurrency, formatDate, timeAgo } from '../../lib/utils'
import { StatusBadge } from '../../components/ui/StatusBadge'
import type { Contract, Job, Notification } from '../../types'

export function ClientDashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { notifications } = useNotifications(user?.id)

  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['client-contracts', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      return (await tables.contracts.list({
        where: { clientId: user.id },
        orderBy: { createdAt: 'desc' },
        limit: 10,
      })) as Contract[]
    },
    enabled: !!user?.id,
  })

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['client-jobs', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      return (await tables.jobs.list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        limit: 10,
      })) as Job[]
    },
    enabled: !!user?.id,
  })

  const activeContracts = contracts.filter(c =>
    ['active', 'submitted', 'revision'].includes(c.status)
  )
  const openJobs = jobs.filter(j => j.status === 'open')
  const totalSpent = contracts
    .filter(c => c.paymentStatus === 'released')
    .reduce((s, c) => s + Number(c.amount), 0)
  const inEscrow = contracts
    .filter(c => c.paymentStatus === 'paid_to_platform')
    .reduce((s, c) => s + Number(c.amount), 0)
  const totalProposals = openJobs.reduce((s, j) => s + Number(j.proposalsCount || 0), 0)

  const stats = [
    {
      label: 'Active Projects',
      value: activeContracts.length,
      icon: Briefcase,
      colorClass: 'text-primary bg-primary/10',
      trend: null,
    },
    {
      label: 'Open Jobs',
      value: openJobs.length,
      icon: FileCheck,
      colorClass: 'text-emerald-600 bg-emerald-50',
      trend: null,
    },
    {
      label: 'Total Spent',
      value: formatCurrency(totalSpent),
      icon: DollarSign,
      colorClass: 'text-amber-600 bg-amber-50',
      trend: null,
    },
    {
      label: 'In Escrow',
      value: formatCurrency(inEscrow),
      icon: Clock,
      colorClass: 'text-purple-600 bg-purple-50',
      trend: null,
    },
  ]

  const recentNotifications = notifications.slice(0, 4)

  return (
    <div className="page-container pt-24 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {profile?.displayName?.split(' ')[0] ?? 'there'}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your projects and find great talent
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

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(stat => (
          <div
            key={stat.label}
            className="bg-card border border-border rounded-2xl p-5 shadow-sm"
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${stat.colorClass}`}
            >
              <stat.icon size={20} />
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent contracts — 2/3 width */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Recent Projects</h2>
            <Link
              to="/client/projects"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {contractsLoading ? (
            <div className="divide-y divide-border">
              {Array(4)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-4 animate-pulse">
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/3" />
                    </div>
                    <div className="h-6 bg-muted rounded w-20" />
                  </div>
                ))}
            </div>
          ) : contracts.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Briefcase size={28} className="text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground mb-1">No projects yet</p>
              <p className="text-sm text-muted-foreground mb-5">
                Post your first job to start working with talented freelancers
              </p>
              <button
                onClick={() => navigate({ to: '/client/post-job' })}
                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Post a Job
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {contracts.slice(0, 6).map(c => (
                <div
                  key={c.id}
                  onClick={() =>
                    navigate({
                      to: '/client/projects/$contractId',
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
                    <span className="text-sm font-bold text-foreground">
                      {formatCurrency(Number(c.amount))}
                    </span>
                    <StatusBadge status={c.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Quick Actions */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h2 className="font-semibold text-foreground mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button
                onClick={() => navigate({ to: '/client/post-job' })}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border hover:bg-muted/50 hover:border-primary/30 transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Plus size={16} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Post a New Job</p>
                  <p className="text-xs text-muted-foreground">Find skilled freelancers</p>
                </div>
              </button>
              <button
                onClick={() => navigate({ to: '/browse' })}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border hover:bg-muted/50 hover:border-primary/30 transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Users size={16} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Browse Freelancers</p>
                  <p className="text-xs text-muted-foreground">Discover top talent</p>
                </div>
              </button>
              <button
                onClick={() => navigate({ to: '/client/projects' })}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border hover:bg-muted/50 hover:border-primary/30 transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <TrendingUp size={16} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Manage Projects</p>
                  <p className="text-xs text-muted-foreground">
                    {activeContracts.length} active project{activeContracts.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Open jobs snippet */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Open Jobs</h2>
              <Link
                to="/client/projects"
                className="text-xs text-primary hover:underline"
              >
                Manage
              </Link>
            </div>
            {jobsLoading ? (
              <div className="px-5 py-3 space-y-3">
                {Array(3).fill(0).map((_, i) => (
                  <div key={i} className="animate-pulse space-y-1.5">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : openJobs.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <p className="text-sm text-muted-foreground">No open jobs</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {openJobs.slice(0, 4).map(j => (
                  <div key={j.id} className="px-5 py-3.5">
                    <p className="text-sm font-medium text-foreground truncate">{j.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {Number(j.proposalsCount) || 0} proposal
                      {Number(j.proposalsCount) !== 1 ? 's' : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent notifications */}
          {recentNotifications.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <Bell size={15} />
                  Notifications
                </h2>
              </div>
              <div className="divide-y divide-border">
                {recentNotifications.map(n => (
                  <div key={n.id} className="px-5 py-3.5">
                    <p
                      className={`text-sm font-medium ${
                        n.isRead === '0' ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {n.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pending proposals callout */}
      {totalProposals > 0 && (
        <div className="mt-6 bg-primary/5 border border-primary/20 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Search size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {totalProposals} proposal{totalProposals !== 1 ? 's' : ''} awaiting review
              </p>
              <p className="text-xs text-muted-foreground">
                Freelancers have applied to your open jobs
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate({ to: '/client/projects' })}
            className="flex-shrink-0 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Review
          </button>
        </div>
      )}
    </div>
  )
}
