import { Link, useNavigate } from '@tanstack/react-router'
import { Briefcase, Menu, X, LayoutDashboard, Wallet, FileText, LogOut, User } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { blink } from '../../blink/client'
import type { UserProfile } from '../../types'

interface NavbarProps {
  user?: any | null
  profile?: UserProfile | null
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getDashboardLink(role?: string) {
  if (role === 'client') return '/client/dashboard'
  if (role === 'freelancer') return '/freelancer/dashboard'
  if (role === 'admin') return '/admin'
  return '/'
}

export function Navbar({ user, profile }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const isAuthenticated = !!user

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-foreground/95 backdrop-blur border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-amber flex items-center justify-center">
              <Briefcase size={18} className="text-white" />
            </div>
            <span className="font-bold text-xl text-white">FreelanceHub</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/browse" className="text-white/70 hover:text-white text-sm transition-colors">
              Find Talent
            </Link>
            <Link to="/jobs" className="text-white/70 hover:text-white text-sm transition-colors">
              Browse Jobs
            </Link>
            {!isAuthenticated && (
              <a href="/#how-it-works" className="text-white/70 hover:text-white text-sm transition-colors">
                How it Works
              </a>
            )}
          </div>

          {/* Auth buttons / user menu */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated && profile ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-white/30">
                    <Avatar className="w-8 h-8">
                      {profile.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt={profile.displayName} /> : null}
                      <AvatarFallback className="bg-accent text-white text-xs">
                        {getInitials(profile.displayName || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-white text-sm font-medium">{profile.displayName}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="text-xs text-muted-foreground capitalize">
                    {profile.role}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => navigate({ to: getDashboardLink(profile.role) as any })}
                  >
                    <LayoutDashboard size={14} /> Dashboard
                  </DropdownMenuItem>
                  {profile.role === 'client' && (
                    <DropdownMenuItem
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={() => navigate({ to: '/client/profile' })}
                    >
                      <User size={14} /> Profile
                    </DropdownMenuItem>
                  )}
                  {profile.role === 'freelancer' && (
                    <>
                      <DropdownMenuItem
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => navigate({ to: '/freelancer/profile' })}
                      >
                        <User size={14} /> Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => navigate({ to: '/freelancer/wallet' })}
                      >
                        <Wallet size={14} /> Wallet
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => navigate({ to: '/messages' })}
                  >
                    <FileText size={14} /> Messages
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive cursor-pointer flex items-center gap-2"
                    onClick={() => blink.auth.logout()}
                  >
                    <LogOut size={14} /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : isAuthenticated && !profile ? (
              <Button
                variant="ghost"
                className="text-white/80 hover:text-white hover:bg-white/10"
                onClick={() => blink.auth.logout()}
              >
                Sign Out
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="text-white/80 hover:text-white hover:bg-white/10"
                  onClick={() => blink.auth.login()}
                >
                  Sign In
                </Button>
                <Button
                  className="gradient-amber border-0 text-white hover:opacity-90"
                  onClick={() => blink.auth.login()}
                >
                  Get Started
                </Button>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-white p-1"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-foreground border-t border-white/10 px-4 py-4 space-y-3">
          <Link
            to="/browse"
            className="block text-white/70 hover:text-white py-2"
            onClick={() => setMobileOpen(false)}
          >
            Find Talent
          </Link>
          <Link
            to="/jobs"
            className="block text-white/70 hover:text-white py-2"
            onClick={() => setMobileOpen(false)}
          >
            Browse Jobs
          </Link>
          {isAuthenticated && profile ? (
            <>
              <Link
                to={getDashboardLink(profile.role) as any}
                className="block text-white/70 hover:text-white py-2"
                onClick={() => setMobileOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                to="/messages"
                className="block text-white/70 hover:text-white py-2"
                onClick={() => setMobileOpen(false)}
              >
                Messages
              </Link>
              <Button
                variant="ghost"
                className="w-full text-white/80 hover:text-white hover:bg-white/10 justify-start"
                onClick={() => { blink.auth.logout(); setMobileOpen(false) }}
              >
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <a
                href="/#how-it-works"
                className="block text-white/70 hover:text-white py-2"
                onClick={() => setMobileOpen(false)}
              >
                How it Works
              </a>
              <Button
                className="w-full gradient-amber border-0 text-white mt-2"
                onClick={() => blink.auth.login()}
              >
                Get Started
              </Button>
            </>
          )}
        </div>
      )}
    </nav>
  )
}