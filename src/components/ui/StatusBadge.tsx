import { cn, getStatusColor } from '../../lib/utils'

interface Props {
  status: string
  className?: string
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  active: 'Active',
  pending: 'Pending',
  submitted: 'Submitted',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
  revision: 'Revision',
  accepted: 'Accepted',
  rejected: 'Rejected',
  released: 'Released',
  paid_to_platform: 'Paid (Escrow)',
  unpaid: 'Unpaid',
  available: 'Available',
  busy: 'Busy',
  unavailable: 'Unavailable',
  withdrawn: 'Withdrawn',
  under_review: 'Under Review',
  resolved_client: 'Resolved (Client)',
  resolved_freelancer: 'Resolved (Freelancer)',
  closed: 'Closed',
  approved: 'Approved',
}

export function StatusBadge({ status, className }: Props) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
      getStatusColor(status),
      className
    )}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
