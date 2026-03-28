import { useParams, useNavigate, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Star, MapPin, Clock, DollarSign, Briefcase, Globe,
  ChevronRight, ArrowLeft, Award, CheckCircle, ExternalLink,
  Users, MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { tables } from '../blink/client'
import { blink } from '../blink/client'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency, formatDate, getInitials, safeParseJSON } from '@/lib/utils'
import type { FreelancerProfile, UserProfile, PortfolioItem, Review } from '../types'

// ─── Star Rating (large) ──────────────────────────────────────────────────────
function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={
            i < Math.floor(rating)
              ? 'fill-amber-400 text-amber-400'
              : i < rating
              ? 'fill-amber-200 text-amber-200'
              : 'fill-muted text-muted-foreground'
          }
        />
      ))}
    </div>
  )
}

// ─── Skill Badges ─────────────────────────────────────────────────────────────
function SkillBadge({ skill }: { skill: string }) {
  return (
    <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm">
      {skill}
    </span>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function ProfileSkeleton() {
  return (
    <div className="page-container animate-pulse">
      <div className="h-4 bg-muted rounded w-48 mb-6" />
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="w-24 h-24 bg-muted rounded-full mx-auto mb-4" />
            <div className="h-6 bg-muted rounded w-3/4 mx-auto mb-2" />
            <div className="h-4 bg-muted rounded w-1/2 mx-auto mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-4 bg-muted rounded" />)}
            </div>
          </div>
        </div>
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 h-40" />
          <div className="bg-card border border-border rounded-xl p-6 h-32" />
        </div>
      </div>
    </div>
  )
}

