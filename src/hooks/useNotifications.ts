import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { blink, tables } from '../blink/client'
import type { Notification } from '../types'

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info',
  link = '',
) {
  await tables.notifications.create({
    id: crypto.randomUUID(),
    userId,
    title,
    message,
    type,
    link,
    isRead: '0',
    createdAt: new Date().toISOString(),
  })
}

export function useNotifications(userId: string | undefined) {
  const qc = useQueryClient()

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return []
      const items = await tables.notifications.list({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        limit: 50,
      })
      return items as Notification[]
    },
    enabled: !!userId,
    refetchInterval: 30000,
  })

  const unreadCount = notifications.filter(n => n.isRead === '0').length

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await tables.notifications.update(id, { isRead: '1' })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', userId] }),
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => n.isRead === '0')
      for (const n of unread) {
        await tables.notifications.update(n.id, { isRead: '1' })
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', userId] }),
  })

  return {
    notifications,
    unreadCount,
    markRead: markRead.mutate,
    markAllRead: markAllRead.mutate,
  }
}
