import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string): string {
  if (!date) return 'N/A'
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatRelativeTime(date: string): string {
  if (!date) return ''
  const now = new Date()
  const d = new Date(date)
  const diff = now.getTime() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return formatDate(date)
}

export function safeParseJSON<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T
  } catch {
    return fallback
  }
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    open: 'bg-emerald-100 text-emerald-700',
    active: 'bg-blue-100 text-blue-700',
    pending: 'bg-amber-100 text-amber-700',
    submitted: 'bg-purple-100 text-purple-700',
    revision: 'bg-orange-100 text-orange-700',
    completed: 'bg-green-100 text-green-700',
    disputed: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-700',
    accepted: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    withdrawn: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-700',
    available: 'bg-green-100 text-green-700',
    busy: 'bg-amber-100 text-amber-700',
    unavailable: 'bg-red-100 text-red-700',
    approved: 'bg-green-100 text-green-700',
    under_review: 'bg-blue-100 text-blue-700',
    open_dispute: 'bg-red-100 text-red-700',
    paid_to_platform: 'bg-amber-100 text-amber-700',
    released: 'bg-green-100 text-green-700',
    refunded: 'bg-gray-100 text-gray-700',
    unpaid: 'bg-gray-100 text-gray-600',
  }
  return colors[status] || 'bg-gray-100 text-gray-600'
} 