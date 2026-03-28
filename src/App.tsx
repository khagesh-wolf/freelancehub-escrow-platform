import {
  createRouter,
  createRoute,
  createRootRoute,
  RouterProvider,
  Outlet,
  useNavigate,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { useAuth } from './hooks/useAuth'
import { Navbar } from './components/layout/Navbar'

// Pages — Auth
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'

// Pages — Shared
import { OnboardingPage } from './pages/OnboardingPage'
import { MessagesPage } from './pages/MessagesPage'
import { WalletPage } from './pages/WalletPage'
import { PortfolioPage } from './pages/PortfolioPage'
import { SettingsPage } from './pages/SettingsPage'

// Pages — Freelancer
import { FreelancerDashboard } from './pages/freelancer/FreelancerDashboard'
import { FreelancerBrowseJobs } from './pages/freelancer/FreelancerBrowseJobs'
import { FreelancerContracts } from './pages/freelancer/FreelancerContracts'
import { FreelancerContractDetail } from './pages/freelancer/FreelancerContractDetail'
import { FreelancerProfileSetup } from './pages/freelancer/FreelancerProfileSetup'

// Pages — Client
import { ClientDashboard } from './pages/client/ClientDashboard'
import { PostJobPage } from './pages/client/PostJobPage'
import { ClientProjectsPage } from './pages/client/ClientProjectsPage'
import { ClientContractDetailPage } from './pages/client/ClientContractDetailPage'

// Pages — Public Browse
import { BrowseFreelancersPage } from './pages/BrowseFreelancersPage'
import { BrowseJobsPage } from './pages/BrowseJobsPage'
import { JobDetailPage } from './pages/JobDetailPage'
import { FreelancerPublicProfilePage } from './pages/FreelancerPublicProfilePage'

// Pages — Admin
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { AdminUsers } from './pages/admin/AdminUsers'
import { AdminJobs } from './pages/admin/AdminJobs'
import { AdminDisputes } from './pages/admin/AdminDisputes'
import { AdminPayments } from './pages/admin/AdminPayments'
import { AdminWithdrawals } from './pages/admin/AdminWithdrawals'

// ─── Loading screen ─────────────────────────────────────────────────────────
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

// ─── Root layout ─────────────────────────────────────────────────────────────
function RootLayout() {
  const { user, profile, isLoading } = useAuth()
  const navigate = useNavigate()
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'
  const isAdminRoute = pathname.startsWith('/admin')
  const isAuthRoute = pathname.startsWith('/auth')

  useEffect(() => {
    if (isLoading) return
    if (user && !profile && !isAuthRoute && pathname !== '/auth/register') {
      navigate({ to: '/auth/register' })
      return
    }
    if (user && profile?.role === 'admin' && !isAdminRoute && pathname === '/') {
      navigate({ to: '/admin' })
      return
    }
    if (user && profile?.role === 'client' && pathname === '/') {
      navigate({ to: '/client/dashboard' })
      return
    }
    if (user && profile?.role === 'freelancer' && pathname === '/') {
      navigate({ to: '/freelancer/dashboard' })
      return
    }
  }, [isLoading, user, profile, pathname])

  if (isLoading) return <LoadingScreen />
  if (isAdminRoute) return <><Outlet /><Toaster position="top-right" /></>

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} profile={profile} />
      <Outlet />
      <Toaster position="top-right" />
    </div>
  )
}

// ─── Placeholder pages (stubs for routes that will be built later) ─────────
function StubPage({ title }: { title: string }) {
  return (
    <div className="page-container">
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
          <p className="text-muted-foreground">This page is coming soon.</p>
        </div>
      </div>
    </div>
  )
}

// ─── Route definitions ─────────────────────────────────────────────────────
const rootRoute = createRootRoute({ component: RootLayout })

// Public routes
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: LandingPage })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/auth/login', component: LoginPage })
const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: '/auth/register', component: RegisterPage })

// Browse routes (public)
const browseRoute = createRoute({ getParentRoute: () => rootRoute, path: '/browse', component: BrowseFreelancersPage })
const jobsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/jobs', component: BrowseJobsPage })
const freelancerPublicRoute = createRoute({ getParentRoute: () => rootRoute, path: '/freelancer/$userId', component: FreelancerPublicProfilePage })
const jobDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: '/jobs/$jobId', component: JobDetailPage })

// Unified routes
const postJobRoute2 = createRoute({ getParentRoute: () => rootRoute, path: '/post-job', component: () => <StubPage title="Post a Job" /> })
const myJobsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/my-jobs', component: () => <StubPage title="My Jobs" /> })
const proposalsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/proposals', component: () => <StubPage title="My Proposals" /> })
const contractsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/contracts', component: () => <StubPage title="Contracts" /> })
const contractDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: '/contracts/$contractId', component: () => <StubPage title="Contract Detail" /> })
const walletRoute = createRoute({ getParentRoute: () => rootRoute, path: '/wallet', component: WalletPage })
const paymentsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/payments', component: () => <StubPage title="Payments" /> })
const portfolioRoute = createRoute({ getParentRoute: () => rootRoute, path: '/portfolio', component: PortfolioPage })
const messagesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/messages', component: MessagesPage })
const messagesContractRoute = createRoute({ getParentRoute: () => rootRoute, path: '/messages/$contractId', component: MessagesPage })
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: SettingsPage })

// Client routes
const clientDashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/client/dashboard', component: ClientDashboard })
const clientProjectsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/client/projects', component: ClientProjectsPage })
const clientProjectDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: '/client/projects/$contractId', component: ClientContractDetailPage })
const postJobRoute = createRoute({ getParentRoute: () => rootRoute, path: '/client/post-job', component: PostJobPage })
const clientProfileRoute = createRoute({ getParentRoute: () => rootRoute, path: '/client/profile', component: () => <StubPage title="My Profile" /> })
const contractPaymentRoute = createRoute({ getParentRoute: () => rootRoute, path: '/client/payment/$contractId', component: () => <StubPage title="Contract Payment" /> })

// Onboarding route
const onboardingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/onboarding', component: OnboardingPage })

// Freelancer routes
const freelancerDashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/freelancer/dashboard', component: FreelancerDashboard })
const freelancerProfileSetupRoute = createRoute({ getParentRoute: () => rootRoute, path: '/freelancer/profile/setup', component: FreelancerProfileSetup })
const freelancerProfileRoute = createRoute({ getParentRoute: () => rootRoute, path: '/freelancer/profile', component: FreelancerProfileSetup })
const freelancerBrowseJobsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/freelancer/jobs', component: FreelancerBrowseJobs })
const freelancerJobDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: '/freelancer/jobs/$jobId', component: () => <StubPage title="Job Details" /> })
const freelancerContractsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/freelancer/contracts', component: FreelancerContracts })
const freelancerContractDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: '/freelancer/contracts/$contractId', component: FreelancerContractDetail })
const freelancerWalletRoute = createRoute({ getParentRoute: () => rootRoute, path: '/freelancer/wallet', component: WalletPage })

// Admin routes
const adminDashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin', component: AdminDashboard })
const adminUsersRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/users', component: AdminUsers })
const adminJobsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/jobs', component: AdminJobs })
const adminContractsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/contracts', component: AdminPayments })
const adminPaymentsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/payments', component: AdminPayments })
const adminDisputesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/disputes', component: AdminDisputes })
const adminWithdrawalsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/withdrawals', component: AdminWithdrawals })

// ─── Route tree ──────────────────────────────────────────────────────────────
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  onboardingRoute,
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
  adminContractsRoute,
  adminPaymentsRoute,
  adminDisputesRoute,
  adminWithdrawalsRoute,
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