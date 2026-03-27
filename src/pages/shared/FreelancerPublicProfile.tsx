import { useParams, useNavigate, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Star, MapPin, Globe, ExternalLink, Briefcase, Award,
  Clock, ChevronLeft, User,
} from 'lucide-react'
import { tables } from '../../blink/client'
import { useAuth } from '../../hooks/useAuth'
import { parseJsonArray, formatDate, formatCurrency } from '../../lib/utils'
import { StatusBadge } from '../../components/ui/StatusBadge'
import type { FreelancerProfile, UserProfile, PortfolioItem, Review } from '../../types'

// Star display helper
function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={size}
          className={
            i < Math.floor(rating)
              ? 'text-amber-400 fill-amber-400'
              : i < rating
              ? 'text-amber-400 fill-amber-400 opacity-50'
              : 'text-gray-300 dark:text-gray-600'
          }
        />
      ))}
    </div>
  )
}

// Avatar initials helper
function Avatar({
  src,
  name,
  size = 'md',
}: {
  src?: string
  name?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClasses = { sm: 'w-9 h-9 text-xs', md: 'w-12 h-12 text-sm', lg: 'w-24 h-24 text-3xl' }
  const cls = sizeClasses[size]
  return (
    <div
      className={`${cls} rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0`}
    >
      {src ? (
        <img src={src} alt={name ?? ''} className="w-full h-full object-cover" />
      ) : (
        <span className="font-bold text-primary">{name?.[0]?.toUpperCase() ?? <User size={16} />}</span>
      )}
    </div>
  )
}

export function PublicFreelancerProfile() {
  const { userId } = useParams({ from: '/freelancer/$userId' })
  const { user, profile: myProfile } = useAuth()
  const navigate = useNavigate()

  const { data: userProfile, isLoading: loadingUser } = useQuery({
    queryKey: ['public-user-profile', userId],
    queryFn: async () => {
      const r = await tables.userProfiles.list({ where: { userId }, limit: 1 })
      return (r[0] ?? null) as UserProfile | null
    },
    enabled: !!userId,
  })

  const { data: freelancerProfile, isLoading: loadingFP } = useQuery({
    queryKey: ['public-freelancer-profile', userId],
    queryFn: async () => {
      const r = await tables.freelancerProfiles.list({ where: { userId }, limit: 1 })
      return (r[0] ?? null) as FreelancerProfile | null
    },
    enabled: !!userId,
  })

  const { data: portfolio = [] } = useQuery({
    queryKey: ['public-portfolio', userId],
    queryFn: async () =>
      tables.portfolioItems.list({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        limit: 20,
      }) as Promise<PortfolioItem[]>,
    enabled: !!userId,
  })

  const { data: reviews = [] } = useQuery({
    queryKey: ['public-reviews', userId],
    queryFn: async () => {
      const r = (await tables.reviews.list({
        where: { freelancerId: userId, isPublic: '1' },
        orderBy: { createdAt: 'desc' },
        limit: 20,
      })) as Review[]

      const reviewerIds = [...new Set(r.map(rv => rv.userId))]
      if (reviewerIds.length === 0) return []

      const reviewers = await Promise.all(
        reviewerIds.map(id =>
          tables.userProfiles.list({ where: { userId: id }, limit: 1 })
        )
      )
      const reviewerMap = new Map(
        reviewers.flatMap(arr => (arr[0] ? [[arr[0].userId, arr[0]]] : []))
      )
      return r.map(rv => ({
        ...rv,
        reviewerName: (reviewerMap.get(rv.userId) as UserProfile | undefined)?.displayName ?? 'Anonymous',
        reviewerAvatar: (reviewerMap.get(rv.userId) as UserProfile | undefined)?.avatarUrl ?? '',
      }))
    },
    enabled: !!userId,
  })

  const isLoading = loadingUser || loadingFP

  if (isLoading) {
    return (
      <div className="page-container pt-24 max-w-5xl">
        <div className="animate-pulse space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6 h-48" />
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-card border border-border rounded-2xl p-5 h-32" />
              <div className="bg-card border border-border rounded-2xl p-5 h-64" />
            </div>
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-2xl p-5 h-32" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!userProfile || !freelancerProfile) {
    return (
      <div className="page-container pt-24 max-w-5xl">
        <div className="text-center py-24">
          <User size={48} className="text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Freelancer Not Found</h2>
          <p className="text-muted-foreground mb-6">
            This profile doesn't exist or may have been removed.
          </p>
          <button
            onClick={() => navigate({ to: '/browse' })}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Browse Freelancers
          </button>
        </div>
      </div>
    )
  }

  const skills = parseJsonArray(freelancerProfile.skills)
  const categories = parseJsonArray(freelancerProfile.categories)
  const avgRating = Number(freelancerProfile.rating) || 0
  const totalReviews = Number(freelancerProfile.totalReviews) || 0
  const completedJobs = Number(freelancerProfile.completedJobs) || 0
  const experienceYears = Number(freelancerProfile.experienceYears) || 0
  const hourlyRate = Number(freelancerProfile.hourlyRate) || 0

  const isClient = user && myProfile?.role === 'client'
  const isOwnProfile = user?.id === userId

  return (
    <div className="page-container pt-24 max-w-5xl animate-fade-in">
      {/* Back button */}
      <button
        onClick={() => navigate({ to: '/browse' })}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft size={16} />
        Back to Browse
      </button>

      {/* ── Hero card ── */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-5">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden border border-border">
            {userProfile.avatarUrl ? (
              <img src={userProfile.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-primary font-bold text-3xl">
                {userProfile.displayName?.[0]?.toUpperCase() ?? '?'}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{userProfile.displayName}</h1>
                <p className="text-muted-foreground mt-0.5">{freelancerProfile.title}</p>

                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <div className="flex items-center gap-1.5">
                    <StarRating rating={avgRating} />
                    <span className="text-sm font-semibold text-foreground">
                      {avgRating > 0 ? avgRating.toFixed(1) : '—'}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ({totalReviews} review{totalReviews !== 1 ? 's' : ''})
                    </span>
                  </div>

                  {userProfile.location && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin size={13} />
                      {userProfile.location}
                    </div>
                  )}

                  <StatusBadge status={freelancerProfile.availability} />
                </div>
              </div>

              {/* Rate + CTA */}
              <div className="flex flex-col items-start sm:items-end gap-3 flex-shrink-0">
                <div className="text-right">
                  <span className="text-2xl font-bold text-foreground">
                    {formatCurrency(hourlyRate)}
                  </span>
                  <span className="text-muted-foreground text-sm">/hr</span>
                </div>

                {isClient && !isOwnProfile && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate({ to: '/client/post-job' })}
                      className="px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      Hire Me
                    </button>
                    <Link
                      to="/messages"
                      className="px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
                    >
                      Message
                    </Link>
                  </div>
                )}

                {!user && (
                  <button
                    onClick={() => navigate({ to: '/auth/login' })}
                    className="px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    Sign In to Hire
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-border">
          {[
            { label: 'Jobs Completed', value: completedJobs, icon: Briefcase },
            { label: 'Total Reviews', value: totalReviews, icon: Star },
            { label: 'Years Experience', value: experienceYears, icon: Award },
            { label: 'Hourly Rate', value: formatCurrency(hourlyRate), icon: Clock },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <div className="flex items-center justify-center mb-1">
                <stat.icon size={14} className="text-muted-foreground" />
              </div>
              <p className="text-xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: About + Portfolio + Reviews */}
        <div className="lg:col-span-2 space-y-6">
          {/* About */}
          {userProfile.bio && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <h2 className="font-semibold text-foreground mb-3">About</h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {userProfile.bio}
              </p>
            </div>
          )}

          {/* Portfolio */}
          {portfolio.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <h2 className="font-semibold text-foreground mb-4">Portfolio</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {portfolio.map(item => (
                  <div
                    key={item.id}
                    className="border border-border rounded-xl overflow-hidden card-hover"
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-40 object-cover"
                      />
                    ) : (
                      <div className="w-full h-32 bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center border-b border-border">
                        <Briefcase size={28} className="text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="p-3.5">
                      <p className="font-semibold text-sm text-foreground">{item.title}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      {/* Tags */}
                      {parseJsonArray(item.tags).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {parseJsonArray(item.tags).slice(0, 3).map(tag => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.projectUrl && (
                        <a
                          href={item.projectUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary mt-2.5 hover:underline font-medium"
                        >
                          View Project <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Reviews</h2>
              <span className="text-sm text-muted-foreground">
                {reviews.length} review{reviews.length !== 1 ? 's' : ''}
              </span>
            </div>

            {reviews.length === 0 ? (
              <div className="text-center py-8">
                <Star size={32} className="text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No reviews yet</p>
              </div>
            ) : (
              <div className="space-y-5">
                {reviews.map(r => (
                  <div
                    key={r.id}
                    className="pb-5 border-b border-border last:border-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {r.reviewerAvatar ? (
                            <img
                              src={r.reviewerAvatar}
                              alt=""
                              className="w-full h-full object-cover rounded-full"
                            />
                          ) : (
                            <span className="text-xs font-semibold text-primary">
                              {r.reviewerName?.[0]?.toUpperCase() ?? '?'}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {r.reviewerName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StarRating rating={Number(r.rating) || 0} size={13} />
                        <span className="text-xs text-muted-foreground">
                          {formatDate(r.createdAt)}
                        </span>
                      </div>
                    </div>
                    {r.comment && (
                      <p className="text-sm text-muted-foreground leading-relaxed ml-10">
                        {r.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Skills */}
          {skills.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-foreground mb-3">Skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {skills.map(s => (
                  <span
                    key={s}
                    className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          {categories.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-foreground mb-3">Categories</h3>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(c => (
                  <span
                    key={c}
                    className="px-2.5 py-1 bg-muted text-muted-foreground rounded-full text-xs"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          {userProfile.website && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-foreground mb-3">Links</h3>
              <a
                href={
                  userProfile.website.startsWith('http')
                    ? userProfile.website
                    : `https://${userProfile.website}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline font-medium"
              >
                <Globe size={14} />
                <span className="truncate">{userProfile.website}</span>
              </a>
            </div>
          )}

          {/* Quick rating summary */}
          {avgRating > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-foreground mb-3">Rating</h3>
              <div className="flex items-center gap-3">
                <span className="text-4xl font-bold text-foreground">
                  {avgRating.toFixed(1)}
                </span>
                <div>
                  <StarRating rating={avgRating} size={18} />
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on {totalReviews} review{totalReviews !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
