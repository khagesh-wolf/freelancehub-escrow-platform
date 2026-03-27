import {
  createRouter,
  createRoute,
  createRootRoute,
  RouterProvider,
  Outlet,
  useNavigate,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { Navbar } from './components/layout/Navbar'

// Pages — Auth
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'

// Pages — Onboarding & Unified Dashboard
import { OnboardingPage } from './pages/OnboardingPage'
import { DashboardPage } from './pages/DashboardPage'

// Pages — Client
import { ClientDashboard } from './pages/client/Dashboard'
import { PostJobPage as ClientPostJobPage } from './pages/client/PostJob'
import { ClientProjectsPage } from './pages/client/Projects'
import { ClientProjectDetail } from './pages/client/ProjectDetail'
import { ClientProfile } from './pages/client/Profile'
import { ContractPaymentPage } from './pages/client/ContractPayment'

// Pages — Freelancer
import { FreelancerDashboard } from './pages/freelancer/Dashboard'
import { FreelancerProfileSetup } from './pages/freelancer/ProfileSetup'
import { FreelancerProfile } from './pages/freelancer/Profile'
import { BrowseJobs } from './pages/freelancer/BrowseJobs'
import { JobDetail } from './pages/freelancer/JobDetail'
import { FreelancerContracts } from './pages/freelancer/Contracts'
import { FreelancerContractDetail } from './pages/freelancer/ContractDetail'
import { FreelancerWallet } from './pages/freelancer/Wallet'

// Pages — Admin
import { AdminDashboard } from './pages/admin/Dashboard'
import { AdminUsers } from './pages/admin/Users'
import { AdminJobs } from './pages/admin/Jobs'
import { AdminPayments } from './pages/admin/Payments'
import { AdminDisputes } from './pages/admin/Disputes'

// Pages — Shared
import { MessagesPage } from './pages/shared/Messages'

// Pages — Unified routes
import { BrowseFreelancersPage } from './pages/BrowseFreelancersPage'
import { BrowseJobsPage } from './pages/BrowseJobsPage'
import { FreelancerProfilePage } from './pages/FreelancerProfilePage'
import { PostJobPage } from './pages/PostJobPage'
import { JobDetailPage } from './pages/JobDetailPage'
import { MyJobsPage } from './pages/MyJobsPage'
import { ProposalsPage } from './pages/ProposalsPage'
import { ContractsPage } from './pages/ContractsPage'
import { ContractDetailPage } from './pages/ContractDetailPage'
import { WalletPage } from './pages/WalletPage'
import { PaymentsPage } from './pages/PaymentsPage'
import { PortfolioPage } from './pages/PortfolioPage'
import { SettingsPage } from './pages/SettingsPage'

// ─── Loading screen ────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}

// ─── Root layout — handles auth redirect ───────────────────────────────────────
function RootLayout() {
  const { user, profile, isLoading } = useAuth()
  const navigate = useNavigate()

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'
  const isAdminRoute = pathname.startsWith('/admin')
  const isAuthRoute = pathname.startsWith('/auth')
  const isPublicRoute = ['/', '/browse', '/jobs'].some(p => pathname === p) ||
    pathname.startsWith('/jobs/') || pathname.startsWith('/freelancer/')

  useEffect(() => {
    if (isLoading) return
    // Authenticated user with no profile → register
    if (user && !profile && !isAuthRoute && pathname !== '/auth/register') {
      navigate({ to: '/auth/register' })
      return
    }
    // Authenticated user, admin → admin panel
    if (user && profile?.role === 'admin' && !isAdminRoute && pathname === '/') {
      navigate({ to: '/admin' })
      return
    }
    // Authenticated client → client dashboard
    if (user && profile?.role === 'client' && pathname === '/') {
      navigate({ to: '/client/dashboard' })
      return
    }
    // Authenticated freelancer → freelancer dashboard
    if (user && profile?.role === 'freelancer' && pathname === '/') {
      navigate({ to: '/freelancer/dashboard' })
      return
    }
  }, [isLoading, user, profile, pathname])

  if (isLoading) return <LoadingScreen />
  if (isAdminRoute) return <Outlet />

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} profile={profile} />
      <Outlet />
    </div>
  )
}

// ─── Route definitions ─────────────────────────────────────────────────────────
const rootRoute = createRootRoute({ component: RootLayout })

