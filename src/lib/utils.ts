import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function timeAgo(dateStr: string) {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 30) return formatDate(dateStr)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'just now'
}

export function parseJsonArray(str: string): string[] {
  try { return JSON.parse(str || '[]') } catch { return [] }
}

export function truncate(str: string, len = 100) {
  if (!str || str.length <= len) return str
  return str.slice(0, len) + '…'
}

export function getInitials(name: string) {
  if (!name) return 'U'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    open: 'bg-green-100 text-green-800',
    active: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-blue-100 text-blue-800',
    pending: 'bg-amber-100 text-amber-800',
    submitted: 'bg-amber-100 text-amber-800',
    completed: 'bg-green-100 text-green-800',
    released: 'bg-green-100 text-green-800',
    paid_to_platform: 'bg-amber-100 text-amber-800',
    unpaid: 'bg-gray-100 text-gray-800',
    disputed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-600',
    rejected: 'bg-red-100 text-red-800',
    withdrawn: 'bg-gray-100 text-gray-600',
    available: 'bg-green-100 text-green-800',
    busy: 'bg-amber-100 text-amber-800',
    unavailable: 'bg-red-100 text-red-800',
  }
  return map[status] ?? 'bg-gray-100 text-gray-700'
}

export function generateId(): string {
  return crypto.randomUUID()
}

export const PLATFORM_FEE_PERCENT = 10

export const CATEGORIES = [
  'Web Development', 'Mobile Development', 'UI/UX Design', 'Graphic Design',
  'Content Writing', 'Digital Marketing', 'Video & Animation', 'Data Science',
  'DevOps & Cloud', 'Cybersecurity', 'Blockchain', 'Game Development',
  'SEO', 'Social Media', 'Translation', 'Virtual Assistant',
]

export const SKILLS = [
  'React', 'Vue', 'Angular', 'Next.js', 'Node.js', 'Python', 'Django', 'Laravel',
  'TypeScript', 'JavaScript', 'HTML/CSS', 'Tailwind CSS', 'Figma', 'Photoshop',
  'Flutter', 'React Native', 'Swift', 'Kotlin', 'AWS', 'Docker', 'PostgreSQL',
  'MongoDB', 'WordPress', 'Shopify', 'Content Writing', 'Copywriting', 'SEO',
]

