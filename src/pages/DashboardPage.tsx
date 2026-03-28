import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/hooks/useAuth'

export function DashboardPage() {
  const { profile, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoading) return
    if (profile?.role === 'client') navigate({ to: '/client/dashboard' })
    else if (profile?.role === 'freelancer') navigate({ to: '/freelancer/dashboard' })
    else if (profile?.role === 'admin') navigate({ to: '/admin' })
    else navigate({ to: '/' })
  }, [profile, isLoading])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
