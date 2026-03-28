import { useState, useEffect } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { DollarSign, Briefcase, Clock, CheckCircle, ArrowRight, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { tables } from '@/blink/client'
import { formatCurrency, formatDate, getStatusColor, safeParseJSON } from '@/lib/utils'
import type { Contract, Job, Wallet } from '@/types'

export function FreelancerDashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [suggestedJobs, setSuggestedJobs] = useState<Job[]>([])
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  async function loadData() {
    if (!user) return
    setLoading(true)
    try {
      const [contractsData, jobsData, walletData] = await Promise.all([
        tables.contracts.list({ where: { userId: user.id }, limit: 20 }),
        tables.jobs.list({ where: { status: 'open' }, limit: 5 }),
        tables.wallets.list({ where: { userId: user.id }, limit: 1 }),
      ])
      setContracts(contractsData as Contract[])
      setSuggestedJobs(jobsData as Job[])
      setWallet((walletData[0] as Wallet) || null)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const activeContracts = contracts.filter(c => c.status === 'active' || c.status === 'submitted' || c.status === 'revision')
  const completedContracts = contracts.filter(c => c.status === 'completed')

  if (!profile) return <div className="page-container"><p className="text-muted-foreground">Loading profile...</p></div>

  return (
    <div className="page-container">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Welcome back, {profile.displayName?.split(' ')[0]}! 👋</h1>
        <p className="text-muted-foreground mt-1">Here's your freelance dashboard overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Earned', value: formatCurrency(wallet?.totalEarned || 0), icon: DollarSign, color: 'text-emerald-600' },
          { label: 'Wallet Balance', value: formatCurrency(wallet?.balance || 0), icon: TrendingUp, color: 'text-blue-600' },
          { label: 'Active Contracts', value: activeContracts.length.toString(), icon: Clock, color: 'text-amber-600' },
          { label: 'Completed Jobs', value: completedContracts.length.toString(), icon: CheckCircle, color: 'text-green-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon size={16} className={stat.color} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Active Contracts */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Active Contracts</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/freelancer/contracts' })}>
              View All <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />)}</div>
          ) : activeContracts.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Briefcase size={32} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">No active contracts yet</p>
              <Button size="sm" className="mt-3" onClick={() => navigate({ to: '/freelancer/jobs' })}>Browse Jobs</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeContracts.slice(0, 4).map(contract => (
                <Link key={contract.id} to="/freelancer/contracts/$contractId" params={{ contractId: contract.id }} className="block">
                  <div className="bg-card border border-border rounded-xl p-4 card-hover">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-medium text-foreground truncate">{contract.title}</h3>
                        <p className="text-sm text-muted-foreground">Client: {contract.clientName || 'Client'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(contract.status)}`}>{contract.status}</span>
                        <div className="text-sm font-semibold text-foreground mt-1">{formatCurrency(contract.freelancerAmount || 0)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Clock size={12} />
                      <span>Due: {formatDate(contract.deadline)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Suggested Jobs */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Jobs For You</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/freelancer/jobs' })}>
              Browse All <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />)}</div>
          ) : suggestedJobs.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-muted-foreground text-sm">No open jobs right now</p>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestedJobs.map(job => {
                const skills = safeParseJSON<string[]>(job.skillsRequired, [])
                return (
                  <Link key={job.id} to="/freelancer/jobs/$jobId" params={{ jobId: job.id }} className="block">
                    <div className="bg-card border border-border rounded-xl p-4 card-hover">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-medium text-foreground">{job.title}</h3>
                        <span className="text-sm font-semibold text-foreground shrink-0">
                          {job.budgetType === 'fixed' ? formatCurrency(job.budgetMax || 0) : `${formatCurrency(job.budgetMin || 0)}/hr`}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {skills.slice(0, 3).map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                      </div>
                      <span className="text-xs text-muted-foreground">{job.category}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate({ to: '/freelancer/jobs' })}>
            <Briefcase size={16} className="mr-2" /> Browse Jobs
          </Button>
          <Button variant="outline" onClick={() => navigate({ to: '/settings' })}>
            Update Profile
          </Button>
          <Button variant="outline" onClick={() => navigate({ to: '/freelancer/wallet' })}>
            <DollarSign size={16} className="mr-2" /> View Wallet
          </Button>
        </div>
      </div>
    </div>
  )
}
