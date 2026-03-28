import { Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { blink } from '@/blink/client'

export function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl gradient-amber mb-4">
            <Briefcase size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="text-muted-foreground mt-1">Sign in to your FreelanceHub account</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-8">
          <Button
            className="w-full gradient-amber border-0 text-white hover:opacity-90 h-12 text-base"
            onClick={() => blink.auth.login()}
          >
            Sign In with FreelanceHub
          </Button>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Don't have an account?{' '}
            <button className="text-primary hover:underline font-medium" onClick={() => blink.auth.login()}>
              Sign up free
            </button>
          </p>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
