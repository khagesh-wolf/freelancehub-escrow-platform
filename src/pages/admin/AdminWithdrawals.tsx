/**
 * Standalone Withdrawals page — wraps the same UI as the Withdrawals tab
 * in AdminPayments, but accessible via /admin/withdrawals route.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowDownToLine, CheckCircle2, XCircle } from 'lucide-react'
import { AdminLayout } from './AdminLayout'
import { tables } from '@/blink/client'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import type { WithdrawalRequest } from '@/types'

function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    completed: 'bg-blue-50 text-blue-700 border-blue-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${map[status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {status}
    </span>
  )
}

export function AdminWithdrawals() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({})

  const { data: withdrawals = [], isLoading } = useQuery<WithdrawalRequest[]>({
    queryKey: ['admin-withdrawals-page'],
    queryFn: () => tables.withdrawalRequests.list({ orderBy: { createdAt: 'desc' }, limit: 200 }) as Promise<WithdrawalRequest[]>,
  })

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await tables.withdrawalRequests.update(id, { status: 'approved', adminNotes: 'Approved by admin' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals-page'] })
      toast.success('Withdrawal approved')
    },
    onError: () => toast.error('Failed to approve withdrawal'),
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      await tables.withdrawalRequests.update(id, { status: 'rejected', adminNotes: notes || 'Rejected by admin' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals-page'] })
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

  const pendingTotal = withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + Number(w.amount || 0), 0)

  return (
    <AdminLayout title="Withdrawal Requests" subtitle="Approve or reject freelancer withdrawal requests">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Requests', value: withdrawals.length, color: 'text-[hsl(215,28%,17%)]' },
          { label: 'Pending', value: withdrawals.filter(w => w.status === 'pending').length, color: 'text-amber-600' },
          { label: 'Approved', value: withdrawals.filter(w => w.status === 'approved').length, color: 'text-emerald-600' },
          { label: 'Pending Amount', value: `$${pendingTotal.toFixed(2)}`, color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-[hsl(214,32%,91%)] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
            <p className="text-xs text-[hsl(215,16%,55%)] mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
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

      {/* List */}
      <div className="bg-white rounded-xl border border-[hsl(214,32%,91%)] shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-[3px] border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ArrowDownToLine size={36} className="text-[hsl(215,16%,75%)] mb-3" />
            <p className="font-medium text-[hsl(215,28%,17%)]">No withdrawal requests</p>
            <p className="text-sm text-[hsl(215,16%,55%)] mt-1">Nothing to show for this filter</p>
          </div>
        ) : (
          <div className="divide-y divide-[hsl(214,32%,93%)]">
            {filtered.map(w => (
              <div key={w.id} className="px-5 py-4 hover:bg-[hsl(210,40%,98.5%)] transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-[hsl(215,42%,12%)] text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                        {w.userName?.[0]?.toUpperCase() ?? 'U'}
                      </div>
                      <div>
                        <p className="font-semibold text-[hsl(215,28%,17%)]">{w.userName ?? `User #${w.userId?.slice(-6)}`}</p>
                        <p className="text-xs text-[hsl(215,16%,55%)]">
                          {w.createdAt ? format(new Date(w.createdAt), 'MMM d, yyyy · h:mm a') : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
                      <div>
                        <p className="text-[10px] font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide mb-0.5">Amount</p>
                        <p className="text-lg font-bold text-[hsl(215,28%,17%)]">${Number(w.amount).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide mb-0.5">Method</p>
                        <p className="text-sm font-medium text-[hsl(215,28%,17%)] capitalize">{w.method}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide mb-0.5">Account Details</p>
                        <p className="text-sm text-[hsl(215,28%,30%)] truncate max-w-[160px]">{w.accountDetails || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide mb-0.5">Status</p>
                        <PaymentStatusBadge status={w.status} />
                      </div>
                    </div>
                    {w.adminNotes && (
                      <p className="text-xs text-[hsl(215,16%,55%)] italic bg-[hsl(210,40%,98%)] px-3 py-2 rounded-lg">
                        Admin note: {w.adminNotes}
                      </p>
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
                        className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white border-0 w-28"
                        onClick={() => approveMutation.mutate(w.id)}
                        disabled={approveMutation.isPending}
                      >
                        <CheckCircle2 size={14} />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 text-xs border-red-300 text-red-600 hover:bg-red-50 w-28"
                        onClick={() => rejectMutation.mutate({ id: w.id, notes: rejectNotes[w.id] ?? '' })}
                        disabled={rejectMutation.isPending}
                      >
                        <XCircle size={14} />
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
            {filtered.length} requests · Pending total: ${pendingTotal.toFixed(2)}
          </p>
        </div>
      </div>
    </AdminLayout>
  )
}
