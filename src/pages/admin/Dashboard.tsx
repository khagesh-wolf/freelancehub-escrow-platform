import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Users,
  Briefcase,
  DollarSign,
  Clock,
  TrendingUp,
  AlertTriangle,
  CreditCard,
  CheckCircle2,
  ArrowUpRight,
  Wallet,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import toast from 'react-hot-toast'
import { blink, tables } from '../../blink/client'
import { useAuth } from '../../hooks/useAuth'
import { createNotification } from '../../hooks/useNotifications'
import { formatCurrency, formatDate, generateId } from '../../lib/utils'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { AdminLayout } from '../../components/layout/AdminLayout'
import type {
  Contract,
  UserProfile,
  Transaction,
  Dispute,
  WithdrawalRequest,
  Wallet as WalletType,
} from '../../types'

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-md text-sm">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-emerald-600 font-semibold">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export function AdminDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  // Redirect non-admins
  if (profile && profile.role !== 'admin') {
    navigate({ to: '/' })
    return null
  }

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => tables.userProfiles.list({ limit: 500 }) as Promise<UserProfile[]>,
  })

  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['admin-contracts'],
    queryFn: () => tables.contracts.list({ limit: 500 }) as Promise<Contract[]>,
  })

  const { data: transactions = [] } = useQuery({
    queryKey: ['admin-transactions'],
    queryFn: () =>
      tables.transactions.list({
        orderBy: { createdAt: 'desc' },
        limit: 500,
      }) as Promise<Transaction[]>,
  })

  const { data: disputes = [] } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: () =>
      tables.disputes.list({ where: { status: 'open' }, limit: 50 }) as Promise<Dispute[]>,
  })

  const { data: withdrawals = [] } = useQuery({
    queryKey: ['admin-withdrawals'],
    queryFn: () =>
      tables.withdrawalRequests.list({
        where: { status: 'pending' },
        limit: 50,
      }) as Promise<WithdrawalRequest[]>,
  })

  // ── Derived stats ──────────────────────────────────────────────────────────
  const pendingPayments = contracts.filter(c => c.paymentStatus === 'paid_to_platform')
  const totalRevenue = contracts
    .filter(c => c.paymentStatus === 'released')
    .reduce((s, c) => s + (c.platformFee ?? 0), 0)
  const clients = users.filter(u => u.role === 'client')
  const freelancers = users.filter(u => u.role === 'freelancer')
  const userMap = new Map(users.map(u => [u.userId, u]))

  // ── Chart data (last 7 days) ───────────────────────────────────────────────
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dayStr = d.toISOString().split('T')[0]
    const dayRevenue = transactions
      .filter(t => t.type === 'platform_fee' && t.createdAt?.startsWith(dayStr))
      .reduce((s, t) => s + (t.amount ?? 0), 0)
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      revenue: dayRevenue,
    }
  })

  // ── Stats grid config ──────────────────────────────────────────────────────
  const stats = [
    {
      label: 'Total Users',
      value: users.length,
      icon: Users,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
    },
    {
      label: 'Freelancers',
      value: freelancers.length,
      icon: Users,
      iconColor: 'text-violet-600',
      iconBg: 'bg-violet-50',
    },
    {
      label: 'Clients',
      value: clients.length,
      icon: Users,
      iconColor: 'text-green-600',
      iconBg: 'bg-green-50',
    },
    {
      label: 'Active Contracts',
      value: contracts.filter(c => c.status === 'active').length,
      icon: Briefcase,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(totalRevenue),
      icon: TrendingUp,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
    },
    {
      label: 'Pending Escrow',
      value: formatCurrency(pendingPayments.reduce((s, c) => s + (c.amount ?? 0), 0)),
      icon: Clock,
      iconColor: 'text-orange-600',
      iconBg: 'bg-orange-50',
    },
  ]

  // ── Release Payment mutation ───────────────────────────────────────────────
  const releasePayment = useMutation({
    mutationFn: async (contract: Contract) => {
      const now = new Date().toISOString()

      await tables.contracts.update(contract.id, {
        status: 'completed',
        paymentStatus: 'released',
        completedAt: now,
        updatedAt: now,
      })

      const wallets = (await tables.wallets.list({
        where: { userId: contract.userId },
        limit: 1,
      })) as WalletType[]

      if (wallets[0]) {
        await tables.wallets.update(wallets[0].id, {
          balance: (wallets[0].balance ?? 0) + (contract.freelancerAmount ?? 0),
          totalEarned: (wallets[0].totalEarned ?? 0) + (contract.freelancerAmount ?? 0),
          updatedAt: now,
        })
      }

      await tables.transactions.create({
        id: generateId(),
        userId: contract.userId,
        contractId: contract.id,
        type: 'credit',
        amount: contract.freelancerAmount,
        description: `Payment released for: ${contract.title}`,
        status: 'completed',
        stripeId: '',
        createdAt: now,
      })

      await tables.transactions.create({
        id: generateId(),
        userId: contract.clientId,
        contractId: contract.id,
        type: 'platform_fee',
        amount: contract.platformFee,
        description: `Platform fee for: ${contract.title}`,
        status: 'completed',
        stripeId: '',
        createdAt: now,
      })

      await createNotification(
        contract.userId,
        'Payment Released! 🎉',
        `${formatCurrency(contract.freelancerAmount)} has been added to your wallet for "${contract.title}"`,
        'success',
        '/freelancer/wallet',
      )
      await createNotification(
        contract.clientId,
        'Project Completed',
        `Your project "${contract.title}" has been completed and marked as finished.`,
        'success',
        '/client/projects',
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-contracts'] })
      qc.invalidateQueries({ queryKey: ['admin-transactions'] })
      toast.success('Payment released successfully!')
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to release payment'),
  })

  // ── Withdrawal mutation ────────────────────────────────────────────────────
  const handleWithdrawal = useMutation({
    mutationFn: async ({
      id,
      action,
      userId,
      amount,
    }: {
      id: string
      action: 'approved' | 'rejected'
      userId: string
      amount: number
    }) => {
      const now = new Date().toISOString()
      await tables.withdrawalRequests.update(id, {
        status: action === 'approved' ? 'completed' : 'rejected',
        updatedAt: now,
      })

      if (action === 'approved') {
        const wallets = (await tables.wallets.list({
          where: { userId },
          limit: 1,
        })) as WalletType[]

        if (wallets[0]) {
          await tables.wallets.update(wallets[0].id, {
            balance: Math.max(0, (wallets[0].balance ?? 0) - amount),
            totalWithdrawn: (wallets[0].totalWithdrawn ?? 0) + amount,
            updatedAt: now,
          })
        }

        await tables.transactions.create({
          id: generateId(),
          userId,
          contractId: '',
          type: 'withdrawal',
          amount,
          description: 'Withdrawal approved by admin',
          status: 'completed',
          stripeId: '',
          createdAt: now,
        })

        await createNotification(
          userId,
          'Withdrawal Approved ✅',
          `Your withdrawal of ${formatCurrency(amount)} has been approved and is being processed.`,
          'success',
          '/freelancer/wallet',
        )
      } else {
        await createNotification(
          userId,
          'Withdrawal Rejected',
          `Your withdrawal request of ${formatCurrency(amount)} was rejected. Please contact support.`,
          'error',
          '/freelancer/wallet',
        )
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-withdrawals'] })
      qc.invalidateQueries({ queryKey: ['admin-transactions'] })
      toast.success('Withdrawal request updated')
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to process withdrawal'),
  })

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AdminLayout active="/admin">
      <div className="page-container">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard Overview</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Platform health, revenue, and pending actions
            </p>
          </div>
          <div className="text-xs text-muted-foreground bg-card border border-border rounded-lg px-3 py-1.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          {stats.map(s => (
            <div
              key={s.label}
              className="bg-card border border-border rounded-2xl p-4 card-hover"
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.iconBg} ${s.iconColor}`}
              >
                <s.icon size={18} />
              </div>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Chart + Open Disputes */}
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Revenue Chart */}
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-semibold text-foreground">Revenue (Last 7 Days)</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Platform fee collected per day</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium bg-emerald-50 rounded-lg px-2.5 py-1">
                <DollarSign size={12} />
                {formatCurrency(totalRevenue)} total
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(215 16% 47%)' }} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(214 32% 91% / 0.5)' }} />
                <Bar dataKey="revenue" fill="hsl(215 28% 17%)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Open Disputes */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle size={16} className="text-orange-500" />
                Open Disputes
                {disputes.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
                    {disputes.length}
                  </span>
                )}
              </h2>
              <Link
                to="/admin/disputes"
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                View all <ArrowUpRight size={11} />
              </Link>
            </div>
            {disputes.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No open disputes</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {disputes.slice(0, 6).map(d => (
                  <Link
                    key={d.id}
                    to="/admin/disputes"
                    className="flex items-start gap-3 px-5 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{d.reason}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(d.createdAt)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pending Escrow Payments — CORE FEATURE */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <CreditCard size={18} className="text-primary" />
              Pending Escrow Payments
              {pendingPayments.length > 0 && (
                <span className="px-2 py-0.5 bg-primary text-primary-foreground rounded-full text-xs font-semibold">
                  {pendingPayments.length}
                </span>
              )}
            </h2>
            <Link
              to="/admin/payments"
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              View all <ArrowUpRight size={11} />
            </Link>
          </div>

          {contractsLoading ? (
            <div className="divide-y divide-border">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                  <div className="flex-1 h-4 bg-muted rounded" />
                  <div className="w-24 h-4 bg-muted rounded" />
                  <div className="w-20 h-8 bg-muted rounded-lg" />
                </div>
              ))}
            </div>
          ) : pendingPayments.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">No pending payments to release</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {['Contract', 'Freelancer', 'Client', 'Amount', 'Platform Fee', 'To Freelancer', 'Action'].map(h => (
                      <th
                        key={h}
                        className={`px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide ${h === 'Action' ? 'text-center' : h === 'Amount' || h === 'Platform Fee' || h === 'To Freelancer' ? 'text-right' : 'text-left'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingPayments.map(c => {
                    const freelancer = userMap.get(c.userId)
                    const client = userMap.get(c.clientId)
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-border hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-5 py-4 text-sm font-medium text-foreground max-w-[200px]">
                          <span className="truncate block">{c.title}</span>
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">
                          {freelancer?.displayName ?? 'Unknown'}
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">
                          {client?.displayName ?? 'Unknown'}
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-right text-foreground">
                          {formatCurrency(c.amount)}
                        </td>
                        <td className="px-5 py-4 text-sm text-right text-amber-600 font-medium">
                          {formatCurrency(c.platformFee)}
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-right text-emerald-600">
                          {formatCurrency(c.freelancerAmount)}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => releasePayment.mutate(c)}
                            disabled={releasePayment.isPending}
                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            {releasePayment.isPending ? 'Releasing…' : 'Release Payment'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending Withdrawals */}
        {withdrawals.length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Wallet size={18} className="text-primary" />
              <h2 className="font-semibold text-foreground">Pending Withdrawal Requests</h2>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold ml-auto">
                {withdrawals.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {['User', 'Amount', 'Method', 'Requested', 'Actions'].map(h => (
                      <th
                        key={h}
                        className={`px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide ${h === 'Actions' ? 'text-center' : 'text-left'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map(w => {
                    const up = userMap.get(w.userId)
                    return (
                      <tr key={w.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-4 text-sm font-medium text-foreground">
                          {up?.displayName ?? w.userId}
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-emerald-600">
                          {formatCurrency(w.amount)}
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground capitalize">
                          {w.method}
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">
                          {formatDate(w.createdAt)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() =>
                                handleWithdrawal.mutate({
                                  id: w.id,
                                  action: 'approved',
                                  userId: w.userId,
                                  amount: w.amount,
                                })
                              }
                              disabled={handleWithdrawal.isPending}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() =>
                                handleWithdrawal.mutate({
                                  id: w.id,
                                  action: 'rejected',
                                  userId: w.userId,
                                  amount: w.amount,
                                })
                              }
                              disabled={handleWithdrawal.isPending}
                              className="px-3 py-1.5 bg-destructive text-white rounded-lg text-xs font-semibold hover:bg-destructive/90 transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
