import { useEffect } from 'react'
import { useNavigate, useParams, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  ArrowLeft,
  Shield,
  User,
  FileText,
  ChevronRight,
  RotateCcw,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { tables } from '@/blink/client'
import { formatCurrency, formatDate, formatRelativeTime, getStatusColor } from '@/lib/utils'
import type { Contract, Milestone } from '@/types'

function AuthSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}

function InfoRow({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium text-foreground ${valueClass ?? ''}`}>{value}</span>
    </div>
  )
}

function MilestoneStatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

export function ClientContractDetailPage() {
  const { user, profile, isLoading } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { contractId } = useParams({ strict: false }) as { contractId: string }

  // Auth guard
  useEffect(() => {
    if (!isLoading && !user) navigate({ to: '/auth/login' })
    if (!isLoading && profile && profile.role !== 'client') navigate({ to: '/freelancer/dashboard' })
  }, [isLoading, user, profile])

  // ── Fetch contract ────────────────────────────────────────────────────────
  const { data: contractList = [], isLoading: contractLoading } = useQuery<Contract[]>({
    queryKey: ['contract-detail', contractId],
    queryFn: () => tables.contracts.list({ where: { id: contractId }, limit: 1 }) as Promise<Contract[]>,
    enabled: !!user && !!contractId,
  })

  // ── Fetch milestones ─────────────────────────────────────────────────────
  const { data: milestones = [], isLoading: milestonesLoading } = useQuery<Milestone[]>({
    queryKey: ['contract-milestones', contractId],
    queryFn: () => tables.milestones.list({ where: { contractId }, orderBy: { createdAt: 'asc' } }) as Promise<Milestone[]>,
    enabled: !!contractId,
  })

  const contract = contractList[0] || null

  // ── Fund escrow mutation ──────────────────────────────────────────────────
  const fundEscrowMutation = useMutation({
    mutationFn: async () => {
      if (!contract) return
      // Update contract status
      await tables.contracts.update(contract.id, {
        paymentStatus: 'paid_to_platform',
        status: 'active',
      } as any)
      // Create escrow transaction record
      await tables.transactions.create({
        userId: user!.id,
        contractId: contract.id,
        type: 'escrow_hold',
        amount: Number(contract.amount),
        description: `Escrow funded for: ${contract.title}`,
        status: 'completed',
      } as any)
    },
    onSuccess: () => {
      toast.success('Escrow funded!', { description: 'The contract is now active. The freelancer can begin work.' })
      queryClient.invalidateQueries({ queryKey: ['contract-detail', contractId] })
      queryClient.invalidateQueries({ queryKey: ['client-contracts', user?.id] })
    },
    onError: () => toast.error('Failed to fund escrow', { description: 'Please try again.' }),
  })

  // ── Approve work mutation ─────────────────────────────────────────────────
  const approveWorkMutation = useMutation({
    mutationFn: async () => {
      if (!contract) return
      await tables.contracts.update(contract.id, {
        status: 'completed',
        paymentStatus: 'released',
        completedAt: new Date().toISOString(),
      } as any)
      // Release payment transaction
      await tables.transactions.create({
        userId: contract.userId,
        contractId: contract.id,
        type: 'credit',
        amount: Number(contract.freelancerAmount),
        description: `Payment released for: ${contract.title}`,
        status: 'completed',
      } as any)
    },
    onSuccess: () => {
      toast.success('Work approved!', { description: `Payment of ${formatCurrency(Number(contract?.freelancerAmount || 0))} has been released to the freelancer.` })
      queryClient.invalidateQueries({ queryKey: ['contract-detail', contractId] })
      queryClient.invalidateQueries({ queryKey: ['client-contracts', user?.id] })
    },
    onError: () => toast.error('Failed to approve work', { description: 'Please try again.' }),
  })

  // ── Request revision mutation ─────────────────────────────────────────────
  const requestRevisionMutation = useMutation({
    mutationFn: async () => {
      if (!contract) return
      await tables.contracts.update(contract.id, { status: 'revision' } as any)
    },
    onSuccess: () => {
      toast.success('Revision requested', { description: 'The freelancer has been notified.' })
      queryClient.invalidateQueries({ queryKey: ['contract-detail', contractId] })
    },
    onError: () => toast.error('Failed to request revision'),
  })

  // ── Open dispute mutation ─────────────────────────────────────────────────
  const openDisputeMutation = useMutation({
    mutationFn: async () => {
      if (!contract) return
      await tables.disputes.create({
        userId: user!.id,
        contractId: contract.id,
        reason: 'Client dispute',
        description: 'Client opened a dispute regarding this contract.',
        status: 'open',
      } as any)
      await tables.contracts.update(contract.id, { status: 'disputed' } as any)
    },
    onSuccess: () => {
      toast.success('Dispute opened', { description: 'Our team will review and contact both parties.' })
      queryClient.invalidateQueries({ queryKey: ['contract-detail', contractId] })
    },
    onError: () => toast.error('Failed to open dispute'),
  })

  if (isLoading) return <AuthSpinner />

  if (contractLoading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-40 bg-muted rounded-xl" />
          <div className="h-60 bg-muted rounded-xl" />
        </div>
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="page-container">
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <FileText size={48} className="mx-auto text-muted-foreground mb-4 opacity-40" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Contract Not Found</h2>
          <p className="text-muted-foreground mb-6">This contract doesn't exist or you don't have access to it.</p>
          <Button onClick={() => navigate({ to: '/client/projects' })}>
            <ArrowLeft size={15} /> Back to Projects
          </Button>
        </div>
      </div>
    )
  }

  const canFundEscrow = contract.status === 'pending' && contract.paymentStatus === 'unpaid'
  const canApproveWork = contract.status === 'submitted'
  const canRequestRevision = contract.status === 'active' || contract.status === 'submitted'
  const canDispute = contract.status === 'active' || contract.status === 'submitted' || contract.status === 'revision'
  const isCompleted = contract.status === 'completed'
  const isDisputed = contract.status === 'disputed'

  const platformFee = Number(contract.platformFee || 0)
  const freelancerAmount = Number(contract.freelancerAmount || 0)
  const totalAmount = Number(contract.amount || 0)

  return (
    <div className="page-container animate-fade-in">
      {/* Back + Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
        <button
          onClick={() => navigate({ to: '/client/projects' })}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          Projects
        </button>
        <ChevronRight size={12} />
        <span className="text-foreground font-medium truncate">{contract.title}</span>
      </div>

      {/* ── Status Banner ────────────────────────────────────────────────── */}
      {canFundEscrow && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Action Required: Fund Escrow</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Deposit {formatCurrency(totalAmount)} into escrow to activate the contract and allow the freelancer to begin work.
            </p>
          </div>
        </div>
      )}

      {canApproveWork && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
          <CheckCircle2 size={18} className="text-purple-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-purple-800 dark:text-purple-300">Work Submitted for Review</p>
            <p className="text-xs text-purple-700 dark:text-purple-400 mt-0.5">
              The freelancer has submitted their work. Review it and approve to release payment, or request a revision.
            </p>
          </div>
        </div>
      )}

      {isCompleted && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Contract Completed</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
              This contract has been completed and payment has been released.
            </p>
          </div>
        </div>
      )}

      {isDisputed && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Dispute In Progress</p>
            <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
              Our team is reviewing this dispute and will contact both parties shortly.
            </p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Main content ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Contract overview card */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h1 className="text-2xl font-bold text-foreground">{contract.title}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium shrink-0 ${getStatusColor(contract.status)}`}>
                {contract.status}
              </span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">{contract.description}</p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-muted/50">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                  <User size={12} /> Freelancer
                </div>
                <div className="font-semibold text-foreground">{contract.freelancerName || 'Freelancer'}</div>
              </div>
              <div className="p-4 rounded-xl bg-muted/50">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                  <Clock size={12} /> Deadline
                </div>
                <div className="font-semibold text-foreground">{formatDate(contract.deadline)}</div>
              </div>
            </div>
          </div>

          {/* Milestones */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Shield size={16} className="text-primary" />
              Milestones
            </h2>

            {milestonesLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="animate-pulse h-16 bg-muted rounded-xl" />
                ))}
              </div>
            ) : milestones.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No milestones defined for this contract.</p>
                <p className="text-xs text-muted-foreground mt-1">Milestones help track project progress.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {milestones.map((milestone, idx) => (
                  <div key={milestone.id} className="flex items-start gap-4 p-4 rounded-xl border border-border bg-muted/30">
                    {/* Step number */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      milestone.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : milestone.status === 'submitted'
                          ? 'bg-purple-100 text-purple-700'
                          : milestone.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-muted text-muted-foreground'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="font-medium text-foreground text-sm">{milestone.title}</h4>
                        <MilestoneStatusBadge status={milestone.status} />
                      </div>
                      {milestone.description && (
                        <p className="text-xs text-muted-foreground mb-2">{milestone.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <DollarSign size={10} />
                          {formatCurrency(Number(milestone.amount || 0))}
                        </span>
                        {milestone.dueDate && (
                          <span>Due {formatDate(milestone.dueDate)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deliverables URL if submitted */}
          {contract.deliverablesUrl && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                Submitted Deliverables
              </h2>
              <a
                href={contract.deliverablesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                View submitted work <ChevronRight size={14} />
              </a>
            </div>
          )}
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Payment breakdown */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <DollarSign size={15} className="text-primary" />
              Payment Summary
            </h3>
            <div>
              <InfoRow label="Contract Amount" value={formatCurrency(totalAmount)} />
              <InfoRow label="Platform Fee (10%)" value={`-${formatCurrency(platformFee)}`} valueClass="text-muted-foreground" />
              <InfoRow
                label="Freelancer Receives"
                value={formatCurrency(freelancerAmount)}
                valueClass="text-emerald-600"
              />
              <div className="mt-3 pt-3 border-t border-border">
                <InfoRow
                  label="Payment Status"
                  value={
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(contract.paymentStatus)}`}>
                      {contract.paymentStatus?.replace('_', ' ')}
                    </span>
                  }
                />
              </div>
            </div>
          </div>

          {/* Escrow shield */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={16} className="text-primary" />
              <span className="font-semibold text-foreground text-sm">Escrow Protection</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Your payment is held securely in escrow. Funds are only released after you approve the completed work.
            </p>
          </div>

          {/* Actions */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-foreground text-sm">Actions</h3>

            {canFundEscrow && (
              <Button
                className="w-full gradient-amber text-white border-0"
                onClick={() => fundEscrowMutation.mutate()}
                disabled={fundEscrowMutation.isPending}
              >
                {fundEscrowMutation.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <Zap size={15} />
                )}
                Fund Escrow ({formatCurrency(totalAmount)})
              </Button>
            )}

            {canApproveWork && (
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => approveWorkMutation.mutate()}
                disabled={approveWorkMutation.isPending}
              >
                {approveWorkMutation.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                Approve Work & Release Payment
              </Button>
            )}

            {canRequestRevision && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => requestRevisionMutation.mutate()}
                disabled={requestRevisionMutation.isPending}
              >
                {requestRevisionMutation.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                ) : (
                  <RotateCcw size={15} />
                )}
                Request Revision
              </Button>
            )}

            <Link to="/messages/$contractId" params={{ contractId: contract.id } as any} className="block">
              <Button variant="outline" className="w-full">
                <MessageCircle size={15} />
                Messages
              </Button>
            </Link>

            {canDispute && (
              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => openDisputeMutation.mutate()}
                disabled={openDisputeMutation.isPending}
              >
                {openDisputeMutation.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-destructive" />
                ) : (
                  <AlertCircle size={15} />
                )}
                Open Dispute
              </Button>
            )}
          </div>

          {/* Meta info */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground text-sm mb-3">Contract Info</h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Contract ID</span>
                <span className="font-mono text-foreground">{contract.id.slice(0, 8)}…</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Created</span>
                <span>{formatRelativeTime(contract.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Last Updated</span>
                <span>{formatRelativeTime(contract.updatedAt || contract.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
