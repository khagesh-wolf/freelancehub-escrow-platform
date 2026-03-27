export type UserRole = 'client' | 'freelancer' | 'admin'

export interface UserProfile {
  id: string
  userId: string
  role: UserRole
  displayName: string
  avatarUrl: string
  bio: string
  location: string
  phone: string
  website: string
  isApproved: string // "0" | "1" from SQLite
  isSuspended: string // "0" | "1"
  stripeCustomerId: string
  createdAt: string
  updatedAt: string
}

export interface FreelancerProfile {
  id: string
  userId: string
  title: string
  skills: string // JSON array string
  categories: string // JSON array string
  hourlyRate: number
  experienceYears: number
  education: string // JSON array string
  languages: string // JSON array string
  availability: 'available' | 'busy' | 'unavailable'
  rating: number
  totalReviews: number
  totalEarnings: number
  completedJobs: number
  isFeatured: string // "0" | "1"
  createdAt: string
  updatedAt: string
}

export interface PortfolioItem {
  id: string
  userId: string
  title: string
  description: string
  imageUrl: string
  projectUrl: string
  tags: string // JSON array string
  createdAt: string
}

export interface Job {
  id: string
  userId: string // client
  title: string
  description: string
  category: string
  skillsRequired: string // JSON array string
  budgetType: 'fixed' | 'hourly'
  budgetMin: number
  budgetMax: number
  deadline: string
  status: 'open' | 'in_progress' | 'completed' | 'cancelled'
  proposalsCount: number
  createdAt: string
  updatedAt: string
  // joined
  clientName?: string
  clientAvatar?: string
}

export interface Proposal {
  id: string
  userId: string // freelancer
  jobId: string
  clientId: string
  coverLetter: string
  bidAmount: number
  estimatedDays: number
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn'
  createdAt: string
  updatedAt: string
  // joined
  freelancerName?: string
  freelancerAvatar?: string
  freelancerTitle?: string
  freelancerRating?: number
  jobTitle?: string
}

export interface Contract {
  id: string
  userId: string // freelancer
  clientId: string
  jobId: string
  proposalId: string
  title: string
  description: string
  amount: number
  platformFee: number
  freelancerAmount: number
  deadline: string
  status: 'pending' | 'active' | 'submitted' | 'revision' | 'completed' | 'disputed' | 'cancelled'
  paymentStatus: 'unpaid' | 'paid_to_platform' | 'released' | 'refunded'
  stripePaymentIntentId: string
  deliverablesUrl: string
  clientNotes: string
  adminNotes: string
  completedAt: string
  createdAt: string
  updatedAt: string
  // joined
  freelancerName?: string
  freelancerAvatar?: string
  clientName?: string
  clientAvatar?: string
  jobTitle?: string
}

export interface Wallet {
  id: string
  userId: string
  balance: number
  pendingBalance: number
  totalEarned: number
  totalWithdrawn: number
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  userId: string
  contractId: string
  type: 'credit' | 'debit' | 'escrow_hold' | 'platform_fee' | 'withdrawal' | 'refund'
  amount: number
  description: string
  status: 'pending' | 'completed' | 'failed'
  stripeId: string
  createdAt: string
}

export interface Review {
  id: string
  userId: string // reviewer
  freelancerId: string
  contractId: string
  rating: number
  comment: string
  isPublic: string // "0"|"1"
  createdAt: string
  // joined
  reviewerName?: string
  reviewerAvatar?: string
}

export interface Notification {
  id: string
  userId: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  link: string
  isRead: string // "0"|"1"
  createdAt: string
}

export interface Message {
  id: string
  userId: string // sender
  recipientId: string
  contractId: string
  content: string
  isRead: string // "0"|"1"
  createdAt: string
  senderName?: string
  senderAvatar?: string
}

export interface WithdrawalRequest {
  id: string
  userId: string
  amount: number
  method: 'bank' | 'paypal' | 'stripe'
  accountDetails: string
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  adminNotes: string
  createdAt: string
  updatedAt: string
  userName?: string
}

export interface Dispute {
  id: string
  userId: string
  contractId: string
  reason: string
  description: string
  evidenceUrl: string
  status: 'open' | 'under_review' | 'resolved_client' | 'resolved_freelancer' | 'closed'
  adminNotes: string
  resolution: string
  createdAt: string
  updatedAt: string
  raisedByName?: string
  contractTitle?: string
}

export const JOB_CATEGORIES = [
  'Web Development',
  'Mobile Development',
  'Design & Creative',
  'Writing & Content',
  'Marketing & SEO',
  'Video & Animation',
  'Data & Analytics',
  'AI & Machine Learning',
  'DevOps & Cloud',
  'Cybersecurity',
  'Consulting',
  'Other',
]

export const SKILL_OPTIONS = [
  'React', 'Next.js', 'Vue.js', 'Angular', 'TypeScript', 'JavaScript',
  'Node.js', 'Python', 'Django', 'FastAPI', 'Go', 'Rust',
  'PostgreSQL', 'MongoDB', 'MySQL', 'Redis',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes',
  'React Native', 'Flutter', 'Swift', 'Kotlin',
  'Figma', 'Adobe XD', 'Photoshop', 'Illustrator',
  'SEO', 'Google Ads', 'Social Media', 'Content Writing',
  'Data Analysis', 'Machine Learning', 'TensorFlow', 'PyTorch',
  'Blockchain', 'Solidity', 'Web3',
  'Stripe', 'GraphQL', 'REST APIs', 'WebSockets',
]

export const PLATFORM_FEE_PERCENT = 10 // 10% platform commission
