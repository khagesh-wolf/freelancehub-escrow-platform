import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Search, MapPin, Star, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { tables } from '../blink/client'
import { formatCurrency, getInitials, parseJsonArray, CATEGORIES } from '../lib/utils'
import type { FreelancerProfile, UserProfile } from '../types'

const PAGE_SIZE = 20

function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-pulse">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-muted" />
        <div className="flex-1">
          <div className="h-4 bg-muted rounded w-32 mb-2" />
          <div className="h-3 bg-muted rounded w-24" />
        </div>
      </div>
      <div className="flex gap-2 mb-3">
        {[1, 2, 3].map(i => <div key={i} className="h-5 bg-muted rounded-full w-16" />)}
      </div>
      <div className="h-3 bg-muted rounded w-full mb-2" />
      <div className="h-8 bg-muted rounded mt-4" />
    </div>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-1 text-sm">
      <Star size={14} className="text-amber-400 fill-amber-400" />
      <span className="font-medium text-foreground">{rating.toFixed(1)}</span>
    </span>
  )
}

export function BrowseFreelancersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [minRating, setMinRating] = useState('any')
  const [maxRate, setMaxRate] = useState('')
  const [availability, setAvailability] = useState('all')
  const [sortBy, setSortBy] = useState('rating')
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const { data: freelancers = [], isLoading: loadingFP } = useQuery({
    queryKey: ['freelancerProfiles'],
    queryFn: () => tables.freelancerProfiles.list({ limit: 200 }),
  })

  const { data: userProfiles = [], isLoading: loadingUP } = useQuery({
    queryKey: ['userProfilesAll'],
    queryFn: () => tables.userProfiles.list({ where: { role: 'freelancer' }, limit: 200 }),
  })

  const isLoading = loadingFP || loadingUP

  const merged = useMemo(() => {
    const upMap = new Map((userProfiles as UserProfile[]).map(u => [u.userId, u]))
    return (freelancers as FreelancerProfile[]).map(fp => ({
      ...fp,
      userProfile: upMap.get(fp.userId),
    })).filter(f => f.userProfile)
  }, [freelancers, userProfiles])

  const filtered = useMemo(() => {
    let list = [...merged]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(f =>
        f.userProfile?.displayName?.toLowerCase().includes(q) ||
        f.title?.toLowerCase().includes(q) ||
        parseJsonArray(f.skills).some(s => s.toLowerCase().includes(q))
      )
    }
    if (category !== 'all') {
      list = list.filter(f => parseJsonArray(f.categories).includes(category))
    }
    if (minRating !== 'any') {
      list = list.filter(f => f.rating >= Number(minRating))
    }
    if (maxRate) {
      list = list.filter(f => f.hourlyRate <= Number(maxRate))
    }
    if (availability !== 'all') {
      list = list.filter(f => f.availability === availability)
    }
    list.sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating
      if (sortBy === 'rate_asc') return a.hourlyRate - b.hourlyRate
      if (sortBy === 'rate_desc') return b.hourlyRate - a.hourlyRate
      if (sortBy === 'experience') return b.experienceYears - a.experienceYears
      return 0
    })
    return list
  }, [merged, search, category, minRating, maxRate, availability, sortBy])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const clearFilters = () => {
    setSearch(''); setCategory('all'); setMinRating('any')
    setMaxRate(''); setAvailability('all'); setPage(1)
  }

  const hasFilters = search || category !== 'all' || minRating !== 'any' || maxRate || availability !== 'all'

  return (
    <div className="page-container pt-24 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Browse Freelancers</h1>
        <p className="text-muted-foreground">Find expert talent for your next project</p>
      </div>

      {/* Search + Sort bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or skill..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onValueChange={v => { if (v) { setSortBy(v); setPage(1) } }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rating">Highest Rated</SelectItem>
            <SelectItem value="rate_asc">Rate: Low to High</SelectItem>
            <SelectItem value="rate_desc">Rate: High to Low</SelectItem>
            <SelectItem value="experience">Most Experienced</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setFiltersOpen(!filtersOpen)} className="gap-2">
          <Filter size={16} /> Filters
          {hasFilters && <span className="w-2 h-2 rounded-full bg-accent" />}
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground gap-1">
            <X size={14} /> Clear
          </Button>
        )}
      </div>

      {/* Filter panel */}
      {filtersOpen && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
            <Select value={category} onValueChange={v => { if (v) { setCategory(v); setPage(1) } }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Min Rating</label>
            <Select value={minRating} onValueChange={v => { if (v) { setMinRating(v); setPage(1) } }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any Rating</SelectItem>
                <SelectItem value="4">4+ Stars</SelectItem>
                <SelectItem value="4.5">4.5+ Stars</SelectItem>
                <SelectItem value="5">5 Stars Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Max Hourly Rate</label>
            <Input
              type="number"
              placeholder="e.g. 100"
              value={maxRate}
              onChange={e => { setMaxRate(e.target.value); setPage(1) }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Availability</label>
            <Select value={availability} onValueChange={v => { if (v) { setAvailability(v); setPage(1) } }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="busy">Busy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-5">
        {isLoading ? 'Loading...' : `${filtered.length} freelancers found`}
      </p>

      {/* Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : paginated.length === 0 ? (
        <div className="text-center py-16">
          <Search size={48} className="text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No freelancers found</h3>
          <p className="text-muted-foreground text-sm">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {paginated.map(f => {
            const up = f.userProfile!
            const skills = parseJsonArray(f.skills).slice(0, 3)
            return (
              <div key={f.id} className="bg-card border border-border rounded-xl p-5 card-hover flex flex-col">
                <div className="flex items-start gap-3 mb-3">
                  <Avatar className="w-12 h-12 shrink-0">
                    <AvatarImage src={up.avatarUrl} />
                    <AvatarFallback className="gradient-hero text-white text-sm font-semibold">
                      {getInitials(up.displayName || 'U')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{up.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{f.title}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {skills.map(s => (
                    <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between text-sm mt-auto pt-3 border-t border-border">
                  <StarRating rating={f.rating || 0} />
                  <span className="text-xs text-muted-foreground">{f.totalReviews || 0} reviews</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-semibold text-foreground">
                    {formatCurrency(f.hourlyRate || 0)}/hr
                  </span>
                  {up.location && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin size={11} />{up.location}
                    </span>
                  )}
                </div>
                <Button
                  className="w-full mt-3 gradient-amber border-0 text-white hover:opacity-90"
                  size="sm"
                  onClick={() => navigate({ to: '/freelancer/$userId', params: { userId: f.userId } })}
                >
                  View Profile
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-10">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  )
}
