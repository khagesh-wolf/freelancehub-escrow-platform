import { useState, useEffect } from 'react'
import { blink, tables } from '../blink/client'
import type { UserProfile } from '../types'

export interface AuthState {
  user: any | null
  profile: UserProfile | null
  isLoading: boolean
  isAuthenticated: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    isLoading: true,
    isAuthenticated: false,
  })

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged(async (authState) => {
      if (!authState.isLoading) {
        if (authState.user) {
          try {
            const profiles = await tables.userProfiles.list({
              where: { userId: authState.user.id },
              limit: 1,
            })
            const profile = profiles[0] as UserProfile | undefined
            setState({
              user: authState.user,
              profile: profile || null,
              isLoading: false,
              isAuthenticated: true,
            })
          } catch {
            setState({
              user: authState.user,
              profile: null,
              isLoading: false,
              isAuthenticated: true,
            })
          }
        } else {
          setState({ user: null, profile: null, isLoading: false, isAuthenticated: false })
        }
      }
    })
    return unsubscribe
  }, [])

  const refreshProfile = async () => {
    if (!state.user) return
    try {
      const profiles = await tables.userProfiles.list({
        where: { userId: state.user.id },
        limit: 1,
      })
      const profile = profiles[0] as UserProfile | undefined
      setState(prev => ({ ...prev, profile: profile || null }))
    } catch {
      // silently fail
    }
  }

  return { ...state, refreshProfile }
}
