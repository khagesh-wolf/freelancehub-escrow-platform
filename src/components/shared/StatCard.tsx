import { cn } from '../../lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  iconColor?: string
  trend?: { value: number; label: string }
  className?: string
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-primary',
  trend,
  className,
}: StatCardProps) {
  return (
    <div className={cn('bg-card border border-border rounded-xl p-5 card-hover', className)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <div className={cn('p-2 rounded-lg bg-muted', iconColor)}>
          <Icon size={18} />
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      {trend && (
        <p className={cn('text-xs mt-2 font-medium', trend.value >= 0 ? 'text-green-600' : 'text-red-500')}>
          {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
        </p>
      )}
    </div>
  )
}
