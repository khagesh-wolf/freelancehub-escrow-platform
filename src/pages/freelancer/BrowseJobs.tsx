import { useState, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { Search, Filter, Clock, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { tables } from '@/blink/client'
import { formatCurrency, formatRelativeTime, getStatusColor, safeParseJSON } from '@/lib/utils'
import type { Job } from '@/types'
import { JOB_CATEGORIES } from '@/types'

export function FreelancerBrowseJobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [budgetType, setBudgetType] = useState('')

  useEffect(() => { loadJobs() }, [])

  async function loadJobs() {
    setLoading(true)
    try {
      const data = await tables.jobs.list({ where: { status: 'open' }, limit: 50, orderBy: { createdAt: 'desc' } })
      setJobs(data as Job[])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const filtered = jobs.filter(j => {
    const matchSearch = !search ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.description.toLowerCase().includes(search.toLowerCase()) ||
      safeParseJSON<string[]>(j.skillsRequired, []).some(s => s.toLowerCase().includes(search.toLowerCase()))
    const matchCat = !selectedCategory || j.category === selectedCategory
    const matchBudget = !budgetType || j.budgetType === budgetType
    return matchSearch && matchCat && matchBudget
  })

  return (
    <div className="page-container">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Browse Jobs</h1>
        <p className="text-muted-foreground">Find your next freelance opportunity</p>
      </div>

      {/* Search + Filters */}
      <div className="mb-6 space-y-4">
        <div className="relative max-w-xl">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search jobs, skills, keywords..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-muted-foreground" />
          {['', 'fixed', 'hourly'].map(type => (
            <button key={type}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors font-medium ${budgetType === type ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground bg-card'}`}
              onClick={() => setBudgetType(type)}
            >
              {type === '' ? 'All Types' : type === 'fixed' ? 'Fixed Price' : 'Hourly'}
            </button>
          ))}
          <span className="text-border">|</span>
          <button
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors font-medium ${!selectedCategory ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground bg-card'}`}
            onClick={() => setSelectedCategory('')}
          >
            All Categories
          </button>
          {JOB_CATEGORIES.slice(0, 6).map(cat => (
            <button key={cat}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors font-medium ${selectedCategory === cat ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground bg-card'}`}
              onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
            >
              {cat.replace(' Development', ' Dev')}
            </button>
          ))}
        </div>
      </div>

      {!loading && <p className="text-sm text-muted-foreground mb-4">{filtered.length} job{filtered.length !== 1 ? 's' : ''} found</p>}

      {loading ? (
        <div className="space-y-4">{[...Array(5)].map((_, i) => <div key={i} className="h-32 bg-card border border-border rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-foreground mb-2">No jobs found</h3>
          <p className="text-muted-foreground mb-6">Try adjusting your search or filters</p>
          <Button variant="outline" onClick={() => { setSearch(''); setSelectedCategory(''); setBudgetType('') }}>Clear Filters</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(job => {
            const skills = safeParseJSON<string[]>(job.skillsRequired, [])
            return (
              <Link key={job.id} to="/freelancer/jobs/$jobId" params={{ jobId: job.id }} className="block">
                <div className="bg-card border border-border rounded-xl p-6 card-hover">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-foreground mb-1">{job.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-foreground">
                        {job.budgetType === 'fixed'
                          ? formatCurrency(job.budgetMax || 0)
                          : `${formatCurrency(job.budgetMin || 0)} - ${formatCurrency(job.budgetMax || 0)}/hr`}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(job.budgetType === 'fixed' ? 'active' : 'pending')}`}>
                        {job.budgetType === 'fixed' ? 'Fixed' : 'Hourly'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {skills.slice(0, 5).map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                    {skills.length > 5 && <Badge variant="outline" className="text-xs">+{skills.length - 5}</Badge>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock size={12} />{formatRelativeTime(job.createdAt)}</span>
                    <span className="flex items-center gap-1"><DollarSign size={12} />{job.proposalsCount || 0} proposals</span>
                    <Badge variant="outline" className="text-xs">{job.category}</Badge>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
