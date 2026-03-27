import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { TrendingUp, Users, Briefcase, DollarSign, FileText, Star } from 'lucide-react'
import { StatCard } from '../../components/shared/StatCard'
import { tables } from '../../blink/client'
import { formatCurrency } from '../../lib/utils'
import type { Contract, UserProfile, Job } from '../../types'

// ─── chart helpers ────────────────────────────────────────────────────────────
function groupByMonth(items: { createdAt: string; value?: number }[]): { month: string; value: number }[] {
  const map: Record<string, number> = {}
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    map[key] = 0
  }
  items.forEach(item => {
    const d = new Date(item.createdAt)
    const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    if (key in map) map[key] = (map[key] || 0) + (item.value ?? 1)
  })
  return Object.entries(map).map(([month, value]) => ({ month, value }))
}

function categoryCounts(jobs: Job[]) {
  const map: Record<string, number> = {}
  jobs.forEach(j => {
    if (j.category) map[j.category] = (map[j.category] || 0) + 1
  })
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
}

function contractStatusCounts(contracts: Contract[]) {
  const statuses = ['active', 'submitted', 'completed', 'disputed', 'cancelled']
  return statuses.map(s => ({
    name: s.charAt(0).toUpperCase() + s.slice(1),
    value: contracts.filter(c => c.status === s).length,
  })).filter(d => d.value > 0)
}

const COLORS = [
  'hsl(215,28%,17%)',
  'hsl(38,92%,50%)',
  'hsl(142,71%,45%)',
  'hsl(221,83%,53%)',
  'hsl(0,84%,60%)',
  'hsl(262,52%,55%)',
  'hsl(25,95%,53%)',
  'hsl(190,80%,40%)',
]

// ─── main export ──────────────────────────────────────────────────────────────
export function AdminAnalyticsPage() {
  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['analytics-users'],
    queryFn: () => tables.userProfiles.list({ limit: 200 }) as Promise<UserProfile[]>,
  })

  const { data: allContracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['analytics-contracts'],
    queryFn: async () => {
      const items = await tables.contracts.list({ orderBy: { createdAt: 'asc' }, limit: 200 })
      return items as Contract[]
    },
  })

  const { data: allJobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['analytics-jobs'],
    queryFn: async () => {
      const items = await tables.jobs.list({ limit: 200 })
      return items as Job[]
    },
  })

  const isLoading = usersLoading || contractsLoading || jobsLoading

  // Summary metrics
  const clients = allUsers.filter(u => u.role === 'client').length
  const freelancers = allUsers.filter(u => u.role === 'freelancer').length
  const admins = allUsers.filter(u => u.role === 'admin').length

  const releasedContracts = allContracts.filter(c => c.paymentStatus === 'released')
  const totalContractValue = allContracts.reduce((s, c) => s + (c.amount || 0), 0)
  const totalPlatformRevenue = releasedContracts.reduce((s, c) => s + (c.platformFee || 0), 0)
  const avgContractValue = allContracts.length > 0 ? totalContractValue / allContracts.length : 0

  // Chart data
  const revenueChartData = groupByMonth(
    releasedContracts.map(c => ({ createdAt: c.createdAt, value: c.platformFee || 0 }))
  )

  const userGrowthData = groupByMonth(
    allUsers.map(u => ({ createdAt: u.createdAt, value: 1 }))
  )

  const jobCategoryData = categoryCounts(allJobs)
  const contractStatusData = contractStatusCounts(allContracts)

  const userDistData = [
    { name: 'Clients', value: clients },
    { name: 'Freelancers', value: freelancers },
    { name: 'Admins', value: admins },
  ].filter(d => d.value > 0)

  return (
    <div className="page-container space-y-8 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
          <TrendingUp size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">Platform performance overview</p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-24 flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Users"
              value={allUsers.length}
              icon={Users}
              iconColor="text-blue-500"
              subtitle={`${clients} clients, ${freelancers} freelancers`}
            />
            <StatCard
              title="Platform Revenue"
              value={formatCurrency(totalPlatformRevenue)}
              icon={DollarSign}
              iconColor="text-accent"
              subtitle="From released contracts"
            />
            <StatCard
              title="Total Contracts"
              value={allContracts.length}
              icon={FileText}
              iconColor="text-purple-500"
              subtitle={`${releasedContracts.length} completed`}
            />
            <StatCard
              title="Avg Contract Value"
              value={formatCurrency(avgContractValue)}
              icon={TrendingUp}
              iconColor="text-green-500"
              subtitle="Per contract"
            />
          </div>

          {/* Revenue & User Growth charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground mb-4">Monthly Platform Revenue</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={revenueChartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} contentStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(38,92%,50%)"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: 'hsl(38,92%,50%)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground mb-4">Monthly User Growth</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={userGrowthData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [v, 'New Users']} contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="value" fill="hsl(215,28%,17%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category & Contract Status charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground mb-4">Top Job Categories</h2>
              {jobCategoryData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No jobs yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={jobCategoryData}
                    layout="vertical"
                    margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip formatter={(v: number) => [v, 'Jobs']} contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="value" fill="hsl(38,92%,50%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground mb-4">Contract Status Distribution</h2>
              {contractStatusData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No contracts yet</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={contractStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {contractStatusData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [v, 'Contracts']} contentStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
                    {contractStatusData.map((entry, i) => (
                      <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        <span className="text-muted-foreground">{entry.name}</span>
                        <span className="ml-auto font-medium text-foreground">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Summary table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Platform Summary</h2>
            </div>
            <div className="divide-y divide-border">
              {[
                { label: 'Total Client Users', value: clients },
                { label: 'Total Freelancer Users', value: freelancers },
                { label: 'Total Admin Users', value: admins },
                { label: 'Total Jobs Posted', value: allJobs.length },
                { label: 'Open Jobs', value: allJobs.filter(j => j.status === 'open').length },
                { label: 'Total Contracts', value: allContracts.length },
                { label: 'Active Contracts', value: allContracts.filter(c => c.status === 'active').length },
                { label: 'Completed Contracts', value: releasedContracts.length },
                { label: 'Disputed Contracts', value: allContracts.filter(c => c.status === 'disputed').length },
                { label: 'Total Contract Volume', value: formatCurrency(totalContractValue) },
                { label: 'Platform Revenue Earned', value: formatCurrency(totalPlatformRevenue) },
                { label: 'Average Contract Value', value: formatCurrency(avgContractValue) },
              ].map(row => (
                <div key={row.label} className="px-5 py-3 flex items-center justify-between text-sm hover:bg-muted/30 transition-colors">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium text-foreground">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
