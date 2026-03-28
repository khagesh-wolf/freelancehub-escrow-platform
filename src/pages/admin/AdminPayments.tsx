import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CreditCard,
  ArrowDownToLine,
  FileText,
  DollarSign,
  CheckCircle2,
  XCircle,
  Unlock,
  AlertCircle,
  Search,
} from 'lucide-react'
import { AdminLayout } from './AdminLayout'
import { tables } from '@/blink/client'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import type { Contract, WithdrawalRequest, Transaction } from '@/types'

type TabId = 'contracts' | 'withdrawals' | 'transactions'

function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    unpaid: { label: 'Unpaid', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
    paid_to_platform: { label: 'In Escrow', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    released: { label: 'Released', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    refunded: { label: 'Refunded', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-700 border-red-200' },
    completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    credit: { label: 'Credit', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    debit: { label: 'Debit', cls: 'bg-red-50 text-red-700 border-red-200' },
    escrow_hold: { label: 'Escrow Hold', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    platform_fee: { label: 'Platform Fee', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
    withdrawal: { label: 'Withdrawal', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    refund: { label: 'Refund', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    failed: { label: 'Failed', cls: 'bg-red-50 text-red-700 border-red-200' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-50 text-gray-600 border-gray-200' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  )
}

function ContractStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    active: 'bg-blue-50 text-blue-700 border-blue-200',
    submitted: 'bg-violet-50 text-violet-700 border-violet-200',
    revision: 'bg-orange-50 text-orange-700 border-orange-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    disputed: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-gray-50 text-gray-600 border-gray-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${map[status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {status}
    </span>
  )
}

// ─── Contracts Tab ────────────────────────────────────────────────────────────
function ContractsTab() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: contracts = [], isLoading } = useQuery<Contract[]>({
    queryKey: ['admin-contracts-full'],
    queryFn: () => tables.contracts.list({ orderBy: { createdAt: 'desc' }, limit: 200 }) as Promise<Contract[]>,
  })

  const releaseMutation = useMutation({
    mutationFn: async (contractId: string) => {
      await tables.contracts.update(contractId, { status: 'completed', paymentStatus: 'released' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-contracts-full'] })
      toast.success('Escrow payment released to freelancer')
    },
    onError: () => toast.error('Failed to release payment'),
  })

  const filtered = contracts.filter(c =>
    !search || c.title?.toLowerCase().includes(search.toLowerCase())
  )

  const needsRelease = contracts.filter(c => c.paymentStatus === 'paid_to_platform' && c.status === 'completed')

  return (
    <div>
      {needsRelease.length > 0 && (
        <div className="mb-5 flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>{needsRelease.length}</strong> completed contract{needsRelease.length !== 1 ? 's' : ''} awaiting payment release from escrow.
          </p>
        </div>
      )}

      <div className="relative mb-5 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,16%,55%)]" />
        <input
          type="text"
          placeholder="Search contracts…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-[hsl(214,32%,91%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-[hsl(215,28%,17%)] placeholder:text-[hsl(215,16%,60%)]"
        />
      </div>

      <div className="bg-white rounded-xl border border-[hsl(214,32%,91%)] shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-[3px] border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText size={36} className="text-[hsl(215,16%,75%)] mb-3" />
            <p className="font-medium text-[hsl(215,28%,17%)]">No contracts found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[hsl(210,40%,98%)] border-b border-[hsl(214,32%,91%)]">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Title</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Parties</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Amount</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Payment</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(214,32%,93%)]">
                {filtered.map((c, i) => {
                  const canRelease = c.paymentStatus === 'paid_to_platform' && c.status === 'completed'
                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors ${canRelease ? 'bg-amber-50/40' : i % 2 !== 0 ? 'bg-[hsl(210,40%,99.5%)]' : ''} hover:bg-[hsl(210,40%,98.5%)]`}
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-[hsl(215,28%,17%)] max-w-[160px] truncate">{c.title}</p>
                        {canRelease && (
                          <p className="text-[10px] text-amber-600 font-semibold mt-0.5">⚡ Release needed</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-xs text-[hsl(215,28%,30%)]">
                          <span className="font-medium">Client:</span> {c.clientName ?? c.clientId?.slice(-6) ?? '—'}
                        </p>
                        <p className="text-xs text-[hsl(215,28%,30%)]">
                          <span className="font-medium">FL:</span> {c.freelancerName ?? c.userId?.slice(-6) ?? '—'}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-[hsl(215,28%,17%)]">${Number(c.amount).toFixed(2)}</p>
                        <p className="text-[10px] text-amber-600">Fee: ${Number(c.platformFee).toFixed(2)}</p>
                      </td>
                      <td className="px-5 py-3.5"><ContractStatusBadge status={c.status} /></td>
                      <td className="px-5 py-3.5"><PaymentStatusBadge status={c.paymentStatus} /></td>
                      <td className="px-5 py-3.5 text-right">
                        {canRelease ? (
                          <Button
                            size="sm"
                            className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white border-0"
                            onClick={() => releaseMutation.mutate(c.id)}
                            disabled={releaseMutation.isPending}
                          >
                            <Unlock size={13} />
                            Release
                          </Button>
                        ) : (
                          <span className="text-xs text-[hsl(215,16%,60%)]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-[hsl(214,32%,91%)] bg-[hsl(210,40%,98.5%)]">
              <p className="text-xs text-[hsl(215,16%,55%)]">
                {filtered.length} contracts · Total escrow: ${contracts.filter(c => c.paymentStatus === 'paid_to_platform').reduce((s, c) => s + Number(c.amount || 0), 0).toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Withdrawals Tab ──────────────────────────────────────────────────────────
function WithdrawalsTab() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({})

  const { data: withdrawals = [], isLoading } = useQuery<WithdrawalRequest[]>({
    queryKey: ['admin-withdrawals-full'],
    queryFn: () => tables.withdrawalRequests.list({ orderBy: { createdAt: 'desc' }, limit: 200 }) as Promise<WithdrawalRequest[]>,
  })

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await tables.withdrawalRequests.update(id, { status: 'approved', adminNotes: 'Approved by admin' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals-full'] })
      toast.success('Withdrawal approved')
    },
    onError: () => toast.error('Failed to approve withdrawal'),
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      await tables.withdrawalRequests.update(id, { status: 'rejected', adminNotes: notes || 'Rejected by admin' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals-full'] })
      toast.success('Withdrawal rejected')
    },
    onError: () => toast.error('Failed to reject withdrawal'),
  })

  const filtered = withdrawals.filter(w => filter === 'all' || w.status === filter)

  const filterOpts = [
    { value: 'all' as const, label: `All (${withdrawals.length})` },
    { value: 'pending' as const, label: `Pending (${withdrawals.filter(w => w.status === 'pending').length})` },
    { value: 'approved' as const, label: `Approved (${withdrawals.filter(w => w.status === 'approved').length})` },
    { value: 'rejected' as const, label: `Rejected (${withdrawals.filter(w => w.status === 'rejected').length})` },
  ]

  return (
    <div>
      <div className="flex bg-white border border-[hsl(214,32%,91%)] rounded-lg overflow-hidden mb-5 w-fit">
        {filterOpts.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
              filter === f.value
                ? 'bg-[hsl(215,42%,12%)] text-white'
                : 'text-[hsl(215,16%,47%)] hover:bg-[hsl(210,40%,97%)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[hsl(214,32%,91%)] shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-[3px] border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ArrowDownToLine size={36} className="text-[hsl(215,16%,75%)] mb-3" />
            <p className="font-medium text-[hsl(215,28%,17%)]">No withdrawal requests</p>
          </div>
        ) : (
          <div className="divide-y divide-[hsl(214,32%,93%)]">
            {filtered.map(w => (
              <div key={w.id} className="px-5 py-4 hover:bg-[hsl(210,40%,98.5%)] transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-full bg-[hsl(215,42%,12%)] text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                        {w.userName?.[0]?.toUpperCase() ?? 'U'}
                      </div>
                      <div>
                        <p className="font-semibold text-[hsl(215,28%,17%)] text-sm">{w.userName ?? `User #${w.userId?.slice(-6)}`}</p>
                        <p className="text-xs text-[hsl(215,16%,55%)]">
                          {w.createdAt ? format(new Date(w.createdAt), 'MMM d, yyyy · h:mm a') : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      <div>
                        <p className="text-[10px] font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Amount</p>
                        <p className="text-base font-bold text-[hsl(215,28%,17%)]">${Number(w.amount).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Method</p>
                        <p className="text-sm font-medium text-[hsl(215,28%,17%)] capitalize">{w.method}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Account</p>
                        <p className="text-sm text-[hsl(215,28%,30%)] truncate max-w-[120px]">{w.accountDetails || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Status</p>
                        <PaymentStatusBadge status={w.status} />
                      </div>
                    </div>
                    {w.adminNotes && (
                      <p className="text-xs text-[hsl(215,16%,55%)] italic">Admin: {w.adminNotes}</p>
                    )}
                    {w.status === 'pending' && (
                      <div className="mt-3">
                        <input
                          type="text"
                          placeholder="Rejection reason (optional)…"
                          value={rejectNotes[w.id] ?? ''}
                          onChange={e => setRejectNotes(prev => ({ ...prev, [w.id]: e.target.value }))}
                          className="w-full max-w-xs px-3 py-2 text-xs bg-white border border-[hsl(214,32%,91%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-[hsl(215,28%,17%)] placeholder:text-[hsl(215,16%,60%)]"
                        />
                      </div>
                    )}
                  </div>
                  {w.status === 'pending' && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white border-0 w-28"
                        onClick={() => approveMutation.mutate(w.id)}
                        disabled={approveMutation.isPending}
                      >
                        <CheckCircle2 size={13} />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50 w-28"
                        onClick={() => rejectMutation.mutate({ id: w.id, notes: rejectNotes[w.id] ?? '' })}
                        disabled={rejectMutation.isPending}
                      >
                        <XCircle size={13} />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="px-5 py-3 border-t border-[hsl(214,32%,91%)] bg-[hsl(210,40%,98.5%)]">
          <p className="text-xs text-[hsl(215,16%,55%)]">
            {filtered.length} requests · Pending total: ${withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + Number(w.amount || 0), 0).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────
function TransactionsTab() {
  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ['admin-transactions-full'],
    queryFn: () => tables.transactions.list({ orderBy: { createdAt: 'desc' }, limit: 200 }) as Promise<Transaction[]>,
  })

  return (
    <div className="bg-white rounded-xl border border-[hsl(214,32%,91%)] shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <DollarSign size={36} className="text-[hsl(215,16%,75%)] mb-3" />
          <p className="font-medium text-[hsl(215,28%,17%)]">No transactions yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[hsl(210,40%,98%)] border-b border-[hsl(214,32%,91%)]">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Description</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Type</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Amount</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(214,32%,93%)]">
              {transactions.map((t, i) => (
                <tr key={t.id} className={`hover:bg-[hsl(210,40%,98.5%)] transition-colors ${i % 2 !== 0 ? 'bg-[hsl(210,40%,99.5%)]' : ''}`}>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-[hsl(215,28%,17%)] max-w-[220px] truncate">{t.description || '—'}</p>
                    {t.contractId && (
                      <p className="text-[10px] text-[hsl(215,16%,55%)]">Contract: #{t.contractId.slice(-8)}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <PaymentStatusBadge status={t.type} />
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`font-semibold ${t.type === 'credit' || t.type === 'escrow_hold' ? 'text-emerald-600' : t.type === 'debit' || t.type === 'withdrawal' ? 'text-red-600' : 'text-[hsl(215,28%,17%)]'}`}>
                      {t.type === 'debit' || t.type === 'withdrawal' ? '-' : '+'}${Number(t.amount).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <PaymentStatusBadge status={t.status} />
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[hsl(215,16%,55%)] whitespace-nowrap">
                    {t.createdAt ? format(new Date(t.createdAt), 'MMM d, yyyy · h:mm a') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-[hsl(214,32%,91%)] bg-[hsl(210,40%,98.5%)]">
            <p className="text-xs text-[hsl(215,16%,55%)]">{transactions.length} transactions total</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function AdminPayments() {
  const [activeTab, setActiveTab] = useState<TabId>('contracts')

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'contracts', label: 'Contracts & Escrow', icon: <FileText size={15} /> },
    { id: 'withdrawals', label: 'Withdrawals', icon: <ArrowDownToLine size={15} /> },
    { id: 'transactions', label: 'Transactions', icon: <DollarSign size={15} /> },
  ]

  return (
    <AdminLayout title="Payments & Escrow" subtitle="Manage contract payments, withdrawals, and transaction history">
      {/* Tab nav */}
      <div className="flex gap-1 bg-white border border-[hsl(214,32%,91%)] rounded-xl p-1 mb-6 w-fit shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.id
                ? 'bg-[hsl(215,42%,12%)] text-white shadow-sm'
                : 'text-[hsl(215,16%,47%)] hover:bg-[hsl(210,40%,97%)] hover:text-[hsl(215,28%,17%)]'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="animate-fade-in">
        {activeTab === 'contracts' && <ContractsTab />}
        {activeTab === 'withdrawals' && <WithdrawalsTab />}
        {activeTab === 'transactions' && <TransactionsTab />}
      </div>
    </AdminLayout>
  )
}
