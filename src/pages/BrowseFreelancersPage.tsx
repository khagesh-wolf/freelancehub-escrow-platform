import { useState, useMemo } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Search, Filter, Star, MapPin, Clock, DollarSign,
  ChevronRight, Users, X, SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { tables } from '../blink/client'
import { JOB_CATEGORIES } from '../types'
import { getInitials, formatCurrency, safeParseJSON } from '@/lib/utils'
import type { FreelancerProfile, UserProfile } from '../types'

const PAGE_SIZE = 12

// ─── Star Rating ─────────────────────────────────────────────────────────────
function StarRating({ rating, totalReviews }: { rating: number; totalReviews: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={12}
            className={
              i < Math.round(rating)
                ? 'fill-amber-400 text-amber-400'
                : 'fill-muted text-muted-foreground'
            }
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        {Number(rating).toFixed(1)} ({totalReviews})
      </span>
    </div>
  )
}

// ─── Skill Badge ──────────────────────────────────────────────────────────────
function SkillBadge({ skill }: { skill: string }) {
  return (
    <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs">
      {skill}
    </span>
  )
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function FreelancerCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-pulse">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-14 h-14 rounded-full bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-1/2" />
          <div className="h-3 bg-muted rounded w-1/3" />
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        {[1, 2, 3].map(i => <div key={i} className="h-5 bg-muted rounded-full w-14" />)}
      </div>
      <div className="flex items-center justify-between">
        <div className="h-4 bg-muted rounded w-20" />
        <div className="h-8 bg-muted rounded w-24" />
      </div>
    </div>
  )
}

// ─── Freelancer Card ──────────────────────────────────────────────────────────
interface EnrichedFreelancer extends FreelancerProfile {
  displayName: string
  avatarUrl: string
  location: string
}

