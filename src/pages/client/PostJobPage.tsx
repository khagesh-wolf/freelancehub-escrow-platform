import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { X, Plus, Briefcase, DollarSign, Calendar, Tag, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { tables } from '@/blink/client'
import { JOB_CATEGORIES, SKILL_OPTIONS } from '@/types'

// ─── Schema ──────────────────────────────────────────────────────────────────
const schema = z
  .object({
    title: z.string().min(5, 'Title must be at least 5 characters').max(120, 'Title too long'),
    description: z.string().min(30, 'Description must be at least 30 characters'),
    category: z.string().min(1, 'Please select a category'),
    budgetType: z.enum(['fixed', 'hourly']),
    budgetMin: z.coerce.number().min(1, 'Minimum budget must be at least $1'),
    budgetMax: z.coerce.number().min(1, 'Maximum budget must be at least $1'),
    deadline: z.string().min(1, 'Please select a deadline'),
  })
  .refine(data => data.budgetMax >= data.budgetMin, {
    message: 'Maximum budget must be ≥ minimum budget',
    path: ['budgetMax'],
  })

type FormValues = z.infer<typeof schema>

// ─── Field wrapper ────────────────────────────────────────────────────────────
function FieldWrap({ label, error, children, hint }: { label: string; error?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ─── Auth spinner ─────────────────────────────────────────────────────────────
function AuthSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}

export function PostJobPage() {
  const { user, profile, isLoading } = useAuth()
  const navigate = useNavigate()
  const [skills, setSkills] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [showSkillDropdown, setShowSkillDropdown] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Auth guard
  useEffect(() => {
    if (!isLoading && !user) navigate({ to: '/auth/login' })
    if (!isLoading && profile && profile.role !== 'client') navigate({ to: '/freelancer/dashboard' })
  }, [isLoading, user, profile])

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { budgetType: 'fixed' },
  })

  const budgetType = watch('budgetType')

  // ── Skill management ─────────────────────────────────────────────────────
  const filteredSkills = SKILL_OPTIONS.filter(
    s => !skills.includes(s) && s.toLowerCase().includes(skillInput.toLowerCase()),
  ).slice(0, 8)

  function addSkill(skill: string) {
    const trimmed = skill.trim()
    if (trimmed && !skills.includes(trimmed) && skills.length < 12) {
      setSkills(prev => [...prev, trimmed])
    }
    setSkillInput('')
    setShowSkillDropdown(false)
  }

  function removeSkill(skill: string) {
    setSkills(prev => prev.filter(s => s !== skill))
  }

  function handleSkillKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && skillInput.trim()) {
      e.preventDefault()
      addSkill(skillInput)
    }
    if (e.key === 'Escape') setShowSkillDropdown(false)
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function onSubmit(data: any) {
    if (!user) return
    if (skills.length === 0) {
      toast.error('Please add at least one required skill')
      return
    }
    setIsSubmitting(true)
    try {
      await tables.jobs.create({
        userId: user.id,
        title: data.title,
        description: data.description,
        category: data.category,
        skillsRequired: JSON.stringify(skills),
        budgetType: data.budgetType,
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        deadline: data.deadline,
        status: 'open',
        proposalsCount: 0,
      } as any)
      toast.success('Job posted successfully!', { description: 'Freelancers can now find and apply to your job.' })
      navigate({ to: '/client/dashboard' })
    } catch {
      toast.error('Failed to post job', { description: 'Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <AuthSpinner />

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Briefcase size={20} className="text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Post a Job</h1>
        </div>
        <p className="text-muted-foreground">
          Fill in the details below to attract the best freelancers for your project.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* ── Form ──────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

            {/* Title */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-5">
              <h2 className="font-semibold text-foreground border-b border-border pb-3">Job Details</h2>

              <FieldWrap label="Job Title" error={errors.title?.message} hint="Be specific — e.g. 'Build a React dashboard with Tailwind CSS'">
                <input
                  {...register('title')}
                  placeholder="e.g. Build a React + TypeScript SaaS dashboard"
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                />
              </FieldWrap>

              {/* Description */}
              <FieldWrap label="Project Description" error={errors.description?.message} hint="Describe what you need, expected deliverables, and any technical requirements">
                <textarea
                  {...register('description')}
                  rows={6}
                  placeholder="Describe your project in detail. Include goals, deliverables, technical requirements, and any preferences..."
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition resize-none"
                />
              </FieldWrap>

              {/* Category */}
              <FieldWrap label="Category" error={errors.category?.message}>
                <div className="relative">
                  <select
                    {...register('category')}
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none transition"
                  >
                    <option value="">Select a category...</option>
                    {JOB_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </FieldWrap>
            </div>

            {/* Skills */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold text-foreground border-b border-border pb-3 mb-5">Required Skills</h2>

              {/* Skill chips */}
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {skills.map(skill => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                    >
                      <Tag size={11} />
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="ml-0.5 hover:text-destructive transition-colors"
                        aria-label={`Remove ${skill}`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Skill input */}
              <div className="relative">
                <div className="flex gap-2">
                  <input
                    value={skillInput}
                    onChange={e => {
                      setSkillInput(e.target.value)
                      setShowSkillDropdown(true)
                    }}
                    onKeyDown={handleSkillKeyDown}
                    onFocus={() => setShowSkillDropdown(true)}
                    onBlur={() => setTimeout(() => setShowSkillDropdown(false), 150)}
                    placeholder="Type a skill and press Enter..."
                    className="flex-1 h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                    disabled={skills.length >= 12}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addSkill(skillInput)}
                    disabled={!skillInput.trim() || skills.length >= 12}
                    className="shrink-0"
                  >
                    <Plus size={14} /> Add
                  </Button>
                </div>

                {/* Dropdown */}
                {showSkillDropdown && filteredSkills.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 right-0 z-20 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                    {filteredSkills.map(s => (
                      <button
                        key={s}
                        type="button"
                        onMouseDown={() => addSkill(s)}
                        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {skills.length}/12 skills • Start typing or pick from suggestions
              </p>
            </div>

            {/* Budget */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-5">
              <h2 className="font-semibold text-foreground border-b border-border pb-3">Budget & Timeline</h2>

              {/* Budget type */}
              <FieldWrap label="Budget Type">
                <Controller
                  name="budgetType"
                  control={control}
                  render={({ field }) => (
                    <div className="flex gap-3">
                      {(['fixed', 'hourly'] as const).map(type => (
                        <label
                          key={type}
                          className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            field.value === type
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-border text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          <input
                            type="radio"
                            value={type}
                            checked={field.value === type}
                            onChange={() => field.onChange(type)}
                            className="sr-only"
                          />
                          <DollarSign size={16} />
                          <div>
                            <div className="font-medium capitalize text-sm">{type} Price</div>
                            <div className="text-xs opacity-70">
                              {type === 'fixed' ? 'One-time payment' : 'Per hour worked'}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                />
              </FieldWrap>

              {/* Budget range */}
              <div className="grid grid-cols-2 gap-4">
                <FieldWrap label={`Min Budget (${budgetType === 'hourly' ? '/hr' : 'USD'})`} error={errors.budgetMin?.message}>
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      {...register('budgetMin')}
                      type="number"
                      min="1"
                      placeholder="100"
                      className="w-full h-10 rounded-lg border border-input bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                    />
                  </div>
                </FieldWrap>

                <FieldWrap label={`Max Budget (${budgetType === 'hourly' ? '/hr' : 'USD'})`} error={errors.budgetMax?.message}>
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      {...register('budgetMax')}
                      type="number"
                      min="1"
                      placeholder="500"
                      className="w-full h-10 rounded-lg border border-input bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                    />
                  </div>
                </FieldWrap>
              </div>

              {/* Deadline */}
              <FieldWrap label="Project Deadline" error={errors.deadline?.message} hint="When do you need this project completed?">
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    {...register('deadline')}
                    type="date"
                    min={today}
                    className="w-full h-10 rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                  />
                </div>
              </FieldWrap>
            </div>

            {/* Submit */}
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="gradient-amber text-white border-0 px-8"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Briefcase size={15} />
                    Post Job
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: '/client/dashboard' })}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>

        {/* ── Tips sidebar ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 sticky top-24">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-amber-500">💡</span> Tips for Success
            </h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {[
                'Write a clear, descriptive title that explains exactly what you need',
                'Include specific technical requirements and preferred technologies',
                'Set a realistic budget range to attract quality proposals',
                'Add relevant skills so the right freelancers can find your job',
                'Provide enough deadline buffer for revisions and review cycles',
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full gradient-amber text-white text-xs flex items-center justify-center font-bold">
                    {i + 1}
                  </span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-3">Platform Fee</h3>
            <p className="text-sm text-muted-foreground">
              FreelanceHub charges a <strong className="text-foreground">10% platform fee</strong> on completed contracts, deducted from the freelancer's earnings — no extra cost to you.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