// Public routes
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: LandingPage })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/auth/login', component: LoginPage })
const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: '/auth/register', component: RegisterPage })
const onboardingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/onboarding', component: OnboardingPage })
const dashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/dashboard', component: DashboardPage })

// Browse routes (public)
const browseRoute = createRoute({ getParentRoute: () => rootRoute, path: '/browse', component: BrowseFreelancersPage })
const jobsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/jobs', component: BrowseJobsPage })
const freelancerPublicRoute = createRoute({ getParentRoute: () => rootRoute, path: '/freelancer/$userId', component: FreelancerProfilePage })
const jobDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: '/jobs/$jobId', component: JobDetailPage })

// Unified routes
const postJobRoute2 = createRoute({ getParentRoute: () => rootRoute, path: '/post-job', component: PostJobPage })
const myJobsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/my-jobs', component: MyJobsPage })
const proposalsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/proposals', component: ProposalsPage })
const contractsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/contracts', component: ContractsPage })
const contractDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: '/contracts/$contractId', component: ContractDetailPage })
const walletRoute = createRoute({ getParentRoute: () => rootRoute, path: '/wallet', component: WalletPage })
const paymentsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/payments', component: PaymentsPage })
const portfolioRoute = createRoute({ getParentRoute: () => rootRoute, path: '/portfolio', component: PortfolioPage })
const messagesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/messages', component: MessagesPage })
const messagesContractRoute = createRoute({ getParentRoute: () => rootRoute, path: '/messages/$contractId', component: MessagesPage })
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: SettingsPage })

// Client routes
const clientDashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/client/dashboard', component: ClientDashboard })
const clientProjectsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/client/projects', component: ClientProjectsPage })
const clientProjectDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: '/client/projects/$contractId', component: ClientProjectDetail })
const postJobRoute = createRoute({ getParentRoute: () => rootRoute, path: '/client/post-job', component: ClientPostJobPage })
const clientProfileRoute = createRoute({ getParentRoute: () => rootRoute, path: '/client/profile', component: ClientProfile })
const contractPaymentRoute = createRoute({ getParentRoute: () => rootRoute, path: '/client/payment/$contractId', component: ContractPaymentPage })

// Freelancer routes
const freelancerDashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/freelancer/dashboard', component: FreelancerDashboard })
const freelancerProfileSetupRoute = createRoute({ getParentRoute: () => rootRoute, path: '/freelancer/profile/setup', component: FreelancerProfileSetup })
const freelancerProfileRoute = createRoute({ getParentRoute: () => rootRoute, path: '/freelancer/profile', component: FreelancerProfile })
const freelancerBrowseJobsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/freelancer/jobs', component: BrowseJobs })
const freelancerJobDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: '/freelancer/jobs/$jobId', component: JobDetail })
const freelancerContractsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/freelancer/contracts', component: FreelancerContracts })
const freelancerContractDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: '/freelancer/contracts/$contractId', component: FreelancerContractDetail })
const freelancerWalletRoute = createRoute({ getParentRoute: () => rootRoute, path: '/freelancer/wallet', component: FreelancerWallet })

// Admin routes
const adminDashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin', component: AdminDashboard })
const adminUsersRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/users', component: AdminUsers })
const adminJobsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/jobs', component: AdminJobs })
const adminPaymentsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/payments', component: AdminPayments })
const adminDisputesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/disputes', component: AdminDisputes })

// ─── Route tree ────────────────────────────────────────────────────────────────
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  onboardingRoute,
  dashboardRoute,
  browseRoute,
  jobsRoute,
  freelancerPublicRoute,
  jobDetailRoute,
  postJobRoute2,
  myJobsRoute,
  proposalsRoute,
  contractsRoute,
  contractDetailRoute,
  walletRoute,
  paymentsRoute,
  portfolioRoute,
  messagesRoute,
  messagesContractRoute,
  settingsRoute,
  clientDashboardRoute,
  clientProjectsRoute,
  clientProjectDetailRoute,
  postJobRoute,
  clientProfileRoute,
  contractPaymentRoute,
  freelancerDashboardRoute,
  freelancerProfileSetupRoute,
  freelancerProfileRoute,
  freelancerBrowseJobsRoute,
  freelancerJobDetailRoute,
  freelancerContractsRoute,
  freelancerContractDetailRoute,
  freelancerWalletRoute,
  adminDashboardRoute,
  adminUsersRoute,
  adminJobsRoute,
  adminPaymentsRoute,
  adminDisputesRoute,
])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function App() {
  return <RouterProvider router={router} />
}
