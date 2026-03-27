import { useState } from 'react'
import { useParams, useNavigate, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle, Clock, CreditCard, MessageSquare, Star,
  ChevronLeft, Shield, Flag, RotateCcw, ExternalLink, X,
  AlertTriangle, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { tables } from '../../blink/client'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDate, generateId } from '../../lib/utils'
import { createNotification } from '../../hooks/useNotifications'
import { StatusBadge } from '../../components/ui/StatusBadge'
import type { Contract, UserProfile, Review } from '../../types'

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
  )
}

// Status step timeline
const CONTRACT_STEPS = [
  { key: 'pending', label: 'Contract Created' },
  { key: 'active', label: 'Work In Progress' },
  { key: 'submitted', label: 'Work Submitted' },
  { key: 'completed', label: 'Approved & Complete' },
] as const

function StatusTimeline({ status }: { status: string }) {
  const stepOrder = ['pending', 'active', 'submitted', 'completed']
  const currentIdx = stepOrder.indexOf(status)
  const isDisputed = status === 'disputed'
  const isRevision = status === 'revision'
  const isCancelled = status === 'cancelled'

  if (isDisputed || isCancelled) {
    return (
      <div className="flex items-center gap-2 py-2">
        <AlertTriangle size={16} className={isDisputed ? 'text-red-500' : 'text-muted-foreground'} />
        <span className="text-sm font-medium text-muted-foreground">
          {isDisputed ? 'Contract is under dispute' : 'Contract cancelled'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2">
      {CONTRACT_STEPS.map((step, idx) => {
        const effectiveIdx = isRevision && step.key === 'submitted' ? currentIdx : currentIdx
        const done = idx < effectiveIdx
        const active = idx === effectiveIdx || (isRevision && step.key === 'submitted')

        return (
          <div key={step.key} className="flex-1 flex flex-col items-center text-center">
            <div
              className={`
                w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1.5
                ${done ? 'bg-green-500 text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
              `}
            >
              {done ? <CheckCircle size={14} /> : idx + 1}
            </div>
            <p
              className={`text-xs leading-tight ${
                active ? 'font-semibold text-foreground' : done ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'
              }`}
            >
              {step.label}
              {isRevision && step.key === 'submitted' ? ' (Revision)' : ''}
            </p>
            {idx < CONTRACT_STEPS.length - 1 && (
              <div
                className={`absolute hidden`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function ClientProjectDetail() {
  const { contractId } = useParams({ from: '/client/projects/$contractId' })
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [showReview, setShowReview] = useState(false)
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeDesc, setDisputeDesc] = useState('')

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: async () => {
      const r = await tables.contracts.list({ where: { id: contractId }, limit: 1 })
      return (r[0] ?? null) as Contract | null
    },
    enabled: !!contractId,
  })

  const { data: freelancer } = useQuery({
    queryKey: ['contract-freelancer', contract?.userId],
    queryFn: async () => {
      if (!contract?.userId) return null
      const r = await tables.userProfiles.list({ where: { userId: contract.userId }, limit: 1 })
      return (r[0] ?? null) as UserProfile | null
    },
    enabled: !!contract?.userId,
  })

  const { data: existingReview } = useQuery({
    queryKey: ['contract-review', contractId],
    queryFn: async () => {
      const r = await tables.reviews.list({ where: { contractId }, limit: 1 })
      return (r[0] ?? null) as Review | null
    },
    enabled: !!contractId,
  })

  // Approve work
  const approveWork = useMutation({
    mutationFn: async () => {
      if (!contract) return
      const now = new Date().toISOString()
      await tables.contracts.update(contract.id, {
        status: 'completed',
        completedAt: now,
        updatedAt: now,
      })
      await createNotification(
        contract.userId,
        '🎉 Work Approved!',
        `Client approved your work on "${contract.title}". Payment will be released by admin shortly.`,
        'success',
        `/freelancer/contracts/${contract.id}`
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract', contractId] })
      toast.success('Work approved! Admin will release the payment.')
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to approve work'),
  })

  // Request revision
  const requestRevision = useMutation({
    mutationFn: async (notes: string) => {
      if (!contract) return
      const now = new Date().toISOString()
      await tables.contracts.update(contract.id, {
        status: 'revision',
        clientNotes: notes,
        updatedAt: now,
      })
      await createNotification(
        contract.userId,
        'Revision Requested',
        `Client requested a revision on "${contract.title}".`,
        'warning',
        `/freelancer/contracts/${contract.id}`
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract', contractId] })
      toast.success('Revision requested.')
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  })

  // Submit review
  const submitReview = useMutation({
    mutationFn: async () => {
      if (!contract || !user) return
      const now = new Date().toISOString()
      await tables.reviews.create({
        id: generateId(),
        userId: user.id,
        freelancerId: contract.userId,
        contractId: contract.id,
        rating,
        comment,
        isPublic: '1',
        createdAt: now,
      })
      // Update freelancer aggregate rating
      const fps = await tables.freelancerProfiles.list({ where: { userId: contract.userId }, limit: 1 }) as any[]
      if (fps[0]) {
        const prev = fps[0]
        const prevRating = Number(prev.rating) || 0
        const prevTotal = Number(prev.totalReviews) || 0
        const newTotal = prevTotal + 1
        const newRating = (prevRating * prevTotal + rating) / newTotal
        await tables.freelancerProfiles.update(fps[0].id, {
          rating: parseFloat(newRating.toFixed(2)),
          totalReviews: newTotal,
          updatedAt: now,
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract-review', contractId] })
      qc.invalidateQueries({ queryKey: ['public-freelancer-profile', contract?.userId] })
      setShowReview(false)
      toast.success('Review submitted!')
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to submit review'),
  })

  // Open dispute
  const openDispute = useMutation({
    mutationFn: async () => {
      if (!contract || !user) return
      if (!disputeReason.trim()) throw new Error('Please select a reason')
      if (!disputeDesc.trim()) throw new Error('Please describe the issue')
      const now = new Date().toISOString()
      await tables.disputes.create({
        id: generateId(),
        userId: user.id,
        contractId: contract.id,
        reason: disputeReason,
        description: disputeDesc,
        evidenceUrl: '',
        status: 'open',
        adminNotes: '',
        resolution: '',
        createdAt: now,
        updatedAt: now,
      })
      await tables.contracts.update(contract.id, { status: 'disputed', updatedAt: now })
      await createNotification(
        contract.userId,
        'Dispute Filed',
        `A dispute has been filed for contract "${contract.title}"`,
        'warning',
        `/freelancer/contracts/${contract.id}`
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract', contractId] })
      toast.success('Dispute filed. Our team will review it.')
      setShowDisputeModal(false)
      setDisputeReason('')
      setDisputeDesc('')
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to file dispute'),
  })

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="page-container pt-24 max-w-3xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="bg-card border border-border rounded-2xl p-6 h-48" />
          <div className="bg-card border border-border rounded-2xl p-5 h-24" />
          <div className="bg-card border border-border rounded-2xl p-5 h-32" />
        </div>
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="page-container pt-24 max-w-3xl">
        <div className="text-center py-16">
          <FileText size={40} className="text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Contract Not Found</h2>
          <p className="text-muted-foreground mb-4">
            This contract doesn't exist or you don't have access.
          </p>
          <button
            onClick={() => navigate({ to: '/client/projects' })}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Back to Projects
          </button>
        </div>
      </div>
    )
  }

  const isPaid = contract.paymentStatus !== 'unpaid'
  const canApprove = contract.status === 'submitted' && isPaid
  const canRevise = contract.status === 'submitted' && isPaid
  const canDispute = ['active', 'submitted', 'revision'].includes(contract.status) && isPaid
  const isCompleted = contract.status === 'completed'

  return (
    <div className="page-container pt-24 max-w-3xl animate-fade-in">
      {/* Back */}
      <button
        onClick={() => navigate({ to: '/client/projects' })}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft size={16} />
        Back to Projects
      </button>

      {/* ── Contract Header ── */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <StatusBadge status={contract.status} />
              <StatusBadge status={contract.paymentStatus} />
            </div>
            <h1 className="text-xl font-bold text-foreground">{contract.title}</h1>
            {freelancer && (
              <p className="text-sm text-muted-foreground mt-1">
                with{' '}
                <Link
                  to="/freelancer/$userId"
                  params={{ userId: contract.userId }}
                  className="font-medium text-foreground hover:text-primary transition-colors hover:underline"
                >
                  {freelancer.displayName}
                </Link>
              </p>
            )}
          </div>
        </div>

        {/* Status timeline */}
        <div className="pt-4 border-t border-border mb-4">
          <StatusTimeline status={contract.status} />
        </div>

        {/* Description */}
        {contract.description && (
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{contract.description}</p>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Contract Value</p>
            <p className="font-bold text-foreground">{formatCurrency(Number(contract.amount))}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">To Freelancer</p>
            <p className="font-bold text-green-600 dark:text-green-400">
              {formatCurrency(Number(contract.freelancerAmount))}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Deadline</p>
            <p className="font-bold text-foreground flex items-center gap-1">
              <Clock size={13} />
              {formatDate(contract.deadline)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Payment Banner ── */}
      {!isPaid && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CreditCard size={20} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-300">
                  Payment required to start
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                  Fund the escrow to allow the freelancer to begin work.
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                navigate({
                  to: '/client/payment/$contractId',
                  params: { contractId: contract.id },
                })
              }
              className="px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 transition-colors flex-shrink-0"
            >
              Pay Now
            </button>
          </div>
        </div>
      )}

      {/* ── Escrow Status Banner ── */}
      {isPaid && (
        <div
          className={`border rounded-2xl p-4 mb-5 flex items-center gap-3 ${
            contract.paymentStatus === 'released'
              ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
              : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
          }`}
        >
          <Shield
            size={18}
            className={`flex-shrink-0 ${
              contract.paymentStatus === 'released'
                ? 'text-green-600 dark:text-green-400'
                : 'text-blue-600 dark:text-blue-400'
            }`}
          />
          <div>
            <p
              className={`font-semibold text-sm ${
                contract.paymentStatus === 'released'
                  ? 'text-green-800 dark:text-green-300'
                  : 'text-blue-800 dark:text-blue-300'
              }`}
            >
              {contract.paymentStatus === 'released'
                ? '✓ Payment released to freelancer'
                : '🔒 Payment held in escrow'}
            </p>
            <p
              className={`text-xs mt-0.5 ${
                contract.paymentStatus === 'released'
                  ? 'text-green-700 dark:text-green-400'
                  : 'text-blue-700 dark:text-blue-400'
              }`}
            >
              {formatCurrency(Number(contract.amount))} •{' '}
              {contract.paymentStatus === 'released'
                ? 'Funds have been sent to freelancer wallet'
                : 'Funds released only after you approve the work'}
            </p>
          </div>
        </div>
      )}

      {/* ── Deliverables (if submitted) ── */}
      {contract.deliverablesUrl && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-5 shadow-sm">
          <h2 className="font-semibold text-foreground mb-2">Submitted Deliverables</h2>
          <a
            href={contract.deliverablesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline break-all"
          >
            <ExternalLink size={14} className="flex-shrink-0" />
            {contract.deliverablesUrl}
          </a>
        </div>
      )}

      {/* ── Revision notes ── */}
      {contract.status === 'revision' && contract.clientNotes && (
        <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-2xl p-5 mb-5">
          <div className="flex items-start gap-2">
            <RotateCcw size={16} className="text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-800 dark:text-orange-300 text-sm mb-1">
                Revision Requested
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-400">{contract.clientNotes}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      {(canApprove || canRevise) && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-5 shadow-sm">
          <h2 className="font-semibold text-foreground mb-1">Review Submitted Work</h2>
          <p className="text-sm text-muted-foreground mb-4">
            The freelancer has submitted their work. Please review the deliverables above and either
            approve or request changes.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => approveWork.mutate()}
              disabled={approveWork.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-60"
            >
              {approveWork.isPending ? <Spinner /> : <CheckCircle size={15} />}
              Approve Work
            </button>
            <button
              onClick={() => {
                const notes = prompt('What needs to be revised?')
                if (notes?.trim()) requestRevision.mutate(notes.trim())
              }}
              disabled={requestRevision.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
            >
              {requestRevision.isPending ? <Spinner /> : <RotateCcw size={15} />}
              Request Revision
            </button>
          </div>
        </div>
      )}

      {/* ── Leave Review ── */}
      {isCompleted && !existingReview && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-5 shadow-sm">
          <h2 className="font-semibold text-foreground mb-3">Leave a Review</h2>
          {!showReview ? (
            <button
              onClick={() => setShowReview(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Write Review
            </button>
          ) : (
            <div className="space-y-4">
              {/* Star picker */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  Rating
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-0.5 transition-transform hover:scale-110"
                    >
                      <Star
                        size={28}
                        className={
                          n <= (hoverRating || rating)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-gray-300 dark:text-gray-600'
                        }
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-muted-foreground self-center">
                    {rating}/5
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Comment (optional)
                </label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Share your experience working with this freelancer..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 border border-input rounded-xl bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary resize-none transition-colors"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => submitReview.mutate()}
                  disabled={submitReview.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {submitReview.isPending ? <Spinner /> : null}
                  Submit Review
                </button>
                <button
                  onClick={() => setShowReview(false)}
                  className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Review already submitted ── */}
      {isCompleted && existingReview && (
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-2xl p-4 mb-5 flex items-center gap-3">
          <CheckCircle size={16} className="text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-300">
            You rated this freelancer {existingReview.rating}/5 stars.
          </p>
        </div>
      )}

      {/* ── Bottom links ── */}
      <div className="flex flex-wrap gap-3">
        <Link
          to="/messages/$contractId"
          params={{ contractId: contract.id }}
          className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
        >
          <MessageSquare size={16} />
          Messages
        </Link>

        {canDispute && (
          <button
            onClick={() => setShowDisputeModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-destructive/30 text-destructive rounded-xl text-sm font-medium hover:bg-destructive/5 transition-colors"
          >
            <Flag size={15} />
            File Dispute
          </button>
        )}
      </div>

      {/* Dispute modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setShowDisputeModal(false)}
          />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-md shadow-xl animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">File a Dispute</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Our team reviews within 24 hours</p>
              </div>
              <button
                onClick={() => setShowDisputeModal(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle size={14} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                  Filing a dispute will pause all contract actions until resolved by an admin.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Reason <span className="text-destructive">*</span>
                </label>
                <select
                  value={disputeReason}
                  onChange={e => setDisputeReason(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                >
                  <option value="">Select a reason…</option>
                  <option value="Work not delivered">Work not delivered</option>
                  <option value="Poor quality work">Poor quality work</option>
                  <option value="Missed deadline">Missed deadline</option>
                  <option value="Unresponsive freelancer">Unresponsive freelancer</option>
                  <option value="Contract terms violation">Contract terms violation</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Describe the issue <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={disputeDesc}
                  onChange={e => setDisputeDesc(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-none"
                  placeholder="Explain the issue in detail…"
                  maxLength={2000}
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-2 justify-end">
              <button
                onClick={() => setShowDisputeModal(false)}
                className="px-4 py-2 border border-border text-foreground rounded-xl text-sm hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => openDispute.mutate()}
                disabled={openDispute.isPending}
                className="flex items-center gap-2 px-5 py-2 bg-destructive text-destructive-foreground rounded-xl text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-60"
              >
                {openDispute.isPending ? <Spinner /> : <Flag size={14} />}
                File Dispute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
