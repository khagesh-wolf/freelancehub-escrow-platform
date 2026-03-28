import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Briefcase, LogOut, ChevronDown, Menu, X, Settings, MessageSquare, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { blink } from '@/blink/client'
import { getInitials } from '@/lib/utils'
import type { UserProfile } from '@/types'

interface NavbarProps {
  user: any | null
  profile: UserProfile | null
}

export function Navbar({ user, profile }: NavbarProps) {
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const handleLogout = async () => {
    await blink.auth.signOut()
    navigate({ to: '/' })
  }

  const navLinks = profile?.role === 'client' ? [
    { label: 'Browse Freelancers', href: '/browse' },
    { label: 'Post a Job', href: '/post-job' },
    { label: 'My Jobs', href: '/my-jobs' },
    { label: 'Contracts', href: '/contracts' },
  ] : profile?.role === 'freelancer' ? [
    { label: 'Find Jobs', href: '/jobs' },
    { label: 'My Proposals', href: '/proposals' },
    { label: 'Contracts', href: '/contracts' },
    { label: 'Wallet', href: '/wallet' },
  ] : profile?.role === 'admin' ? [
    { label: 'Admin Panel', href: '/admin' },
  ] : [
    { label: 'Browse Freelancers', href: '/browse' },
    { label: 'Find Jobs', href: '/jobs' },
  ]

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-amber flex items-center justify-center">
              <Briefcase size={16} className="text-white" />
            </div>
            <span className="font-bold text-lg text-foreground">FreelanceHub</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                to={link.href}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-md transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <>
                <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/messages' })}>
                  <MessageSquare size={18} />
                </Button>
                <div className="relative">
                  <button
                    className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-secondary/50 transition-colors"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={profile?.avatarUrl} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {getInitials(profile?.displayName || user.email || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground">{profile?.displayName || 'User'}</span>
                    <ChevronDown size={14} className="text-muted-foreground" />
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-background border border-border rounded-lg shadow-lg py-1 z-50">
                      <button
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-foreground hover:bg-secondary/50"
                        onClick={() => { navigate({ to: '/settings' }); setUserMenuOpen(false) }}
                      >
                        <Settings size={14} /> Settings
                      </button>
                      {profile?.role === 'freelancer' && (
                        <button
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-foreground hover:bg-secondary/50"
                          onClick={() => { navigate({ to: '/wallet' }); setUserMenuOpen(false) }}
                        >
                          <Wallet size={14} /> Wallet
                        </button>
                      )}
                      <hr className="my-1 border-border" />
                      <button
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
                        onClick={handleLogout}
                      >
                        <LogOut size={14} /> Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => blink.auth.login()}>Sign In</Button>
                <Button size="sm" className="gradient-amber border-0 text-white hover:opacity-90" onClick={() => blink.auth.login()}>Get Started</Button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden p-2 rounded-md hover:bg-secondary/50" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden py-4 border-t border-border space-y-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                to={link.href}
                className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-md"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive" onClick={handleLogout}>
                <LogOut size={14} /> Sign Out
              </button>
            ) : (
              <Button className="w-full mt-2 gradient-amber border-0 text-white" onClick={() => blink.auth.login()}>
                Get Started
              </Button>
            )}
          </div>
        )}
      </div>
      {userMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />}
    </nav>
  )
}
