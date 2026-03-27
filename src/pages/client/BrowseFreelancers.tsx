import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Search, Star, MapPin, Briefcase, SlidersHorizontal, X } from 'lucide-react'
import { blink, tables } from '../../blink/client'
import { parseJsonArray } from '../../lib/utils'
import { StatusBadge } from '../../components/ui/StatusBadge'
import type { FreelancerProfile, UserProfile } from '../../types'
import { JOB_CATEGORIES, SKILL_OPTIONS } from '../../types'

interface FreelancerWithProfile extends FreelancerProfile {
  displayName: string
  avatarUrl: string
  location: string
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function BrowseFreelancers() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'rating' | 'rate_asc' | 'rate_desc' | 'newest'>('rating')
  const [availability, setAvailability] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 12

  const { data: freelancers = [], isLoading } = useQuery({
    queryKey: ['browse-freelancers'],
    queryFn: async () => {
      const [profiles, userProfiles] = await Promise.all([
        tables.freelancerProfiles.list({ limit: 200 }) as Promise<FreelancerProfile[]>,
        tables.userProfiles.list({
          where: { role: 'freelancer' },
          limit: 200,
        }) as Promise<UserProfile[]>,
      ])
      const userMap = new Map(userProfiles.map(u => [u.userId, u]))
      return profiles
        .map(fp => {
          const up = userMap.get(fp.userId)
          if (!up) return null
          if (Number(up.isSuspended) > 0) return null
          return {
            ...fp,
            displayName: up.displayName,
            avatarUrl: up.avatarUrl,
            location: up.location,
          } as FreelancerWithProfile
        })
        .filter(Boolean) as FreelancerWithProfile[]
    },
  })

