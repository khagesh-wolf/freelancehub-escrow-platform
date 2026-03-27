import { useState } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, DollarSign, Users, CheckCircle, XCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { blink, tables } from '../blink/client'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency, formatDate, parseJsonArray, getInitials, timeAgo, PLATFORM_FEE_PERCENT } from '../lib/utils'
import { StatusBadge } from '../components/ui/StatusBadge'
import type { Job, Proposal, UserProfile } from '../types'
import toast from 'react-hot-toast'

export function JobDetailPage() {
  const { jobId } = useParams({ from: '/jobs/$jobId' })
  const { user, profile, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [coverLetter, setCoverLetter] = useState('')
  const [bidAmount, setBidAmount] = useState('')
  const [estimatedDays, setEstimatedDays] = useState('')

  const { data: jobArr, isLoading: loadingJob } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => tables.jobs.list({ where: { id: jobId }, limit: 1 }),
  })
  const job = (jobArr as Job[] | undefined)?.[0]

  const { data: clientProfileArr } = useQuery({
    queryKey: ['userProfile', job?.userId],
    queryFn: () => tables.userProfiles.list({ where: { userId: job!.userId }, limit: 1 }),
    enabled: !!job?.userId,
  })
  const clientProfile = (clientProfileArr as UserProfile[] | undefined)?.[0]

  const { data: proposals = [], isLoading: loadingProposals } = useQuery({
    queryKey: ['proposals', jobId],
    queryFn: () => tables.proposals.list({ where: { jobId }, limit: 50, orderBy: { createdAt: 'desc' } }),
    enabled: !!jobId,
  })

  // My existing proposal (freelancer)
  const myProposal = user ? (proposals as Proposal[]).find(p => p.userId === user.id) : undefined

  // Freelancer profiles for proposals (client view)
  const { data: proposerProfiles = [] } = useQuery({
    queryKey: ['proposerProfiles', jobId],
    queryFn: async () => {
      const uids = [...new Set((proposals as Proposal[]).map(p => p.userId))]
      if (!uids.length) return []
      const all = await Promise.all(uids.map(uid => tables.userProfiles.list({ where: { userId: uid }, limit: 1 })))
      return all.flat()
    },
    enabled: (proposals as Proposal[]).length > 0 && profile?.role === 'client',
  })

  const submitProposal = useMutation({
    mutationFn: async () => {
      if (!user || !job) throw new Error('Not authenticated')
      if (!coverLetter.trim()) throw new Error('Cover letter is required')
      if (!bidAmount) throw new Error('Bid amount is required')
      await tables.proposals.create({
        userId: user.id,
        jobId,
        clientId: job.userId,
        coverLetter: coverLetter.trim(),
        bidAmount: Number(bidAmount),
        estimatedDays: Number(estimatedDays) || 7,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      await tables.jobs.update(jobId, { proposalsCount: (job.proposalsCount || 0) + 1 })
      await tables.notifications.create({
        userId: job.userId,
        title: 'New Proposal',
        message: `You have a new proposal for "${job.title}"`,
        type: 'info',
        link: `/jobs/${jobId}`,
        isRead: '0',
        createdAt: new Date().toISOString(),
      })
    },
    onSuccess: () => {
      toast.success('Proposal submitted!')
      qc.invalidateQueries({ queryKey: ['proposals', jobId] })
      qc.invalidateQueries({ queryKey: ['job', jobId] })
      setCoverLetter(''); setBidAmount(''); setEstimatedDays('')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const acceptProposal = useMutation({
    mutationFn: async (proposal: Proposal) => {
      if (!job) throw new Error('No job')
      const contract = await tables.contracts.create({
        userId: proposal.userId,
        clientId: job.userId,
        jobId,
        proposalId: proposal.id,
        title: job.title,
        description: job.description,
        amount: proposal.bidAmount,
        platformFee: proposal.bidAmount * PLATFORM_FEE_PERCENT / 100,
        freelancerAmount: proposal.bidAmount * (1 - PLATFORM_FEE_PERCENT / 100),
        deadline: job.deadline,
        status: 'pending',
        paymentStatus: 'unpaid',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      await tables.proposals.update(proposal.id, { status: 'accepted' })
      await tables.jobs.update(jobId, { status: 'in_progress' })
      // Reject all other proposals
      for (const p of (proposals as Proposal[])) {
        if (p.id !== proposal.id && p.status === 'pending') {
          await tables.proposals.update(p.id, { status: 'rejected' })
        }
      }
      await tables.notifications.create({
        userId: proposal.userId,
        title: 'Proposal Accepted!',
        message: `Your proposal for "${job.title}" was accepted.`,
        type: 'success',
        link: `/contracts/${(contract as any).id}`,
        isRead: '0',
        createdAt: new Date().toISOString(),
      })
      return contract
    },
    onSuccess: (contract) => {
      toast.success('Proposal accepted! Contract created.')
      qc.invalidateQueries({ queryKey: ['proposals', jobId] })
      qc.invalidateQueries({ queryKey: ['job', jobId] })
      navigate({ to: '/contracts/$contractId', params: { contractId: (contract as any).id } })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rejectProposal = useMutation({
    mutationFn: async (proposalId: string) => {
      await tables.proposals.update(proposalId, { status: 'rejected' })
    },
    onSuccess: () => {
      toast.success('Proposal rejected')
      qc.invalidateQueries({ queryKey: ['proposals', jobId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (loadingJob) {
    return (
      <div className="page-container pt-24 flex items-center justify-center py-24">
        <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="page-container pt-24 text-center py-24">
        <h2 className="text-xl font-semibold mb-2">Job Not Found</h2>
        <Button variant="outline" onClick={() => navigate({ to: '/jobs' })}>Browse Jobs</Button>
      </div>
    )
  }

  const skills = parseJsonArray(job.skillsRequired)
  const isClient = profile?.role === 'client' && user?.id === job.userId
  const isFreelancer = profile?.role === 'freelancer'
  const upMap = new Map((proposerProfiles as UserProfile[]).map(u => [u.userId, u]))

  return (
    <div className="page-container pt-24 animate-fade-in">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job header */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">{job.title}</h1>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={job.status} />
                  <Badge variant="outline">{job.category}</Badge>
                  <Badge variant="outline" className="capitalize">{job.budgetType}</Badge>
                </div>
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-4">{job.description}</p>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {skills.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-sm">
                <DollarSign size={15} className="text-accent" />
                <div>
                  <p className="text-xs text-muted-foreground">Budget</p>
                  <p className="font-medium">{formatCurrency(job.budgetMin)} – {formatCurrency(job.budgetMax)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={15} className="text-accent" />
                <div>
                  <p className="text-xs text-muted-foreground">Deadline</p>
                  <p className="font-medium">{formatDate(job.deadline)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users size={15} className="text-accent" />
                <div>
                  <p className="text-xs text-muted-foreground">Proposals</p>
                  <p className="font-medium">{job.proposalsCount || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Submit proposal (freelancer) */}
          {isFreelancer && job.status === 'open' && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold text-lg mb-4">
                {myProposal ? 'Your Proposal' : 'Submit a Proposal'}
              </h2>
              {myProposal ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={myProposal.status} />
                    <span className="text-sm text-muted-foreground">Submitted {timeAgo(myProposal.createdAt)}</span>
                  </div>
                  <div className="bg-muted rounded-lg p-4 text-sm">
                    <p className="text-muted-foreground mb-1">Bid: <span className="font-semibold text-foreground">{formatCurrency(myProposal.bidAmount)}</span></p>
                    <p className="text-muted-foreground">{myProposal.coverLetter}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Bid Amount ($) *</Label>
                      <Input type="number" placeholder="e.g. 1500" value={bidAmount} onChange={e => setBidAmount(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Estimated Days</Label>
                      <Input type="number" placeholder="e.g. 14" value={estimatedDays} onChange={e => setEstimatedDays(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cover Letter *</Label>
                    <Textarea placeholder="Why are you the best fit for this job?" rows={4} value={coverLetter} onChange={e => setCoverLetter(e.target.value)} />
                  </div>
                  <Button
                    className="gradient-amber border-0 text-white hover:opacity-90 gap-2"
                    onClick={() => submitProposal.mutate()}
                    disabled={submitProposal.isPending}
                  >
                    <Send size={16} />
                    {submitProposal.isPending ? 'Submitting...' : 'Submit Proposal'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Proposals list (client) */}
          {isClient && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold text-lg mb-4">Proposals ({(proposals as Proposal[]).length})</h2>
              {loadingProposals ? (
                <div className="space-y-3">
                  {[1, 2].map(i => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}
                </div>
              ) : (proposals as Proposal[]).length === 0 ? (
                <p className="text-muted-foreground text-sm">No proposals yet.</p>
              ) : (
                <div className="space-y-4">
                  {(proposals as Proposal[]).map(p => {
                    const fp = upMap.get(p.userId)
                    return (
                      <div key={p.id} className="border border-border rounded-lg p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={fp?.avatarUrl} />
                              <AvatarFallback className="text-xs gradient-hero text-white">
                                {getInitials(fp?.displayName || 'F')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{fp?.displayName || 'Freelancer'}</p>
                              <div className="flex items-center gap-2">
                                <StatusBadge status={p.status} />
                                <span className="text-xs text-muted-foreground">{timeAgo(p.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-foreground">{formatCurrency(p.bidAmount)}</p>
                            <p className="text-xs text-muted-foreground">{p.estimatedDays}d</p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{p.coverLetter}</p>
                        {p.status === 'pending' && job.status === 'open' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="gradient-amber border-0 text-white hover:opacity-90 gap-1"
                              onClick={() => acceptProposal.mutate(p)}
                              disabled={acceptProposal.isPending}
                            >
                              <CheckCircle size={14} /> Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                              onClick={() => rejectProposal.mutate(p.id)}
                              disabled={rejectProposal.isPending}
                            >
                              <XCircle size={14} /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Client info */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-3">Posted By</h3>
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={clientProfile?.avatarUrl} />
                <AvatarFallback className="text-xs gradient-hero text-white">
                  {getInitials(clientProfile?.displayName || 'C')}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{clientProfile?.displayName || 'Client'}</p>
                {clientProfile?.location && (
                  <p className="text-xs text-muted-foreground">{clientProfile.location}</p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          {!isAuthenticated && (
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-sm text-muted-foreground mb-3">Sign in to submit a proposal</p>
              <Button className="w-full gradient-amber border-0 text-white hover:opacity-90" onClick={() => blink.auth.login()}>
                Sign In to Apply
              </Button>
            </div>
          )}

          {isClient && job.status === 'open' && (
            <Button
              variant="outline"
              className="w-full text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={async () => {
                await tables.jobs.update(jobId, { status: 'cancelled' })
                toast.success('Job cancelled')
                navigate({ to: '/client/projects' })
              }}
            >
              Cancel Job
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
