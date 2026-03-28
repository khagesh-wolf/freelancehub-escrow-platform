import { useState, useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  Clock, DollarSign, CheckCircle, Upload, MessageCircle,
  AlertTriangle, ArrowLeft, ExternalLink, RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import { tables } from '@/blink/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Contract, Milestone } from '@/types'
import { toast } from 'sonner'

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
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.pending}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">{value}</span>
    </div>
  )
}

export function FreelancerContractDetail() {
  const { user, profile, isLoading } = useAuth()
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { contractId?: string }
  const contractId = params.contractId || ''

  const [contract, setContract] = useState<Contract | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)

  // Submit work dialog
  const [submitOpen, setSubmitOpen] = useState(false)
  const [deliverablesUrl, setDeliverablesUrl] = useState('')
  const [clientNotes, setClientNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Dispute dialog
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeDesc, setDisputeDesc] = useState('')
  const [disputeSubmitting, setDisputeSubmitting] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) navigate({ to: '/auth/login' })
    if (!isLoading && profile && profile.role !== 'freelancer') navigate({ to: '/client/dashboard' })
  }, [isLoading, user, profile])

  useEffect(() => {
    if (!user || !contractId) return
    loadData()
  }, [user, contractId])

  async function loadData() {
    setLoading(true)
    try {
      const [contractsData, milestonesData] = await Promise.all([
        tables.contracts.list({ where: { id: contractId, userId: user!.id }, limit: 1 }),
        tables.milestones.list({ where: { contractId }, orderBy: { createdAt: 'asc' } }),
      ])
      const c = contractsData[0] as Contract | undefined
      if (!c) { navigate({ to: '/freelancer/contracts' }); return }
      setContract(c)
      setMilestones(milestonesData as Milestone[])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  async function submitWork() {
    if (!contract) return
    if (!deliverablesUrl.trim()) { toast.error('Please enter the deliverables URL'); return }

    setSubmitting(true)
    try {
      await tables.contracts.update(contract.id, {
        status: 'submitted',
        deliverablesUrl: deliverablesUrl.trim(),
        clientNotes: clientNotes.trim() || undefined,
      })
      setContract(prev => prev ? { ...prev, status: 'submitted', deliverablesUrl: deliverablesUrl.trim() } : prev)
      setSubmitOpen(false)
      toast.success('Work submitted!', { description: 'Waiting for client review.' })
    } catch {
      toast.error('Submission failed', { description: 'Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  async function raiseDispute() {
    if (!contract || !user) return
    if (!disputeReason.trim()) { toast.error('Please enter a reason'); return }
    if (!disputeDesc.trim()) { toast.error('Please describe the issue'); return }

    setDisputeSubmitting(true)
    try {
      await tables.disputes.create({
        userId: user.id,
        contractId: contract.id,
        reason: disputeReason.trim(),
        description: disputeDesc.trim(),
        evidenceUrl: '',
        status: 'open',
        adminNotes: '',
        resolution: '',
      })
      setDisputeOpen(false)
      toast.success('Dispute raised', { description: 'Our team will review your case shortly.' })
    } catch {
      toast.error('Failed to raise dispute', { description: 'Please try again.' })
    } finally {
      setDisputeSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="h-8 w-48 bg-muted/60 rounded animate-pulse mb-6" />
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-40 bg-muted/60 rounded-xl animate-pulse" />
            <div className="h-52 bg-muted/60 rounded-xl animate-pulse" />
          </div>
          <div className="h-64 bg-muted/60 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (!contract) return null

  const canSubmit = contract.status === 'active' || contract.status === 'revision'
  const isSubmitted = contract.status === 'submitted'
  const canDispute = ['active', 'submitted', 'revision'].includes(contract.status)

  return (
    <div className="page-container animate-fade-in">
      {/* Back */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/freelancer/contracts' })}
          className="text-muted-foreground hover:text-foreground -ml-2">
          <ArrowLeft size={15} className="mr-1.5" /> Back to Contracts
        </Button>
      </div>

      {/* Title Row */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap mb-1">
            <h1 className="text-2xl font-bold text-foreground">{contract.title}</h1>
            <StatusBadge status={contract.status} />
          </div>
          <p className="text-muted-foreground text-sm">
            Client: <span className="text-foreground font-medium">{contract.clientName || 'Client'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: '/messages/$contractId', params: { contractId: contract.id } })}
          >
            <MessageCircle size={14} className="mr-1.5" /> Messages
          </Button>
          {canDispute && (
            <Button
              variant="outline"
              size="sm"
              className="border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => setDisputeOpen(true)}
            >
              <AlertTriangle size={14} className="mr-1.5" /> Dispute
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contract Details */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold text-foreground mb-4">Contract Details</h2>
            {contract.description && (
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{contract.description}</p>
            )}
            <div className="divide-y divide-border">
              <InfoRow label="Client" value={contract.clientName || '—'} />
              <InfoRow label="Deadline" value={formatDate(contract.deadline)} />
              <InfoRow label="Total Amount" value={formatCurrency(Number(contract.amount))} />
              <InfoRow
                label="Your Earnings"
                value={
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {formatCurrency(Number(contract.freelancerAmount))}
                  </span>
                }
              />
              <InfoRow
                label="Platform Fee"
                value={`${formatCurrency(Number(contract.platformFee))} (10%)`}
              />
              <InfoRow label="Payment Status" value={<StatusBadge status={contract.paymentStatus} />} />
            </div>
          </div>

          {/* Milestones */}
          {milestones.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <CheckCircle size={16} className="text-muted-foreground" />
                Milestones ({milestones.length})
              </h2>
              <div className="space-y-3">
                {milestones.map((m, idx) => (
                  <div key={m.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      m.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      m.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{m.title}</span>
                        <StatusBadge status={m.status} />
                      </div>
                      {m.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{formatCurrency(Number(m.amount))}</span>
                        {m.dueDate && <span>Due: {formatDate(m.dueDate)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deliverables (if already submitted) */}
          {contract.deliverablesUrl && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Upload size={15} className="text-muted-foreground" />
                Submitted Deliverables
              </h2>
              <a
                href={contract.deliverablesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline break-all"
              >
                <ExternalLink size={13} />
                {contract.deliverablesUrl}
              </a>
            </div>
          )}

          {/* Status Messages */}
          {isSubmitted && (
            <div className="flex items-start gap-3 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/40 rounded-xl p-4">
              <Clock size={16} className="text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
                  Awaiting Client Review
                </p>
                <p className="text-xs text-purple-700/70 dark:text-purple-400/70 mt-0.5">
                  Your work has been submitted. The client will review and release payment once satisfied.
                </p>
              </div>
            </div>
          )}

          {contract.status === 'revision' && (
            <div className="flex items-start gap-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/40 rounded-xl p-4">
              <RefreshCw size={16} className="text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                  Revision Requested
                </p>
                {contract.clientNotes && (
                  <p className="text-xs text-orange-700/70 dark:text-orange-400/70 mt-0.5">
                    Client notes: {contract.clientNotes}
                  </p>
                )}
              </div>
            </div>
          )}

          {contract.status === 'completed' && (
            <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-4">
              <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  Contract Completed!
                </p>
                <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">
                  Payment of {formatCurrency(Number(contract.freelancerAmount))} has been released to your wallet.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Earnings Card */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              Your Earnings
            </h3>
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(Number(contract.freelancerAmount))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              After 10% platform fee from {formatCurrency(Number(contract.amount))}
            </p>
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Payment</span>
                <StatusBadge status={contract.paymentStatus} />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-2.5">
            <h3 className="text-sm font-semibold text-foreground mb-1">Actions</h3>

            {canSubmit && (
              <Button
                className="w-full gradient-amber text-white border-0"
                onClick={() => setSubmitOpen(true)}
              >
                <Upload size={15} className="mr-1.5" />
                {contract.status === 'revision' ? 'Resubmit Work' : 'Submit Work'}
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate({ to: '/messages/$contractId', params: { contractId: contract.id } })}
            >
              <MessageCircle size={15} className="mr-1.5" />
              Message Client
            </Button>

            {canDispute && (
              <Button
                variant="outline"
                className="w-full border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={() => setDisputeOpen(true)}
              >
                <AlertTriangle size={15} className="mr-1.5" />
                Raise Dispute
              </Button>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Timeline</h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Contract Created</span>
                <span className="text-foreground">{formatDate(contract.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Deadline</span>
                <span className="font-medium text-foreground">{formatDate(contract.deadline)}</span>
              </div>
              {contract.completedAt && (
                <div className="flex justify-between">
                  <span>Completed</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{formatDate(contract.completedAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Submit Work Dialog */}
      <Dialog open={submitOpen} onOpenChange={open => !submitting && setSubmitOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {contract.status === 'revision' ? 'Resubmit Work' : 'Submit Work'}
            </DialogTitle>
            <DialogDescription>
              Provide a link to your deliverables and any notes for the client.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Deliverables URL *
              </label>
              <Input
                placeholder="https://drive.google.com/... or GitHub link..."
                value={deliverablesUrl}
                onChange={e => setDeliverablesUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Link to your work (Google Drive, GitHub, Figma, etc.)
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Notes to Client (optional)
              </label>
              <Textarea
                placeholder="Describe what you've delivered, instructions, or anything the client should know..."
                value={clientNotes}
                onChange={e => setClientNotes(e.target.value)}
                rows={4}
                className="resize-none text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSubmitOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              className="gradient-amber text-white border-0"
              onClick={submitWork}
              disabled={submitting}
            >
              {submitting ? (
                <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Submitting...</>
              ) : (
                <><Upload size={14} className="mr-1.5" />Submit Work</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute Dialog */}
      <Dialog open={disputeOpen} onOpenChange={open => !disputeSubmitting && setDisputeOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={17} className="text-red-500" />
              Raise a Dispute
            </DialogTitle>
            <DialogDescription>
              Our team will review your dispute and mediate a fair resolution.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Reason *
              </label>
              <Input
                placeholder="e.g. Client is unresponsive, Payment not released..."
                value={disputeReason}
                onChange={e => setDisputeReason(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Detailed Description *
              </label>
              <Textarea
                placeholder="Explain the issue in detail. Include dates, what was agreed, and what went wrong..."
                value={disputeDesc}
                onChange={e => setDisputeDesc(e.target.value)}
                rows={5}
                className="resize-none text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDisputeOpen(false)} disabled={disputeSubmitting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={raiseDispute}
              disabled={disputeSubmitting}
            >
              {disputeSubmitting ? (
                <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Submitting...</>
              ) : (
                <><AlertTriangle size={14} className="mr-1.5" />Submit Dispute</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
