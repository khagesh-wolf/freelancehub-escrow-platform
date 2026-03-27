import { Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { blink } from '../../blink/client'

export function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center pt-16">
      <div className="animate-fade-in w-full max-w-md mx-auto px-4">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg gradient-amber flex items-center justify-center">
              <Briefcase size={16} className="text-white" />
            </div>
            <span className="font-bold text-lg text-foreground">FreelanceHub</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Sign in</h1>
          <p className="text-muted-foreground text-sm mb-8">
            Welcome back — sign in to your account
          </p>
          <Button
            className="w-full gradient-amber border-0 text-white hover:opacity-90 h-11"
            onClick={() => blink.auth.login()}
          >
            Continue with FreelanceHub
          </Button>
          <p className="text-muted-foreground text-xs text-center mt-4">
            Don't have an account?{' '}
            <button
              className="text-accent hover:underline"
              onClick={() => blink.auth.login()}
            >
              Sign up free
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
