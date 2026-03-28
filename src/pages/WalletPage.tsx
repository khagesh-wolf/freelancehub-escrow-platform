import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Wallet,
  ArrowDownCircle,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign,
  CreditCard,
  Banknote,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { tables } from '@/blink/client'
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils'
import type { Wallet as WalletType, Transaction } from '@/types'

// ─── Transaction type config ──────────────────────────────────────────────────
const TX_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  credit:        { label: 'Credit',       color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: TrendingUp },
  debit:         { label: 'Debit',        color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: ArrowDownCircle },
  escrow_hold:   { label: 'Escrow Hold',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  withdrawal:    { label: 'Withdrawal',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: CreditCard },
  platform_fee:  { label: 'Platform Fee', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: DollarSign },
  refund:        { label: 'Refund',       color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400', icon: RefreshCw },
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pending',   color: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700' },
  failed:    { label: 'Failed',    color: 'bg-red-100 text-red-700' },
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  sub?: string
}

function StatCard({ label, value, icon: Icon, iconBg, iconColor, sub }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 card-hover">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${iconBg}`}>
          <Icon size={20} className={iconColor} />
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

function StatSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 animate-pulse">
      <div className="w-10 h-10 bg-muted rounded-xl mb-4" />
      <div className="h-3 w-24 bg-muted rounded mb-2" />
      <div className="h-7 w-32 bg-muted rounded" />
    </div>
  )
}

// ─── Withdraw Dialog ──────────────────────────────────────────────────────────
interface WithdrawDialogProps {
  open: boolean
  onClose: () => void
  maxAmount: number
  userId: string
  onSuccess: () => void
}

