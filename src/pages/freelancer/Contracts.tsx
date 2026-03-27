import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import {
  Briefcase, ChevronRight, Clock, DollarSign,
  CheckCircle, AlertTriangle, FileText,
} from 'lucide-react'
import { blink, tables } from '../../blink/client'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDate } from '../../lib/utils'
import { StatusBadge } from '../../components/ui/StatusBadge'
import type { Contract } from '../../types'

type TabFilter = 'all' | 'active' | 'completed' | 'disputed'

const TABS: { id: TabFilter; label: string; icon: LucideIcon }[] = [
  { id: 'all', label: 'All', icon: FileText },
  { id: 'active', label: 'Active', icon: Briefcase },
  { id: 'completed', label: 'Completed', icon: CheckCircle },
  { id: 'disputed', label: 'Disputed', icon: AlertTriangle },
]

const ACTIVE_STATUSES = ['pending', 'active', 'submitted', 'revision']

export function FreelancerContracts() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabFilter>('all')

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['freelancer-contracts-all', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      return await tables.contracts.list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        limit: 100,
      }) as Contract[]
    },
    enabled: !!user?.id,
  })

  const filtered = contracts.filter(c => {
    if (tab === 'all') return true
    if (tab === 'active') return ACTIVE_STATUSES.includes(c.status)
    if (tab === 'completed') return c.status === 'completed'
    if (tab === 'disputed') return c.status === 'disputed'
    return true
  })

  const counts = {
    all: contracts.length,
    active: contracts.filter(c => ACTIVE_STATUSES.includes(c.status)).length,
    completed: contracts.filter(c => c.status === 'completed').length,
    disputed: contracts.filter(c => c.status === 'disputed').length,
  }

  return (
    <div className="page-container pt-24">
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">My Contracts</h1>
          <p className="text-muted-foreground mt-1">Track and manage your ongoing work</p>
        </div>

        {/* Tab filter */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl mb-6 w-fit flex-wrap">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={14} />
                {t.label}
                {counts[t.id] > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    tab === t.id
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {counts[t.id]}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-muted rounded w-1/2" />
                    <div className="h-4 bg-muted rounded w-1/3" />
                  </div>
                  <div className="flex gap-3">
                    <div className="h-6 bg-muted rounded-full w-20" />
                    <div className="h-6 bg-muted rounded w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <Briefcase size={40} className="text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {tab === 'all' ? 'No contracts yet' : `No ${tab} contracts`}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {tab === 'all'
                ? 'Submit proposals on jobs to start working with clients'
                : `You don't have any ${tab} contracts at this time`
              }
            </p>
            {tab === 'all' && (
              <button
                onClick={() => navigate({ to: '/jobs' })}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Browse Jobs
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(contract => (
              <ContractRow
                key={contract.id}
                contract={contract}
                onClick={() => navigate({
                  to: '/freelancer/contracts/$contractId',
                  params: { contractId: contract.id },
                })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ContractRow({ contract, onClick }: { contract: Contract; onClick: () => void }) {
  const isUrgent = contract.deadline && new Date(contract.deadline) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    && ['active', 'submitted', 'revision'].includes(contract.status)

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border rounded-2xl p-5 card-hover cursor-pointer group"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors truncate">
              {contract.title}
            </h3>
            <StatusBadge status={contract.status} />
            {isUrgent && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-full text-xs font-medium">
                <AlertTriangle size={10} />
                Due soon
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              Due {formatDate(contract.deadline)}
            </span>
            <span className="flex items-center gap-1">
              <DollarSign size={11} />
              Payment: <StatusBadge status={contract.paymentStatus} className="ml-0.5" />
            </span>
          </div>
        </div>

        <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1 flex-shrink-0">
          <div className="text-right">
            <p className="text-base font-bold text-foreground">
              {formatCurrency(contract.freelancerAmount)}
            </p>
            <p className="text-xs text-muted-foreground">
              of {formatCurrency(contract.amount)} total
            </p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors sm:self-end" />
        </div>
      </div>
    </div>
  )
}
