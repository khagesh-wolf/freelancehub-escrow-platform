import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Grid, Plus, Edit2, Trash2, ExternalLink, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { blink, tables } from '../blink/client'
import { useAuth } from '../hooks/useAuth'
import { parseJsonArray } from '../lib/utils'
import { EmptyState } from '../components/shared/EmptyState'
import type { PortfolioItem } from '../types'
import toast from 'react-hot-toast'

interface PortfolioForm {
  title: string
  description: string
  imageUrl: string
  projectUrl: string
  tags: string
}

const EMPTY_FORM: PortfolioForm = { title: '', description: '', imageUrl: '', projectUrl: '', tags: '' }

function PortfolioModal({
  open,
  item,
  onClose,
  userId,
}: {
  open: boolean
  item: PortfolioItem | null
  onClose: () => void
  userId: string
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<PortfolioForm>(
    item
      ? { title: item.title, description: item.description, imageUrl: item.imageUrl, projectUrl: item.projectUrl, tags: parseJsonArray(item.tags).join(', ') }
      : EMPTY_FORM
  )

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error('Title is required')
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        imageUrl: form.imageUrl.trim(),
        projectUrl: form.projectUrl.trim(),
        tags: JSON.stringify(tags),
        updatedAt: new Date().toISOString(),
      }
      if (item) {
        await tables.portfolioItems.update(item.id, payload)
      } else {
        await tables.portfolioItems.create({
          userId,
          ...payload,
          createdAt: new Date().toISOString(),
        })
      }
    },
    onSuccess: () => {
      toast.success(item ? 'Portfolio item updated!' : 'Portfolio item added!')
      qc.invalidateQueries({ queryKey: ['portfolio', userId] })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const f = (key: keyof PortfolioForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Portfolio Item' : 'Add Portfolio Item'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input placeholder="e.g. E-commerce Platform" value={form.title} onChange={f('title')} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea placeholder="Brief description of the project..." rows={3} value={form.description} onChange={f('description')} />
          </div>
          <div className="space-y-1.5">
            <Label>Image URL</Label>
            <Input placeholder="https://..." value={form.imageUrl} onChange={f('imageUrl')} />
          </div>
          <div className="space-y-1.5">
            <Label>Project URL</Label>
            <Input placeholder="https://..." value={form.projectUrl} onChange={f('projectUrl')} />
          </div>
          <div className="space-y-1.5">
            <Label>Tags (comma-separated)</Label>
            <Input placeholder="React, Node.js, PostgreSQL" value={form.tags} onChange={f('tags')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="gradient-amber border-0 text-white hover:opacity-90"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PortfolioPage() {
  const { user, profile, isAuthenticated } = useAuth()
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<PortfolioItem | null>(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['portfolio', user?.id],
    queryFn: () => tables.portfolioItems.list({ where: { userId: user!.id }, limit: 50, orderBy: { createdAt: 'desc' } }),
    enabled: !!user?.id,
  })

  const deleteItem = useMutation({
    mutationFn: (id: string) => tables.portfolioItems.delete(id),
    onSuccess: () => {
      toast.success('Item deleted')
      qc.invalidateQueries({ queryKey: ['portfolio', user?.id] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!isAuthenticated || profile?.role !== 'freelancer') {
    return (
      <div className="page-container pt-24 flex flex-col items-center justify-center py-24">
        <Grid size={48} className="text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Freelancer Access Only</h2>
        <Button className="gradient-amber border-0 text-white" onClick={() => blink.auth.login()}>Sign In</Button>
      </div>
    )
  }

  const openAdd = () => { setEditItem(null); setModalOpen(true) }
  const openEdit = (item: PortfolioItem) => { setEditItem(item); setModalOpen(true) }

  return (
    <div className="page-container pt-24 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
          <p className="text-muted-foreground text-sm mt-1">Showcase your best work</p>
        </div>
        <Button className="gradient-amber border-0 text-white hover:opacity-90 gap-2" onClick={openAdd}>
          <Plus size={16} /> Add Item
        </Button>
      </div>

      <PortfolioModal
        open={modalOpen}
        item={editItem}
        onClose={() => setModalOpen(false)}
        userId={user!.id}
      />

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-card border border-border rounded-xl animate-pulse">
              <div className="h-48 bg-muted rounded-t-xl" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (items as PortfolioItem[]).length === 0 ? (
        <EmptyState
          icon={Grid}
          title="No portfolio items yet"
          description="Add your first project to showcase your skills to potential clients."
          action={{ label: 'Add Item', onClick: openAdd }}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(items as PortfolioItem[]).map(item => {
            const tags = parseJsonArray(item.tags)
            return (
              <div key={item.id} className="bg-card border border-border rounded-xl overflow-hidden card-hover group">
                {/* Image */}
                <div className="h-48 bg-muted flex items-center justify-center overflow-hidden relative">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-6xl font-black text-muted-foreground/20">
                      {item.title?.[0]?.toUpperCase()}
                    </span>
                  )}
                  {/* Overlay actions */}
                  <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      onClick={() => openEdit(item)}
                      className="w-9 h-9 rounded-full bg-white flex items-center justify-center hover:bg-secondary transition-colors"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => deleteItem.mutate(item.id)}
                      className="w-9 h-9 rounded-full bg-destructive flex items-center justify-center hover:opacity-90 transition-opacity"
                    >
                      <Trash2 size={15} className="text-white" />
                    </button>
                    {item.projectUrl && (
                      <a
                        href={item.projectUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-9 h-9 rounded-full bg-white flex items-center justify-center hover:bg-secondary transition-colors"
                      >
                        <ExternalLink size={15} />
                      </a>
                    )}
                  </div>
                </div>
                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{item.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {tags.map(t => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
