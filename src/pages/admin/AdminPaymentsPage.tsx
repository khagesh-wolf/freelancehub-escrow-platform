import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DollarSign, Wallet, TrendingUp, Clock, CheckCircle2, XCircle,
  ArrowDownCircle, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatCard } from '../../components/shared/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/shared/EmptyState'
import { blink, tables } from '../../blink/client'
import { formatCurrency, formatDate, timeAgo } from '../../lib/utils'
import { FUNCTION_URLS } from '../../lib/functions'
import type { Contract, Transaction, WithdrawalRequest, UserProfile } from '../../types'

// ─── helpers ──────────────────────────────────────────────────────────────────
const PAYMENT_LABELS: Record<string, string> = {
  unpaid: 'Unpaid',
  paid_to_platform: 'In Escrow',
  released: 'Released',
  refunded: 'Refunded',
}

function paymentBadgeClass(status: string) {
  if (status === 'released') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (status === 'paid_to_platform') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  if (status === 'refunded') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
}

function withdrawalBadgeClass(status: string) {
  if (status === 'completed' || status === 'approved') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (status === 'pending') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  if (status === 'rejected') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  return 'bg-gray-100 text-gray-600'
}

function txTypeBadgeClass(type: string) {
  if (type === 'credit') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (type === 'debit') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  if (type === 'platform_fee') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
  if (type === 'withdrawal') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
}

