import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { CreditCard, ExternalLink, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { blink, tables } from '../blink/client'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency, timeAgo } from '../lib/utils'
import { StatusBadge } from '../components/ui/StatusBadge'
import { EmptyState } from '../components/shared/EmptyState'
import type { Transaction, Contract } from '../types'

export function PaymentsPage() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ['clientTransactions', user?.id],
    queryFn: () => tables.transactions.list({
      where: { userId: user!.id },
      limit: 100,
      orderBy: { createdAt: 'desc' },
    }),
    enabled: !!user?.id,
  })

  const contractIds = [...new Set((transactions as Transaction[]).map(t => t.contractId).filter(Boolean))]
  const { data: contracts = [] } = useQuery({
    queryKey: ['paymentContracts', contractIds.join(',')],
    queryFn: async () => {
      if (!contractIds.length) return []
      const all = await Promise.all(contractIds.map(id => tables.contracts.list({ where: { id }, limit: 1 })))
      return all.flat()
    },
    enabled: contractIds.length > 0,
  })

  if (!isAuthenticated) {
    return (
      <div className="page-container pt-24 flex flex-col items-center justify-center py-24">
        <CreditCard size={48} className="text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
        <Button className="gradient-amber border-0 text-white" onClick={() => blink.auth.login()}>Sign In</Button>
      </div>
    )
  }

  const contractMap = new Map((contracts as Contract[]).map(c => [c.id, c]))
  const totalSpent = (transactions as Transaction[])
    .filter(t => t.type === 'escrow_hold' || t.type === 'debit')
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + (t.amount || 0), 0)

  return (
    <div className="page-container pt-24 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Payments</h1>
        <p className="text-muted-foreground text-sm mt-1">Your payment history</p>
      </div>

      {/* Total stat */}
      <div className="bg-card border border-border rounded-xl p-6 mb-8 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl gradient-amber flex items-center justify-center shrink-0">
          <DollarSign size={28} className="text-white" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Total Spent</p>
          <p className="text-3xl font-bold text-foreground">{formatCurrency(totalSpent)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {(transactions as Transaction[]).length} transactions
          </p>
        </div>
      </div>

      {/* Transactions list */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Payment History</h2>
        </div>

        {loadingTx ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : (transactions as Transaction[]).length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No payments yet"
            description="Your payment history will appear once you fund a contract."
          />
        ) : (
          <div className="divide-y divide-border">
            {(transactions as Transaction[]).map(tx => {
              const contract = tx.contractId ? contractMap.get(tx.contractId) : undefined
              const isCredit = tx.type === 'refund'
              return (
                <div key={tx.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <CreditCard size={16} className="text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{tx.description}</p>
                      {contract && (
                        <p className="text-xs text-muted-foreground mt-0.5">{contract.title}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{timeAgo(tx.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`font-semibold text-sm ${isCredit ? 'text-green-600' : 'text-foreground'}`}>
                        {isCredit ? '+' : '-'}{formatCurrency(tx.amount)}
                      </p>
                      <StatusBadge status={tx.status} />
                    </div>
                    {contract && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => navigate({ to: '/contracts/$contractId', params: { contractId: contract.id } })}
                      >
                        <ExternalLink size={14} />
                      </Button>
                    )}
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
