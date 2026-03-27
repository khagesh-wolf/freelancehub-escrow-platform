import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  UserCheck,
  Users,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  NotebookPen,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { blink, tables } from '../../blink/client'
import { useAuth } from '../../hooks/useAuth'
import { createNotification } from '../../hooks/useNotifications'
import { formatCurrency, formatDate, generateId } from '../../lib/utils'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { AdminLayout } from '../../components/layout/AdminLayout'
import type { Dispute, Contract, UserProfile, Wallet as WalletType } from '../../types'

type DisputeStatusFilter = 'all' | 'open' | 'under_review' | 'resolved_client' | 'resolved_freelancer' | 'closed'

const STATUS_FILTERS: { key: DisputeStatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'resolved_client', label: 'Resolved (Client)' },
  { key: 'resolved_freelancer', label: 'Resolved (Freelancer)' },
  { key: 'closed', label: 'Closed' },
]

export function AdminDisputes() {
  const { profile: adminProfile } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<DisputeStatusFilter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  if (adminProfile && adminProfile.role !== 'admin') {
    navigate({ to: '/' })
    return null
  }

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ['admin-disputes-all'],
    queryFn: () =>
      tables.disputes.list({
        orderBy: { createdAt: 'desc' },
        limit: 500,
      }) as Promise<Dispute[]>,
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['admin-contracts'],
    queryFn: () =>
      tables.contracts.list({ limit: 500 }) as Promise<Contract[]>,
  })

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => tables.userProfiles.list({ limit: 500 }) as Promise<UserProfile[]>,
  })

  const userMap = new Map(users.map(u => [u.userId, u]))
  const contractMap = new Map(contracts.map(c => [c.id, c]))

  // ── Filters ────────────────────────────────────────────────────────────────
  const filtered = disputes.filter(d => {
    const matchStatus = statusFilter === 'all' || d.status === statusFilter
    const q = search.toLowerCase()
    const raiser = userMap.get(d.userId)
    const contract = contractMap.get(d.contractId)
    const matchSearch =
      !q ||
      d.reason?.toLowerCase().includes(q) ||
      d.description?.toLowerCase().includes(q) ||
      raiser?.displayName?.toLowerCase().includes(q) ||
      contract?.title?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const openCount = disputes.filter(d => d.status === 'open').length
  const reviewCount = disputes.filter(d => d.status === 'under_review').length

  // ── Mark Under Review ──────────────────────────────────────────────────────
  const markUnderReview = useMutation({
    mutationFn: async (dispute: Dispute) => {
      await tables.disputes.update(dispute.id, {
        status: 'under_review',
        updatedAt: new Date().toISOString(),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-disputes-all'] })
      toast.success('Dispute marked as under review')
    },
  })

  // ── Resolve in Favor of Client ─────────────────────────────────────────────
  const resolveForClient = useMutation({
    mutationFn: async ({ dispute, notes }: { dispute: Dispute; notes: string }) => {
      const now = new Date().toISOString()
      const contract = contractMap.get(dispute.contractId)
      if (!contract) throw new Error('Contract not found')

      // Close dispute
      await tables.disputes.update(dispute.id, {
        status: 'resolved_client',
        adminNotes: notes,
        resolution: 'Resolved in favor of client. Payment refunded.',
        updatedAt: now,
      })

      // Cancel contract + mark refunded
      await tables.contracts.update(contract.id, {
        status: 'cancelled',
        paymentStatus: 'refunded',
        adminNotes: notes,
        updatedAt: now,
      })

      // Refund client wallet
      const clientWallets = (await tables.wallets.list({
        where: { userId: contract.clientId },
        limit: 1,
      })) as WalletType[]

      if (clientWallets[0]) {
        await tables.wallets.update(clientWallets[0].id, {
          balance: (clientWallets[0].balance ?? 0) + (contract.amount ?? 0),
          updatedAt: now,
        })
      } else {
        // Create wallet if doesn't exist
        await tables.wallets.create({
          id: generateId(),
          userId: contract.clientId,
          balance: contract.amount ?? 0,
          pendingBalance: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
          createdAt: now,
          updatedAt: now,
        })
      }

      // Create refund transaction
      await tables.transactions.create({
        id: generateId(),
        userId: contract.clientId,
        contractId: contract.id,
        type: 'refund',
        amount: contract.amount,
        description: `Dispute resolved — refund for: ${contract.title}`,
        status: 'completed',
        stripeId: '',
        createdAt: now,
      })

      // Notify both parties
      await createNotification(
        contract.clientId,
        'Dispute Resolved — Refund Issued',
        `Your dispute for "${contract.title}" was resolved in your favor. ${formatCurrency(contract.amount)} has been refunded.`,
        'success',
        '/client/projects',
      )
      await createNotification(
        contract.userId,
        'Dispute Resolved',
        `The dispute for "${contract.title}" was resolved in the client's favor. The contract has been cancelled.`,
        'warning',
        '/freelancer/contracts',
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-disputes-all'] })
      qc.invalidateQueries({ queryKey: ['admin-contracts'] })
      setResolvingId(null)
      toast.success('Dispute resolved — client refunded')
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to resolve dispute'),
  })

  // ── Resolve in Favor of Freelancer ────────────────────────────────────────
  const resolveForFreelancer = useMutation({
    mutationFn: async ({ dispute, notes }: { dispute: Dispute; notes: string }) => {
      const now = new Date().toISOString()
      const contract = contractMap.get(dispute.contractId)
      if (!contract) throw new Error('Contract not found')

      // Close dispute
      await tables.disputes.update(dispute.id, {
        status: 'resolved_freelancer',
        adminNotes: notes,
        resolution: 'Resolved in favor of freelancer. Payment released.',
        updatedAt: now,
      })

      // Complete contract + release payment
      await tables.contracts.update(contract.id, {
        status: 'completed',
        paymentStatus: 'released',
        adminNotes: notes,
        completedAt: now,
        updatedAt: now,
      })

      // Credit freelancer wallet
      const freelancerWallets = (await tables.wallets.list({
        where: { userId: contract.userId },
        limit: 1,
      })) as WalletType[]

      if (freelancerWallets[0]) {
        await tables.wallets.update(freelancerWallets[0].id, {
          balance: (freelancerWallets[0].balance ?? 0) + (contract.freelancerAmount ?? 0),
          totalEarned: (freelancerWallets[0].totalEarned ?? 0) + (contract.freelancerAmount ?? 0),
          updatedAt: now,
        })
      } else {
        await tables.wallets.create({
          id: generateId(),
          userId: contract.userId,
          balance: contract.freelancerAmount ?? 0,
          pendingBalance: 0,
          totalEarned: contract.freelancerAmount ?? 0,
          totalWithdrawn: 0,
          createdAt: now,
          updatedAt: now,
        })
      }

      // Create credit transaction
      await tables.transactions.create({
        id: generateId(),
        userId: contract.userId,
        contractId: contract.id,
        type: 'credit',
        amount: contract.freelancerAmount,
        description: `Dispute resolved — payment released for: ${contract.title}`,
        status: 'completed',
        stripeId: '',
        createdAt: now,
      })

      // Notify both parties
      await createNotification(
        contract.userId,
        'Dispute Resolved — Payment Released! 🎉',
        `Your dispute for "${contract.title}" was resolved in your favor. ${formatCurrency(contract.freelancerAmount)} has been added to your wallet.`,
        'success',
        '/freelancer/wallet',
      )
      await createNotification(
        contract.clientId,
        'Dispute Resolved',
        `The dispute for "${contract.title}" was resolved in the freelancer's favor. The project is marked as completed.`,
        'info',
        '/client/projects',
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-disputes-all'] })
      qc.invalidateQueries({ queryKey: ['admin-contracts'] })
      setResolvingId(null)
      toast.success('Dispute resolved — payment released to freelancer')
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to resolve dispute'),
  })

  const isResolutionPending =
    resolveForClient.isPending || resolveForFreelancer.isPending

  return (
    <AdminLayout active="/admin/disputes">
      <div className="page-container">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <AlertTriangle size={22} className="text-orange-500" />
              Disputes
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {disputes.length} total ·{' '}
              <span className="text-orange-600 font-medium">{openCount} open</span>
              {reviewCount > 0 && (
                <>, <span className="text-blue-600 font-medium">{reviewCount} under review</span></>
              )}
            </p>
          </div>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['admin-disputes-all'] })}
            className="p-2 rounded-xl border border-border hover:bg-muted/50 transition-colors text-muted-foreground"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-3 mb-5">
          {[
            { label: 'Open', count: openCount, color: 'bg-orange-50 text-orange-700 border-orange-200' },
            { label: 'Under Review', count: reviewCount, color: 'bg-blue-50 text-blue-700 border-blue-200' },
            { label: 'Resolved (Client)', count: disputes.filter(d => d.status === 'resolved_client').length, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { label: 'Resolved (Freelancer)', count: disputes.filter(d => d.status === 'resolved_freelancer').length, color: 'bg-violet-50 text-violet-700 border-violet-200' },
          ].map(s => (
            <div key={s.label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${s.color}`}>
              {s.label} <span className="font-bold">{s.count}</span>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by reason, user, or contract…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
            />
          </div>
          <div className="flex items-center bg-muted/50 rounded-xl p-1 border border-border gap-0.5 overflow-x-auto">
            <Filter size={14} className="text-muted-foreground ml-2 mr-1 flex-shrink-0" />
            {STATUS_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  statusFilter === f.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Disputes List */}
        <div className="space-y-3">
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-48" />
                    <div className="h-3 bg-muted rounded w-72" />
                  </div>
                  <div className="h-6 bg-muted rounded-full w-24" />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl py-16 text-center">
              <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No disputes found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No disputes have been filed yet'}
              </p>
            </div>
          ) : (
            filtered.map(d => {
              const raiser = userMap.get(d.userId)
              const contract = contractMap.get(d.contractId)
              const freelancer = contract ? userMap.get(contract.userId) : null
              const client = contract ? userMap.get(contract.clientId) : null
              const isExpanded = expanded === d.id
              const notes = adminNotes[d.id] ?? d.adminNotes ?? ''
              const isActionable = d.status === 'open' || d.status === 'under_review'
              const isResolving = resolvingId === d.id

              return (
                <div
                  key={d.id}
                  className={`bg-card border rounded-2xl overflow-hidden transition-all duration-200 ${
                    d.status === 'open'
                      ? 'border-orange-200'
                      : d.status === 'under_review'
                      ? 'border-blue-200'
                      : 'border-border'
                  }`}
                >
                  {/* Row header */}
                  <div
                    className="flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-muted/20 transition-colors select-none"
                    onClick={() => setExpanded(isExpanded ? null : d.id)}
                  >
                    {/* Status indicator */}
                    <div
                      className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                        d.status === 'open'
                          ? 'bg-orange-500'
                          : d.status === 'under_review'
                          ? 'bg-blue-500'
                          : d.status === 'resolved_client' || d.status === 'resolved_freelancer'
                          ? 'bg-emerald-500'
                          : 'bg-gray-400'
                      }`}
                    />

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-semibold text-foreground">{d.reason}</p>
                        <StatusBadge status={d.status} />
                        {contract && (
                          <span className="text-xs bg-muted text-muted-foreground rounded-md px-2 py-0.5">
                            {formatCurrency(contract.amount)}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <AlertTriangle size={11} />
                          Raised by: <span className="font-medium text-foreground ml-0.5">{raiser?.displayName ?? d.userId}</span>
                        </span>
                        {contract && (
                          <span className="flex items-center gap-1">
                            <FileText size={11} />
                            Contract: <span className="font-medium text-foreground ml-0.5 truncate max-w-[180px]">{contract.title}</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {formatDate(d.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Expand toggle */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {isActionable && (
                        <span className="text-xs text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded-lg">
                          Action needed
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp size={18} className="text-muted-foreground" />
                      ) : (
                        <ChevronDown size={18} className="text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-border">
                      <div className="px-5 py-5 space-y-5">
                        {/* Parties */}
                        <div className="grid sm:grid-cols-2 gap-4">
                          {/* Freelancer */}
                          {freelancer && (
                            <div className="bg-muted/30 rounded-xl p-4">
                              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                                <UserCheck size={12} /> Freelancer
                              </p>
                              <p className="text-sm font-medium text-foreground">{freelancer.displayName}</p>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">{freelancer.userId}</p>
                              {contract && (
                                <p className="text-xs text-emerald-600 font-semibold mt-1.5">
                                  Would receive: {formatCurrency(contract.freelancerAmount)}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Client */}
                          {client && (
                            <div className="bg-muted/30 rounded-xl p-4">
                              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                                <Users size={12} /> Client
                              </p>
                              <p className="text-sm font-medium text-foreground">{client.displayName}</p>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">{client.userId}</p>
                              {contract && (
                                <p className="text-xs text-blue-600 font-semibold mt-1.5">
                                  Paid: {formatCurrency(contract.amount)}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Description */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                            Dispute Description
                          </p>
                          <p className="text-sm text-foreground bg-muted/30 rounded-xl px-4 py-3 whitespace-pre-wrap">
                            {d.description || 'No description provided.'}
                          </p>
                        </div>

                        {/* Evidence */}
                        {d.evidenceUrl && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                              Evidence
                            </p>
                            <a
                              href={d.evidenceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                            >
                              <ExternalLink size={14} /> View Evidence
                            </a>
                          </div>
                        )}

                        {/* Previous Resolution */}
                        {d.resolution && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                            <p className="text-xs font-semibold text-emerald-700 uppercase mb-1">Resolution</p>
                            <p className="text-sm text-emerald-800">{d.resolution}</p>
                          </div>
                        )}

                        {/* Admin Notes */}
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                            <NotebookPen size={12} /> Admin Notes
                          </label>
                          <textarea
                            rows={3}
                            value={notes}
                            onChange={e =>
                              setAdminNotes(prev => ({ ...prev, [d.id]: e.target.value }))
                            }
                            placeholder="Add internal notes about this dispute before resolving…"
                            className="w-full px-4 py-3 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none transition-shadow"
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-3 pt-1">
                          {/* Mark Under Review */}
                          {d.status === 'open' && (
                            <button
                              onClick={() => markUnderReview.mutate(d)}
                              disabled={markUnderReview.isPending}
                              className="flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                            >
                              <Clock size={15} />
                              Mark Under Review
                            </button>
                          )}

                          {/* Resolve for Client */}
                          {isActionable && (
                            <button
                              onClick={() => {
                                if (!isResolving) {
                                  setResolvingId(d.id)
                                  return
                                }
                                resolveForClient.mutate({ dispute: d, notes })
                              }}
                              disabled={isResolutionPending}
                              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
                                isResolving
                                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                                  : 'border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100'
                              }`}
                            >
                              <Users size={15} />
                              {isResolving
                                ? resolveForClient.isPending
                                  ? 'Refunding…'
                                  : 'Confirm: Refund Client'
                                : 'Resolve for Client'}
                            </button>
                          )}

                          {/* Resolve for Freelancer */}
                          {isActionable && (
                            <button
                              onClick={() => {
                                if (!isResolving) {
                                  setResolvingId(d.id)
                                  return
                                }
                                resolveForFreelancer.mutate({ dispute: d, notes })
                              }}
                              disabled={isResolutionPending}
                              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
                                isResolving
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  : 'border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                              }`}
                            >
                              <UserCheck size={15} />
                              {isResolving
                                ? resolveForFreelancer.isPending
                                  ? 'Releasing…'
                                  : 'Confirm: Release to Freelancer'
                                : 'Resolve for Freelancer'}
                            </button>
                          )}

                          {/* Cancel confirmation */}
                          {isResolving && (
                            <button
                              onClick={() => setResolvingId(null)}
                              className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground hover:bg-muted/50 rounded-xl text-sm font-medium transition-colors"
                            >
                              <XCircle size={15} />
                              Cancel
                            </button>
                          )}

                          {/* Closed state indicator */}
                          {!isActionable && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-xl text-sm text-muted-foreground">
                              <CheckCircle2 size={15} className="text-emerald-500" />
                              This dispute has been resolved
                            </div>
                          )}
                        </div>

                        {/* Confirmation warning */}
                        {isResolving && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                            <span>
                              <strong>Confirm resolution:</strong> Click the colored button again to confirm. This action will update the contract, transfer funds, and notify both parties. It cannot be undone.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {!isLoading && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground text-center mt-6">
            Showing {filtered.length} of {disputes.length} disputes
          </p>
        )}
      </div>
    </AdminLayout>
  )
}
