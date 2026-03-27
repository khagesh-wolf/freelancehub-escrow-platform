import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import {
  DollarSign, TrendingUp, Clock, ArrowDownToLine,
  X, ArrowUpRight, ArrowDownLeft, RefreshCw, AlertCircle,
  Wallet as WalletIcon, CreditCard, Building2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { blink, tables } from '../../blink/client'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDate, generateId } from '../../lib/utils'
import { StatusBadge } from '../../components/ui/StatusBadge'
import type { Wallet as WalletType, Transaction, WithdrawalRequest } from '../../types'

type WithdrawMethod = 'bank' | 'paypal' | 'stripe'

const METHOD_OPTIONS: { value: WithdrawMethod; label: string; icon: LucideIcon; placeholder: string }[] = [
  { value: 'bank', label: 'Bank Transfer', icon: Building2, placeholder: 'Account number, routing number, bank name' },
  { value: 'paypal', label: 'PayPal', icon: CreditCard, placeholder: 'PayPal email address' },
  { value: 'stripe', label: 'Stripe', icon: WalletIcon, placeholder: 'Stripe account ID or email' },
]

const TX_ICONS: Record<string, LucideIcon> = {
  credit: ArrowDownLeft,
  debit: ArrowUpRight,
  withdrawal: ArrowUpRight,
  refund: ArrowDownLeft,
  escrow_hold: Clock,
  platform_fee: AlertCircle,
}

const TX_COLORS: Record<string, string> = {
  credit: 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400',
  debit: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
  withdrawal: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400',
  refund: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400',
  escrow_hold: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400',
  platform_fee: 'text-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-400',
}

