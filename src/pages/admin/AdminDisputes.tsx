import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertCircle,
  Search,
  ExternalLink,
  X,
  Clock,
  Eye,
  UserCheck,
  Briefcase,
  ChevronRight,
} from 'lucide-react'
import { AdminLayout } from './AdminLayout'
import { tables } from '@/blink/client'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import type { Dispute } from '@/types'

type StatusFilter = 'all' | 'open' | 'under_review' | 'resolved'

function DisputeStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    open: { label: 'Open', cls: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
    under_review: { label: 'Under Review', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    resolved_client: { label: 'Resolved (Client)', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    resolved_freelancer: { label: 'Resolved (Freelancer)', cls: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
    closed: { label: 'Closed', cls: 'bg-gray-50 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
  }
  const { label, cls, dot } = map[status] ?? { label: status, cls: 'bg-gray-50 text-gray-600 border-gray-200', dot: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}

function DisputeDetailDialog({
  dispute,
  onClose,
}: {
  dispute: Dispute
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [adminNotes, setAdminNotes] = useState(dispute.adminNotes ?? '')
  const [resolution, setResolution] = useState(dispute.resolution ?? '')

  const resolveMutation = useMutation({
    mutationFn: async (status: 'under_review' | 'resolved_client' | 'resolved_freelancer' | 'closed') => {
      await tables.disputes.update(dispute.id, {
        status,
        adminNotes,
        resolution: status.startsWith('resolved') ? resolution : dispute.resolution,
      })
      if (status === 'resolved_client' || status === 'resolved_freelancer') {
        // Update contract if exists
        if (dispute.contractId) {
          if (status === 'resolved_client') {
            await tables.contracts.update(dispute.contractId, {
              status: 'completed',
              paymentStatus: 'refunded',
              adminNotes,
            })
          } else {
            await tables.contracts.update(dispute.contractId, {
              status: 'completed',
              paymentStatus: 'released',
              adminNotes,
            })
          }
        }
      }
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ['admin-disputes-full'] })
      queryClient.invalidateQueries({ queryKey: ['admin-contracts'] })
      const labels: Record<string, string> = {
        under_review: 'Marked as under review',
        resolved_client: 'Resolved in favour of client',
        resolved_freelancer: 'Resolved in favour of freelancer',
        closed: 'Dispute closed',
      }
      toast.success(labels[status] ?? 'Updated')
      onClose()
    },
    onError: () => toast.error('Failed to update dispute'),
  })

  const isResolved = dispute.status === 'resolved_client' || dispute.status === 'resolved_freelancer' || dispute.status === 'closed'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white flex items-start justify-between px-6 py-5 border-b border-[hsl(214,32%,91%)] rounded-t-2xl">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={18} className="text-red-500" />
              <h2 className="font-bold text-[hsl(215,28%,17%)]">Dispute Details</h2>
            </div>
            <DisputeStatusBadge status={dispute.status} />
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[hsl(215,16%,55%)] hover:bg-[hsl(210,40%,96%)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[hsl(210,40%,98%)] rounded-lg p-4">
              <p className="text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide mb-1">Contract</p>
              <p className="text-sm font-medium text-[hsl(215,28%,17%)] truncate">
                {dispute.contractTitle ?? `#${dispute.contractId?.slice(-8) ?? '—'}`}
              </p>
            </div>
            <div className="bg-[hsl(210,40%,98%)] rounded-lg p-4">
              <p className="text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide mb-1">Raised By</p>
              <p className="text-sm font-medium text-[hsl(215,28%,17%)]">{dispute.raisedByName ?? 'Unknown'}</p>
            </div>
            <div className="bg-[hsl(210,40%,98%)] rounded-lg p-4">
              <p className="text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide mb-1">Reason</p>
              <p className="text-sm font-medium text-[hsl(215,28%,17%)]">{dispute.reason ?? '—'}</p>
            </div>
            <div className="bg-[hsl(210,40%,98%)] rounded-lg p-4">
              <p className="text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide mb-1">Filed On</p>
              <p className="text-sm font-medium text-[hsl(215,28%,17%)]">
                {dispute.createdAt ? format(new Date(dispute.createdAt), 'MMM d, yyyy') : '—'}
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide mb-2">Description</p>
            <div className="bg-[hsl(210,40%,98%)] rounded-lg p-4 text-sm text-[hsl(215,28%,17%)] leading-relaxed whitespace-pre-wrap">
              {dispute.description || 'No description provided.'}
            </div>
          </div>

          {/* Evidence */}
          {dispute.evidenceUrl && (
            <div>
              <p className="text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide mb-2">Evidence</p>
              <a
                href={dispute.evidenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                <ExternalLink size={14} />
                View Evidence
              </a>
            </div>
          )}

          {/* Existing resolution */}
          {dispute.resolution && (
            <div>
              <p className="text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide mb-2">Previous Resolution</p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800">
                {dispute.resolution}
              </div>
            </div>
          )}

          {/* Admin actions */}
          {!isResolved && (
            <div className="border-t border-[hsl(214,32%,91%)] pt-5 space-y-4">
              <p className="text-sm font-semibold text-[hsl(215,28%,17%)]">Admin Action</p>

              <div>
                <label className="text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide mb-1.5 block">
                  Admin Notes
                </label>
                <textarea
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  rows={3}
                  placeholder="Internal notes about this dispute…"
                  className="w-full px-3 py-2.5 text-sm bg-white border border-[hsl(214,32%,91%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-[hsl(215,28%,17%)] placeholder:text-[hsl(215,16%,60%)] resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide mb-1.5 block">
                  Resolution Statement
                </label>
                <textarea
                  value={resolution}
                  onChange={e => setResolution(e.target.value)}
                  rows={3}
                  placeholder="Visible resolution description for both parties…"
                  className="w-full px-3 py-2.5 text-sm bg-white border border-[hsl(214,32%,91%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-[hsl(215,28%,17%)] placeholder:text-[hsl(215,16%,60%)] resize-none"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {dispute.status === 'open' && (
                  <Button
                    variant="outline"
                    className="border-amber-300 text-amber-700 hover:bg-amber-50"
                    onClick={() => resolveMutation.mutate('under_review')}
                    disabled={resolveMutation.isPending}
                  >
                    <Clock size={15} />
                    Mark Under Review
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                  onClick={() => resolveMutation.mutate('resolved_client')}
                  disabled={resolveMutation.isPending}
                >
                  <UserCheck size={15} />
                  Resolve for Client
                  <span className="text-[10px] opacity-60 ml-1">(refund)</span>
                </Button>
                <Button
                  variant="outline"
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => resolveMutation.mutate('resolved_freelancer')}
                  disabled={resolveMutation.isPending}
                >
                  <Briefcase size={15} />
                  Resolve for Freelancer
                  <span className="text-[10px] opacity-60 ml-1">(release)</span>
                </Button>
                <Button
                  variant="outline"
                  className="border-gray-300 text-gray-600 hover:bg-gray-50"
                  onClick={() => resolveMutation.mutate('closed')}
                  disabled={resolveMutation.isPending}
                >
                  <X size={15} />
                  Close
                </Button>
              </div>
            </div>
          )}

          {isResolved && (
            <div className="border-t border-[hsl(214,32%,91%)] pt-5">
              {dispute.adminNotes && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide mb-1">Admin Notes</p>
                  <p className="text-sm text-[hsl(215,28%,17%)] bg-[hsl(210,40%,98%)] p-3 rounded-lg">{dispute.adminNotes}</p>
                </div>
              )}
              <div className="text-center py-4">
                <p className="text-sm font-medium text-[hsl(215,28%,17%)]">This dispute has been resolved.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function AdminDisputes() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null)

  const { data: disputes = [], isLoading } = useQuery<Dispute[]>({
    queryKey: ['admin-disputes-full'],
    queryFn: () => tables.disputes.list({ orderBy: { createdAt: 'desc' }, limit: 200 }) as Promise<Dispute[]>,
  })

  const filtered = disputes.filter(d => {
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'resolved' ? d.status.startsWith('resolved') || d.status === 'closed' : d.status === statusFilter)
    const matchesSearch =
      !search ||
      d.contractTitle?.toLowerCase().includes(search.toLowerCase()) ||
      d.raisedByName?.toLowerCase().includes(search.toLowerCase()) ||
      d.reason?.toLowerCase().includes(search.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const counts = {
    all: disputes.length,
    open: disputes.filter(d => d.status === 'open').length,
    under_review: disputes.filter(d => d.status === 'under_review').length,
    resolved: disputes.filter(d => d.status.startsWith('resolved') || d.status === 'closed').length,
  }

  const filterOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: `All (${counts.all})` },
    { value: 'open', label: `Open (${counts.open})` },
    { value: 'under_review', label: `Under Review (${counts.under_review})` },
    { value: 'resolved', label: `Resolved (${counts.resolved})` },
  ]

  return (
    <AdminLayout title="Dispute Management" subtitle="Review and resolve platform disputes between clients and freelancers">
      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,16%,55%)]" />
          <input
            type="text"
            placeholder="Search disputes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-[hsl(214,32%,91%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-[hsl(215,28%,17%)] placeholder:text-[hsl(215,16%,60%)]"
          />
        </div>
        <div className="flex bg-white border border-[hsl(214,32%,91%)] rounded-lg overflow-hidden">
          {filterOptions.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                statusFilter === f.value
                  ? 'bg-[hsl(215,42%,12%)] text-white'
                  : 'text-[hsl(215,16%,47%)] hover:bg-[hsl(210,40%,97%)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[hsl(214,32%,91%)] shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-[3px] border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle size={36} className="text-[hsl(215,16%,75%)] mb-3" />
            <p className="font-medium text-[hsl(215,28%,17%)]">No disputes found</p>
            <p className="text-sm text-[hsl(215,16%,55%)] mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[hsl(210,40%,98%)] border-b border-[hsl(214,32%,91%)]">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Contract</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Raised By</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Reason</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Filed</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(214,32%,93%)]">
                {filtered.map((d, i) => (
                  <tr
                    key={d.id}
                    className={`hover:bg-[hsl(210,40%,98.5%)] transition-colors cursor-pointer ${i % 2 !== 0 ? 'bg-[hsl(210,40%,99.5%)]' : ''}`}
                    onClick={() => setSelectedDispute(d)}
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-[hsl(215,28%,17%)] max-w-[180px] truncate">
                        {d.contractTitle ?? `Contract #${d.contractId?.slice(-6) ?? '—'}`}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-[hsl(215,28%,30%)]">{d.raisedByName ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <p className="max-w-[150px] truncate text-[hsl(215,28%,30%)]">{d.reason ?? '—'}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <DisputeStatusBadge status={d.status} />
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[hsl(215,16%,55%)] whitespace-nowrap">
                      {d.createdAt ? format(new Date(d.createdAt), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end">
                        <button
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[hsl(215,42%,30%)] bg-[hsl(215,42%,95%)] hover:bg-[hsl(215,42%,90%)] rounded-lg transition-colors"
                          onClick={e => { e.stopPropagation(); setSelectedDispute(d) }}
                        >
                          <Eye size={12} />
                          Review
                          <ChevronRight size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-[hsl(214,32%,91%)] bg-[hsl(210,40%,98.5%)]">
              <p className="text-xs text-[hsl(215,16%,55%)]">Showing {filtered.length} of {disputes.length} disputes</p>
            </div>
          </div>
        )}
      </div>

      {selectedDispute && (
        <DisputeDetailDialog dispute={selectedDispute} onClose={() => setSelectedDispute(null)} />
      )}
    </AdminLayout>
  )
}
