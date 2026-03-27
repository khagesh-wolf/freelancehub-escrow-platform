import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Users, Briefcase, FileText, DollarSign, Clock, AlertTriangle,
  TrendingUp, CheckCircle, ChevronRight, ShieldCheck, Wallet,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '../../components/shared/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { blink, tables } from '../../blink/client'
import { formatCurrency, formatDate, timeAgo } from '../../lib/utils'
import { FUNCTION_URLS } from '../../lib/functions'
import type { Contract, UserProfile, WithdrawalRequest } from '../../types'

// ─── helpers ──────────────────────────────────────────────────────────────────
function groupByDay(items: { createdAt: string; platformFee?: number }[]) {
  const map: Record<string, number> = {}
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    map[d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })] = 0
  }
  items.forEach(item => {
    const d = new Date(item.createdAt)
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (key in map) map[key] = (map[key] || 0) + (item.platformFee || 0)
  })
  return Object.entries(map).map(([day, revenue]) => ({ day, revenue }))
}

const PIE_COLORS = ['hsl(215,28%,17%)', 'hsl(38,92%,50%)', 'hsl(142,71%,45%)']

// ─── pending withdrawal row ───────────────────────────────────────────────────
function WithdrawalRow({ wr }: { wr: WithdrawalRequest }) {
  const qc = useQueryClient()

  const approve = useMutation({
    mutationFn: async () => {
      const token = await blink.auth.getValidToken()
      const res = await fetch(FUNCTION_URLS.processWithdrawal, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId: wr.id, action: 'approve' }),
      })
      if (!res.ok) throw new Error('Failed to approve')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Withdrawal approved')
      qc.invalidateQueries({ queryKey: ['admin-withdrawals'] })
    },
    onError: () => toast.error('Failed to approve withdrawal'),
  })

  const reject = useMutation({
    mutationFn: async () => {
      const token = await blink.auth.getValidToken()
      const res = await fetch(FUNCTION_URLS.processWithdrawal, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId: wr.id, action: 'reject', adminNotes: 'Rejected by admin' }),
      })
      if (!res.ok) throw new Error('Failed to reject')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Withdrawal rejected')
      qc.invalidateQueries({ queryKey: ['admin-withdrawals'] })
    },
    onError: () => toast.error('Failed to reject withdrawal'),
  })

  return (
    <div className="px-5 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{formatCurrency(wr.amount)}</p>
        <p className="text-xs text-muted-foreground">
          {wr.method.toUpperCase()} · {timeAgo(wr.createdAt)}
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
          onClick={() => approve.mutate()}
          disabled={approve.isPending || reject.isPending}
        >
          {approve.isPending ? '…' : 'Approve'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
          onClick={() => reject.mutate()}
          disabled={approve.isPending || reject.isPending}
        >
          {reject.isPending ? '…' : 'Reject'}
        </Button>
      </div>
    </div>
  )
}

