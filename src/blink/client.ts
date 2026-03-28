import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: import.meta.env.VITE_BLINK_PROJECT_ID,
  publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY,
  auth: { mode: 'managed' },
})

const db = blink.db as any

export const tables = {
  userProfiles: db.userProfiles,
  freelancerProfiles: db.freelancerProfiles,
  portfolioItems: db.portfolioItems,
  jobs: db.jobs,
  proposals: db.proposals,
  contracts: db.contracts,
  milestones: db.milestones,
  wallets: db.wallets,
  transactions: db.transactions,
  reviews: db.reviews,
  messages: db.messages,
  notifications: db.notifications,
  withdrawalRequests: db.withdrawalRequests,
  disputes: db.disputes,
}
