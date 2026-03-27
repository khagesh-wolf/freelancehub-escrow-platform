import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Briefcase, Plus, Eye, XCircle, Calendar, Users, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { blink, tables } from '../blink/client'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency, formatDate, parseJsonArray } from '../lib/utils'
import { StatusBadge } from '../components/ui/StatusBadge'
import { EmptyState } from '../components/shared/EmptyState'
import type { Job } from '../types'
import toast from 'react-hot-toast'

type TabStatus = 'open' | 'in_progress' | 'completed' | 'cancelled'

const TABS: { key: TabStatus; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

export function MyJobsPage() {
  const { user, profile, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabStatus>('open')

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['myJobs', user?.id],
    queryFn: () => tables.jobs.list({
      where: { userId: user!.id },
      limit: 200,
      orderBy: { createdAt: 'desc' },
    }),
    enabled: !!user?.id,
  })

  const cancelJob = useMutation({
    mutationFn: async (jobId: string) => {
      await tables.jobs.update(jobId, {
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
      })
    },
    onSuccess: () => {
      toast.success('Job cancelled')
      qc.invalidateQueries({ queryKey: ['myJobs', user?.id] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!isAuthenticated || profile?.role !== 'client') {
    return (
      <div className="page-container pt-24 flex flex-col items-center justify-center py-24">
        <Briefcase size={48} className="text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Client Access Only</h2>
        <Button className="gradient-amber border-0 text-white" onClick={() => blink.auth.login()}>Sign In</Button>
      </div>
    )
  }

  const filtered = (jobs as Job[]).filter(j => j.status === activeTab)
  const counts = TABS.reduce((acc, t) => {
    acc[t.key] = (jobs as Job[]).filter(j => j.status === t.key).length
    return acc
  }, {} as Record<TabStatus, number>)

  return (
    <div className="page-container pt-24 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Jobs</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage all your posted jobs</p>
        </div>
        <Button
          className="gradient-amber border-0 text-white hover:opacity-90 gap-2"
          onClick={() => navigate({ to: '/post-job' })}
        >
          <Plus size={16} /> Post Job
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-muted rounded-lg p-1 w-fit">
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
              <span className="text-xs bg-primary/10 text-primary px-1.5 rounded-full">
                {counts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
              <div className="h-5 bg-muted rounded w-1/2 mb-3" />
              <div className="h-3 bg-muted rounded w-full mb-2" />
              <div className="h-8 bg-muted rounded w-24 mt-4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={`No ${activeTab.replace('_', ' ')} jobs`}
          description={activeTab === 'open' ? 'Post a job to find talented freelancers.' : `You have no ${activeTab.replace('_', ' ')} jobs.`}
          action={activeTab === 'open' ? { label: 'Post a Job', onClick: () => navigate({ to: '/post-job' }) } : undefined}
        />
      ) : (
        <div className="space-y-4">
          {filtered.map(job => {
            const skills = parseJsonArray(job.skillsRequired)
            return (
              <div key={job.id} className="bg-card border border-border rounded-xl p-5 card-hover">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">{job.title}</h3>
                      <StatusBadge status={job.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{job.category}</p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {skills.slice(0, 4).map(s => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <DollarSign size={12} />
                        {formatCurrency(job.budgetMin)} – {formatCurrency(job.budgetMax)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        Due {formatDate(job.deadline)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {job.proposalsCount || 0} proposals
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => navigate({ to: '/jobs/$jobId', params: { jobId: job.id } })}
                    >
                      <Eye size={14} /> View
                    </Button>
                    {job.status === 'open' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={() => cancelJob.mutate(job.id)}
                        disabled={cancelJob.isPending}
                      >
                        <XCircle size={14} /> Cancel
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
