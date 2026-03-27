import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { FileText, ExternalLink, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { blink, tables } from '../blink/client'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency, formatDate, timeAgo } from '../lib/utils'
import { StatusBadge } from '../components/ui/StatusBadge'
import { EmptyState } from '../components/shared/EmptyState'
import type { Proposal, Job } from '../types'
import toast from 'react-hot-toast'

type TabStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn'

const TABS: { key: TabStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'withdrawn', label: 'Withdrawn' },
]

export function ProposalsPage() {
  const { user, profile, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabStatus>('pending')

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ['myProposals', user?.id],
    queryFn: () => tables.proposals.list({
      where: { userId: user!.id },
      limit: 200,
      orderBy: { createdAt: 'desc' },
    }),
    enabled: !!user?.id,
  })

  // Fetch jobs for each proposal
  const jobIds = [...new Set((proposals as Proposal[]).map(p => p.jobId))]
  const { data: jobs = [] } = useQuery({
    queryKey: ['proposalJobs', jobIds.join(',')],
    queryFn: async () => {
      if (!jobIds.length) return []
      const all = await Promise.all(jobIds.map(id => tables.jobs.list({ where: { id }, limit: 1 })))
      return all.flat()
    },
    enabled: jobIds.length > 0,
  })

  const withdraw = useMutation({
    mutationFn: async (proposalId: string) => {
      await tables.proposals.update(proposalId, {
        status: 'withdrawn',
        updatedAt: new Date().toISOString(),
      })
    },
    onSuccess: () => {
      toast.success('Proposal withdrawn')
      qc.invalidateQueries({ queryKey: ['myProposals', user?.id] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!isAuthenticated || profile?.role !== 'freelancer') {
    return (
      <div className="page-container pt-24 flex flex-col items-center justify-center py-24">
        <FileText size={48} className="text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Freelancer Access Only</h2>
        <Button className="gradient-amber border-0 text-white" onClick={() => blink.auth.login()}>Sign In</Button>
      </div>
    )
  }

  const jobMap = new Map((jobs as Job[]).map(j => [j.id, j]))
  const filtered = (proposals as Proposal[]).filter(p => p.status === activeTab)
  const counts = TABS.reduce((acc, t) => {
    acc[t.key] = (proposals as Proposal[]).filter(p => p.status === t.key).length
    return acc
  }, {} as Record<TabStatus, number>)

  return (
    <div className="page-container pt-24 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">My Proposals</h1>
        <p className="text-muted-foreground text-sm mt-1">Track proposals you've submitted</p>
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
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={`No ${activeTab} proposals`}
          description="Browse open jobs to find opportunities."
          action={{ label: 'Browse Jobs', onClick: () => navigate({ to: '/jobs' }) }}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const job = jobMap.get(p.jobId)
            return (
              <div key={p.id} className="bg-card border border-border rounded-xl p-5 card-hover">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">
                        {job?.title || 'Unknown Job'}
                      </h3>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {job?.category} • Submitted {timeAgo(p.createdAt)}
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span className="text-foreground font-semibold">{formatCurrency(p.bidAmount)}</span>
                      <span className="text-muted-foreground">{p.estimatedDays} days</span>
                      {p.status === 'accepted' && job?.deadline && (
                        <span className="text-muted-foreground">Due {formatDate(job.deadline)}</span>
                      )}
                    </div>
                    {p.coverLetter && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">"{p.coverLetter}"</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {job && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => navigate({ to: '/jobs/$jobId', params: { jobId: job.id } })}
                      >
                        <ExternalLink size={13} /> View Job
                      </Button>
                    )}
                    {p.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={() => withdraw.mutate(p.id)}
                        disabled={withdraw.isPending}
                      >
                        <Trash2 size={13} /> Withdraw
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
