import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { FileText, Search, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/shared/EmptyState'
import { blink, tables } from '../../blink/client'
import { formatCurrency, formatDate } from '../../lib/utils'
import { FUNCTION_URLS } from '../../lib/functions'
import type { Contract, UserProfile } from '../../types'

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: 'Unpaid',
  paid_to_platform: 'In Escrow',
  released: 'Released',
  refunded: 'Refunded',
}

function paymentBadgeClass(status: string) {
  if (status === 'released') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (status === 'paid_to_platform') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  if (status === 'refunded') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
}

type TabValue = 'all' | 'active' | 'submitted' | 'completed' | 'disputed'

interface ReleaseDialogProps {
  contract: Contract
  onClose: () => void
}

function ReleasePaymentDialog({ contract, onClose }: ReleaseDialogProps) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const qc = useQueryClient()

  const handleRelease = async () => {
    setLoading(true)
    try {
      const token = await blink.auth.getValidToken()
      const res = await fetch(FUNCTION_URLS.releasePayment, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: contract.id, adminNotes: notes }),
      })
      if (!res.ok) throw new Error('Failed to release payment')
      toast.success('Payment released successfully')
      qc.invalidateQueries({ queryKey: ['admin-contracts'] })
      onClose()
    } catch {
      toast.error('Failed to release payment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-green-600" />
            Release Payment
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-muted/50 rounded-lg p-4 space-y-1 text-sm">
            <p className="font-medium text-foreground">{contract.title}</p>
            <p className="text-muted-foreground">Amount: {formatCurrency(contract.amount)}</p>
            <p className="text-muted-foreground">Freelancer gets: {formatCurrency(contract.freelancerAmount)}</p>
            <p className="text-muted-foreground">Platform fee: {formatCurrency(contract.platformFee)}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Admin Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add notes about this payment release…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            className="gradient-amber border-0 text-white hover:opacity-90"
            onClick={handleRelease}
            disabled={loading}
          >
            {loading ? 'Releasing…' : 'Confirm Release'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AdminContractsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabValue>('all')
  const [search, setSearch] = useState('')
  const [releaseTarget, setReleaseTarget] = useState<Contract | null>(null)

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['admin-contracts'],
    queryFn: async () => {
      const items = await tables.contracts.list({ orderBy: { createdAt: 'desc' }, limit: 200 })
      return items as Contract[]
    },
  })

  const { data: userProfiles = [] } = useQuery({
    queryKey: ['admin-user-profiles-map'],
    queryFn: () => tables.userProfiles.list({ limit: 500 }) as Promise<UserProfile[]>,
  })

  const profileMap = Object.fromEntries(userProfiles.map(p => [p.userId, p]))

  const markDisputed = useMutation({
    mutationFn: async (contractId: string) => {
      await tables.contracts.update(contractId, { status: 'disputed' })
    },
    onSuccess: () => { toast.success('Contract marked as disputed'); qc.invalidateQueries({ queryKey: ['admin-contracts'] }) },
    onError: () => toast.error('Failed to update contract'),
  })

  const filtered = contracts.filter(c => {
    const matchTab = tab === 'all' || c.status === tab
    const matchSearch = !search ||
      c.title?.toLowerCase().includes(search.toLowerCase()) ||
      c.id?.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  const tabCounts = {
    all: contracts.length,
    active: contracts.filter(c => c.status === 'active').length,
    submitted: contracts.filter(c => c.status === 'submitted').length,
    completed: contracts.filter(c => c.status === 'completed').length,
    disputed: contracts.filter(c => c.status === 'disputed').length,
  }

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contracts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{contracts.length} total contracts</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by title or ID…"
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={v => setTab(v as TabValue)}>
        <TabsList className="gap-1">
          {(['all', 'active', 'submitted', 'completed', 'disputed'] as TabValue[]).map(t => (
            <TabsTrigger key={t} value={t} className="capitalize text-xs">
              {t} ({tabCounts[t]})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="py-16 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No contracts"
              description="No contracts match the current filters."
            />
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Client</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Freelancer</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Payment</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Created</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map(c => {
                      const client = profileMap[c.clientId]
                      const freelancer = profileMap[c.userId]
                      const canRelease = c.paymentStatus === 'paid_to_platform' &&
                        (c.status === 'submitted' || c.status === 'completed')
                      const canDispute = c.status !== 'disputed' && c.status !== 'completed' && c.status !== 'cancelled'
                      return (
                        <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-medium text-foreground truncate max-w-[160px]">{c.title}</p>
                            <p className="text-xs text-muted-foreground">Fee: {formatCurrency(c.platformFee)}</p>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <p className="text-xs text-foreground truncate max-w-[100px]">
                              {client?.displayName || c.clientId.slice(0, 10) + '…'}
                            </p>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <p className="text-xs text-foreground truncate max-w-[100px]">
                              {freelancer?.displayName || c.userId.slice(0, 10) + '…'}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-foreground">{formatCurrency(c.amount)}</p>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <StatusBadge status={c.status} />
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${paymentBadgeClass(c.paymentStatus)}`}>
                              {PAYMENT_LABELS[c.paymentStatus] ?? c.paymentStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden xl:table-cell text-xs text-muted-foreground">
                            {formatDate(c.createdAt)}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => navigate({ to: '/client/projects/$contractId', params: { contractId: c.id } })}
                              >
                                <ExternalLink size={12} className="mr-1" /> View
                              </Button>
                              {canRelease && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-green-700 hover:bg-green-50"
                                  onClick={() => setReleaseTarget(c)}
                                >
                                  <CheckCircle2 size={12} className="mr-1" /> Release
                                </Button>
                              )}
                              {canDispute && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-orange-600 hover:bg-orange-50"
                                  onClick={() => markDisputed.mutate(c.id)}
                                  disabled={markDisputed.isPending}
                                >
                                  <AlertTriangle size={12} className="mr-1" /> Dispute
                                </Button>
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
        </TabsContent>
      </Tabs>

      {releaseTarget && (
        <ReleasePaymentDialog
          contract={releaseTarget}
          onClose={() => setReleaseTarget(null)}
        />
      )}
    </div>
  )
}
