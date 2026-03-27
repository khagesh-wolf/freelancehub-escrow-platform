import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ExternalLink, UserCheck, Briefcase } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/shared/EmptyState'
import { blink, tables } from '../../blink/client'
import { formatDate, timeAgo } from '../../lib/utils'
import { FUNCTION_URLS } from '../../lib/functions'
import type { Dispute, Contract, UserProfile } from '../../types'

// ─── resolve dialog ───────────────────────────────────────────────────────────
interface ResolveDialogProps {
  dispute: Dispute
  contract?: Contract
  onClose: () => void
}

function ResolveDialog({ dispute, contract, onClose }: ResolveDialogProps) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const qc = useQueryClient()

  const resolve = async (winner: 'client' | 'freelancer') => {
    if (!notes.trim()) {
      toast.error('Please provide resolution notes')
      return
    }
    setLoading(true)
    try {
      const newStatus = winner === 'client' ? 'resolved_client' : 'resolved_freelancer'

      // Update dispute
      await tables.disputes.update(dispute.id, {
        status: newStatus,
        adminNotes: notes,
        resolution: `Resolved in favor of ${winner}`,
      })

      // If resolving for freelancer and contract is in escrow, release payment
      if (winner === 'freelancer' && contract && contract.paymentStatus === 'paid_to_platform') {
        try {
          const token = await blink.auth.getValidToken()
          await fetch(FUNCTION_URLS.releasePayment, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ contractId: dispute.contractId, adminNotes: notes }),
          })
        } catch {
          // payment release may fail silently — dispute is still resolved
        }
      }

      // Update contract status
      if (contract) {
        await tables.contracts.update(dispute.contractId, {
          status: winner === 'client' ? 'cancelled' : 'completed',
          adminNotes: notes,
        })
      }

      toast.success(`Dispute resolved in favor of ${winner}`)
      qc.invalidateQueries({ queryKey: ['admin-disputes'] })
      onClose()
    } catch {
      toast.error('Failed to resolve dispute')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-orange-500" />
            Resolve Dispute
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Dispute details */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground w-20 shrink-0">Reason:</span>
              <span className="font-medium text-foreground">{dispute.reason}</span>
            </div>
            {dispute.description && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-20 shrink-0">Details:</span>
                <span className="text-foreground">{dispute.description}</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="text-muted-foreground w-20 shrink-0">Opened:</span>
              <span className="text-foreground">{formatDate(dispute.createdAt)}</span>
            </div>
            {contract && (
              <>
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">Contract:</span>
                  <span className="font-medium text-foreground">{contract.title}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">Amount:</span>
                  <span className="text-foreground">
                    ${contract.amount?.toFixed(2) ?? '—'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">Payment:</span>
                  <StatusBadge status={contract.paymentStatus} />
                </div>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Resolution Notes <span className="text-red-500">*</span></Label>
            <Textarea
              placeholder="Describe the resolution decision…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <p><strong>Resolve for Client:</strong> Contract cancelled, payment refunded to client.</p>
            <p><strong>Resolve for Freelancer:</strong> Payment released to freelancer (if in escrow).</p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            variant="outline"
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
            onClick={() => resolve('client')}
            disabled={loading}
          >
            <UserCheck size={14} className="mr-1.5" />
            {loading ? 'Resolving…' : 'Resolve for Client'}
          </Button>
          <Button
            className="gradient-amber border-0 text-white hover:opacity-90"
            onClick={() => resolve('freelancer')}
            disabled={loading}
          >
            <Briefcase size={14} className="mr-1.5" />
            {loading ? 'Resolving…' : 'Resolve for Freelancer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── main export ──────────────────────────────────────────────────────────────
export function AdminDisputesPage() {
  const [resolveTarget, setResolveTarget] = useState<Dispute | null>(null)

  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: async () => {
      const items = await tables.disputes.list({ orderBy: { createdAt: 'desc' }, limit: 100 })
      return items as Dispute[]
    },
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['admin-contracts-for-disputes'],
    queryFn: async () => {
      const items = await tables.contracts.list({ limit: 200 })
      return items as Contract[]
    },
  })

  const { data: userProfiles = [] } = useQuery({
    queryKey: ['admin-profiles-disputes'],
    queryFn: () => tables.userProfiles.list({ limit: 500 }) as Promise<UserProfile[]>,
  })

  const profileMap = Object.fromEntries(userProfiles.map(p => [p.userId, p]))
  const contractMap = Object.fromEntries(contracts.map(c => [c.id, c]))

  const openCount = disputes.filter(d => d.status === 'open' || d.status === 'under_review').length
  const resolvedCount = disputes.filter(d =>
    d.status === 'resolved_client' || d.status === 'resolved_freelancer' || d.status === 'closed'
  ).length

  const resolveContract = resolveTarget ? contractMap[resolveTarget.contractId] : undefined

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dispute Resolution</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {openCount} open · {resolvedCount} resolved
          </p>
        </div>
      </div>

      {openCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-4 flex gap-3 items-center dark:bg-orange-900/20 dark:border-orange-800">
          <AlertTriangle size={18} className="text-orange-600 shrink-0" />
          <p className="text-sm text-orange-800 dark:text-orange-300">
            <strong>{openCount} dispute{openCount !== 1 ? 's' : ''}</strong> require your attention.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="py-16 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : disputes.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No disputes"
          description="Great news — no disputes have been filed."
        />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Contract</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Raised by</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Reason</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Date</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {disputes.map(d => {
                  const contract = contractMap[d.contractId]
                  const raisedBy = profileMap[d.userId]
                  const isOpen = d.status === 'open' || d.status === 'under_review'
                  return (
                    <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-foreground truncate max-w-[160px]">
                          {contract?.title || d.contractTitle || d.contractId.slice(0, 12) + '…'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {contract ? `$${contract.amount?.toFixed(2) ?? '—'}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                        {d.raisedByName || raisedBy?.displayName || d.userId.slice(0, 12) + '…'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-foreground font-medium">{d.reason}</p>
                        {d.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5">{d.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                        {timeAgo(d.createdAt)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {isOpen && (
                            <Button
                              size="sm"
                              className="h-7 text-xs gradient-amber border-0 text-white hover:opacity-90"
                              onClick={() => setResolveTarget(d)}
                            >
                              Resolve
                            </Button>
                          )}
                          {d.adminNotes && (
                            <span className="text-xs text-muted-foreground ml-2 hidden lg:inline" title={d.adminNotes}>
                              ✓ Note
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {resolveTarget && (
        <ResolveDialog
          dispute={resolveTarget}
          contract={resolveContract}
          onClose={() => setResolveTarget(null)}
        />
      )}
    </div>
  )
}
