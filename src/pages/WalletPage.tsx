import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Wallet, TrendingUp, ArrowDownCircle, ArrowUpCircle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { blink, tables } from '../blink/client'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency, formatDate, timeAgo } from '../lib/utils'
import { StatusBadge } from '../components/ui/StatusBadge'
import { EmptyState } from '../components/shared/EmptyState'
import type { Transaction, Wallet as WalletType } from '../types'
import toast from 'react-hot-toast'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  credit: <ArrowDownCircle size={16} className="text-green-500" />,
  debit: <ArrowUpCircle size={16} className="text-red-500" />,
  escrow_hold: <ArrowUpCircle size={16} className="text-blue-500" />,
  platform_fee: <ArrowUpCircle size={16} className="text-orange-500" />,
  withdrawal: <ArrowUpCircle size={16} className="text-purple-500" />,
  refund: <ArrowDownCircle size={16} className="text-green-500" />,
}

function WithdrawModal({ open, wallet, onClose }: {
  open: boolean
  wallet: WalletType
  onClose: () => void
}) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'bank' | 'paypal' | 'stripe'>('bank')
  const [accountDetails, setAccountDetails] = useState('')

  const submit = useMutation({
    mutationFn: async () => {
      const amt = Number(amount)
      if (!amt || amt <= 0) throw new Error('Invalid amount')
      if (amt > wallet.balance) throw new Error('Insufficient balance')
      if (!accountDetails.trim()) throw new Error('Account details required')
      await tables.withdrawalRequests.create({
        userId: user!.id,
        amount: amt,
        method,
        accountDetails: accountDetails.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      await tables.wallets.update(wallet.id, {
        balance: wallet.balance - amt,
        pendingBalance: (wallet.pendingBalance || 0) + amt,
        updatedAt: new Date().toISOString(),
      })
    },
    onSuccess: () => {
      toast.success('Withdrawal request submitted!')
      qc.invalidateQueries({ queryKey: ['wallet', user?.id] })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Withdrawal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-muted rounded-lg p-3 text-sm">
            <span className="text-muted-foreground">Available: </span>
            <span className="font-bold text-foreground">{formatCurrency(wallet.balance)}</span>
          </div>
          <div className="space-y-1.5">
            <Label>Amount ($)</Label>
            <Input
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              max={wallet.balance}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select value={method} onValueChange={v => setMethod(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Bank Transfer</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Account Details</Label>
            <Textarea
              placeholder={method === 'bank' ? 'Bank name, account number, routing number...' : method === 'paypal' ? 'PayPal email address' : 'Stripe account ID'}
              rows={3}
              value={accountDetails}
              onChange={e => setAccountDetails(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="gradient-amber border-0 text-white hover:opacity-90"
            onClick={() => submit.mutate()}
            disabled={submit.isPending}
          >
            {submit.isPending ? 'Submitting...' : 'Request Withdrawal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function WalletPage() {
  const { user, isAuthenticated } = useAuth()
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  const { data: walletArr, isLoading: loadingWallet } = useQuery({
    queryKey: ['wallet', user?.id],
    queryFn: () => tables.wallets.list({ where: { userId: user!.id }, limit: 1 }),
    enabled: !!user?.id,
  })
  const wallet = (walletArr as WalletType[] | undefined)?.[0]

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: () => tables.transactions.list({
      where: { userId: user!.id },
      limit: 100,
      orderBy: { createdAt: 'desc' },
    }),
    enabled: !!user?.id,
  })

  if (!isAuthenticated) {
    return (
      <div className="page-container pt-24 flex flex-col items-center justify-center py-24">
        <Wallet size={48} className="text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
        <Button className="gradient-amber border-0 text-white" onClick={() => blink.auth.login()}>Sign In</Button>
      </div>
    )
  }

  if (loadingWallet) {
    return (
      <div className="page-container pt-24 flex items-center justify-center py-24">
        <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const bal = wallet?.balance || 0
  const pending = wallet?.pendingBalance || 0
  const earned = wallet?.totalEarned || 0
  const withdrawn = wallet?.totalWithdrawn || 0

  return (
    <div className="page-container pt-24 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Wallet</h1>
          <p className="text-muted-foreground text-sm mt-1">Your earnings and transactions</p>
        </div>
        {wallet && bal > 0 && (
          <Button
            className="gradient-amber border-0 text-white hover:opacity-90 gap-2"
            onClick={() => setWithdrawOpen(true)}
          >
            <Plus size={16} /> Request Withdrawal
          </Button>
        )}
      </div>

      {wallet && <WithdrawModal open={withdrawOpen} wallet={wallet} onClose={() => setWithdrawOpen(false)} />}

      {/* Balance cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Available Balance', value: bal, icon: Wallet, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'Pending', value: pending, icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Total Earned', value: earned, icon: ArrowDownCircle, color: 'text-accent', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Total Withdrawn', value: withdrawn, icon: ArrowUpCircle, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5 card-hover">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon size={20} className={color} />
            </div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(value)}</p>
          </div>
        ))}
      </div>

      {/* Transactions */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Transaction History</h2>
        </div>
        {loadingTx ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : (transactions as Transaction[]).length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No transactions yet"
            description="Your transaction history will appear here."
          />
        ) : (
          <div className="divide-y divide-border">
            {(transactions as Transaction[]).map(tx => {
              const isCredit = tx.type === 'credit' || tx.type === 'refund'
              return (
                <div key={tx.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                      {TYPE_ICONS[tx.type] ?? <Wallet size={16} />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(tx.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold text-sm ${isCredit ? 'text-green-600' : 'text-foreground'}`}>
                      {isCredit ? '+' : '-'}{formatCurrency(tx.amount)}
                    </p>
                    <StatusBadge status={tx.status} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
