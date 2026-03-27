import { useState } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Star, MapPin, Globe, Calendar, Briefcase, Award, MessageSquare, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { blink, tables } from '../blink/client'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency, formatDate, getInitials, parseJsonArray } from '../lib/utils'
import { StatusBadge } from '../components/ui/StatusBadge'
import type { FreelancerProfile, UserProfile, PortfolioItem, Review } from '../types'
import toast from 'react-hot-toast'

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={14} className={i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'} />
      ))}
    </div>
  )
}

export function FreelancerProfilePage() {
  const { userId } = useParams({ from: '/freelancer/$userId' })
  const { user, profile, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [proposalMsg, setProposalMsg] = useState('')
  const [budget, setBudget] = useState('')
  const [days, setDays] = useState('')

  const { data: userProfileArr } = useQuery({
    queryKey: ['userProfile', userId],
    queryFn: () => tables.userProfiles.list({ where: { userId }, limit: 1 }),
  })
  const up = (userProfileArr as UserProfile[] | undefined)?.[0]

  const { data: fpArr } = useQuery({
    queryKey: ['freelancerProfile', userId],
    queryFn: () => tables.freelancerProfiles.list({ where: { userId }, limit: 1 }),
  })
  const fp = (fpArr as FreelancerProfile[] | undefined)?.[0]

  const { data: portfolio = [] } = useQuery({
    queryKey: ['portfolio', userId],
    queryFn: () => tables.portfolioItems.list({ where: { userId }, limit: 20 }),
  })

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', userId],
    queryFn: () => tables.reviews.list({ where: { freelancerId: userId }, limit: 20 }),
  })

  const sendProposal = useMutation({
    mutationFn: async () => {
      if (!user || !budget || !proposalMsg) throw new Error('Fill all fields')
      // For direct hire, navigate to post job
      navigate({ to: '/client/post-job' })
    },
    onSuccess: () => toast.success('Redirecting to post a job...'),
    onError: (e: Error) => toast.error(e.message),
  })

  if (!up || !fp) {
    return (
      <div className="page-container pt-24">
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  const skills = parseJsonArray(fp.skills)
  const categories = parseJsonArray(fp.categories)
  const isClient = profile?.role === 'client'
  const avgRating = fp.rating || 0

  return (
    <div className="page-container pt-24 animate-fade-in">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Hero card */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="gradient-hero h-28" />
            <div className="px-6 pb-6">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10 mb-5">
                <Avatar className="w-20 h-20 border-4 border-card shrink-0">
                  <AvatarImage src={up.avatarUrl} />
                  <AvatarFallback className="text-xl font-bold gradient-hero text-white">
                    {getInitials(up.displayName || 'F')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 pt-2 sm:pt-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold text-foreground">{up.displayName}</h1>
                    <StatusBadge status={fp.availability} />
                  </div>
                  <p className="text-muted-foreground">{fp.title}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-5 text-sm">
                {up.location && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin size={14} /> {up.location}
                  </span>
                )}
                {up.website && (
                  <a href={up.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-accent hover:underline">
                    <Globe size={14} /> {up.website}
                  </a>
                )}
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar size={14} /> Member since {formatDate(up.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* About */}
          {up.bio && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold text-lg mb-3">About</h2>
              <p className="text-muted-foreground leading-relaxed">{up.bio}</p>
            </div>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold text-lg mb-3">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {skills.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}
              </div>
            </div>
          )}

          {/* Categories */}
          {categories.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold text-lg mb-3">Categories</h2>
              <div className="flex flex-wrap gap-2">
                {categories.map(c => <Badge key={c} className="badge-freelancer">{c}</Badge>)}
              </div>
            </div>
          )}

          {/* Portfolio */}
          {(portfolio as PortfolioItem[]).length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold text-lg mb-4">Portfolio</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {(portfolio as PortfolioItem[]).map(item => {
                  const tags = parseJsonArray(item.tags)
                  return (
                    <div key={item.id} className="border border-border rounded-lg overflow-hidden">
                      <div className="h-36 bg-muted flex items-center justify-center overflow-hidden">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-4xl font-black text-muted-foreground/30">
                            {item.title?.[0]?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-sm">{item.title}</p>
                          {item.projectUrl && (
                            <a href={item.projectUrl} target="_blank" rel="noreferrer">
                              <ExternalLink size={14} className="text-muted-foreground hover:text-accent" />
                            </a>
                          )}
                        </div>
                        {item.description && <p className="text-xs text-muted-foreground mb-2">{item.description}</p>}
                        <div className="flex flex-wrap gap-1">
                          {tags.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Reviews */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold text-lg mb-4">Reviews ({(reviews as Review[]).length})</h2>
            {(reviews as Review[]).length === 0 ? (
              <p className="text-muted-foreground text-sm">No reviews yet.</p>
            ) : (
              <div className="space-y-5">
                {(reviews as Review[]).map(r => (
                  <div key={r.id} className="border-b border-border last:border-0 pb-5 last:pb-0">
                    <div className="flex items-center gap-2 mb-2">
                      <StarRow rating={r.rating} />
                      <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Rate + CTA */}
          <div className="bg-card border border-border rounded-xl p-6 sticky top-24">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(fp.hourlyRate || 0)}</p>
                <p className="text-xs text-muted-foreground">per hour</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  <Star size={16} className="text-amber-400 fill-amber-400" />
                  <span className="font-semibold">{avgRating.toFixed(1)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{fp.totalReviews || 0} reviews</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="text-center p-3 bg-muted rounded-lg">
                <Briefcase size={16} className="mx-auto mb-1 text-accent" />
                <p className="text-sm font-bold">{fp.completedJobs || 0}</p>
                <p className="text-xs text-muted-foreground">Jobs</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <Award size={16} className="mx-auto mb-1 text-accent" />
                <p className="text-sm font-bold">{fp.experienceYears || 0}y</p>
                <p className="text-xs text-muted-foreground">Exp.</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <Star size={16} className="mx-auto mb-1 text-accent" />
                <p className="text-sm font-bold">{fp.totalReviews || 0}</p>
                <p className="text-xs text-muted-foreground">Reviews</p>
              </div>
            </div>

            {!isAuthenticated ? (
              <Button className="w-full gradient-amber border-0 text-white hover:opacity-90" onClick={() => blink.auth.login()}>
                Sign In to Hire
              </Button>
            ) : isClient ? (
              <div className="space-y-3">
                <Input placeholder="Budget (USD)" type="number" value={budget} onChange={e => setBudget(e.target.value)} />
                <Input placeholder="Estimated days" type="number" value={days} onChange={e => setDays(e.target.value)} />
                <Textarea placeholder="Describe your project..." value={proposalMsg} onChange={e => setProposalMsg(e.target.value)} rows={3} />
                <Button
                  className="w-full gradient-amber border-0 text-white hover:opacity-90"
                  onClick={() => sendProposal.mutate()}
                >
                  <MessageSquare size={16} className="mr-2" /> Hire Me
                </Button>
              </div>
            ) : profile?.userId === userId ? null : (
              <p className="text-sm text-muted-foreground text-center">Switch to a client account to hire.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