function WithdrawDialog({ open, onClose, maxAmount, userId, onSuccess }: WithdrawDialogProps) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'bank' | 'paypal'>('bank')
  const [accountDetails, setAccountDetails] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const num = Number(amount)
      if (!num || num <= 0) throw new Error('Invalid amount')
      if (num > maxAmount) throw new Error(`Insufficient balance. Max: ${formatCurrency(maxAmount)}`)
      if (!accountDetails.trim()) throw new Error('Account details required')
      await tables.withdrawalRequests.create({
        userId,
        amount: num,
        method,
        accountDetails: accountDetails.trim(),
        status: 'pending',
      })
    },
    onSuccess: () => {
      toast.success('Withdrawal request submitted!', { description: 'Your request is under review.' })
      setAmount('')
      setAccountDetails('')
      onSuccess()
      onClose()
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to submit withdrawal'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote size={18} className="text-primary" />
            Request Withdrawal
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Amount <span className="text-muted-foreground font-normal">(max {formatCurrency(maxAmount)})</span>
            </label>
            <div className="relative">
              <DollarSign size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="number"
                min="1"
                max={maxAmount}
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="pl-8"
              />
            </div>
          </div>

          {/* Method */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Withdrawal Method</label>
            <div className="grid grid-cols-2 gap-2">
              {(['bank', 'paypal'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                    method === m
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {m === 'bank' ? '🏦 Bank Transfer' : '💳 PayPal'}
                </button>
              ))}
            </div>
          </div>

          {/* Account details */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {method === 'bank' ? 'Bank Account Details' : 'PayPal Email'}
            </label>
            <Input
              value={accountDetails}
              onChange={e => setAccountDetails(e.target.value)}
              placeholder={method === 'bank' ? 'Account number, routing number...' : 'your@paypal.com'}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !amount || !accountDetails}
            className="gradient-amber text-white border-0"
          >
            {mutation.isPending ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function WalletPage() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) navigate({ to: '/auth/login' })
  }, [isLoading, user])

  const { data: walletData = [], isLoading: walletLoading } = useQuery<WalletType[]>({
    queryKey: ['wallet', user?.id],
    queryFn: () => tables.wallets.list({ where: { userId: user!.id }, limit: 1 }) as Promise<WalletType[]>,
    enabled: !!user,
  })

  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ['transactions', user?.id],
    queryFn: () => tables.transactions.list({ where: { userId: user!.id }, orderBy: { createdAt: 'desc' } }) as Promise<Transaction[]>,
    enabled: !!user,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const wallet = walletData[0] ?? null
  const balance = Number(wallet?.balance ?? 0)
  const pending = Number(wallet?.pendingBalance ?? 0)
  const earned = Number(wallet?.totalEarned ?? 0)
  const withdrawn = Number(wallet?.totalWithdrawn ?? 0)

  const stats = [
    {
      label: 'Available Balance',
      value: formatCurrency(balance),
      icon: Wallet,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      sub: 'Ready to withdraw',
    },
    {
      label: 'Pending Balance',
      value: formatCurrency(pending),
      icon: Clock,
      iconBg: 'bg-amber-100 dark:bg-amber-900/20',
      iconColor: 'text-amber-600 dark:text-amber-400',
      sub: 'In escrow / processing',
    },
    {
      label: 'Total Earned',
      value: formatCurrency(earned),
      icon: TrendingUp,
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/20',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      sub: 'All time earnings',
    },
    {
      label: 'Total Withdrawn',
      value: formatCurrency(withdrawn),
      icon: ArrowUpRight,
      iconBg: 'bg-blue-100 dark:bg-blue-900/20',
      iconColor: 'text-blue-600 dark:text-blue-400',
      sub: 'All time withdrawals',
    },
  ]

  return (
    <div className="page-container animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Wallet size={28} className="text-primary" />
            My Wallet
          </h1>
          <p className="text-muted-foreground mt-1">Manage your earnings and withdrawals</p>
        </div>
        <Button
          onClick={() => setWithdrawOpen(true)}
          disabled={balance <= 0}
          className="gradient-amber text-white border-0 gap-2 shrink-0"
        >
          <Banknote size={16} />
          Withdraw Funds
        </Button>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {walletLoading
          ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          : stats.map(s => <StatCard key={s.label} {...s} />)
        }
      </div>

      {/* ── Transaction History ─────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Transaction History</h2>
          <span className="text-sm text-muted-foreground">{transactions.length} total</span>
        </div>

        {txLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 animate-pulse flex gap-3">
                <div className="w-10 h-10 bg-muted rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 bg-muted rounded" />
                  <div className="h-3 w-56 bg-muted rounded" />
                </div>
                <div className="h-5 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <DollarSign size={24} className="text-muted-foreground opacity-50" />
            </div>
            <p className="text-foreground font-medium">No transactions yet</p>
            <p className="text-sm text-muted-foreground mt-1">Your transaction history will appear here</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Type</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Description</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Date</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-5 py-3">Amount</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map(tx => {
                    const cfg = TX_CONFIG[tx.type] ?? TX_CONFIG.credit
                    const stCfg = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG.pending
                    const TxIcon = cfg.icon
                    const isCredit = ['credit', 'refund'].includes(tx.type)
                    return (
                      <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${cfg.color.split(' ').slice(0, 2).join(' ').replace('text-', 'bg-').replace('700', '100').replace('400', '900/20')}`}>
                              <TxIcon size={14} className={cfg.color.split(' ')[1]} />
                            </div>
                            <Badge className={`${cfg.color} border-0 text-xs`}>
                              {cfg.label}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-sm text-foreground">{tx.description || '—'}</p>
                          {tx.contractId && (
                            <p className="text-xs text-muted-foreground mt-0.5">Contract #{tx.contractId.slice(-6)}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(tx.createdAt)}
                          <p className="text-xs">{formatRelativeTime(tx.createdAt)}</p>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={`text-sm font-semibold ${isCredit ? 'text-emerald-600' : 'text-red-500'}`}>
                            {isCredit ? '+' : '-'}{formatCurrency(Math.abs(Number(tx.amount)))}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${stCfg.color}`}>
                            {tx.status === 'completed' && <CheckCircle2 size={11} />}
                            {tx.status === 'failed' && <XCircle size={11} />}
                            {tx.status === 'pending' && <Clock size={11} />}
                            {stCfg.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <div className="md:hidden divide-y divide-border">
              {transactions.map(tx => {
                const cfg = TX_CONFIG[tx.type] ?? TX_CONFIG.credit
                const stCfg = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG.pending
                const TxIcon = cfg.icon
                const isCredit = ['credit', 'refund'].includes(tx.type)
                return (
                  <div key={tx.id} className="p-4 flex items-start gap-3">
                    <div className={`p-2 rounded-xl shrink-0 ${cfg.color}`}>
                      <TxIcon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{cfg.label}</p>
                        <span className={`text-sm font-bold ${isCredit ? 'text-emerald-600' : 'text-red-500'}`}>
                          {isCredit ? '+' : '-'}{formatCurrency(Math.abs(Number(tx.amount)))}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{tx.description || '—'}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[11px] text-muted-foreground">{formatRelativeTime(tx.createdAt)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${stCfg.color}`}>{stCfg.label}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Withdraw dialog */}
      {user && (
        <WithdrawDialog
          open={withdrawOpen}
          onClose={() => setWithdrawOpen(false)}
          maxAmount={balance}
          userId={user.id}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['wallet', user.id] })}
        />
      )}
    </div>
  )
}
