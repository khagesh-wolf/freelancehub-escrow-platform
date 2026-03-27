import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText, CreditCard, CheckCircle, RotateCcw, AlertTriangle,
  Send, Link2, Clock, MessageSquare, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { blink, tables } from '../blink/client'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency, formatDate, getInitials, timeAgo, PLATFORM_FEE_PERCENT } from '../lib/utils'
import { StatusBadge } from '../components/ui/StatusBadge'
import { FUNCTION_URLS } from '../lib/functions'
import type { Contract, UserProfile, Message } from '../types'
import toast from 'react-hot-toast'

// ─── Payment Modal ────────────────────────────────────────────────────────────
function PaymentModal({
  open, contract, onClose, onSuccess,
}: {
  open: boolean
  contract: Contract
  onClose: () => void
  onSuccess: () => void
}) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [clientSecret, setClientSecret] = useState('')
  const qc = useQueryClient()

  const initiate = async () => {
    setLoading(true)
    try {
      const token = await blink.auth.getValidToken()
      const res = await fetch(FUNCTION_URLS.stripeCheckout, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: contract.id }),
      })
      const data = await res.json()
      setClientSecret(data.clientSecret || 'test_' + Math.random().toString(36).slice(2))
    } catch {
      setClientSecret('test_simulation_mode')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (open) initiate() }, [open])

  const simulatePay = async () => {
    setLoading(true)
    try {
      await tables.contracts.update(contract.id, {
        status: 'active',
        paymentStatus: 'paid_to_platform',
        platformFee: contract.amount * PLATFORM_FEE_PERCENT / 100,
        freelancerAmount: contract.amount * (1 - PLATFORM_FEE_PERCENT / 100),
        updatedAt: new Date().toISOString(),
      })
      await tables.transactions.create({
        userId: contract.clientId,
        contractId: contract.id,
        type: 'escrow_hold',
        amount: contract.amount,
        description: `Payment for: ${contract.title}`,
        status: 'completed',
        createdAt: new Date().toISOString(),
      })
      await tables.notifications.create({
        userId: contract.userId,
        title: 'Payment Received',
        message: `Client has paid for "${contract.title}". Work can begin!`,
        type: 'success',
        link: `/contracts/${contract.id}`,
        isRead: '0',
        createdAt: new Date().toISOString(),
      })
      qc.invalidateQueries({ queryKey: ['contract', contract.id] })
      toast.success('Payment successful! Contract is now active.')
      onSuccess()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard size={20} className="text-accent" /> Pay for Contract
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contract</span>
              <span className="font-medium">{contract.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-bold text-foreground">{formatCurrency(contract.amount)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Platform fee ({PLATFORM_FEE_PERCENT}%)</span>
              <span>{formatCurrency(contract.amount * PLATFORM_FEE_PERCENT / 100)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Freelancer receives</span>
              <span>{formatCurrency(contract.amount * (1 - PLATFORM_FEE_PERCENT / 100))}</span>
            </div>
          </div>
          {clientSecret && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-xs text-yellow-800 dark:text-yellow-300">
              <p className="font-medium mb-1">Test Mode Active</p>
              <p>Payment Intent: <code className="font-mono">{clientSecret.slice(0, 30)}...</code></p>
              <p className="mt-1 text-xs opacity-70">Funds are held securely in escrow until you approve the work.</p>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="gradient-amber border-0 text-white hover:opacity-90"
            onClick={simulatePay}
            disabled={loading || !clientSecret}
          >
            {loading ? 'Processing...' : 'Confirm Payment (Test Mode)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Dispute Modal ────────────────────────────────────────────────────────────
function DisputeModal({
  open, contract, onClose,
}: {
  open: boolean
  contract: Contract
  onClose: () => void
}) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')

  const submit = useMutation({
    mutationFn: async () => {
      if (!reason || !description) throw new Error('All fields required')
      await tables.disputes.create({
        userId: user!.id,
        contractId: contract.id,
        reason,
        description,
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      await tables.contracts.update(contract.id, {
        status: 'disputed',
        updatedAt: new Date().toISOString(),
      })
    },
    onSuccess: () => {
      toast.success('Dispute submitted. Admin will review.')
      qc.invalidateQueries({ queryKey: ['contract', contract.id] })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle size={20} /> Open Dispute
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Input placeholder="e.g. Work not delivered" value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="Describe the issue in detail..."
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending ? 'Submitting...' : 'Submit Dispute'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function ContractDetailPage() {
  const { contractId } = useParams({ from: '/contracts/$contractId' })
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [payOpen, setPayOpen] = useState(false)
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [delivUrl, setDelivUrl] = useState('')
  const [msgText, setMsgText] = useState('')
  const msgEndRef = useRef<HTMLDivElement>(null)

  const { data: contractArr, isLoading } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: () => tables.contracts.list({ where: { id: contractId }, limit: 1 }),
  })
  const contract = (contractArr as Contract[] | undefined)?.[0]

  const { data: freelancerProfileArr } = useQuery({
    queryKey: ['userProfile', contract?.userId],
    queryFn: () => tables.userProfiles.list({ where: { userId: contract!.userId }, limit: 1 }),
    enabled: !!contract?.userId,
  })
  const freelancerProfile = (freelancerProfileArr as UserProfile[] | undefined)?.[0]

  const { data: clientProfileArr } = useQuery({
    queryKey: ['userProfile', contract?.clientId],
    queryFn: () => tables.userProfiles.list({ where: { userId: contract!.clientId }, limit: 1 }),
    enabled: !!contract?.clientId,
  })
  const clientProfile = (clientProfileArr as UserProfile[] | undefined)?.[0]

  const { data: messages = [], refetch: refetchMsgs } = useQuery({
    queryKey: ['messages', contractId],
    queryFn: () => tables.messages.list({
      where: { contractId },
      limit: 50,
      orderBy: { createdAt: 'asc' },
    }),
    enabled: !!contractId,
    refetchInterval: 5000,
  })

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMsg = useMutation({
    mutationFn: async () => {
      if (!msgText.trim() || !contract) throw new Error('Message empty')
      const recipientId = user!.id === contract.clientId ? contract.userId : contract.clientId
      await tables.messages.create({
        userId: user!.id,
        recipientId,
        contractId,
        content: msgText.trim(),
        isRead: '0',
        createdAt: new Date().toISOString(),
      })
      setMsgText('')
    },
    onSuccess: () => refetchMsgs(),
    onError: (e: Error) => toast.error(e.message),
  })

  const submitWork = useMutation({
    mutationFn: async () => {
      if (!delivUrl.trim()) throw new Error('Deliverables URL required')
      await tables.contracts.update(contractId, {
        status: 'submitted',
        deliverablesUrl: delivUrl.trim(),
        updatedAt: new Date().toISOString(),
      })
      await tables.notifications.create({
        userId: contract!.clientId,
        title: 'Work Submitted',
        message: `Freelancer has submitted work for "${contract!.title}". Please review.`,
        type: 'info',
        link: `/contracts/${contractId}`,
        isRead: '0',
        createdAt: new Date().toISOString(),
      })
    },
    onSuccess: () => {
      toast.success('Work submitted for review!')
      qc.invalidateQueries({ queryKey: ['contract', contractId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const approveWork = useMutation({
    mutationFn: async () => {
      await tables.contracts.update(contractId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      await tables.notifications.create({
        userId: contract!.userId,
        title: 'Work Approved!',
        message: `Your work on "${contract!.title}" was approved. Payment will be released soon.`,
        type: 'success',
        link: `/contracts/${contractId}`,
        isRead: '0',
        createdAt: new Date().toISOString(),
      })
    },
    onSuccess: () => {
      toast.success('Work approved! Payment release requested.')
      qc.invalidateQueries({ queryKey: ['contract', contractId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const requestRevision = useMutation({
    mutationFn: async () => {
      await tables.contracts.update(contractId, {
        status: 'active',
        updatedAt: new Date().toISOString(),
      })
      await tables.notifications.create({
        userId: contract!.userId,
        title: 'Revision Requested',
        message: `Client requested revisions on "${contract!.title}".`,
        type: 'warning',
        link: `/contracts/${contractId}`,
        isRead: '0',
        createdAt: new Date().toISOString(),
      })
    },
    onSuccess: () => {
      toast.success('Revision requested')
      qc.invalidateQueries({ queryKey: ['contract', contractId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) {
    return (
      <div className="page-container pt-24 flex items-center justify-center py-24">
        <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="page-container pt-24 text-center py-24">
        <h2 className="text-xl font-semibold mb-2">Contract Not Found</h2>
        <Button variant="outline" onClick={() => navigate({ to: '/contracts' })}>Back to Contracts</Button>
      </div>
    )
  }

  const isClient = user?.id === contract.clientId
  const isFreelancer = user?.id === contract.userId
  const myProfile = isClient ? clientProfile : freelancerProfile
  const otherProfile = isClient ? freelancerProfile : clientProfile

  const STEPS = ['pending', 'active', 'submitted', 'completed']
  const stepIdx = STEPS.indexOf(contract.status)

  return (
    <div className="page-container pt-24 animate-fade-in">
      {contract && (
        <>
          <PaymentModal
            open={payOpen}
            contract={contract}
            onClose={() => setPayOpen(false)}
            onSuccess={() => setPayOpen(false)}
          />
          <DisputeModal open={disputeOpen} contract={contract} onClose={() => setDisputeOpen(false)} />
        </>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contract header */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">{contract.title}</h1>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={contract.status} />
                  <StatusBadge status={contract.paymentStatus} />
                </div>
              </div>
              {(contract.status === 'active' || contract.status === 'submitted') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={() => setDisputeOpen(true)}
                >
                  <AlertTriangle size={14} /> Dispute
                </Button>
              )}
            </div>

            <p className="text-muted-foreground text-sm leading-relaxed mb-5">{contract.description}</p>

            {/* Progress stepper */}
            <div className="flex items-center gap-2 mb-5">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    i <= stepIdx
                      ? 'gradient-amber text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {i < stepIdx && <CheckCircle size={11} />}
                    {s === 'pending' ? 'Pending' : s === 'active' ? 'Active' : s === 'submitted' ? 'Review' : 'Done'}
                  </div>
                  {i < STEPS.length - 1 && <div className={`h-0.5 w-6 rounded ${i < stepIdx ? 'bg-accent' : 'bg-border'}`} />}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="font-bold text-foreground">{formatCurrency(contract.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Platform Fee</p>
                <p className="font-medium">{formatCurrency(contract.platformFee || contract.amount * 0.1)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Freelancer Gets</p>
                <p className="font-medium text-green-600">{formatCurrency(contract.freelancerAmount || contract.amount * 0.9)}</p>
              </div>
            </div>
            {contract.deadline && (
              <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                <Clock size={13} /> Deadline: {formatDate(contract.deadline)}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-4">
            {/* Client: Pay */}
            {isClient && contract.paymentStatus === 'unpaid' && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold mb-2">Payment Required</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Fund the escrow to activate this contract. The freelancer can start work once payment is confirmed.
                </p>
                <Button
                  className="gradient-amber border-0 text-white hover:opacity-90 gap-2"
                  onClick={() => setPayOpen(true)}
                >
                  <CreditCard size={16} /> Pay {formatCurrency(contract.amount)}
                </Button>
              </div>
            )}

            {/* Freelancer: Submit work */}
            {isFreelancer && contract.status === 'active' && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold mb-3">Submit Your Work</h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Deliverables URL</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://drive.google.com/... or GitHub link"
                        value={delivUrl}
                        onChange={e => setDelivUrl(e.target.value)}
                      />
                      <Button
                        className="gradient-amber border-0 text-white hover:opacity-90 gap-1 shrink-0"
                        onClick={() => submitWork.mutate()}
                        disabled={submitWork.isPending}
                      >
                        <Link2 size={15} /> Submit
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Client: Review submitted work */}
            {isClient && contract.status === 'submitted' && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold mb-2">Work Submitted for Review</h3>
                {contract.deliverablesUrl && (
                  <a
                    href={contract.deliverablesUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-accent hover:underline flex items-center gap-1 mb-4"
                  >
                    <Link2 size={14} /> View Deliverables
                  </a>
                )}
                <div className="flex gap-3">
                  <Button
                    className="gradient-amber border-0 text-white hover:opacity-90 gap-1"
                    onClick={() => approveWork.mutate()}
                    disabled={approveWork.isPending}
                  >
                    <CheckCircle size={15} /> Approve & Release Payment
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-1"
                    onClick={() => requestRevision.mutate()}
                    disabled={requestRevision.isPending}
                  >
                    <RotateCcw size={15} /> Request Revision
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <MessageSquare size={18} className="text-accent" />
              <h3 className="font-semibold">Messages</h3>
            </div>
            <div className="h-64 overflow-y-auto p-4 space-y-3">
              {(messages as Message[]).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No messages yet. Say hello!</p>
              ) : (
                (messages as Message[]).map(m => {
                  const isMine = m.userId === user?.id
                  const sender = isMine ? myProfile : otherProfile
                  return (
                    <div key={m.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                      <Avatar className="w-7 h-7 shrink-0">
                        <AvatarImage src={sender?.avatarUrl} />
                        <AvatarFallback className="text-xs gradient-hero text-white">
                          {getInitials(sender?.displayName || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`max-w-[70%] px-3 py-2 rounded-xl text-sm ${
                        isMine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                      }`}>
                        <p>{m.content}</p>
                        <p className={`text-xs mt-1 ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                          {timeAgo(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={msgEndRef} />
            </div>
            <div className="px-4 py-3 border-t border-border flex gap-2">
              <Input
                placeholder="Type a message..."
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMsg.mutate())}
              />
              <Button
                size="sm"
                className="gradient-amber border-0 text-white hover:opacity-90"
                onClick={() => sendMsg.mutate()}
                disabled={sendMsg.isPending || !msgText.trim()}
              >
                <Send size={15} />
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Parties */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Contract Parties</h3>
            <div className="space-y-4">
              {[
                { label: 'Client', profile: clientProfile },
                { label: 'Freelancer', profile: freelancerProfile },
              ].map(({ label, profile: p }) => (
                <div key={label} className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={p?.avatarUrl} />
                    <AvatarFallback className="text-xs gradient-hero text-white">
                      {getInitials(p?.displayName || 'U')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium text-sm">{p?.displayName || 'Unknown'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick info */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-3">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={contract.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment</span>
                <StatusBadge status={contract.paymentStatus} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">{formatCurrency(contract.amount)}</span>
              </div>
              {contract.completedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed</span>
                  <span>{formatDate(contract.completedAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
