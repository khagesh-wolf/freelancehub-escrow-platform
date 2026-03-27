import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { Briefcase, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { blink, tables } from '../blink/client'
import { useAuth } from '../hooks/useAuth'
import { CATEGORIES, SKILLS } from '../lib/utils'
import toast from 'react-hot-toast'

export function PostJobPage() {
  const { user, profile, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [budgetType, setBudgetType] = useState<'fixed' | 'hourly'>('fixed')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [deadline, setDeadline] = useState('')
  const [skillInput, setSkillInput] = useState('')

  if (!isAuthenticated || profile?.role !== 'client') {
    return (
      <div className="page-container pt-24 flex flex-col items-center justify-center py-24">
        <Briefcase size={48} className="text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Client Access Only</h2>
        <p className="text-muted-foreground mb-4">You need a client account to post jobs.</p>
        <Button className="gradient-amber border-0 text-white" onClick={() => blink.auth.login()}>
          Sign In
        </Button>
      </div>
    )
  }

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    )
  }

  const addCustomSkill = () => {
    const s = skillInput.trim()
    if (s && !selectedSkills.includes(s)) {
      setSelectedSkills(prev => [...prev, s])
      setSkillInput('')
    }
  }

  const postJob = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Job title is required')
      if (!description.trim()) throw new Error('Description is required')
      if (!category) throw new Error('Category is required')
      if (!budgetMin || !budgetMax) throw new Error('Budget range is required')
      const job = await tables.jobs.create({
        userId: user!.id,
        title: title.trim(),
        description: description.trim(),
        category,
        skillsRequired: JSON.stringify(selectedSkills),
        budgetType,
        budgetMin: Number(budgetMin),
        budgetMax: Number(budgetMax),
        deadline: deadline || new Date(Date.now() + 30 * 86400000).toISOString(),
        status: 'open',
        proposalsCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      await tables.notifications.create({
        userId: user!.id,
        title: 'Job Posted',
        message: `Your job "${title}" is now live.`,
        type: 'success',
        link: `/jobs/${(job as any).id}`,
        isRead: '0',
        createdAt: new Date().toISOString(),
      })
      return job
    },
    onSuccess: (job) => {
      toast.success('Job posted successfully!')
      navigate({ to: '/jobs/$jobId', params: { jobId: (job as any).id } })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="page-container pt-24 animate-fade-in">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl gradient-amber flex items-center justify-center">
            <Briefcase size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Post a Job</h1>
            <p className="text-muted-foreground text-sm">Find the perfect freelancer for your project</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Job Title *</Label>
            <Input
              id="title"
              placeholder="e.g. Build a React dashboard with charts"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="desc">Description *</Label>
            <Textarea
              id="desc"
              placeholder="Describe the project, deliverables, and requirements..."
              rows={5}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Category *</Label>
            <Select value={category} onValueChange={v => { if (v) setCategory(v) }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Skills */}
          <div className="space-y-2">
            <Label>Skills Required</Label>
            <div className="flex flex-wrap gap-2 p-3 border border-border rounded-lg min-h-[60px]">
              {selectedSkills.map(s => (
                <Badge key={s} variant="secondary" className="gap-1 cursor-pointer" onClick={() => toggleSkill(s)}>
                  {s} <X size={11} />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add custom skill..."
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomSkill())}
              />
              <Button variant="outline" size="sm" onClick={addCustomSkill}><Plus size={16} /></Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {SKILLS.filter(s => !selectedSkills.includes(s)).slice(0, 20).map(s => (
                <button key={s} onClick={() => toggleSkill(s)}
                  className="px-2.5 py-1 text-xs rounded-full border border-border hover:bg-secondary transition-colors"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>

          {/* Budget type */}
          <div className="space-y-1.5">
            <Label>Budget Type *</Label>
            <div className="flex gap-3">
              {(['fixed', 'hourly'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setBudgetType(t)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all capitalize ${
                    budgetType === t
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {t === 'fixed' ? '💼 Fixed Price' : '⏰ Hourly Rate'}
                </button>
              ))}
            </div>
          </div>

          {/* Budget range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Min Budget ($) *</Label>
              <Input type="number" placeholder="500" value={budgetMin} onChange={e => setBudgetMin(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Max Budget ($) *</Label>
              <Input type="number" placeholder="2000" value={budgetMax} onChange={e => setBudgetMax(e.target.value)} />
            </div>
          </div>

          {/* Deadline */}
          <div className="space-y-1.5">
            <Label htmlFor="deadline">Project Deadline</Label>
            <Input id="deadline" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} min={new Date().toISOString().split('T')[0]} />
          </div>

          <Button
            className="w-full gradient-amber border-0 text-white hover:opacity-90 h-11"
            onClick={() => postJob.mutate()}
            disabled={postJob.isPending}
          >
            {postJob.isPending ? 'Posting...' : 'Post Job'}
          </Button>
        </div>
      </div>
    </div>
  )
}