export function FreelancerWallet() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawMethod, setWithdrawMethod] = useState<WithdrawMethod>('bank')
  const [accountDetails, setAccountDetails] = useState('')
  const [activeTab, setActiveTab] = useState<'transactions' | 'withdrawals'>('transactions')

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['wallet', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const ws = await tables.wallets.list({ where: { userId: user.id }, limit: 1 })
      return (ws[0] ?? null) as WalletType | null
    },
    enabled: !!user?.id,
  })

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      return await tables.transactions.list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        limit: 50,
      }) as Transaction[]
    },
    enabled: !!user?.id,
  })

  const { data: withdrawals = [], isLoading: wdLoading } = useQuery({
    queryKey: ['withdrawals', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      return await tables.withdrawalRequests.list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        limit: 30,
      }) as WithdrawalRequest[]
    },
    enabled: !!user?.id,
  })

  const requestWithdrawal = useMutation({
    mutationFn: async () => {
      if (!user?.id || !wallet) throw new Error('Wallet not found')
      const amount = Number(withdrawAmount)
      if (!amount || amount <= 0) throw new Error('Enter a valid amount')
      if (amount > wallet.balance) throw new Error('Insufficient balance')
      if (amount < 10) throw new Error('Minimum withdrawal is $10')
      if (!accountDetails.trim()) throw new Error('Please enter your account details')

      await tables.withdrawalRequests.create({
        id: generateId(),
        userId: user.id,
        amount,
        method: withdrawMethod,
        accountDetails,
        status: 'pending',
        adminNotes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      // Record transaction
      await tables.transactions.create({
        id: generateId(),
        userId: user.id,
        contractId: '',
        type: 'withdrawal',
        amount,
        description: `Withdrawal request via ${withdrawMethod}`,
        status: 'pending',
        stripeId: '',
        createdAt: new Date().toISOString(),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet', user?.id] })
      qc.invalidateQueries({ queryKey: ['transactions', user?.id] })
      qc.invalidateQueries({ queryKey: ['withdrawals', user?.id] })
      toast.success('Withdrawal request submitted! Processing within 2-3 business days.')
      setShowWithdrawModal(false)
      setWithdrawAmount('')
      setAccountDetails('')
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to submit withdrawal'),
  })

  const summaryCards = [
    {
      label: 'Available Balance',
      value: formatCurrency(wallet?.balance ?? 0),
      icon: DollarSign,
      color: 'text-green-600 bg-green-50 dark:bg-green-900/20',
      note: 'Ready to withdraw',
    },
    {
      label: 'Pending Balance',
      value: formatCurrency(wallet?.pendingBalance ?? 0),
      icon: Clock,
      color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
      note: 'In escrow',
    },
    {
      label: 'Total Earned',
      value: formatCurrency(wallet?.totalEarned ?? 0),
      icon: TrendingUp,
      color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
      note: 'All time',
    },
    {
      label: 'Total Withdrawn',
      value: formatCurrency(wallet?.totalWithdrawn ?? 0),
      icon: ArrowDownToLine,
      color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
      note: 'Paid out',
    },
  ]

  const selectedMethod = METHOD_OPTIONS.find(m => m.value === withdrawMethod)!

  return (
    <div className="page-container pt-24">
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Wallet & Earnings</h1>
            <p className="text-muted-foreground mt-1">Track your income and request withdrawals</p>
          </div>
          <button
            onClick={() => setShowWithdrawModal(true)}
            disabled={!wallet || wallet.balance < 10}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-start sm:self-auto"
          >
            <ArrowDownToLine size={15} />
            Withdraw Funds
          </button>
        </div>

        {/* Summary cards */}
        {walletLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-muted" />
                <div className="h-6 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {summaryCards.map(card => (
              <div key={card.label} className="bg-card border border-border rounded-2xl p-5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>
                  <card.icon size={20} />
                </div>
                <p className="text-xl font-bold text-foreground">{card.value}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{card.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{card.note}</p>
              </div>
            ))}
          </div>
        )}

        {/* Min balance notice */}
        {wallet && wallet.balance < 10 && wallet.balance > 0 && (
          <div className="mb-6 p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-400">
            <AlertCircle size={14} className="flex-shrink-0" />
            Minimum withdrawal amount is $10. Earn more to unlock withdrawals.
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl mb-6 w-fit">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'transactions'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Transactions
          </button>
          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'withdrawals'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Withdrawals
            {withdrawals.filter(w => w.status === 'pending').length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded-full text-xs">
                {withdrawals.filter(w => w.status === 'pending').length}
              </span>
            )}
          </button>
        </div>

        {/* Transactions tab */}
        {activeTab === 'transactions' && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Transaction History</h2>
            </div>
            {txLoading ? (
              <div className="divide-y divide-border animate-pulse">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="px-5 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 bg-muted rounded w-1/2" />
                      <div className="h-3 bg-muted rounded w-1/3" />
                    </div>
                    <div className="h-5 bg-muted rounded w-20" />
                  </div>
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <RefreshCw size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No transactions yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Transactions appear once you complete contracts
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {transactions.map(tx => {
                  const Icon = TX_ICONS[tx.type] ?? DollarSign
                  const colorClass = TX_COLORS[tx.type] ?? 'text-gray-600 bg-gray-50'
                  const isPositive = ['credit', 'refund'].includes(tx.type)

                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-5 py-4 hover:bg-muted/20 transition-colors">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(tx.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-sm font-semibold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {isPositive ? '+' : '-'}{formatCurrency(tx.amount)}
                        </span>
                        <StatusBadge status={tx.status} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Withdrawals tab */}
        {activeTab === 'withdrawals' && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Withdrawal Requests</h2>
            </div>
            {wdLoading ? (
              <div className="divide-y divide-border animate-pulse">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="px-5 py-4 flex items-center gap-3">
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 bg-muted rounded w-1/3" />
                      <div className="h-3 bg-muted rounded w-1/4" />
                    </div>
                    <div className="h-6 bg-muted rounded-full w-20" />
                  </div>
                ))}
              </div>
            ) : withdrawals.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <ArrowDownToLine size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No withdrawal requests</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your withdrawal history will appear here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {withdrawals.map(wd => (
                  <div key={wd.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrency(wd.amount)}
                          </p>
                          <StatusBadge status={wd.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {wd.method.charAt(0).toUpperCase() + wd.method.slice(1)} • {formatDate(wd.createdAt)}
                        </p>
                        {wd.accountDetails && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                            {wd.accountDetails}
                          </p>
                        )}
                        {wd.adminNotes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Note: {wd.adminNotes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setShowWithdrawModal(false)} />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-md shadow-xl animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">Request Withdrawal</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Available: {formatCurrency(wallet?.balance ?? 0)}
                </p>
              </div>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Amount (USD) <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                    placeholder="Min. $10"
                    min="10"
                    max={wallet?.balance}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-muted-foreground">Minimum: $10</p>
                  <button
                    onClick={() => setWithdrawAmount(String(wallet?.balance ?? 0))}
                    className="text-xs text-primary hover:underline"
                  >
                    Max ({formatCurrency(wallet?.balance ?? 0)})
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Withdrawal Method <span className="text-destructive">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {METHOD_OPTIONS.map(method => {
                    const Icon = method.icon
                    return (
                      <button
                        key={method.value}
                        onClick={() => { setWithdrawMethod(method.value); setAccountDetails('') }}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-xs font-medium ${
                          withdrawMethod === method.value
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
                        }`}
                      >
                        <Icon size={18} />
                        {method.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Account Details <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={accountDetails}
                  onChange={e => setAccountDetails(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm resize-none"
                  placeholder={selectedMethod.placeholder}
                />
              </div>

              <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground space-y-1">
                <p>• Processing time: 2-3 business days</p>
                <p>• No withdrawal fees charged by FreelanceHub</p>
                <p>• Your bank/PayPal may charge transfer fees</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-border flex gap-2 justify-end">
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="px-4 py-2 border border-border text-foreground rounded-xl text-sm hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => requestWithdrawal.mutate()}
                disabled={requestWithdrawal.isPending}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {requestWithdrawal.isPending
                  ? <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  : <ArrowDownToLine size={14} />
                }
                Request Withdrawal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
