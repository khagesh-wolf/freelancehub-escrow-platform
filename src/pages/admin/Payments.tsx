import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  CreditCard,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  TrendingUp,
  Clock,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  Layers,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { blink, tables } from '../../blink/client'
import { useAuth } from '../../hooks/useAuth'
import { createNotification } from '../../hooks/useNotifications'
import { formatCurrency, formatDate, generateId } from '../../lib/utils'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { AdminLayout } from '../../components/layout/AdminLayout'
import type { Contract, Transaction, UserProfile, Wallet as WalletType } from '../../types'

type PaymentTab = 'escrow' | 'all-contracts' | 'transactions'
type PaymentStatusFilter = 'all' | 'unpaid' | 'paid_to_platform' | 'released' | 'refunded'

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-md text-sm">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-emerald-600 font-semibold">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

const TRANSACTION_TYPE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  credit: { label: 'Credit', color: 'text-emerald-600', icon: ArrowDownLeft },
  debit: { label: 'Debit', color: 'text-red-600', icon: ArrowUpRight },
  escrow_hold: { label: 'Escrow Hold', color: 'text-blue-600', icon: Layers },
  platform_fee: { label: 'Platform Fee', color: 'text-amber-600', icon: TrendingUp },
  withdrawal: { label: 'Withdrawal', color: 'text-violet-600', icon: ArrowUpRight },
  refund: { label: 'Refund', color: 'text-orange-600', icon: ArrowDownLeft },
}

