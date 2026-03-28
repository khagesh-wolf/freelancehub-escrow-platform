import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  FileText,
  AlertCircle,
  CreditCard,
  ArrowDownToLine,
  Shield,
  Menu,
  X,
  LogOut,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { blink } from '@/blink/client'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/admin', icon: <LayoutDashboard size={18} /> },
  { label: 'Users', path: '/admin/users', icon: <Users size={18} /> },
  { label: 'Jobs', path: '/admin/jobs', icon: <Briefcase size={18} /> },
  { label: 'Contracts', path: '/admin/contracts', icon: <FileText size={18} /> },
  { label: 'Disputes', path: '/admin/disputes', icon: <AlertCircle size={18} /> },
  { label: 'Payments', path: '/admin/payments', icon: <CreditCard size={18} /> },
  { label: 'Withdrawals', path: '/admin/withdrawals', icon: <ArrowDownToLine size={18} /> },
]

interface AdminLayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
}

export function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  const { user, profile, isLoading } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/admin'

  useEffect(() => {
    if (!isLoading && (!user || profile?.role !== 'admin')) {
      navigate({ to: '/' })
    }
  }, [isLoading, user, profile])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[hsl(215,42%,12%)]">
        <div className="text-center">
          <div className="w-10 h-10 border-[3px] border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[hsl(210,40%,70%)]">Loading admin panel…</p>
        </div>
      </div>
    )
  }

  if (!user || profile?.role !== 'admin') return null

  const handleLogout = async () => {
    await blink.auth.signOut()
    navigate({ to: '/' })
  }

  const isActive = (path: string) => {
    if (path === '/admin') return currentPath === '/admin'
    return currentPath.startsWith(path)
  }

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-[hsl(215,42%,12%)] border-r border-[hsl(215,28%,18%)]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[hsl(215,28%,18%)]">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500">
          <Shield size={18} className="text-[hsl(215,42%,12%)]" />
        </div>
        <div>
          <p className="font-bold text-[hsl(210,40%,95%)] text-sm leading-tight">FreelanceHub</p>
          <p className="text-[10px] text-amber-400 font-semibold tracking-widest uppercase">Admin Panel</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => {
              navigate({ to: item.path as any })
              setSidebarOpen(false)
            }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
              isActive(item.path)
                ? 'bg-[hsl(215,30%,20%)] text-amber-400'
                : 'text-[hsl(210,40%,70%)] hover:bg-[hsl(215,30%,18%)] hover:text-[hsl(210,40%,90%)]'
            )}
          >
            <span className={cn(
              'transition-colors',
              isActive(item.path) ? 'text-amber-400' : 'text-[hsl(210,40%,55%)] group-hover:text-[hsl(210,40%,80%)]'
            )}>
              {item.icon}
            </span>
            <span className="flex-1 text-left">{item.label}</span>
            {isActive(item.path) && (
              <ChevronRight size={14} className="text-amber-400 opacity-60" />
            )}
          </button>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-[hsl(215,28%,18%)]">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg mb-1">
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-[hsl(215,42%,12%)]">
              {profile?.displayName?.[0]?.toUpperCase() ?? 'A'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[hsl(210,40%,90%)] text-xs font-semibold truncate">
              {profile?.displayName ?? 'Admin'}
            </p>
            <p className="text-[hsl(210,40%,55%)] text-[10px] truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[hsl(210,40%,60%)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(210,40%,97%)]">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-60 flex-shrink-0 flex-col">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-64 flex flex-col">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="flex-shrink-0 flex items-center gap-4 px-6 py-4 bg-white border-b border-[hsl(214,32%,91%)] shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-lg text-[hsl(215,16%,47%)] hover:bg-[hsl(210,40%,96%)] transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1 min-w-0">
            {title && (
              <h1 className="text-lg font-bold text-[hsl(215,28%,17%)] leading-tight truncate">{title}</h1>
            )}
            {subtitle && (
              <p className="text-xs text-[hsl(215,16%,47%)] mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-medium text-amber-700">Admin</span>
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