  const filtered = useMemo(() => {
    const result = freelancers
      .filter(f => {
        if (
          search &&
          !f.displayName?.toLowerCase().includes(search.toLowerCase()) &&
          !f.title?.toLowerCase().includes(search.toLowerCase())
        )
          return false
        if (availability && f.availability !== availability) return false
        if (selectedSkills.length > 0) {
          const fSkills = parseJsonArray(f.skills)
          if (!selectedSkills.some(s => fSkills.includes(s))) return false
        }
        if (category) {
          const fCats = parseJsonArray(f.categories)
          if (!fCats.includes(category)) return false
        }
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'rating') return Number(b.rating) - Number(a.rating)
        if (sortBy === 'rate_asc') return Number(a.hourlyRate) - Number(b.hourlyRate)
        if (sortBy === 'rate_desc') return Number(b.hourlyRate) - Number(a.hourlyRate)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
    return result
  }, [freelancers, search, availability, selectedSkills, category, sortBy])

  const paginated = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = paginated.length < filtered.length

  const toggleSkill = (s: string) => {
    setPage(1)
    setSelectedSkills(p => (p.includes(s) ? p.filter(x => x !== s) : [...p, s]))
  }

  const clearFilters = () => {
    setSearch('')
    setCategory('')
    setSelectedSkills([])
    setAvailability('')
    setPage(1)
  }

  const hasActiveFilters = search || category || selectedSkills.length > 0 || availability

  return (
    <div className="page-container pt-24 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Find Freelancers</h1>
        <p className="text-muted-foreground">Discover skilled professionals for your projects</p>
      </div>

      {/* Search + top controls */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search by name or title..."
            className="w-full pl-10 pr-4 py-2.5 border border-input rounded-xl bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-2.5 border border-input rounded-xl bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
        >
          <option value="rating">Top Rated</option>
          <option value="rate_asc">Rate: Low to High</option>
          <option value="rate_desc">Rate: High to Low</option>
          <option value="newest">Newest</option>
        </select>
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium shadow-sm transition-colors ${
            showFilters || hasActiveFilters
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-input bg-card text-foreground hover:bg-muted/50'
          }`}
        >
          <SlidersHorizontal size={15} />
          Filters
          {selectedSkills.length + (category ? 1 : 0) + (availability ? 1 : 0) > 0 && (
            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
              {selectedSkills.length + (category ? 1 : 0) + (availability ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      {/* Expandable filter panel */}
      {showFilters && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-6 shadow-sm space-y-5 animate-fade-in">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Category
              </label>
              <select
                value={category}
                onChange={e => {
                  setCategory(e.target.value)
                  setPage(1)
                }}
                className="w-full px-3 py-2.5 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All Categories</option>
                {JOB_CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Availability
              </label>
              <select
                value={availability}
                onChange={e => {
                  setAvailability(e.target.value)
                  setPage(1)
                }}
                className="w-full px-3 py-2.5 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Any Availability</option>
                <option value="available">Available Now</option>
                <option value="busy">Busy</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Skills
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SKILL_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => toggleSkill(s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedSkills.includes(s)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {category && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
              {category}
              <button onClick={() => setCategory('')}>
                <X size={12} />
              </button>
            </span>
          )}
          {availability && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
              {availability}
              <button onClick={() => setAvailability('')}>
                <X size={12} />
              </button>
            </span>
          )}
          {selectedSkills.map(s => (
            <span
              key={s}
              className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium"
            >
              {s}
              <button onClick={() => toggleSkill(s)}>
                <X size={12} />
              </button>
            </span>
          ))}
          <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground underline">
            Clear all
          </button>
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? 'Loading...'
            : `${filtered.length} freelancer${filtered.length !== 1 ? 's' : ''} found`}
        </p>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(9)
            .fill(0)
            .map((_, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-2xl p-5 animate-pulse"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
                <div className="flex gap-1.5 mt-3">
                  {Array(3).fill(0).map((_, j) => (
                    <div key={j} className="h-5 bg-muted rounded-full w-12" />
                  ))}
                </div>
              </div>
            ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-card border border-border rounded-2xl">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Search size={32} className="text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground mb-2">No freelancers found</p>
          <p className="text-sm text-muted-foreground mb-4">
            Try adjusting your filters or search terms
          </p>
          <button
            onClick={clearFilters}
            className="text-sm text-primary hover:underline"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginated.map(f => (
              <FreelancerCard key={f.id} freelancer={f} />
            ))}
          </div>
          {hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={() => setPage(p => p + 1)}
                className="px-6 py-3 border border-border rounded-xl text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                Load more freelancers
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function FreelancerCard({ freelancer: f }: { freelancer: FreelancerWithProfile }) {
  const skills = parseJsonArray(f.skills).slice(0, 4)
  const rating = Number(f.rating) || 0
  const reviews = Number(f.totalReviews) || 0
  const jobs = Number(f.completedJobs) || 0
  const rate = Number(f.hourlyRate) || 0
  const featured = Number(f.isFeatured) > 0

  return (
    <div className="bg-card border border-border rounded-2xl p-5 card-hover flex flex-col relative overflow-hidden">
      {featured && (
        <div className="absolute top-3 right-3">
          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
            ⭐ Featured
          </span>
        </div>
      )}

      {/* Avatar + name */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden border border-border">
          {f.avatarUrl ? (
            <img src={f.avatarUrl} alt={f.displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-primary font-bold text-base">
              {getInitials(f.displayName || '?')}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0 pr-16">
          <p className="font-semibold text-foreground truncate">{f.displayName}</p>
          <p className="text-sm text-muted-foreground truncate">{f.title || 'Freelancer'}</p>
        </div>
      </div>

      {/* Rating + jobs */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1">
          <Star size={13} className="text-amber-500 fill-amber-500" />
          <span className="text-sm font-semibold text-foreground">
            {rating > 0 ? rating.toFixed(1) : 'New'}
          </span>
          {reviews > 0 && (
            <span className="text-xs text-muted-foreground">({reviews})</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Briefcase size={12} />
          <span>{jobs} job{jobs !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Location */}
      {f.location && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          <MapPin size={11} />
          <span className="truncate">{f.location}</span>
        </div>
      )}

      {/* Skills */}
      <div className="flex flex-wrap gap-1.5 mb-4 flex-1">
        {skills.map(s => (
          <span
            key={s}
            className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs"
          >
            {s}
          </span>
        ))}
        {parseJsonArray(f.skills).length > 4 && (
          <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs">
            +{parseJsonArray(f.skills).length - 4}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
        <div>
          <span className="text-lg font-bold text-foreground">${rate}</span>
          <span className="text-xs text-muted-foreground">/hr</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={f.availability || 'available'} />
          <Link
            to="/freelancer/$userId"
            params={{ userId: f.userId }}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            View Profile
          </Link>
        </div>
      </div>
    </div>
  )
}
