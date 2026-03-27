import { Link, useNavigate } from '@tanstack/react-router'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CreditCard,
  AlertTriangle,
  LogOut,
  Shield,
} from 'lucide-react'
import { blink } from '../../blink/client'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  active: string
}

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/disputes', label: 'Disputes', icon: AlertTriangle },
]

export function AdminLayout({ children, active }: Props) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await blink.auth.signOut()
    navigate({ to: '/' })
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'hsl(210 40% 98%)' }}>
      {/* Sidebar */}
      <aside
        className="w-64 h-screen flex flex-col flex-shrink-0 border-r"
        style={{ background: 'hsl(222, 47%, 11%)', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        {/* Logo */}
        <div
          className="h-16 flex items-center px-6 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="w-8 h-8 rounded-lg gradient-amber flex items-center justify-center mr-2.5 flex-shrink-0">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-white text-sm leading-none block">Admin Panel</span>
            <span className="text-xs leading-none mt-0.5 block" style={{ color: 'rgba(255,255,255,0.4)' }}>
              FreelanceHub
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const isActive = active === item.href
            return (
              <Link
                key={item.href}
                to={item.href as any}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                style={{
                  color: isActive ? '#ffffff' : 'rgba(255,255,255,0.55)',
                  background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                }}
              >
                <item.icon size={17} style={{ flexShrink: 0 }} />
                {item.label}
                {isActive && (
                  <div
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ background: 'hsl(38 92% 50%)' }}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div
          className="p-3 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-medium transition-all duration-150 hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            <LogOut size={17} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  )
}