// ─── main export ──────────────────────────────────────────────────────────────
export function AdminDashboardPage() {
  const navigate = useNavigate()

  const { data: allUsers = [] } = useQuery({
    queryKey: ['admin-users-all'],
    queryFn: () => tables.userProfiles.list({ limit: 500 }) as Promise<UserProfile[]>,
  })

  const { data: allContracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['admin-contracts-all'],
    queryFn: async () => {
      const items = await tables.contracts.list({ orderBy: { createdAt: 'desc' }, limit: 200 })
      return items as Contract[]
    },
  })

  const { data: withdrawals = [] } = useQuery({
    queryKey: ['admin-withdrawals'],
    queryFn: async () => {
      const items = await tables.withdrawalRequests.list({
        where: { status: 'pending' },
        orderBy: { createdAt: 'desc' },
        limit: 20,
      })
      return items as WithdrawalRequest[]
    },
  })

  // Stats
  const totalUsers = allUsers.length
  const totalRevenue = allContracts
    .filter(c => c.paymentStatus === 'released')
    .reduce((s, c) => s + (c.platformFee || 0), 0)
  const activeProjects = allContracts.filter(c => c.status === 'active').length
  const pendingPayments = allContracts.filter(c => c.paymentStatus === 'paid_to_platform').length

  // Last 7-day revenue
  const last7Contracts = allContracts.filter(c => {
    const d = new Date(c.createdAt)
    return Date.now() - d.getTime() < 7 * 86400000
  })
  const revenueData = groupByDay(last7Contracts)

  // User distribution
  const clients = allUsers.filter(u => u.role === 'client').length
  const freelancers = allUsers.filter(u => u.role === 'freelancer').length
  const admins = allUsers.filter(u => u.role === 'admin').length
  const pieData = [
    { name: 'Clients', value: clients },
    { name: 'Freelancers', value: freelancers },
    { name: 'Admins', value: admins },
  ].filter(d => d.value > 0)

  const recentContracts = allContracts.slice(0, 5)

  return (
    <div className="page-container space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-amber flex items-center justify-center">
          <ShieldCheck size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Platform overview and management</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={totalUsers}
          icon={Users}
          iconColor="text-blue-500"
          subtitle={`${clients} clients · ${freelancers} freelancers`}
        />
        <StatCard
          title="Platform Revenue"
          value={formatCurrency(totalRevenue)}
          icon={DollarSign}
          iconColor="text-accent"
          subtitle="From released contracts"
        />
        <StatCard
          title="Active Projects"
          value={activeProjects}
          icon={Briefcase}
          iconColor="text-green-500"
          subtitle="Contracts in progress"
        />
        <StatCard
          title="Pending Payments"
          value={pendingPayments}
          icon={Clock}
          iconColor="text-yellow-500"
          subtitle="Awaiting release"
        />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Revenue bar chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-4">Revenue — Last 7 Days</h2>
          {contractsLoading ? (
            <div className="h-52 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="revenue" fill="hsl(38,92%,50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* User distribution pie */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-4">User Distribution</h2>
          {pieData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
              No users yet
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, 'Users']} contentStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pieData.map((entry, i) => (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      {entry.name}
                    </span>
                    <span className="font-medium text-foreground">{entry.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Activity sections */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent contracts */}
        <div className="bg-card border border-border rounded-xl">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Recent Contracts</h2>
            <button
              className="text-xs text-primary hover:underline flex items-center gap-1"
              onClick={() => navigate({ to: '/admin/contracts' as any })}
            >
              View all <ChevronRight size={12} />
            </button>
          </div>
          {recentContracts.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No contracts yet</div>
          ) : (
            <div className="divide-y divide-border">
              {recentContracts.map(c => (
                <div key={c.id} className="px-5 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(c.createdAt)}</p>
                  </div>
                  <div className="ml-3 text-right shrink-0 space-y-0.5">
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(c.amount)}</p>
                    <StatusBadge status={c.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending withdrawals */}
        <div className="bg-card border border-border rounded-xl">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Pending Withdrawals</h2>
            <button
              className="text-xs text-primary hover:underline flex items-center gap-1"
              onClick={() => navigate({ to: '/admin/payments' as any })}
            >
              View all <ChevronRight size={12} />
            </button>
          </div>
          {withdrawals.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <CheckCircle size={24} className="text-green-500" />
              All withdrawals processed
            </div>
          ) : (
            <div className="divide-y divide-border">
              {withdrawals.map(wr => (
                <WithdrawalRow key={wr.id} wr={wr} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Manage Users', icon: Users, to: '/admin/users' },
          { label: 'All Contracts', icon: FileText, to: '/admin/contracts' },
          { label: 'Payments & Escrow', icon: Wallet, to: '/admin/payments' },
          { label: 'Analytics', icon: TrendingUp, to: '/admin/analytics' },
        ].map(item => (
          <div
            key={item.label}
            className="bg-card border border-border rounded-xl p-4 card-hover cursor-pointer flex items-center gap-3"
            onClick={() => navigate({ to: item.to as any })}
          >
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <item.icon size={18} className="text-primary" />
            </div>
            <span className="text-sm font-medium text-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
