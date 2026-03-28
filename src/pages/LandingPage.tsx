import { ArrowRight, Shield, DollarSign, Star, Users, Briefcase, CheckCircle, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { blink } from '../blink/client'

const stats = [
  { label: 'Active Freelancers', value: '10,000+' },
  { label: 'Projects Completed', value: '50,000+' },
  { label: 'Client Satisfaction', value: '98%' },
  { label: 'Avg. Project Value', value: '$2,400' },
]

const categories = [
  { name: 'Web Development', icon: '💻', count: '2,400 freelancers' },
  { name: 'UI/UX Design', icon: '🎨', count: '1,800 freelancers' },
  { name: 'Mobile Apps', icon: '📱', count: '1,200 freelancers' },
  { name: 'Content Writing', icon: '✍️', count: '3,100 freelancers' },
  { name: 'Digital Marketing', icon: '📢', count: '890 freelancers' },
  { name: 'Data Science', icon: '📊', count: '650 freelancers' },
  { name: 'Video & Animation', icon: '🎬', count: '740 freelancers' },
  { name: 'DevOps & Cloud', icon: '☁️', count: '420 freelancers' },
]

const steps = [
  { step: '01', title: 'Post Your Project', desc: 'Describe your project and budget. Get proposals from skilled freelancers within hours.', icon: Briefcase },
  { step: '02', title: 'Hire with Confidence', desc: 'Review proposals, check portfolios, and hire the best fit. Funds held securely in escrow.', icon: Shield },
  { step: '03', title: 'Work & Collaborate', desc: 'Communicate directly, track progress, review deliverables with full transparency.', icon: Users },
  { step: '04', title: 'Pay When Satisfied', desc: 'Approve the work. Admin releases payment to the freelancer. Zero risk for both parties.', icon: CheckCircle },
]

const trustFeatures = [
  { icon: Shield, title: 'Escrow Payment Protection', desc: 'Your payment is held securely until you approve the work. Zero risk of losing money.' },
  { icon: Star, title: 'Verified Freelancer Profiles', desc: 'All freelancers are reviewed. View portfolios, ratings, and work history before hiring.' },
  { icon: Users, title: 'Dedicated Support', desc: 'Our admin team resolves disputes fairly and ensures smooth project completion.' },
  { icon: DollarSign, title: 'Transparent Pricing', desc: 'No hidden fees. 10% platform commission only on successful project completion.' },
]

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="gradient-hero min-h-screen flex items-center pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-sm mb-6 border border-white/20">
              <Zap size={14} className="text-amber-400" />
              Trusted by 10,000+ businesses worldwide
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
              Hire Top Freelancers<br />
              <span className="text-amber-400">Pay When Satisfied</span>
            </h1>
            <p className="text-xl text-white/70 mb-10 max-w-2xl leading-relaxed">
              FreelanceHub connects you with world-class talent. Our escrow payment system ensures
              your money is safe until you're 100% happy with the work.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="gradient-amber border-0 text-white hover:opacity-90 text-base px-8 h-12" onClick={() => blink.auth.login()}>
                Start Hiring <ArrowRight size={18} className="ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 text-base px-8 h-12 bg-transparent" onClick={() => blink.auth.login()}>
                Become a Freelancer
              </Button>
            </div>
            <div className="mt-12 flex items-center gap-3 flex-wrap">
              <span className="text-white/50 text-sm">Popular:</span>
              {['React Developer', 'UI Designer', 'Content Writer', 'SEO Expert'].map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full bg-white/10 text-white/70 text-sm border border-white/20 cursor-pointer hover:bg-white/20 transition-colors"
                  onClick={() => blink.auth.login()}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-accent py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-3xl font-bold text-white">{value}</div>
                <div className="text-white/80 text-sm mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">How FreelanceHub Works</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Our escrow system protects both clients and freelancers, ensuring fair payment for quality work
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map(({ step, title, desc, icon: Icon }) => (
              <div key={step} className="relative">
                <div className="text-6xl font-black text-muted/50 mb-4 leading-none">{step}</div>
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-4">
                  <Icon size={22} className="text-primary-foreground" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-24 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">Browse Categories</h2>
            <p className="text-muted-foreground text-lg">Find experts in every field</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map(({ name, icon, count }) => (
              <div
                key={name}
                className="bg-card border border-border rounded-xl p-5 card-hover cursor-pointer"
                onClick={() => blink.auth.login()}
              >
                <div className="text-3xl mb-3">{icon}</div>
                <h3 className="font-semibold text-foreground mb-1">{name}</h3>
                <p className="text-muted-foreground text-xs">{count}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Trust Us */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-foreground mb-6">Why Clients Trust FreelanceHub</h2>
              <div className="space-y-5">
                {trustFeatures.map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex gap-4">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <Icon size={20} className="text-accent" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">{title}</h4>
                      <p className="text-muted-foreground text-sm">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-foreground mb-6">Ready to get started?</h3>
              <div className="space-y-3">
                <Button className="w-full gradient-amber border-0 text-white hover:opacity-90 h-12 text-base" onClick={() => blink.auth.login()}>
                  Hire a Freelancer <ArrowRight size={18} className="ml-2" />
                </Button>
                <Button variant="outline" className="w-full h-12 text-base" onClick={() => blink.auth.login()}>
                  Find Work as Freelancer
                </Button>
              </div>
              <p className="text-muted-foreground text-xs text-center mt-4">Free to join. No subscription required.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg gradient-amber flex items-center justify-center">
                <Briefcase size={14} className="text-white" />
              </div>
              <span className="font-bold text-lg">FreelanceHub</span>
            </div>
            <p className="text-white/50 text-sm">© 2025 FreelanceHub. Admin-controlled escrow marketplace.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
