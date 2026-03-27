import { useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  Briefcase, LayoutDashboard, Search, FileText, MessageSquare,
  Bell, Wallet, Settings, LogOut, Menu, Users,
  CreditCard, BarChart3, AlertTriangle, Star, Plus,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { blink } from '../../blink/client'
import { useAuth } from '../../hooks/useAuth'
import { useNotifications } from '../../hooks/useNotifications'
import { getInitials } from '../../lib/utils'
import type { UserRole } from '../../types'

function getNavItems(role: UserRole) {
  const common = [
    { label: 'Messages', href: '/messages', icon: MessageSquare },
    { label: 'Settings', href: '/settings', icon: Settings },
  ]

  if (role === 'admin') {
    return [
      { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
      { label: 'Users', href: '/admin/users', icon: Users },
      { label: 'Jobs', href: '/admin/jobs', icon: Briefcase },
      { label: 'Contracts', href: '/admin/contracts', icon: FileText },
      { label: 'Payments', href: '/admin/payments', icon: CreditCard },
      { label: 'Disputes', href: '/admin/disputes', icon: AlertTriangle },
      { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
      ...common,
    ]
  }

  if (role === 'freelancer') {
    return [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Browse Jobs', href: '/jobs', icon: Search },
      { label: 'My Proposals', href: '/proposals', icon: FileText },
      { label: 'My Contracts', href: '/contracts', icon: Briefcase },
      { label: 'Portfolio', href: '/portfolio', icon: Star },
      { label: 'Earnings', href: '/wallet', icon: Wallet },
      ...common,
    ]
  }

  // client
  return [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Find Talent', href: '/browse', icon: Search },
    { label: 'Post a Job', href: '/jobs/new', icon: Plus },
    { label: 'My Jobs', href: '/my-jobs', icon: Briefcase },
    { label: 'Contracts', href: '/contracts', icon: FileText },
    { label: 'Payments', href: '/payments', icon: CreditCard },
    ...common,
  ]
}

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, profile } = useAuth()
  const { unreadCount, notifications, markRead } = useNotifications(user?.id)
  const [notifOpen, setNotifOpen] = useState(false)
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  const role = profile?.role ?? 'client'
  const navItems = getNavItems(role)

  const roleBadgeClass =
    role === 'admin'
      ? 'badge-admin'
      : role === 'freelancer'
        ? 'badge-freelancer'
        : 'badge-client'

  function SidebarContent() {
    return (
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-sidebar-border shrink-0">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-amber flex items-center justify-center shrink-0">
              <Briefcase size={16} className="text-white" />
            </div>
            <span className="font-bold text-white text-lg">FreelanceHub</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
          {navItems.map(({ label, href, icon: Icon }) => {
            const isActive =
              currentPath === href ||
              (href !== '/' && currentPath.startsWith(href))
            return (
              <Link
                key={href}
                to={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-white'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div className="shrink-0 p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={profile?.avatarUrl} />
              <AvatarFallback className="bg-sidebar-accent text-white text-sm">
                {getInitials(profile?.displayName || user?.email || 'U')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {profile?.displayName || 'User'}
              </p>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${roleBadgeClass}`}>
                {role}
              </span>
            </div>
          </div>
          <button
            onClick={() => blink.auth.logout()}
            className="flex items-center gap-2 text-sidebar-foreground hover:text-white text-sm w-full py-1.5 transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-sidebar shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-64 bg-sidebar flex flex-col z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        {/* Top header */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0">
          <button
            className="lg:hidden p-1.5 rounded-lg hover:bg-muted"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="flex-1 lg:flex-none" />

          {/* Header right */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <Bell size={20} className="text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full gradient-amber text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <>
                  {/* backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setNotifOpen(false)}
                  />
                  <div className="absolute right-0 top-12 w-80 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <span className="font-semibold text-sm">Notifications</span>
                      {unreadCount > 0 && (
                        <button className="text-xs text-primary hover:underline">
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground text-sm">
                          No notifications yet
                        </div>
                      ) : (
                        notifications.slice(0, 10).map(n => (
                          <div
                            key={n.id}
                            onClick={() => markRead(n.id)}
                            className={`px-4 py-3 border-b border-border cursor-pointer hover:bg-muted transition-colors ${
                              n.isRead === '0' ? 'bg-accent/5' : ''
                            }`}
                          >
                            <p className="text-sm font-medium">{n.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarImage src={profile?.avatarUrl} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {getInitials(profile?.displayName || user?.email || 'U')}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
