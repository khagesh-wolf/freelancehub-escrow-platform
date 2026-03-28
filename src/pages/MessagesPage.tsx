import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, MessageSquare, Search, Clock, CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import { tables } from '@/blink/client'
import { formatRelativeTime, getInitials } from '@/lib/utils'
import type { Message } from '@/types'

// ─── Conversation thread type ─────────────────────────────────────────────────
interface Conversation {
  contractId: string
  contractTitle: string
  lastMessage: string
  lastMessageAt: string
  unreadCount: number
  otherPartyName: string
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────
function MsgSkeleton() {
  return (
    <div className="animate-pulse flex gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
      <div className="space-y-1.5 flex-1">
        <div className="h-3 w-24 bg-muted rounded" />
        <div className="h-10 w-2/3 bg-muted rounded-2xl" />
      </div>
    </div>
  )
}

function ConvSkeleton() {
  return (
    <div className="animate-pulse p-4 flex gap-3">
      <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-28 bg-muted rounded" />
        <div className="h-3 w-full bg-muted rounded" />
      </div>
    </div>
  )
}

export function MessagesPage() {
  const { user, profile, isLoading } = useAuth()
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { contractId?: string }
  const qc = useQueryClient()

  const [selectedContractId, setSelectedContractId] = useState<string | null>(
    params.contractId ?? null,
  )
  const [messageText, setMessageText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auth guard
  useEffect(() => {
    if (!isLoading && !user) navigate({ to: '/auth/login' })
  }, [isLoading, user])

  // Fetch all messages for this user (sent or received)
  const { data: allMessages = [], isLoading: msgsLoading } = useQuery<Message[]>({
    queryKey: ['all-messages', user?.id],
    queryFn: async () => {
      const [sent, received] = await Promise.all([
        tables.messages.list({ where: { userId: user!.id }, orderBy: { createdAt: 'asc' } }),
        tables.messages.list({ where: { recipientId: user!.id }, orderBy: { createdAt: 'asc' } }),
      ])
      const combined = [...(sent as Message[]), ...(received as Message[])]
      const seen = new Set<string>()
      return combined
        .filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true })
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    },
    enabled: !!user,
    refetchInterval: 5000,
  })

  // Derive conversations from messages
  const conversations: Conversation[] = (() => {
    const map = new Map<string, Conversation>()
    for (const msg of allMessages) {
      const cId = msg.contractId || `direct-${[msg.userId, msg.recipientId].sort().join('-')}`
      const isMine = msg.userId === user?.id
      const otherPartyName = isMine
        ? (msg.senderName ?? 'Other Party')
        : (msg.senderName ?? 'Other Party')

      if (!map.has(cId)) {
        map.set(cId, {
          contractId: cId,
          contractTitle: msg.contractId ? `Contract #${msg.contractId.slice(-6)}` : 'Direct Message',
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          unreadCount: 0,
          otherPartyName,
        })
      }
      const conv = map.get(cId)!
      if (new Date(msg.createdAt) > new Date(conv.lastMessageAt)) {
        conv.lastMessage = msg.content
        conv.lastMessageAt = msg.createdAt
      }
      if (!isMine && msg.isRead === '0') conv.unreadCount++
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    )
  })()