function FreelancerCard({ freelancer }: { freelancer: EnrichedFreelancer }) {
  const navigate = useNavigate()
  const skills = safeParseJSON<string[]>(freelancer.skills, [])
  const displaySkills = skills.slice(0, 4)

  const availabilityColor = {
    available: 'bg-emerald-100 text-emerald-700',
    busy: 'bg-amber-100 text-amber-700',
    unavailable: 'bg-red-100 text-red-700',
  }[freelancer.availability] || 'bg-muted text-muted-foreground'

  return (
    <article className="bg-card border border-border rounded-xl p-5 card-hover flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar className="w-14 h-14 shrink-0">
          <AvatarImage src={freelancer.avatarUrl} alt={freelancer.displayName} />
          <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
            {getInitials(freelancer.displayName || 'F')}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {freelancer.displayName}
              </h3>
              <p className="text-sm text-muted-foreground truncate">{freelancer.title}</p>
            </div>
            {freelancer.isFeatured === '1' && (
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium border border-accent/20">
                Featured
              </span>
            )}
          </div>
          <StarRating
            rating={Number(freelancer.rating) || 0}
            totalReviews={Number(freelancer.totalReviews) || 0}
          />
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <DollarSign size={12} className="text-accent" />
          {formatCurrency(Number(freelancer.hourlyRate) || 0)}/hr
        </span>
        {freelancer.location && (
          <span className="flex items-center gap-1">
            <MapPin size={12} />
            {freelancer.location}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {freelancer.experienceYears}y exp
        </span>
        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${availabilityColor}`}>
          {freelancer.availability}
        </span>
      </div>

      {/* Skills */}
      {displaySkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {displaySkills.map(skill => <SkillBadge key={skill} skill={skill} />)}
          {skills.length > 4 && (
            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">
              +{skills.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-border mt-auto">
        <span className="text-xs text-muted-foreground">
          {Number(freelancer.completedJobs) || 0} jobs completed
        </span>
        <Button
          size="sm"
          onClick={() => navigate({ to: '/freelancer/$userId', params: { userId: freelancer.userId } as any })}

          className="gradient-amber border-0 text-white hover:opacity-90 text-xs h-8"
        >
          View Profile <ChevronRight size={13} />
        </Button>
      </div>
    </article>
  )
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────
interface Filters {
  search: string
  category: string
  availability: string
  minRate: string
  maxRate: string
  minRating: string
}

function FilterBar({
  filters,
  onChange,
  onReset,
}: {
  filters: Filters
  onChange: (key: keyof Filters, value: string) => void
  onReset: () => void
}) {
  const hasActive = Object.values(filters).some(v => v !== '')

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-4">
      {/* Search row */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or skill..."
            value={filters.search}
            onChange={e => onChange('search', e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {filters.search && (
            <button
              onClick={() => onChange('search', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {hasActive && (
          <Button variant="outline" size="sm" onClick={onReset} className="shrink-0">
            <X size={14} /> Clear
          </Button>
        )}
      </div>

      {/* Filter controls */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Filters:</span>
        </div>

        {/* Category */}
        <select
          value={filters.category}
          onChange={e => onChange('category', e.target.value)}
          className="text-xs bg-background border border-input rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Categories</option>
          {JOB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Availability */}
        <select
          value={filters.availability}
          onChange={e => onChange('availability', e.target.value)}
          className="text-xs bg-background border border-input rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Any Availability</option>
          <option value="available">Available</option>
          <option value="busy">Busy</option>
          <option value="unavailable">Unavailable</option>
        </select>

        {/* Rate range */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Rate:</span>
          <input
            type="number"
            placeholder="Min"
            value={filters.minRate}
            onChange={e => onChange('minRate', e.target.value)}
            className="w-16 text-xs bg-background border border-input rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.maxRate}
            onChange={e => onChange('maxRate', e.target.value)}
            className="w-16 text-xs bg-background border border-input rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">/hr</span>
        </div>

        {/* Min rating */}
        <select
          value={filters.minRating}
          onChange={e => onChange('minRating', e.target.value)}
          className="text-xs bg-background border border-input rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Any Rating</option>
          <option value="4">4★ & above</option>
          <option value="4.5">4.5★ & above</option>
          <option value="5">5★ only</option>
        </select>
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="text-center py-24">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
        <Users size={28} className="text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">No freelancers found</h3>
      <p className="text-muted-foreground text-sm max-w-xs mx-auto">
        Try adjusting your filters or search terms to find available talent.
      </p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function BrowseFreelancersPage() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Filters>({
    search: '',
    category: '',
    availability: '',
    minRate: '',
    maxRate: '',
    minRating: '',
  })

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const resetFilters = () => {
    setFilters({ search: '', category: '', availability: '', minRate: '', maxRate: '', minRating: '' })
    setPage(1)
  }

  // Fetch freelancer profiles
  const { data: rawFreelancers = [], isLoading: loadingFreelancers } = useQuery({
    queryKey: ['freelancerProfiles'],
    queryFn: () => tables.freelancerProfiles.list({ limit: 200 }),
  })

  // Fetch all user profiles needed
  const userIds = useMemo(
    () => [...new Set((rawFreelancers as FreelancerProfile[]).map(f => f.userId))],
    [rawFreelancers]
  )

  const { data: rawUserProfiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['userProfilesBatch', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return []
      return tables.userProfiles.list({ limit: 500 })
    },
    enabled: userIds.length > 0,
  })

  const isLoading = loadingFreelancers || (userIds.length > 0 && loadingProfiles)

  // Build enriched list
  const enriched = useMemo<EnrichedFreelancer[]>(() => {
    const profileMap = new Map<string, UserProfile>()
    ;(rawUserProfiles as UserProfile[]).forEach(p => profileMap.set(p.userId, p))

    return (rawFreelancers as FreelancerProfile[]).map(f => {
      const up = profileMap.get(f.userId)
      return {
        ...f,
        displayName: up?.displayName || 'Freelancer',
        avatarUrl: up?.avatarUrl || '',
        location: up?.location || '',
      }
    })
  }, [rawFreelancers, rawUserProfiles])

  // Client-side filtering
  const filtered = useMemo(() => {
    return enriched.filter(f => {
      const skills = safeParseJSON<string[]>(f.skills, [])
      const categories = safeParseJSON<string[]>(f.categories, [])

      if (filters.search) {
        const q = filters.search.toLowerCase()
        const matchName = f.displayName.toLowerCase().includes(q)
        const matchTitle = f.title?.toLowerCase().includes(q)
        const matchSkill = skills.some(s => s.toLowerCase().includes(q))
        if (!matchName && !matchTitle && !matchSkill) return false
      }
      if (filters.category && !categories.includes(filters.category)) return false
      if (filters.availability && f.availability !== filters.availability) return false
      if (filters.minRate && Number(f.hourlyRate) < Number(filters.minRate)) return false
      if (filters.maxRate && Number(f.hourlyRate) > Number(filters.maxRate)) return false
      if (filters.minRating && Number(f.rating) < Number(filters.minRating)) return false
      return true
    })
  }, [enriched, filters])

  // Sort: featured first, then by rating desc
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.isFeatured === '1' && b.isFeatured !== '1') return -1
      if (b.isFeatured === '1' && a.isFeatured !== '1') return 1
      return Number(b.rating) - Number(a.rating)
    })
  }, [filtered])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginated = sorted.slice(0, page * PAGE_SIZE)
  const hasMore = page < totalPages

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight size={14} />
          <span className="text-foreground">Browse Freelancers</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Browse Freelancers</h1>
            <p className="text-muted-foreground mt-1">
              Find top talent for your project from our vetted pool of professionals
            </p>
          </div>
          {!isLoading && (
            <span className="text-sm text-muted-foreground shrink-0">
              {sorted.length} freelancer{sorted.length !== 1 ? 's' : ''} found
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <FilterBar filters={filters} onChange={handleFilterChange} onReset={resetFilters} />

      {/* Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <FreelancerCardSkeleton key={i} />)}
        </div>
      ) : paginated.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginated.map(f => <FreelancerCard key={f.id} freelancer={f} />)}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="text-center mt-10">
              <Button
                variant="outline"
                onClick={() => setPage(p => p + 1)}
                className="min-w-[160px]"
              >
                Load More
                <span className="ml-2 text-xs text-muted-foreground">
                  ({paginated.length}/{sorted.length})
                </span>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
