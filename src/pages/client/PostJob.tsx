import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../../hooks/useAuth'
import { blink, tables } from '../../blink/client'
import { generateId } from '../../lib/utils'
import { JOB_CATEGORIES, SKILL_OPTIONS } from '../../types'
import {
  Briefcase,
  DollarSign,
  Calendar,
  Tag,
  ChevronRight,
  ArrowLeft,
  Clock,
  Zap,
  Check,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface FormState {
  title: string
  description: string
  category: string
  budgetType: 'fixed' | 'hourly'
  budgetMin: string
  budgetMax: string
  deadline: string
}

export function PostJobPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    category: '',
    budgetType: 'fixed',
    budgetMin: '',
    budgetMax: '',
    deadline: '',
  })
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [skillSearch, setSkillSearch] = useState('')

  const toggleSkill = (s: string) =>
    setSelectedSkills(p => (p.includes(s) ? p.filter(x => x !== s) : [...p, s]))

  const filteredSkills = SKILL_OPTIONS.filter(s =>
    s.toLowerCase().includes(skillSearch.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      navigate({ to: '/auth/login' })
      return
    }
    if (!form.title.trim()) {
      toast.error('Please enter a job title')
      return
    }
    if (!form.description.trim() || form.description.trim().length < 30) {
      toast.error('Please write a description (at least 30 characters)')
      return
    }
    if (!form.category) {
      toast.error('Please select a category')
      return
    }
    if (!form.budgetMax || Number(form.budgetMax) <= 0) {
      toast.error('Please enter a valid maximum budget')
      return
    }

    setLoading(true)
    try {
      const now = new Date().toISOString()
      await tables.jobs.create({
        id: generateId(),
        userId: user.id,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        skillsRequired: JSON.stringify(selectedSkills),
        budgetType: form.budgetType,
        budgetMin: parseFloat(form.budgetMin || '0'),
        budgetMax: parseFloat(form.budgetMax),
        deadline: form.deadline || '',
        status: 'open',
        proposalsCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      toast.success('Job posted successfully! Freelancers can now apply.')
      navigate({ to: '/client/projects' })
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to post job. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const minDate = new Date().toISOString().split('T')[0]
  const descWordCount = form.description.trim().split(/\s+/).filter(Boolean).length

  return (
    <div className="page-container pt-24 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate({ to: '/client/dashboard' })}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft size={15} />
            Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-foreground">Post a Job</h1>
          <p className="text-muted-foreground mt-1">
            Describe your project and receive proposals from skilled freelancers
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Job Details section */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-sm">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Briefcase size={15} className="text-primary" />
              </div>
              Job Details
            </h2>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Job Title <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Build a React dashboard with Next.js"
                maxLength={120}
                className="w-full px-3.5 py-2.5 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">{form.title.length}/120 characters</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Description <span className="text-destructive">*</span>
              </label>
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Describe the job in detail. Include requirements, deliverables, preferred experience, and any relevant context. The more detailed, the better proposals you'll receive."
                rows={7}
                className="w-full px-3.5 py-2.5 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y transition-colors"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                {descWordCount} word{descWordCount !== 1 ? 's' : ''} — aim for 100+ for best results
              </p>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Category <span className="text-destructive">*</span>
              </label>
              <select
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                required
              >
                <option value="">Select a category...</option>
                {JOB_CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Skills section */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Tag size={15} className="text-amber-600" />
                </div>
                Required Skills
              </h2>
              {selectedSkills.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {selectedSkills.length} selected
                </span>
              )}
            </div>

            {/* Search skills */}
            <input
              type="text"
              value={skillSearch}
              onChange={e => setSkillSearch(e.target.value)}
              placeholder="Filter skills..."
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />

            <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto">
              {filteredSkills.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSkill(s)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedSkills.includes(s)
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  }`}
                >
                  {selectedSkills.includes(s) && <Check size={10} />}
                  {s}
                </button>
              ))}
            </div>

            {selectedSkills.length > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs font-medium text-foreground mb-1.5">Selected:</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedSkills.map(s => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium"
                    >
                      {s}
                      <button
                        type="button"
                        onClick={() => toggleSkill(s)}
                        className="hover:text-primary/60 ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Budget & Timeline section */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-sm">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <DollarSign size={15} className="text-emerald-600" />
              </div>
              Budget &amp; Timeline
            </h2>

            {/* Budget type */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Budget Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'fixed', label: 'Fixed Price', icon: Zap, desc: 'Pay a set amount' },
                  { value: 'hourly', label: 'Hourly Rate', icon: Clock, desc: 'Pay per hour worked' },
                ].map(({ value, label, icon: Icon, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, budgetType: value as 'fixed' | 'hourly' }))}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      form.budgetType === value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <Icon
                      size={18}
                      className={form.budgetType === value ? 'text-primary' : 'text-muted-foreground'}
                    />
                    <div>
                      <p
                        className={`text-sm font-semibold ${
                          form.budgetType === value ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        {label}
                      </p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Budget range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {form.budgetType === 'fixed' ? 'Minimum ($)' : 'Min Rate/hr ($)'}
                </label>
                <div className="relative">
                  <DollarSign
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.budgetMin}
                    onChange={e => setForm(p => ({ ...p, budgetMin: e.target.value }))}
                    placeholder="0"
                    className="w-full pl-8 pr-3.5 py-2.5 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {form.budgetType === 'fixed' ? 'Maximum ($)' : 'Max Rate/hr ($)'}{' '}
                  <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <DollarSign
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.budgetMax}
                    onChange={e => setForm(p => ({ ...p, budgetMax: e.target.value }))}
                    placeholder="500"
                    required
                    className="w-full pl-8 pr-3.5 py-2.5 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </div>

            {/* Budget preview */}
            {form.budgetMax && Number(form.budgetMax) > 0 && (
              <div className="bg-muted/50 rounded-xl p-3 text-sm">
                <p className="text-muted-foreground">
                  Budget range:{' '}
                  <span className="font-semibold text-foreground">
                    {form.budgetMin ? `$${Number(form.budgetMin).toLocaleString()} – ` : 'Up to '}
                    ${Number(form.budgetMax).toLocaleString()}
                    {form.budgetType === 'hourly' ? '/hr' : ''}
                  </span>
                </p>
              </div>
            )}

            {/* Deadline */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                <Calendar size={14} />
                Project Deadline{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={form.deadline}
                min={minDate}
                onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Preview card */}
          {form.title && form.category && (
            <div className="bg-muted/30 border border-border rounded-2xl p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Preview
              </p>
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="font-semibold text-foreground">{form.title || 'Job title'}</p>
                  <span className="px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium flex-shrink-0">
                    Open
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{form.category}</p>
                {form.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {form.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {form.budgetMax && (
                    <span className="flex items-center gap-1">
                      <DollarSign size={12} />
                      {form.budgetMin ? `$${form.budgetMin} – ` : 'Up to '}${form.budgetMax}
                      {form.budgetType === 'hourly' ? '/hr' : ''}
                    </span>
                  )}
                  {form.deadline && (
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      Due {new Date(form.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                  {selectedSkills.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Tag size={12} />
                      {selectedSkills.slice(0, 3).join(', ')}
                      {selectedSkills.length > 3 ? ` +${selectedSkills.length - 3}` : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 justify-end pb-4">
            <button
              type="button"
              onClick={() => navigate({ to: '/client/dashboard' })}
              className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 shadow-sm"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  Post Job
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
