import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from '@tanstack/react-router'
import {
  ArrowLeft, Clock, DollarSign, CheckCircle, AlertTriangle,
  MessageSquare, Upload, RotateCcw, Flag, X, ExternalLink,
  FileText, Shield,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { blink, tables } from '../../blink/client'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDate, generateId } from '../../lib/utils'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { createNotification } from '../../hooks/useNotifications'
import type { Contract } from '../../types'

export function FreelancerContractDetail() {
  const { contractId } = useParams({ strict: false }) as { contractId: string }
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  // Submit work modal
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [deliverablesUrl, setDeliverablesUrl] = useState('')
  const [submitNotes, setSubmitNotes] = useState('')

  // Dispute modal
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeDesc, setDisputeDesc] = useState('')

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: async () => {
      if (!contractId) return null
      const c = await tables.contracts.get(contractId)
      return c as Contract | null
    },
    enabled: !!contractId,
  })

  const submitWork = useMutation({
    mutationFn: async () => {
      if (!contract || !user?.id) throw new Error('Not found')
      if (!deliverablesUrl.trim()) throw new Error('Please enter the deliverables URL')

      await tables.contracts.update(contract.id, {
        status: 'submitted',
        deliverablesUrl,
        updatedAt: new Date().toISOString(),
      })

      await createNotification(
        contract.clientId,
        'Work Submitted',
        `The freelancer has submitted work for "${contract.title}". Please review and approve.`,
        'info',
        `/client/projects/${contract.id}`
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract', contractId] })
      toast.success('Work submitted successfully!')
      setShowSubmitModal(false)
      setDeliverablesUrl('')
      setSubmitNotes('')
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to submit work'),
  })

  const openDispute = useMutation({
    mutationFn: async () => {
      if (!contract || !user?.id) throw new Error('Not found')
      if (!disputeReason.trim()) throw new Error('Please enter a reason')
      if (!disputeDesc.trim()) throw new Error('Please describe the issue')

      // Create dispute record
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      // Update contract status
      await tables.contracts.update(contract.id, {
        status: 'disputed',
        updatedAt: new Date().toISOString(),
      })

      await createNotification(
        contract.clientId,
        'Dispute Filed',
        `A dispute has been filed for contract "${contract.title}"`,
        'warning',
        `/client/projects/${contract.id}`
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract', contractId] })
      toast.success('Dispute filed. Our team will review it.')
      setShowDisputeModal(false)
      setDisputeReason('')
      setDisputeDesc('')
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to file dispute'),
  })

  if (isLoading) {
    return (
      <div className="page-container pt-24">
        <div className="max-w-3xl animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/2" />
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="page-container pt-24">
        <div className="text-center py-16">
          <FileText size={40} className="text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Contract Not Found</h2>
          <p className="text-muted-foreground mb-4">This contract doesn't exist or you don't have access.</p>
          <button
            onClick={() => navigate({ to: '/freelancer/contracts' })}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Back to Contracts
          </button>
        </div>
      </div>
    )
  }

  const canSubmit = contract.status === 'active'
  const canReSubmit = contract.status === 'revision'
  const isCompleted = contract.status === 'completed'
  const isSubmitted = contract.status === 'submitted'
  const canDispute = ['active', 'submitted', 'revision'].includes(contract.status)

  return (
    <div className="page-container pt-24">
      <div className="max-w-3xl animate-fade-in">
        {/* Back */}
        <button
          onClick={() => navigate({ to: '/freelancer/contracts' })}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          Back to Contracts
        </button>

        {/* Header */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <StatusBadge status={contract.status} />
                <StatusBadge status={contract.paymentStatus} />
              </div>
              <h1 className="text-xl font-bold text-foreground">{contract.title}</h1>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(contract.freelancerAmount)}
              </p>
              <p className="text-xs text-muted-foreground">
                Your earnings (after 10% fee)
              </p>
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Total Value</p>
              <p className="font-semibold text-foreground">{formatCurrency(contract.amount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Platform Fee</p>
              <p className="font-semibold text-foreground">{formatCurrency(contract.platformFee)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Deadline</p>
              <p className="font-semibold text-foreground flex items-center gap-1">
                <Clock size={13} />
                {formatDate(contract.deadline)}
              </p>
            </div>
          </div>
        </div>

        {/* Description / notes */}
        {contract.description && (
          <div className="bg-card border border-border rounded-2xl p-5 mb-4">
            <h2 className="font-semibold text-foreground mb-2 text-sm">Contract Details</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contract.description}</p>
          </div>
        )}

        {/* Deliverables (if submitted) */}
        {contract.deliverablesUrl && (
          <div className="bg-card border border-border rounded-2xl p-5 mb-4">
            <h2 className="font-semibold text-foreground mb-2 text-sm">Submitted Deliverables</h2>
            <a
              href={contract.deliverablesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink size={14} />
              {contract.deliverablesUrl}
            </a>
          </div>
        )}

        {/* Client notes (revision request) */}
        {contract.status === 'revision' && contract.clientNotes && (
          <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-2xl p-5 mb-4">
            <div className="flex items-start gap-2">
              <RotateCcw size={16} className="text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-orange-800 dark:text-orange-300 mb-1 text-sm">
                  Revision Requested
                </h2>
                <p className="text-sm text-orange-700 dark:text-orange-400">{contract.clientNotes}</p>
              </div>
            </div>
          </div>
        )}

        {/* Status banners */}
        {isSubmitted && (
          <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-2xl p-5 mb-4 flex items-center gap-3">
            <CheckCircle size={18} className="text-purple-600 dark:text-purple-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-purple-800 dark:text-purple-300 text-sm">
                Work Submitted — Awaiting Client Review
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                The client will review your submission and either approve or request revisions.
              </p>
            </div>
          </div>
        )}

        {isCompleted && (
          <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-2xl p-5 mb-4 flex items-center gap-3">
            <CheckCircle size={18} className="text-green-600 dark:text-green-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-800 dark:text-green-300 text-sm">
                Contract Completed ✓
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                Payment of {formatCurrency(contract.freelancerAmount)} has been released to your wallet.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-4">
          {(canSubmit || canReSubmit) && (
            <button
              onClick={() => setShowSubmitModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Upload size={15} />
              {canReSubmit ? 'Re-submit Work' : 'Submit Work'}
            </button>
          )}

          <Link
            to="/messages/$contractId"
            params={{ contractId: contract.id }}
            className="flex items-center gap-2 px-5 py-2.5 border border-border text-foreground rounded-xl text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <MessageSquare size={15} />
            Messages
          </Link>

          {canDispute && !isCompleted && (
            <button
              onClick={() => setShowDisputeModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 border border-destructive/30 text-destructive rounded-xl text-sm font-medium hover:bg-destructive/5 transition-colors"
            >
              <Flag size={15} />
              File Dispute
            </button>
          )}
        </div>

        {/* Protection note */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Shield size={13} className="flex-shrink-0 mt-0.5" />
          <p>
            Your payment is held in escrow and will be released upon client approval.
            If there are any issues, you can file a dispute for admin review.
          </p>
        </div>
      </div>

      {/* Submit Work Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setShowSubmitModal(false)} />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-md shadow-xl animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Submit Work</h2>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Deliverables URL <span className="text-destructive">*</span>
                </label>
                <input
                  value={deliverablesUrl}
                  onChange={e => setDeliverablesUrl(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                  placeholder="https://github.com/... or Google Drive link"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Share a link to your deliverables (GitHub, Drive, Dropbox, etc.)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Notes for client (optional)
                </label>
                <textarea
                  value={submitNotes}
                  onChange={e => setSubmitNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm resize-none"
                  placeholder="Describe what you've delivered and any relevant notes..."
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-2 justify-end">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 border border-border text-foreground rounded-xl text-sm hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => submitWork.mutate()}
                disabled={submitWork.isPending}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {submitWork.isPending
                  ? <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  : <Upload size={14} />
                }
                Submit Work
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setShowDisputeModal(false)} />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-md shadow-xl animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">File a Dispute</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Our team will review within 24 hours</p>
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
                  <option value="">Select a reason...</option>
                  <option value="Non-payment">Non-payment</option>
                  <option value="Scope creep">Scope creep / extra work requested</option>
                  <option value="Unreasonable revisions">Unreasonable revision requests</option>
                  <option value="Unresponsive client">Unresponsive client</option>
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
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm resize-none"
                  placeholder="Explain the issue in detail..."
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
                {openDispute.isPending
                  ? <div className="w-3.5 h-3.5 border-2 border-destructive-foreground/30 border-t-destructive-foreground rounded-full animate-spin" />
                  : <Flag size={14} />
                }
                File Dispute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