  const filteredConversations = conversations.filter(c =>
    c.contractTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.otherPartyName.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  // Messages for selected conversation
  const threadMessages = allMessages.filter(
    m => (m.contractId || `direct-${[m.userId, m.recipientId].sort().join('-')}`) === selectedContractId,
  )

  // Determine recipientId for send
  const recipientId = (() => {
    const thread = threadMessages.find(m => m.userId !== user?.id)
    if (thread) return thread.userId
    return ''
  })()

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threadMessages.length])

  // Mark messages as read when selecting conversation
  useEffect(() => {
    if (!selectedContractId || !user) return
    const unread = threadMessages.filter(m => m.recipientId === user.id && m.isRead === '0')
    Promise.all(unread.map(m => tables.messages.update(m.id, { isRead: '1' }))).then(() => {
      if (unread.length > 0) qc.invalidateQueries({ queryKey: ['all-messages', user.id] })
    })
  }, [selectedContractId, threadMessages.length])

  // Send message
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !selectedContractId || !content.trim()) throw new Error('Missing data')
      const contractIdForDB = selectedContractId.startsWith('direct-') ? '' : selectedContractId
      await tables.messages.create({
        userId: user.id,
        recipientId,
        contractId: contractIdForDB,
        content: content.trim(),
        isRead: '0',
      })
    },
    onSuccess: () => {
      setMessageText('')
      qc.invalidateQueries({ queryKey: ['all-messages', user?.id] })
    },
    onError: () => toast.error('Failed to send message'),
  })

  const handleSend = () => {
    if (!messageText.trim() || !recipientId) return
    sendMutation.mutate(messageText)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="page-container !py-0 !px-0 sm:!px-0 lg:!px-0">
      <div className="flex h-[calc(100vh-4rem)] max-w-7xl mx-auto">

        {/* ── Left Sidebar: Conversations ──────────────────────────────────── */}
        <div className={`
          w-full sm:w-80 lg:w-96 border-r border-border bg-card flex flex-col shrink-0
          ${selectedContractId ? 'hidden sm:flex' : 'flex'}
        `}>
          {/* Header */}
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <MessageSquare size={20} className="text-primary" />
              Messages
            </h2>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {msgsLoading ? (
              <div>{Array.from({ length: 4 }).map((_, i) => <ConvSkeleton key={i} />)}</div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <MessageSquare size={40} className="text-muted-foreground opacity-30 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">No conversations yet</p>
                <p className="text-xs text-muted-foreground mt-1">Messages from contracts will appear here</p>
              </div>
            ) : (
              filteredConversations.map(conv => (
                <button
                  key={conv.contractId}
                  onClick={() => setSelectedContractId(conv.contractId)}
                  className={`w-full p-4 flex gap-3 text-left hover:bg-muted/50 transition-colors border-b border-border/50 ${
                    selectedContractId === conv.contractId ? 'bg-muted/60' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full gradient-amber flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {getInitials(conv.otherPartyName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-foreground truncate">{conv.otherPartyName}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0 flex items-center gap-1">
                        <Clock size={10} />
                        {formatRelativeTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{conv.contractTitle}</p>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground truncate flex-1">{conv.lastMessage}</p>
                      {conv.unreadCount > 0 && (
                        <span className="shrink-0 w-5 h-5 rounded-full gradient-amber text-white text-[10px] font-bold flex items-center justify-center">
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Right Panel: Chat Thread ──────────────────────────────────────── */}
        <div className={`
          flex-1 flex flex-col bg-background
          ${!selectedContractId ? 'hidden sm:flex' : 'flex'}
        `}>
          {!selectedContractId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <MessageSquare size={28} className="text-muted-foreground" />
                </div>
                <p className="text-foreground font-semibold">Select a conversation</p>
                <p className="text-sm text-muted-foreground mt-1">Choose from your conversations on the left</p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="p-4 border-b border-border bg-card flex items-center gap-3">
                <button
                  onClick={() => setSelectedContractId(null)}
                  className="sm:hidden text-muted-foreground hover:text-foreground"
                >
                  ←
                </button>
                {(() => {
                  const conv = conversations.find(c => c.contractId === selectedContractId)
                  return conv ? (
                    <>
                      <div className="w-9 h-9 rounded-full gradient-amber flex items-center justify-center text-white text-sm font-bold">
                        {getInitials(conv.otherPartyName)}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{conv.otherPartyName}</p>
                        <p className="text-xs text-muted-foreground">{conv.contractTitle}</p>
                      </div>
                    </>
                  ) : null
                })()}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {msgsLoading
                  ? Array.from({ length: 4 }).map((_, i) => <MsgSkeleton key={i} />)
                  : threadMessages.length === 0
                  ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground text-sm">No messages yet. Say hello! 👋</p>
                    </div>
                  )
                  : threadMessages.map(msg => {
                    const isOwn = msg.userId === user?.id
                    return (
                      <div key={msg.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Avatar */}
                        {!isOwn && (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 mt-1">
                            {getInitials(msg.senderName ?? 'U')}
                          </div>
                        )}
                        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%]`}>
                          {!isOwn && msg.senderName && (
                            <span className="text-[11px] text-muted-foreground mb-1 px-1">{msg.senderName}</span>
                          )}
                          <div
                            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                              isOwn
                                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                : 'bg-card border border-border text-foreground rounded-tl-sm'
                            }`}
                          >
                            {msg.content}
                          </div>
                          <div className={`flex items-center gap-1 mt-1 px-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                            <span className="text-[10px] text-muted-foreground">{formatRelativeTime(msg.createdAt)}</span>
                            {isOwn && (
                              <CheckCheck size={12} className={msg.isRead === '1' ? 'text-primary' : 'text-muted-foreground'} />
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                }
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border bg-card">
                <div className="flex gap-2 items-end">
                  <Textarea
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                    className="resize-none min-h-[44px] max-h-32 text-sm flex-1"
                    rows={1}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!messageText.trim() || !recipientId || sendMutation.isPending}
                    className="gradient-amber text-white border-0 h-11 px-4 shrink-0"
                  >
                    <Send size={16} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
