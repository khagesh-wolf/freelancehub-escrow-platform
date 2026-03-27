import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { FileText, Eye, Calendar, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { blink, tables } from '../blink/client'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency, formatDate, getInitials } from '../lib/utils'
import { StatusBadge } from '../components/ui/StatusBadge'
import { EmptyState } from '../components/shared/EmptyState'
import type { Contract, UserProfile } from '../types'

type TabKey = 'active' | 'submitted' | 'completed' | 'all'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'completed', label: 'Completed' },
  { key: 'all', label: 'All' },
]

export function ContractsPage() {
  const { user, profile, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabKey>('active')

  const isClient = profile?.role === 'client'
  const isFreelancer = profile?.role === 'freelancer'

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['myContracts', user?.id, profile?.role],
    queryFn: () => isClient
      ? tables.contracts.list({ where: { clientId: user!.id }, limit: 200, orderBy: { createdAt: 'desc' } })
      : tables.contracts.list({ where: { userId: user!.id }, limit: 200, orderBy: { createdAt: 'desc' } }),
    enabled: !!user?.id && (isClient || isFreelancer),
  })

  // Fetch counterpart profiles
  const counterpartIds = [...new Set((contracts as Contract[]).map(c =>
    isClient ? c.userId : c.clientId
  ))]
  const { data: counterparts = [] } = useQuery({
    queryKey: ['contractCounterparts', counterpartIds.join(',')],
    queryFn: async () => {
      if (!counterpartIds.length) return []
      const all = await Promise.all(counterpartIds.map(id =>
        tables.userProfiles.list({ where: { userId: id }, limit: 1 })
      ))
      return all.flat()
    },
    enabled: counterpartIds.length > 0,
  })

  if (!isAuthenticated) {
    return (
      <div className="page-container pt-24 flex flex-col items-center justify-center py-24">
        <FileText size={48} className="text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
        <Button className="gradient-amber border-0 text-white" onClick={() => blink.auth.login()}>Sign In</Button>
      </div>
    )
  }

  const cpMap = new Map((counterparts as UserProfile[]).map(u => [u.userId, u]))

  const filtered = (contracts as Contract[]).filter(c => {
    if (activeTab === 'all') return true
    if (activeTab === 'active') return c.status === 'active' || c.status === 'pending'
    return c.status === activeTab
  })

  const counts = TABS.reduce((acc, t) => {
    acc[t.key] = t.key === 'all'
      ? (contracts as Contract[]).length
      : (contracts as Contract[]).filter(c => {
          if (t.key === 'active') return c.status === 'active' || c.status === 'pending'
          return c.status === t.key
        }).length
    return acc
  }, {} as Record<TabKey, number>)

  return (
    <div className="page-container pt-24 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Contracts</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isClient ? 'Projects you\'ve hired freelancers for' : 'Jobs you\'re contracted for'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-muted rounded-lg p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === t.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {counts[t.key] > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-1.5 rounded-full">{counts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No contracts found"
          description="Contracts will appear here once a proposal is accepted."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map(c => {
            const counterpartId = isClient ? c.userId : c.clientId
            const cp = cpMap.get(counterpartId)
            return (
              <div key={c.id} className="bg-card border border-border rounded-xl p-5 card-hover">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarImage src={cp?.avatarUrl} />
                      <AvatarFallback className="text-xs gradient-hero text-white">
                        {getInitials(cp?.displayName || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{c.title}</h3>
                        <StatusBadge status={c.status} />
                        <StatusBadge status={c.paymentStatus} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {isClient ? 'Freelancer' : 'Client'}: <span className="font-medium">{cp?.displayName || 'Unknown'}</span>
                      </p>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DollarSign size={12} /> {formatCurrency(c.amount)}
                        </span>
                        {c.deadline && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} /> Due {formatDate(c.deadline)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="gradient-amber border-0 text-white hover:opacity-90 gap-1 shrink-0"
                    onClick={() => navigate({ to: '/contracts/$contractId', params: { contractId: c.id } })}
                  >
                    <Eye size={14} /> View Details
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