// ─── release dialog ───────────────────────────────────────────────────────────
function ReleaseDialog({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const qc = useQueryClient()

  const handleRelease = async () => {
    setLoading(true)
    try {
      const token = await blink.auth.getValidToken()
      const res = await fetch(FUNCTION_URLS.releasePayment, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: contract.id, adminNotes: notes }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Payment released')
      qc.invalidateQueries({ queryKey: ['admin-escrow-contracts'] })
      onClose()
    } catch {
      toast.error('Failed to release payment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-green-600" />
            Release Payment
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
            <p className="font-medium">{contract.title}</p>
            <p className="text-muted-foreground">Total: {formatCurrency(contract.amount)}</p>
            <p className="text-muted-foreground">Freelancer receives: {formatCurrency(contract.freelancerAmount)}</p>
            <p className="text-muted-foreground">Platform fee: {formatCurrency(contract.platformFee)}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Admin Notes</Label>
            <Textarea
              placeholder="Optional notes…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            className="gradient-amber border-0 text-white hover:opacity-90"
            onClick={handleRelease}
            disabled={loading}
          >
            {loading ? 'Releasing…' : 'Release Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── reject dialog ────────────────────────────────────────────────────────────
function RejectWithdrawalDialog({
  wr, onClose,
}: {
  wr: WithdrawalRequest; onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const qc = useQueryClient()

  const handleReject = async () => {
    setLoading(true)
    try {
      const token = await blink.auth.getValidToken()
      const res = await fetch(FUNCTION_URLS.processWithdrawal, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId: wr.id, action: 'reject', adminNotes: reason }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Withdrawal rejected')
      qc.invalidateQueries({ queryKey: ['admin-all-withdrawals'] })
      onClose()
    } catch {
      toast.error('Failed to reject')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle size={18} /> Reject Withdrawal
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Rejecting withdrawal of <strong>{formatCurrency(wr.amount)}</strong> via {wr.method.toUpperCase()}.
          </p>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Textarea
              placeholder="Rejection reason…"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="destructive" onClick={handleReject} disabled={loading}>
            {loading ? 'Rejecting…' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── main export ──────────────────────────────────────────────────────────────
export function AdminPaymentsPage() {
  const qc = useQueryClient()
  const [releaseTarget, setReleaseTarget] = useState<Contract | null>(null)
  const [rejectTarget, setRejectTarget] = useState<WithdrawalRequest | null>(null)

  const { data: allContracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['admin-all-contracts-payments'],
    queryFn: async () => {
      const items = await tables.contracts.list({ orderBy: { createdAt: 'desc' }, limit: 200 })
      return items as Contract[]
    },
  })

  const { data: allWithdrawals = [], isLoading: withdrawalsLoading } = useQuery({
    queryKey: ['admin-all-withdrawals'],
    queryFn: async () => {
      const items = await tables.withdrawalRequests.list({ orderBy: { createdAt: 'desc' }, limit: 100 })
      return items as WithdrawalRequest[]
    },
  })

  const { data: allTransactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['admin-all-transactions'],
    queryFn: async () => {
      const items = await tables.transactions.list({ orderBy: { createdAt: 'desc' }, limit: 200 })
      return items as Transaction[]
    },
  })

  const { data: userProfiles = [] } = useQuery({
    queryKey: ['admin-profiles-map'],
    queryFn: () => tables.userProfiles.list({ limit: 500 }) as Promise<UserProfile[]>,
  })

  const profileMap = Object.fromEntries(userProfiles.map(p => [p.userId, p]))

  // Approve withdrawal
  const approveWithdrawal = useMutation({
    mutationFn: async (wrId: string) => {
      const token = await blink.auth.getValidToken()
      const res = await fetch(FUNCTION_URLS.processWithdrawal, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId: wrId, action: 'approve' }),
      })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => { toast.success('Withdrawal approved'); qc.invalidateQueries({ queryKey: ['admin-all-withdrawals'] }) },
    onError: () => toast.error('Failed to approve'),
  })

  // Summary stats
  const totalEscrow = allContracts
    .filter(c => c.paymentStatus === 'paid_to_platform')
    .reduce((s, c) => s + (c.amount || 0), 0)
  const totalReleased = allContracts
    .filter(c => c.paymentStatus === 'released')
    .reduce((s, c) => s + (c.freelancerAmount || 0), 0)
  const platformRevenue = allContracts
    .filter(c => c.paymentStatus === 'released')
    .reduce((s, c) => s + (c.platformFee || 0), 0)
  const pendingWithdrawalsCount = allWithdrawals.filter(w => w.status === 'pending').length

  // Escrow queue
  const escrowContracts = allContracts.filter(c => c.paymentStatus === 'paid_to_platform')

  return (
    <div className="page-container space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Payments & Escrow</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage payments, escrow releases and withdrawals</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Escrow Holdings" value={formatCurrency(totalEscrow)} icon={Wallet} iconColor="text-amber-500" subtitle="Awaiting release" />
        <StatCard title="Total Released" value={formatCurrency(totalReleased)} icon={CheckCircle2} iconColor="text-green-500" subtitle="To freelancers" />
        <StatCard title="Platform Revenue" value={formatCurrency(platformRevenue)} icon={TrendingUp} iconColor="text-blue-500" subtitle="Earned fees" />
        <StatCard title="Pending Withdrawals" value={pendingWithdrawalsCount} icon={Clock} iconColor="text-orange-500" subtitle="Awaiting approval" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="escrow">
        <TabsList>
          <TabsTrigger value="escrow">
            Escrow Queue ({escrowContracts.length})
          </TabsTrigger>
          <TabsTrigger value="withdrawals">
            Withdrawals ({allWithdrawals.length})
          </TabsTrigger>
          <TabsTrigger value="transactions">
            Transaction Log ({allTransactions.length})
          </TabsTrigger>
        </TabsList>

        {/* Escrow queue */}
        <TabsContent value="escrow" className="mt-4">
          {contractsLoading ? (
            <div className="py-16 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : escrowContracts.length === 0 ? (
            <EmptyState icon={Wallet} title="No contracts in escrow" description="All payments have been released." />
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Contract</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Freelancer</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Client</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Date</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {escrowContracts.map(c => {
                      const freelancer = profileMap[c.userId]
                      const client = profileMap[c.clientId]
                      const canRelease = c.status === 'submitted' || c.status === 'completed'
                      return (
                        <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-medium text-foreground truncate max-w-[160px]">{c.title}</p>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-xs text-foreground">
                            {freelancer?.displayName || c.userId.slice(0, 10) + '…'}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-xs text-foreground">
                            {client?.displayName || c.clientId.slice(0, 10) + '…'}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-foreground">{formatCurrency(c.amount)}</p>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <StatusBadge status={c.status} />
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                            {formatDate(c.createdAt)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Button
                              size="sm"
                              className={canRelease ? 'gradient-amber border-0 text-white hover:opacity-90 h-7 text-xs' : 'h-7 text-xs'}
                              variant={canRelease ? 'default' : 'ghost'}
                              disabled={!canRelease}
                              onClick={() => canRelease && setReleaseTarget(c)}
                            >
                              {canRelease ? 'Release' : 'Not ready'}
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Withdrawals */}
        <TabsContent value="withdrawals" className="mt-4">
          {withdrawalsLoading ? (
            <div className="py-16 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : allWithdrawals.length === 0 ? (
            <EmptyState icon={ArrowDownCircle} title="No withdrawal requests" description="No freelancers have requested withdrawals yet." />
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Method</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Account</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Date</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allWithdrawals.map(wr => {
                      const user = profileMap[wr.userId]
                      const isPending = wr.status === 'pending'
                      return (
                        <tr key={wr.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3">
                            <p className="text-sm font-medium text-foreground">
                              {user?.displayName || wr.userId.slice(0, 12) + '…'}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-foreground">{formatCurrency(wr.amount)}</p>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-xs uppercase font-medium text-muted-foreground">{wr.method}</span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground truncate max-w-[120px]">
                            {wr.accountDetails || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${withdrawalBadgeClass(wr.status)}`}>
                              {wr.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                            {timeAgo(wr.createdAt)}
                          </td>
                          <td className="px-5 py-3">
                            {isPending && (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-green-700 hover:bg-green-50"
                                  onClick={() => approveWithdrawal.mutate(wr.id)}
                                  disabled={approveWithdrawal.isPending}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-red-600 hover:bg-red-50"
                                  onClick={() => setRejectTarget(wr)}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Transaction log */}
        <TabsContent value="transactions" className="mt-4">
          {txLoading ? (
            <div className="py-16 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : allTransactions.length === 0 ? (
            <EmptyState icon={FileText} title="No transactions" description="No transactions recorded yet." />
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Description</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allTransactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${txTypeBadgeClass(tx.type)}`}>
                            {tx.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground">{formatCurrency(tx.amount)}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground truncate max-w-[200px]">
                          {tx.description || '—'}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <StatusBadge status={tx.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {timeAgo(tx.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {releaseTarget && (
        <ReleaseDialog contract={releaseTarget} onClose={() => setReleaseTarget(null)} />
      )}
      {rejectTarget && (
        <RejectWithdrawalDialog wr={rejectTarget} onClose={() => setRejectTarget(null)} />
      )}
    </div>
  )
}
