import { useState, useEffect, useRef } from 'react'
import { useParams } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { blink, tables } from '../blink/client'
import { useAuth } from '../hooks/useAuth'
import { getInitials, timeAgo } from '../lib/utils'
import { EmptyState } from '../components/shared/EmptyState'
import type { Message, UserProfile, Contract } from '../types'
import toast from 'react-hot-toast'

interface Conversation {
  contractId: string
  contractTitle: string
  otherUserId: string
  otherUserName: string
  otherUserAvatar: string
  lastMessage: string
  lastAt: string
  unread: number
}

export function MessagesPage() {
  const params = useParams({ strict: false }) as { contractId?: string }
  const { user, isAuthenticated } = useAuth()
  const qc = useQueryClient()
  const [activeContractId, setActiveContractId] = useState(params.contractId || '')
  const [msgText, setMsgText] = useState('')
  const msgEndRef = useRef<HTMLDivElement>(null)

  const { data: sentMsgs = [] } = useQuery({
    queryKey: ['sentMessages', user?.id],
    queryFn: () => tables.messages.list({ where: { userId: user!.id }, limit: 500, orderBy: { createdAt: 'desc' } }),
    enabled: !!user?.id,
    refetchInterval: 5000,
  })

  const { data: recvMsgs = [] } = useQuery({
    queryKey: ['recvMessages', user?.id],
    queryFn: () => tables.messages.list({ where: { recipientId: user!.id }, limit: 500, orderBy: { createdAt: 'desc' } }),
    enabled: !!user?.id,
    refetchInterval: 5000,
  })

  const allMsgs = [...(sentMsgs as Message[]), ...(recvMsgs as Message[])]
  const contractIds = [...new Set(allMsgs.map(m => m.contractId).filter(Boolean))]

  const { data: contracts = [] } = useQuery({
    queryKey: ['msgContracts', contractIds.join(',')],
    queryFn: async () => {
      if (!contractIds.length) return []
      const all = await Promise.all(contractIds.map(id => tables.contracts.list({ where: { id }, limit: 1 })))
      return all.flat()
    },
    enabled: contractIds.length > 0,
  })

  const otherUserIds = [...new Set(allMsgs.map(m => m.userId === user?.id ? m.recipientId : m.userId))]
  const { data: userProfiles = [] } = useQuery({
    queryKey: ['msgUsers', otherUserIds.join(',')],
    queryFn: async () => {
      if (!otherUserIds.length) return []
      const all = await Promise.all(otherUserIds.map(id => tables.userProfiles.list({ where: { userId: id }, limit: 1 })))
      return all.flat()
    },
    enabled: otherUserIds.length > 0,
  })

  const contractMap = new Map((contracts as Contract[]).map(c => [c.id, c]))
  const profileMap = new Map((userProfiles as UserProfile[]).map(u => [u.userId, u]))

  // Build conversations
  const convMap = new Map<string, Conversation>()
  for (const msg of allMsgs) {
    if (!msg.contractId) continue
    const contract = contractMap.get(msg.contractId)
    const otherUid = msg.userId === user?.id ? msg.recipientId : msg.userId
    const otherUser = profileMap.get(otherUid)
    const existing = convMap.get(msg.contractId)
    const isUnread = msg.recipientId === user?.id && msg.isRead === '0'
    if (!existing || new Date(msg.createdAt) > new Date(existing.lastAt)) {
      convMap.set(msg.contractId, {
        contractId: msg.contractId,
        contractTitle: contract?.title || 'Contract',
        otherUserId: otherUid,
        otherUserName: otherUser?.displayName || 'User',
        otherUserAvatar: otherUser?.avatarUrl || '',
        lastMessage: msg.content,
        lastAt: msg.createdAt,
        unread: (existing?.unread || 0) + (isUnread ? 1 : 0),
      })
    }
  }
  const conversations = [...convMap.values()].sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())

  // Active thread messages
  const threadMsgs = allMsgs
    .filter(m => m.contractId === activeContractId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  const activeConv = convMap.get(activeContractId)

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threadMsgs.length])

  // Auto-select first conversation
  useEffect(() => {
    if (!activeContractId && conversations.length > 0) {
      setActiveContractId(conversations[0].contractId)
    }
  }, [conversations.length])

  // Mark messages as read
  useEffect(() => {
    if (!activeContractId || !user?.id) return
    const unread = (recvMsgs as Message[]).filter(m => m.contractId === activeContractId && m.isRead === '0')
    unread.forEach(m => tables.messages.update(m.id, { isRead: '1' }).catch(() => {}))
  }, [activeContractId, recvMsgs])

  const sendMsg = useMutation({
    mutationFn: async () => {
      if (!msgText.trim() || !activeContractId) throw new Error('No message or contract')
      const conv = convMap.get(activeContractId)
      if (!conv) throw new Error('Conversation not found')
      await tables.messages.create({
        userId: user!.id,
        recipientId: conv.otherUserId,
        contractId: activeContractId,
        content: msgText.trim(),
        isRead: '0',
        createdAt: new Date().toISOString(),
      })
      setMsgText('')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sentMessages', user?.id] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!isAuthenticated) {
    return (
      <div className="page-container pt-24 flex flex-col items-center justify-center py-24">
        <MessageSquare size={48} className="text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
        <Button className="gradient-amber border-0 text-white" onClick={() => blink.auth.login()}>Sign In</Button>
      </div>
    )
  }

  return (
    <div className="page-container pt-24 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground mb-6">Messages</h1>

      <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}>
        <div className="flex h-full">
          {/* Conversations list */}
          <div className="w-72 border-r border-border flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-medium text-muted-foreground">Conversations</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-4 text-center">
                  <MessageSquare size={32} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">No conversations yet</p>
                </div>
              ) : (
                conversations.map(conv => (
                  <button
                    key={conv.contractId}
                    onClick={() => setActiveContractId(conv.contractId)}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-start gap-3 ${
                      activeContractId === conv.contractId ? 'bg-muted' : ''
                    }`}
                  >
                    <Avatar className="w-9 h-9 shrink-0">
                      <AvatarImage src={conv.otherUserAvatar} />
                      <AvatarFallback className="text-xs gradient-hero text-white">
                        {getInitials(conv.otherUserName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-medium truncate">{conv.otherUserName}</p>
                        {conv.unread > 0 && (
                          <span className="text-xs bg-accent text-white px-1.5 py-0.5 rounded-full shrink-0">{conv.unread}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{conv.contractTitle}</p>
                      <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{conv.lastMessage}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Message thread */}
          <div className="flex-1 flex flex-col min-w-0">
            {!activeContractId ? (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState
                  icon={MessageSquare}
                  title="Select a conversation"
                  description="Choose a conversation from the left to start messaging."
                />
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="px-5 py-3 border-b border-border flex items-center gap-3">
                  {activeConv && (
                    <>
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={activeConv.otherUserAvatar} />
                        <AvatarFallback className="text-xs gradient-hero text-white">
                          {getInitials(activeConv.otherUserName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold">{activeConv.otherUserName}</p>
                        <p className="text-xs text-muted-foreground">{activeConv.contractTitle}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {threadMsgs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Say hello!</p>
                  ) : (
                    threadMsgs.map(m => {
                      const isMine = m.userId === user?.id
                      const senderProfile = isMine ? null : profileMap.get(m.userId)
                      return (
                        <div key={m.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                          {!isMine && (
                            <Avatar className="w-7 h-7 shrink-0">
                              <AvatarImage src={senderProfile?.avatarUrl} />
                              <AvatarFallback className="text-xs gradient-hero text-white">
                                {getInitials(senderProfile?.displayName || 'U')}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm ${
                            isMine
                              ? 'bg-primary text-primary-foreground rounded-tr-sm'
                              : 'bg-muted text-foreground rounded-tl-sm'
                          }`}>
                            <p>{m.content}</p>
                            <p className={`text-xs mt-1 ${isMine ? 'text-primary-foreground/50' : 'text-muted-foreground'}`}>
                              {timeAgo(m.createdAt)}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={msgEndRef} />
                </div>

                {/* Input */}
                <div className="px-4 py-3 border-t border-border flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMsg.mutate())}
                  />
                  <Button
                    className="gradient-amber border-0 text-white hover:opacity-90 shrink-0"
                    onClick={() => sendMsg.mutate()}
                    disabled={sendMsg.isPending || !msgText.trim()}
                  >
                    <Send size={16} />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
