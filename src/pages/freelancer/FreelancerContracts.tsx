import { useState, useEffect } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { Briefcase, Clock, DollarSign, ChevronRight, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/useAuth'
import { tables } from '@/blink/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Contract } from '@/types'

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    submitted: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    revision: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    disputed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400',
  }
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.pending}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    unpaid: { label: 'Unpaid', cls: 'text-muted-foreground' },
    paid_to_platform: { label: 'In Escrow', cls: 'text-amber-600 dark:text-amber-400' },
    released: { label: 'Released', cls: 'text-emerald-600 dark:text-emerald-400' },
    refunded: { label: 'Refunded', cls: 'text-gray-500' },
  }
  const { label, cls } = map[status] || { label: status, cls: 'text-muted-foreground' }
  return <span className={`text-xs font-medium ${cls}`}>{label}</span>
}

function ContractCard({ contract }: { contract: Contract }) {
  return (
    <Link to="/freelancer/contracts/$contractId" params={{ contractId: contract.id }} className="block">
      <div className="bg-card border border-border rounded-xl p-5 card-hover group">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {contract.title}
              </h3>
              <StatusBadge status={contract.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              Client: <span className="text-foreground font-medium">{contract.clientName || 'Client'}</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-lg font-bold text-foreground">
              {formatCurrency(Number(contract.freelancerAmount))}
            </span>
            <PaymentBadge status={contract.paymentStatus} />
          </div>
        </div>

        <div className="flex items-center gap-5 mt-4 text-xs text-muted-foreground border-t border-border pt-3">
          <span className="flex items-center gap-1.5">
            <Clock size={12} />
            Deadline: {formatDate(contract.deadline)}
          </span>
          <span className="flex items-center gap-1.5">
            <DollarSign size={12} />
            Total: {formatCurrency(Number(contract.amount))}
          </span>
          <span className="ml-auto flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            View <ChevronRight size={13} />
          </span>
        </div>
      </div>
    </Link>
  )
}

function EmptyContracts({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-muted/60 rounded-full flex items-center justify-center mx-auto mb-4">
        <FileText size={28} className="text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">No contracts here</h3>
      <p className="text-muted-foreground text-sm mb-5 max-w-xs mx-auto">
        Browse available jobs and submit proposals to start working with clients.
      </p>
      <Button onClick={onBrowse} className="gradient-amber text-white border-0">
        <Briefcase size={15} className="mr-1.5" /> Browse Jobs
      </Button>
    </div>
  )
}

export function FreelancerContracts() {
  const { user, profile, isLoading } = useAuth()
  const navigate = useNavigate()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoading && !user) navigate({ to: '/auth/login' })
    if (!isLoading && profile && profile.role !== 'freelancer') navigate({ to: '/client/dashboard' })
  }, [isLoading, user, profile])

  useEffect(() => {
    if (!user) return
    loadContracts()
  }, [user])

  async function loadContracts() {
    if (!user) return
    setLoading(true)
    try {
      const data = await tables.contracts.list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      })
      setContracts(data as Contract[])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const activeContracts = contracts.filter(c =>
    ['pending', 'active', 'submitted', 'revision'].includes(c.status)
  )
  const completedContracts = contracts.filter(c =>
    ['completed', 'cancelled', 'disputed'].includes(c.status)
  )

  const Skeletons = () => (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-28 bg-muted/60 border border-border rounded-xl animate-pulse" />
      ))}
    </div>
  )

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Contracts</h1>
            <p className="text-muted-foreground mt-1">
              {contracts.length} total contract{contracts.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate({ to: '/freelancer/jobs' })}
          >
            <Briefcase size={15} className="mr-1.5" /> Browse Jobs
          </Button>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          {
            label: 'Active',
            value: activeContracts.filter(c => c.status === 'active').length,
            color: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-100 dark:bg-emerald-900/20',
          },
          {
            label: 'Pending Review',
            value: activeContracts.filter(c => c.status === 'submitted' || c.status === 'revision').length,
            color: 'text-amber-600 dark:text-amber-400',
            bg: 'bg-amber-100 dark:bg-amber-900/20',
          },
          {
            label: 'Completed',
            value: completedContracts.filter(c => c.status === 'completed').length,
            color: 'text-blue-600 dark:text-blue-400',
            bg: 'bg-blue-100 dark:bg-blue-900/20',
          },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 ${s.bg} border border-border/50`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active">
        <TabsList className="mb-6">
          <TabsTrigger value="active">
            Active
            {activeContracts.length > 0 && (
              <span className="ml-1.5 w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">
                {activeContracts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed
            {completedContracts.length > 0 && (
              <span className="ml-1.5 w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center">
                {completedContracts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">All ({contracts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {loading ? <Skeletons /> : activeContracts.length === 0 ? (
            <EmptyContracts onBrowse={() => navigate({ to: '/freelancer/jobs' })} />
          ) : (
            <div className="space-y-4">
              {activeContracts.map(c => <ContractCard key={c.id} contract={c} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed">
          {loading ? <Skeletons /> : completedContracts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-sm">No completed contracts yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {completedContracts.map(c => <ContractCard key={c.id} contract={c} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all">
          {loading ? <Skeletons /> : contracts.length === 0 ? (
            <EmptyContracts onBrowse={() => navigate({ to: '/freelancer/jobs' })} />
          ) : (
            <div className="space-y-4">
              {contracts.map(c => <ContractCard key={c.id} contract={c} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
