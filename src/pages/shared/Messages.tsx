import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, MessageSquare, ChevronLeft } from 'lucide-react'
import { tables } from '../../blink/client'
import { useAuth } from '../../hooks/useAuth'
import { generateId, timeAgo } from '../../lib/utils'
import type { Message, Contract, UserProfile } from '../../types'

function getInitials(name: string) {
  return (name ?? '?')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// formatRelativeTime may not exist — fallback to timeAgo
function displayTime(dateStr: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (formatRelativeTime as any) === 'function') return formatRelativeTime(dateStr)
  } catch {}
  return timeAgo(dateStr)
}

export function MessagesPage() {
  const params = useParams({ strict: false }) as { contractId?: string }
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [selectedContractId, setSelectedContractId] = useState(params.contractId ?? '')
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep selectedContractId in sync if URL param changes
  useEffect(() => {
    if (params.contractId && params.contractId !== selectedContractId) {
      setSelectedContractId(params.contractId)
    }
  }, [params.contractId])

  // Fetch all contracts where user is freelancer or client
  const { data: myContracts = [] } = useQuery({
    queryKey: ['my-contracts-messages', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const [asFreelancer, asClient] = await Promise.all([
        tables.contracts.list({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          limit: 100,
        }) as Promise<Contract[]>,
        tables.contracts.list({
          where: { clientId: user.id },
          orderBy: { createdAt: 'desc' },
          limit: 100,
        }) as Promise<Contract[]>,
      ])
      const all = [...asFreelancer, ...asClient]
      const seen = new Set<string>()
      return all.filter(c => {
        if (seen.has(c.id)) return false
        seen.add(c.id)
        return true
      })
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  })

  // Fetch messages for selected contract
  const { data: messages = [] } = useQuery({
    queryKey: ['messages', selectedContractId],
    queryFn: async () => {
      if (!selectedContractId) return []
      return tables.messages.list({
        where: { contractId: selectedContractId },
        orderBy: { createdAt: 'asc' },
        limit: 200,
      }) as Promise<Message[]>
    },
    enabled: !!selectedContractId,
    refetchInterval: 10000,
  })

  // Fetch all relevant user profiles for display names
  const { data: userProfiles = [] } = useQuery({
    queryKey: ['message-users', myContracts.map(c => c.id).join(',')],
    queryFn: async () => {
      if (myContracts.length === 0) return []
      // Collect all unique userIds from contracts
      const ids = new Set<string>()
      myContracts.forEach(c => { ids.add(c.userId); ids.add(c.clientId) })
      const profiles = await Promise.all(
        [...ids].map(id => tables.userProfiles.list({ where: { userId: id }, limit: 1 }))
      )
      return profiles.flatMap(p => p) as UserProfile[]
    },
    enabled: myContracts.length > 0,
  })
  const profileMap = new Map(userProfiles.map(u => [u.userId, u]))

  const selectedContract = myContracts.find(c => c.id === selectedContractId)
  const otherUserId = selectedContract
    ? selectedContract.userId === user?.id
      ? selectedContract.clientId
      : selectedContract.userId
    : null
  const otherUser = otherUserId ? profileMap.get(otherUserId) : null

  // Mark messages as read when conversation is opened
  useEffect(() => {
    if (!selectedContractId || !user?.id || messages.length === 0) return
    const unread = messages.filter(
      m => m.recipientId === user.id && m.isRead === '0'
    )
    if (unread.length === 0) return
    Promise.all(
      unread.map(m => tables.messages.update(m.id, { isRead: '1' }))
    ).then(() => {
      qc.invalidateQueries({ queryKey: ['messages', selectedContractId] })
    })
  }, [messages, selectedContractId, user?.id])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedContractId || !user?.id || !otherUserId) return
      await tables.messages.create({
        id: generateId(),
        userId: user.id,
        recipientId: otherUserId,
        contractId: selectedContractId,
        content,
        isRead: '0',
        createdAt: new Date().toISOString(),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', selectedContractId] })
      setInput('')
      inputRef.current?.focus()
    },
  })

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !sendMessage.isPending) {
      sendMessage.mutate(input.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !sendMessage.isPending) {
        sendMessage.mutate(input.trim())
      }
    }
  }

  if (!user) {
    return (
      <div className="page-container pt-24 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <MessageSquare size={48} className="text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign in required</h2>
          <p className="text-muted-foreground mb-4">Please sign in to view your messages.</p>
          <button
            onClick={() => navigate({ to: '/auth/login' })}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-16 h-screen flex flex-col bg-background">
      {/* Page container — full height below navbar */}
      <div className="flex flex-1 overflow-hidden max-w-7xl mx-auto w-full px-0 sm:px-4 lg:px-8">
        {/* ── Conversations sidebar ── */}
        <aside
          className={`
            ${selectedContractId ? 'hidden sm:flex' : 'flex'}
            sm:w-72 w-full flex-col bg-card border-r border-border
          `}
        >
          <div className="px-4 py-4 border-b border-border">
            <h2 className="font-bold text-lg text-foreground">Messages</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {myContracts.length} conversation{myContracts.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {myContracts.length === 0 ? (
              <div className="p-6 text-center">
                <MessageSquare size={32} className="text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No conversations yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Conversations are linked to your active contracts.
                </p>
              </div>
            ) : (
              myContracts.map(c => {
                const otherUId = c.userId === user.id ? c.clientId : c.userId
                const other = profileMap.get(otherUId)
                const isSelected = selectedContractId === c.id

                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedContractId(c.id)
                      navigate({
                        to: '/messages/$contractId',
                        params: { contractId: c.id },
                      })
                    }}
                    className={`
                      w-full flex items-start gap-3 px-4 py-3 border-b border-border
                      hover:bg-muted/50 transition-colors text-left
                      ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}
                    `}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-primary">
                      {other?.avatarUrl ? (
                        <img
                          src={other.avatarUrl}
                          alt=""
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        getInitials(other?.displayName ?? '?')
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {other?.displayName ?? 'User'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {c.title}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        {timeAgo(c.createdAt)}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* ── Message thread ── */}
        <div
          className={`
            ${!selectedContractId ? 'hidden sm:flex' : 'flex'}
            flex-1 flex-col min-w-0
          `}
        >
          {!selectedContractId ? (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare size={36} className="text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Select a Conversation
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Choose a contract conversation from the left to start messaging.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="px-4 py-3.5 border-b border-border flex items-center gap-3 bg-card flex-shrink-0">
                {/* Mobile back button */}
                <button
                  onClick={() => {
                    setSelectedContractId('')
                    navigate({ to: '/messages' })
                  }}
                  className="sm:hidden p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-primary overflow-hidden">
                  {otherUser?.avatarUrl ? (
                    <img
                      src={otherUser.avatarUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getInitials(otherUser?.displayName ?? '?')
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">
                    {otherUser?.displayName ?? 'User'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedContract?.title}
                  </p>
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">
                        No messages yet. Say hello!
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((m, idx) => {
                      const isMe = m.userId === user.id
                      const prevMsg = messages[idx - 1]
                      const showDateSeparator =
                        !prevMsg ||
                        new Date(m.createdAt).toDateString() !==
                          new Date(prevMsg.createdAt).toDateString()

                      return (
                        <div key={m.id}>
                          {/* Date separator */}
                          {showDateSeparator && (
                            <div className="flex items-center gap-3 my-4">
                              <div className="flex-1 h-px bg-border" />
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {new Date(m.createdAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                              <div className="flex-1 h-px bg-border" />
                            </div>
                          )}

                          <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {!isMe && (
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary mr-2 flex-shrink-0 self-end overflow-hidden">
                                {otherUser?.avatarUrl ? (
                                  <img
                                    src={otherUser.avatarUrl}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  getInitials(otherUser?.displayName ?? '?')
                                )}
                              </div>
                            )}
                            <div
                              className={`
                                max-w-xs lg:max-w-md xl:max-w-lg
                                px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                                ${
                                  isMe
                                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                                    : 'bg-card border border-border text-foreground rounded-bl-sm shadow-sm'
                                }
                              `}
                            >
                              <p className="whitespace-pre-wrap break-words">{m.content}</p>
                              <p
                                className={`text-xs mt-1.5 ${
                                  isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'
                                }`}
                              >
                                {displayTime(m.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input */}
              <form
                onSubmit={handleSend}
                className="px-4 py-3.5 border-t border-border bg-card flex gap-3 flex-shrink-0"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Enter to send)"
                  className="
                    flex-1 px-4 py-2.5 border border-input rounded-xl bg-background
                    text-sm text-foreground placeholder:text-muted-foreground
                    focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary
                    transition-colors
                  "
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sendMessage.isPending}
                  className="
                    p-2.5 bg-primary text-primary-foreground rounded-xl
                    hover:bg-primary/90 transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed
                    flex items-center justify-center flex-shrink-0
                  "
                >
                  {sendMessage.isPending ? (
                    <div className="w-[18px] h-[18px] border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
