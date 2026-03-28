import { useQuery } from '@tanstack/react-query'
import {
  Users,
  Briefcase,
  FileText,
  DollarSign,
  AlertCircle,
  ArrowDownToLine,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
} from 'lucide-react'
import { AdminLayout } from './AdminLayout'
import { tables } from '@/blink/client'
import { format } from 'date-fns'
import type { Contract, Dispute, Transaction } from '@/types'

function StatCard({
  label,
  value,
  icon,
  iconBg,
  trend,
  trendLabel,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  iconBg: string
  trend?: number
  trendLabel?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-[hsl(214,32%,91%)] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${iconBg}`}>
          {icon}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${trend >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
            <ArrowUpRight size={12} className={trend < 0 ? 'rotate-180' : ''} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-[hsl(215,28%,17%)] mb-1">{value}</p>
      <p className="text-sm text-[hsl(215,16%,47%)]">{label}</p>
      {trendLabel && <p className="text-xs text-[hsl(215,16%,60%)] mt-0.5">{trendLabel}</p>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: 'Open', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    under_review: { label: 'Under Review', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    resolved_client: { label: 'Resolved (Client)', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    resolved_freelancer: { label: 'Resolved (Freelancer)', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    closed: { label: 'Closed', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
    completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    active: { label: 'Active', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    disputed: { label: 'Disputed', cls: 'bg-red-50 text-red-700 border-red-200' },
    cancelled: { label: 'Cancelled', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
    credit: { label: 'Credit', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    debit: { label: 'Debit', cls: 'bg-red-50 text-red-700 border-red-200' },
    escrow_hold: { label: 'Escrow', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    platform_fee: { label: 'Platform Fee', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
    withdrawal: { label: 'Withdrawal', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    refund: { label: 'Refund', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-50 text-gray-600 border-gray-200' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  )
}

export function AdminDashboard() {
  const { data: allUsers = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => tables.userProfiles.list({ orderBy: { createdAt: 'desc' }, limit: 200 }),
  })

  const { data: allJobs = [] } = useQuery({
    queryKey: ['admin-jobs'],
    queryFn: () => tables.jobs.list({ orderBy: { createdAt: 'desc' }, limit: 200 }),
  })

  const { data: allContracts = [] } = useQuery({
    queryKey: ['admin-contracts'],
    queryFn: () => tables.contracts.list({ orderBy: { createdAt: 'desc' }, limit: 200 }),
  })

  const { data: allDisputes = [] } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: () => tables.disputes.list({ orderBy: { createdAt: 'desc' }, limit: 50 }),
  })

  const { data: allWithdrawals = [] } = useQuery({
    queryKey: ['admin-withdrawals'],
    queryFn: () => tables.withdrawalRequests.list({ orderBy: { createdAt: 'desc' }, limit: 100 }),
  })

  const { data: allTransactions = [] } = useQuery({
    queryKey: ['admin-transactions'],
    queryFn: () => tables.transactions.list({ orderBy: { createdAt: 'desc' }, limit: 20 }),
  })

  const contracts = allContracts as Contract[]
  const disputes = allDisputes as Dispute[]
  const transactions = allTransactions as Transaction[]

  const activeJobs = (allJobs as any[]).filter(j => j.status === 'open' || j.status === 'in_progress').length
  const activeContracts = contracts.filter(c => c.status === 'active' || c.status === 'submitted').length
  const platformRevenue = contracts
    .filter(c => c.paymentStatus === 'released' || c.paymentStatus === 'paid_to_platform')
    .reduce((sum, c) => sum + Number(c.platformFee || 0), 0)
  const pendingDisputes = disputes.filter(d => d.status === 'open' || d.status === 'under_review').length
  const pendingWithdrawals = (allWithdrawals as any[]).filter(w => w.status === 'pending').length

  const recentDisputes = disputes.slice(0, 5)
  const recentTransactions = transactions.slice(0, 6)

  return (
    <AdminLayout title="Dashboard" subtitle="FreelanceHub Escrow Platform Overview">
      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatCard
          label="Total Users"
          value={allUsers.length}
          icon={<Users size={20} className="text-blue-600" />}
          iconBg="bg-blue-50"
        />
        <StatCard
          label="Active Jobs"
          value={activeJobs}
          icon={<Briefcase size={20} className="text-violet-600" />}
          iconBg="bg-violet-50"
        />
        <StatCard
          label="Active Contracts"
          value={activeContracts}
          icon={<FileText size={20} className="text-emerald-600" />}
          iconBg="bg-emerald-50"
        />
        <StatCard
          label="Platform Revenue"
          value={`$${platformRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<TrendingUp size={20} className="text-amber-600" />}
          iconBg="bg-amber-50"
        />
        <StatCard
          label="Pending Disputes"
          value={pendingDisputes}
          icon={<AlertCircle size={20} className="text-red-500" />}
          iconBg="bg-red-50"
        />
        <StatCard
          label="Pending Withdrawals"
          value={pendingWithdrawals}
          icon={<ArrowDownToLine size={20} className="text-orange-500" />}
          iconBg="bg-orange-50"
        />
      </div>

      {/* Two-column below */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Recent disputes */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-[hsl(214,32%,91%)] shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(214,32%,91%)]">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" />
              <h2 className="font-semibold text-[hsl(215,28%,17%)] text-sm">Recent Disputes</h2>
            </div>
            {pendingDisputes > 0 && (
              <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                {pendingDisputes} need attention
              </span>
            )}
          </div>
          {recentDisputes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 size={32} className="text-emerald-400 mb-3" />
              <p className="text-sm font-medium text-[hsl(215,28%,17%)]">No disputes</p>
              <p className="text-xs text-[hsl(215,16%,55%)] mt-1">All disputes have been resolved</p>
            </div>
          ) : (
            <div className="divide-y divide-[hsl(214,32%,93%)]">
              {recentDisputes.map((d) => (
                <div key={d.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-[hsl(210,40%,98%)] transition-colors">
                  <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${d.status === 'open' ? 'bg-red-500' : d.status === 'under_review' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[hsl(215,28%,17%)] truncate">
                      {d.contractTitle ?? `Contract #${d.contractId.slice(-6)}`}
                    </p>
                    <p className="text-xs text-[hsl(215,16%,55%)] mt-0.5 truncate">
                      {d.reason} · by {d.raisedByName ?? 'Unknown'}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <StatusBadge status={d.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[hsl(214,32%,91%)] shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[hsl(214,32%,91%)]">
            <DollarSign size={16} className="text-emerald-600" />
            <h2 className="font-semibold text-[hsl(215,28%,17%)] text-sm">Recent Transactions</h2>
          </div>
          {recentTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <XCircle size={28} className="text-[hsl(215,16%,75%)] mb-2" />
              <p className="text-sm text-[hsl(215,16%,55%)]">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-[hsl(214,32%,93%)]">
              {recentTransactions.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[hsl(210,40%,98%)] transition-colors">
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${t.type === 'credit' ? 'bg-emerald-50' : t.type === 'platform_fee' ? 'bg-amber-50' : 'bg-red-50'}`}>
                    <DollarSign size={14} className={t.type === 'credit' ? 'text-emerald-600' : t.type === 'platform_fee' ? 'text-amber-600' : 'text-red-500'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[hsl(215,28%,17%)] truncate">{t.description || t.type}</p>
                    <p className="text-[10px] text-[hsl(215,16%,55%)] mt-0.5">
                      {t.createdAt ? format(new Date(t.createdAt), 'MMM d, h:mm a') : '—'}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className={`text-sm font-semibold ${t.type === 'credit' ? 'text-emerald-600' : 'text-[hsl(215,28%,30%)]'}`}>
                      {t.type === 'debit' || t.type === 'withdrawal' ? '-' : '+'}${Number(t.amount).toFixed(2)}
                    </p>
                    <StatusBadge status={t.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent contracts */}
      <div className="mt-6 bg-white rounded-xl border border-[hsl(214,32%,91%)] shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[hsl(214,32%,91%)]">
          <FileText size={16} className="text-[hsl(215,42%,40%)]" />
          <h2 className="font-semibold text-[hsl(215,28%,17%)] text-sm">Recent Contracts</h2>
        </div>
        {contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FileText size={28} className="text-[hsl(215,16%,75%)] mb-2" />
            <p className="text-sm text-[hsl(215,16%,55%)]">No contracts yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(214,32%,91%)] bg-[hsl(210,40%,98%)]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Title</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Amount</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Payment</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(214,32%,93%)]">
                {contracts.slice(0, 8).map((c, i) => (
                  <tr key={c.id} className={`hover:bg-[hsl(210,40%,98.5%)] transition-colors ${i % 2 === 0 ? '' : 'bg-[hsl(210,40%,99%)]'}`}>
                    <td className="px-5 py-3 font-medium text-[hsl(215,28%,17%)] max-w-[180px] truncate">{c.title}</td>
                    <td className="px-5 py-3 font-semibold text-[hsl(215,28%,17%)]">
                      ${Number(c.amount).toFixed(2)}
                      <span className="text-xs text-amber-600 ml-1">(fee: ${Number(c.platformFee).toFixed(2)})</span>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-5 py-3"><StatusBadge status={c.paymentStatus} /></td>
                    <td className="px-5 py-3 text-[hsl(215,16%,55%)] text-xs whitespace-nowrap">
                      {c.createdAt ? format(new Date(c.createdAt), 'MMM d, yyyy') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