export function AdminPayments() {
  const { profile: adminProfile } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [tab, setTab] = useState<PaymentTab>('escrow')
  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>('all')
  const [search, setSearch] = useState('')

  if (adminProfile && adminProfile.role !== 'admin') {
    navigate({ to: '/' })
    return null
  }

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['admin-contracts'],
    queryFn: () =>
      tables.contracts.list({
        orderBy: { createdAt: 'desc' },
        limit: 500,
      }) as Promise<Contract[]>,
  })

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['admin-transactions'],
    queryFn: () =>
      tables.transactions.list({
        orderBy: { createdAt: 'desc' },
        limit: 500,
      }) as Promise<Transaction[]>,
  })

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => tables.userProfiles.list({ limit: 500 }) as Promise<UserProfile[]>,
  })

  const userMap = new Map(users.map(u => [u.userId, u]))

  // ── Derived ────────────────────────────────────────────────────────────────
  const pendingEscrow = contracts.filter(c => c.paymentStatus === 'paid_to_platform')
  const totalRevenue = contracts
    .filter(c => c.paymentStatus === 'released')
    .reduce((s, c) => s + (c.platformFee ?? 0), 0)
  const totalEscrow = pendingEscrow.reduce((s, c) => s + (c.amount ?? 0), 0)
  const totalTransacted = contracts.reduce((s, c) => s + (c.amount ?? 0), 0)

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartData = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    const dayStr = d.toISOString().split('T')[0]
    const revenue = transactions
      .filter(t => t.type === 'platform_fee' && t.createdAt?.startsWith(dayStr))
      .reduce((s, t) => s + (t.amount ?? 0), 0)
    return {
      day: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue,
    }
  })

  // ── Contract filters ───────────────────────────────────────────────────────
  const filteredContracts = contracts.filter(c => {
    const matchStatus = statusFilter === 'all' || c.paymentStatus === statusFilter
    const q = search.toLowerCase()
    const freelancer = userMap.get(c.userId)
    const client = userMap.get(c.clientId)
    const matchSearch =
      !q ||
      c.title?.toLowerCase().includes(q) ||
      freelancer?.displayName?.toLowerCase().includes(q) ||
      client?.displayName?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const displayContracts =
    tab === 'escrow'
      ? contracts.filter(c => c.paymentStatus === 'paid_to_platform')
      : filteredContracts

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

  const overviewStats = [
    {
      label: 'Total Revenue',
      value: formatCurrency(totalRevenue),
      icon: TrendingUp,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      sub: 'Platform fees collected',
    },
    {
      label: 'In Escrow',
      value: formatCurrency(totalEscrow),
      icon: Clock,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      sub: `${pendingEscrow.length} contracts pending`,
    },
    {
      label: 'Total Transacted',
      value: formatCurrency(totalTransacted),
      icon: DollarSign,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      sub: `Across ${contracts.length} contracts`,
    },
    {
      label: 'Total Transactions',
      value: transactions.length,
      icon: Layers,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      sub: 'All-time activity',
    },
  ]

  const TABS: { key: PaymentTab; label: string }[] = [
    { key: 'escrow', label: `Escrow (${pendingEscrow.length})` },
    { key: 'all-contracts', label: 'All Contracts' },
    { key: 'transactions', label: 'Transactions' },
  ]

  return (
    <AdminLayout active="/admin/payments">
      <div className="page-container">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <CreditCard size={22} className="text-primary" />
              Payments
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage escrow releases, contract payments, and transaction history
            </p>
          </div>
          <button
            onClick={() => {
              qc.invalidateQueries({ queryKey: ['admin-contracts'] })
              qc.invalidateQueries({ queryKey: ['admin-transactions'] })
            }}
            className="p-2 rounded-xl border border-border hover:bg-muted/50 transition-colors text-muted-foreground"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {overviewStats.map(s => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-4 card-hover">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.iconBg} ${s.iconColor}`}>
                <s.icon size={18} />
              </div>
              <p className="text-lg font-bold text-foreground">{s.value}</p>
              <p className="text-xs font-medium text-foreground mt-0.5">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Revenue Chart */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <h2 className="font-semibold text-foreground mb-4">Platform Revenue — Last 14 Days</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} width={44} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(214 32% 91% / 0.5)' }} />
              <Bar dataKey="revenue" fill="hsl(215 28% 17%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 border border-border mb-5 w-fit">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Controls for all-contracts tab */}
        {tab === 'all-contracts' && (
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by title, freelancer, or client…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
              />
            </div>
            <div className="flex items-center bg-muted/50 rounded-xl p-1 border border-border gap-0.5 overflow-x-auto">
              <Filter size={14} className="text-muted-foreground ml-2 mr-1 flex-shrink-0" />
              {(['all', 'unpaid', 'paid_to_platform', 'released', 'refunded'] as PaymentStatusFilter[]).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 capitalize ${
                    statusFilter === s
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s === 'all' ? 'All' : s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Escrow Tab */}
        {tab === 'escrow' && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Clock size={17} className="text-blue-600" />
              <h2 className="font-semibold text-foreground">Pending Escrow Payments</h2>
              <span className="ml-auto px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                {pendingEscrow.length}
              </span>
            </div>

            {contractsLoading ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground animate-pulse">
                Loading…
              </div>
            ) : pendingEscrow.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">No pending payments</p>
                <p className="text-xs text-muted-foreground mt-1">All escrow balances have been released</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {['Contract', 'Freelancer', 'Client', 'Amount', 'Platform Fee', 'To Freelancer', 'Date', 'Action'].map(h => (
                        <th
                          key={h}
                          className={`px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide ${
                            ['Amount', 'Platform Fee', 'To Freelancer', 'Action'].includes(h)
                              ? 'text-right'
                              : 'text-left'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingEscrow.map(c => {
                      const freelancer = userMap.get(c.userId)
                      const client = userMap.get(c.clientId)
                      return (
                        <tr key={c.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-4 text-sm font-medium text-foreground max-w-[180px]">
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
                          <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(c.createdAt)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => releasePayment.mutate(c)}
                              disabled={releasePayment.isPending}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                            >
                              {releasePayment.isPending ? 'Releasing…' : 'Release'}
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
        )}

        {/* All Contracts Tab */}
        {tab === 'all-contracts' && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {['Contract', 'Freelancer', 'Client', 'Amount', 'Fee', 'Status', 'Payment', 'Action'].map(h => (
                      <th
                        key={h}
                        className={`px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide ${
                          ['Amount', 'Fee', 'Action'].includes(h) ? 'text-right' : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayContracts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-sm text-muted-foreground">
                        No contracts match your filter
                      </td>
                    </tr>
                  ) : (
                    displayContracts.map(c => {
                      const freelancer = userMap.get(c.userId)
                      const client = userMap.get(c.clientId)
                      const canRelease = c.paymentStatus === 'paid_to_platform'
                      return (
                        <tr key={c.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3.5 text-sm font-medium text-foreground max-w-[160px]">
                            <span className="truncate block">{c.title}</span>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-muted-foreground">
                            {freelancer?.displayName ?? 'Unknown'}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-muted-foreground">
                            {client?.displayName ?? 'Unknown'}
                          </td>
                          <td className="px-5 py-3.5 text-sm font-semibold text-right text-foreground">
                            {formatCurrency(c.amount)}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-right text-amber-600">
                            {formatCurrency(c.platformFee)}
                          </td>
                          <td className="px-5 py-3.5">
                            <StatusBadge status={c.status} />
                          </td>
                          <td className="px-5 py-3.5">
                            <StatusBadge status={c.paymentStatus} />
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {canRelease ? (
                              <button
                                onClick={() => releasePayment.mutate(c)}
                                disabled={releasePayment.isPending}
                                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                              >
                                Release
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            {!contractsLoading && displayContracts.length > 0 && (
              <div className="px-5 py-3 border-t border-border bg-muted/20">
                <p className="text-xs text-muted-foreground">
                  Showing {displayContracts.length} of {contracts.length} contracts
                </p>
              </div>
            )}
          </div>
        )}

        {/* Transactions Tab */}
        {tab === 'transactions' && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Transaction History</h2>
            </div>
            {txLoading ? (
              <div className="divide-y divide-border">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                    <div className="w-9 h-9 bg-muted rounded-xl" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 bg-muted rounded w-48" />
                      <div className="h-3 bg-muted rounded w-32" />
                    </div>
                    <div className="h-5 bg-muted rounded w-20" />
                  </div>
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No transactions yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {['Type', 'User', 'Description', 'Amount', 'Status', 'Date'].map(h => (
                        <th
                          key={h}
                          className={`px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide ${
                            h === 'Amount' ? 'text-right' : 'text-left'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(t => {
                      const user = userMap.get(t.userId)
                      const txInfo = TRANSACTION_TYPE_LABELS[t.type] ?? {
                        label: t.type,
                        color: 'text-foreground',
                        icon: DollarSign,
                      }
                      const TxIcon = txInfo.icon
                      return (
                        <tr key={t.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className={`flex items-center gap-2 text-sm font-medium ${txInfo.color}`}>
                              <TxIcon size={14} />
                              {txInfo.label}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-muted-foreground">
                            {user?.displayName ?? (
                              <span className="font-mono text-xs">{t.userId.slice(0, 10)}…</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-muted-foreground max-w-[220px]">
                            <span className="truncate block">{t.description}</span>
                          </td>
                          <td className={`px-5 py-3.5 text-sm font-semibold text-right ${txInfo.color}`}>
                            {formatCurrency(t.amount)}
                          </td>
                          <td className="px-5 py-3.5">
                            <StatusBadge status={t.status} />
                          </td>
                          <td className="px-5 py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(t.createdAt)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!txLoading && transactions.length > 0 && (
              <div className="px-5 py-3 border-t border-border bg-muted/20">
                <p className="text-xs text-muted-foreground">
                  {transactions.length} transactions total
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