// ─── Portfolio Item ───────────────────────────────────────────────────────────
function PortfolioCard({ item }: { item: PortfolioItem }) {
  const tags = safeParseJSON<string[]>(item.tags, [])
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden card-hover">
      {item.imageUrl && (
        <div className="aspect-video bg-muted overflow-hidden">
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-semibold text-foreground text-sm">{item.title}</h4>
          {item.projectUrl && (
            <a
              href={item.projectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-accent transition-colors shrink-0"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
        {item.description && (
          <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">
            {item.description}
          </p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Review Card ──────────────────────────────────────────────────────────────
function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <Avatar className="w-9 h-9">
            <AvatarImage src={review.reviewerAvatar} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {getInitials(review.reviewerName || 'C')}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-foreground">{review.reviewerName || 'Client'}</p>
            <p className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</p>
          </div>
        </div>
        <StarRating rating={Number(review.rating)} size={13} />
      </div>
      {review.comment && (
        <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function FreelancerPublicProfilePage() {
  const { userId } = useParams({ strict: false }) as { userId: string }
  const navigate = useNavigate()
  const { user, profile: authProfile } = useAuth()

  // Fetch user profile
  const { data: userProfile, isLoading: loadingUser } = useQuery({
    queryKey: ['userProfile', userId],
    queryFn: async () => {
      const profiles = await tables.userProfiles.list({ where: { userId }, limit: 1 })
      return (profiles[0] as UserProfile) || null
    },
    enabled: !!userId,
  })

  // Fetch freelancer profile
  const { data: freelancerProfile, isLoading: loadingFreelancer } = useQuery({
    queryKey: ['freelancerProfile', userId],
    queryFn: async () => {
      const profiles = await tables.freelancerProfiles.list({ where: { userId }, limit: 1 })
      return (profiles[0] as FreelancerProfile) || null
    },
    enabled: !!userId,
  })

  // Fetch portfolio
  const { data: portfolio = [] } = useQuery({
    queryKey: ['portfolio', userId],
    queryFn: async () => {
      return tables.portfolioItems.list({ where: { userId }, limit: 12 })
    },
    enabled: !!userId,
  })

  // Fetch reviews
  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', userId],
    queryFn: async () => {
      return tables.reviews.list({ where: { freelancerId: userId }, limit: 20 })
    },
    enabled: !!userId,
  })

  const isLoading = loadingUser || loadingFreelancer

  if (isLoading) return <ProfileSkeleton />

  if (!userProfile || !freelancerProfile) {
    return (
      <div className="page-container">
        <div className="text-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Users size={28} className="text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Profile not found</h2>
          <p className="text-muted-foreground text-sm mb-6">
            This freelancer profile doesn't exist or is no longer available.
          </p>
          <Button onClick={() => navigate({ to: '/browse' })}>
            <ArrowLeft size={14} /> Browse Freelancers
          </Button>
        </div>
      </div>
    )
  }

  const skills = safeParseJSON<string[]>(freelancerProfile.skills, [])
  const categories = safeParseJSON<string[]>(freelancerProfile.categories, [])

  const availabilityConfig = {
    available: { label: 'Available for work', color: 'text-emerald-600', bg: 'bg-emerald-100' },
    busy: { label: 'Currently busy', color: 'text-amber-600', bg: 'bg-amber-100' },
    unavailable: { label: 'Unavailable', color: 'text-red-600', bg: 'bg-red-100' },
  }[freelancerProfile.availability] || { label: 'Unknown', color: 'text-muted-foreground', bg: 'bg-muted' }

  const handleHireClick = () => {
    if (!user) {
      blink.auth.login()
      return
    }
    if (authProfile?.role === 'client') {
      navigate({ to: '/client/post-job' })
    } else {
      blink.auth.login()
    }
  }

  const handleMessageClick = () => {
    if (!user) {
      blink.auth.login()
      return
    }
    navigate({ to: '/messages' })
  }

  return (
    <div className="page-container animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
        <ChevronRight size={14} />
        <Link to="/browse" className="hover:text-foreground transition-colors">Browse Freelancers</Link>
        <ChevronRight size={14} />
        <span className="text-foreground">{userProfile.displayName}</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* ─── Sidebar (Profile card) ──────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Avatar + Info */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="text-center mb-5">
              <Avatar className="w-24 h-24 mx-auto mb-3">
                <AvatarImage src={userProfile.avatarUrl} alt={userProfile.displayName} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                  {getInitials(userProfile.displayName || 'F')}
                </AvatarFallback>
              </Avatar>

              <div className="flex items-center justify-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-foreground">{userProfile.displayName}</h1>
                {freelancerProfile.isFeatured === '1' && (
                  <Award size={16} className="text-accent" />
                )}
              </div>
              <p className="text-muted-foreground text-sm mb-3">{freelancerProfile.title}</p>

              <div className="flex items-center justify-center gap-2 mb-1">
                <StarRating rating={Number(freelancerProfile.rating) || 0} size={14} />
                <span className="text-sm font-semibold text-foreground">
                  {Number(freelancerProfile.rating).toFixed(1)}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({Number(freelancerProfile.totalReviews) || 0} reviews)
                </span>
              </div>

              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mt-2 ${availabilityConfig.bg} ${availabilityConfig.color}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {availabilityConfig.label}
              </span>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 py-4 border-y border-border mb-4">
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">{Number(freelancerProfile.completedJobs) || 0}</p>
                <p className="text-xs text-muted-foreground">Jobs Done</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">{Number(freelancerProfile.experienceYears) || 0}y</p>
                <p className="text-xs text-muted-foreground">Experience</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(Number(freelancerProfile.hourlyRate) || 0)}
                </p>
                <p className="text-xs text-muted-foreground">/ hour</p>
              </div>
            </div>

            {/* Meta list */}
            <div className="space-y-2.5 text-sm text-muted-foreground">
              {userProfile.location && (
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="shrink-0" />
                  {userProfile.location}
                </div>
              )}
              <div className="flex items-center gap-2">
                <DollarSign size={14} className="text-accent shrink-0" />
                {formatCurrency(Number(freelancerProfile.hourlyRate) || 0)}/hr
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} className="shrink-0" />
                {Number(freelancerProfile.experienceYears) || 0} years experience
              </div>
              {userProfile.website && (
                <a
                  href={userProfile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-accent transition-colors"
                >
                  <Globe size={14} className="shrink-0" />
                  {userProfile.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>

            {/* CTA Buttons */}
            <div className="space-y-2.5 mt-5">
              {authProfile?.userId !== userId && (
                <>
                  <Button
                    className="w-full gradient-amber border-0 text-white hover:opacity-90"
                    onClick={handleHireClick}
                  >
                    <Briefcase size={15} />
                    {user ? 'Hire This Freelancer' : 'Sign In to Hire'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleMessageClick}
                  >
                    <MessageSquare size={15} />
                    Message
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Categories */}
          {categories.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-3">Categories</h3>
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                  <span key={cat} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── Main content ────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bio */}
          {userProfile.bio && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold text-foreground text-lg mb-3">About</h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {userProfile.bio}
              </p>
            </div>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold text-foreground text-lg mb-4">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {skills.map(skill => <SkillBadge key={skill} skill={skill} />)}
              </div>
            </div>
          )}

          {/* Trust indicators */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold text-foreground text-lg mb-4">Trust & Safety</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { icon: CheckCircle, label: 'Verified Profile', desc: 'Identity confirmed' },
                { icon: Award, label: freelancerProfile.isFeatured === '1' ? 'Featured Freelancer' : 'Registered Freelancer', desc: 'Platform member' },
                { icon: Star, label: `${Number(freelancerProfile.rating).toFixed(1)} Avg Rating`, desc: `From ${Number(freelancerProfile.totalReviews)} reviews` },
                { icon: Briefcase, label: `${Number(freelancerProfile.completedJobs)} Jobs Completed`, desc: 'Successful projects' },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <Icon size={14} className="text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Portfolio */}
          {(portfolio as PortfolioItem[]).length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold text-foreground text-lg mb-4">Portfolio</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {(portfolio as PortfolioItem[]).map(item => (
                  <PortfolioCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          {(reviews as Review[]).length > 0 ? (
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-foreground text-lg">Reviews</h2>
                <div className="flex items-center gap-2">
                  <StarRating rating={Number(freelancerProfile.rating) || 0} size={14} />
                  <span className="text-sm font-semibold">
                    {Number(freelancerProfile.rating).toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({(reviews as Review[]).length})
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                {(reviews as Review[]).map(review => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold text-foreground text-lg mb-3">Reviews</h2>
              <p className="text-sm text-muted-foreground">
                No reviews yet. Be the first to work with {userProfile.displayName}!
              </p>
            </div>
          )}

          {/* Back button */}
          <Button
            variant="ghost"
            onClick={() => navigate({ to: '/browse' })}
            className="w-full sm:w-auto"
          >
            <ArrowLeft size={14} /> Back to Browse
          </Button>
        </div>
      </div>
    </div>
  )
}
