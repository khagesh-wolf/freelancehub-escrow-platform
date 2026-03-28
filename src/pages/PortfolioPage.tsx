import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  ImageOff,
  Tag,
  FolderOpen,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { tables } from '@/blink/client'
import { formatRelativeTime } from '@/lib/utils'
import type { PortfolioItem } from '@/types'

// ─── Form State ───────────────────────────────────────────────────────────────
interface ItemForm {
  title: string
  description: string
  imageUrl: string
  projectUrl: string
  tagsInput: string // comma-separated
}

const emptyForm: ItemForm = {
  title: '',
  description: '',
  imageUrl: '',
  projectUrl: '',
  tagsInput: '',
}

// ─── Portfolio Item Card ──────────────────────────────────────────────────────
interface ItemCardProps {
  item: PortfolioItem
  onEdit: (item: PortfolioItem) => void
  onDelete: (id: string) => void
  isDeleting: boolean
}

function PortfolioCard({ item, onEdit, onDelete, isDeleting }: ItemCardProps) {
  const tags = (() => { try { return JSON.parse(item.tags || '[]') as string[] } catch { return [] } })()

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden card-hover group">
      {/* Image */}
      <div className="relative aspect-video bg-muted overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff size={32} className="text-muted-foreground opacity-30" />
          </div>
        )}

        {/* Hover overlay actions */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          {item.projectUrl && (
            <a
              href={item.projectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-white/20 backdrop-blur rounded-xl hover:bg-white/30 transition-colors"
              title="View project"
            >
              <ExternalLink size={16} className="text-white" />
            </a>
          )}
          <button
            onClick={() => onEdit(item)}
            className="p-2 bg-white/20 backdrop-blur rounded-xl hover:bg-white/30 transition-colors"
            title="Edit"
          >
            <Pencil size={16} className="text-white" />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            disabled={isDeleting}
            className="p-2 bg-red-500/60 backdrop-blur rounded-xl hover:bg-red-500/80 transition-colors disabled:opacity-50"
            title="Delete"
          >
            <Trash2 size={16} className="text-white" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-foreground text-sm line-clamp-1">{item.title}</h3>
          {item.projectUrl && (
            <a
              href={item.projectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>

        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{item.description}</p>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {tags.map((tag: string) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium"
              >
                <Tag size={9} />
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-[11px] text-muted-foreground">{formatRelativeTime(item.createdAt)}</span>
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(item)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => onDelete(item.id)}
              disabled={isDeleting}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-muted-foreground hover:text-red-500 disabled:opacity-50"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Item Form Dialog ─────────────────────────────────────────────────────────
interface ItemDialogProps {
  open: boolean
  onClose: () => void
  initialData?: PortfolioItem | null
  userId: string
  onSuccess: () => void
}

function ItemDialog({ open, onClose, initialData, userId, onSuccess }: ItemDialogProps) {
  const [form, setForm] = useState<ItemForm>(emptyForm)

  useEffect(() => {
    if (open) {
      if (initialData) {
        const tags = (() => { try { return JSON.parse(initialData.tags || '[]') as string[] } catch { return [] } })()
        setForm({
          title: initialData.title,
          description: initialData.description,
          imageUrl: initialData.imageUrl,
          projectUrl: initialData.projectUrl,
          tagsInput: tags.join(', '),
        })
      } else {
        setForm(emptyForm)
      }
    }
  }, [open, initialData])

  const set = (field: keyof ItemForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error('Title is required')
      const tags = form.tagsInput.split(',').map(t => t.trim()).filter(Boolean)
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        imageUrl: form.imageUrl.trim(),
        projectUrl: form.projectUrl.trim(),
        tags: JSON.stringify(tags),
      }
      if (initialData) {
        await tables.portfolioItems.update(initialData.id, payload)
      } else {
        await tables.portfolioItems.create({ userId, ...payload })
      }
    },
    onSuccess: () => {
      toast.success(initialData ? 'Portfolio item updated!' : 'Portfolio item added!')
      onSuccess()
      onClose()
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save item'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Portfolio Item' : 'Add Portfolio Item'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Title *</label>
            <Input value={form.title} onChange={set('title')} placeholder="e.g. E-commerce Dashboard" />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
            <Textarea
              value={form.description}
              onChange={set('description')}
              placeholder="Describe the project, your role, technologies used..."
              rows={3}
              className="resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Image URL</label>
            <Input
              value={form.imageUrl}
              onChange={set('imageUrl')}
              placeholder="https://example.com/image.jpg"
              type="url"
            />
            {form.imageUrl && (
              <div className="mt-2 rounded-xl overflow-hidden border border-border aspect-video bg-muted">
                <img
                  src={form.imageUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.opacity = '0' }}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Project URL</label>
            <Input
              value={form.projectUrl}
              onChange={set('projectUrl')}
              placeholder="https://github.com/..."
              type="url"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Tags <span className="text-muted-foreground font-normal">(comma-separated)</span>
            </label>
            <Input
              value={form.tagsInput}
              onChange={set('tagsInput')}
              placeholder="React, TypeScript, Node.js"
            />
            {form.tagsInput && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.tagsInput.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.title.trim()}
            className="gradient-amber text-white border-0"
          >
            {mutation.isPending ? 'Saving...' : initialData ? 'Save Changes' : 'Add Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function PortfolioPage() {
  const { user, profile, isLoading } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null)

  useEffect(() => {
    if (!isLoading && !user) navigate({ to: '/auth/login' })
    if (!isLoading && profile && profile.role !== 'freelancer') navigate({ to: '/client/dashboard' })
  }, [isLoading, user, profile])

  const { data: items = [], isLoading: itemsLoading } = useQuery<PortfolioItem[]>({
    queryKey: ['portfolio', user?.id],
    queryFn: () => tables.portfolioItems.list({ where: { userId: user!.id }, orderBy: { createdAt: 'desc' } }) as Promise<PortfolioItem[]>,
    enabled: !!user,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tables.portfolioItems.delete(id),
    onSuccess: () => {
      toast.success('Portfolio item deleted')
      qc.invalidateQueries({ queryKey: ['portfolio', user?.id] })
    },
    onError: () => toast.error('Failed to delete item'),
  })

  const handleEdit = (item: PortfolioItem) => {
    setEditingItem(item)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingItem(null)
    setDialogOpen(true)
  }

  const handleClose = () => {
    setDialogOpen(false)
    setEditingItem(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="page-container animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Portfolio</h1>
          <p className="text-muted-foreground mt-1">Showcase your best work to attract clients</p>
        </div>
        <Button onClick={handleAdd} className="gradient-amber text-white border-0 gap-2 shrink-0">
          <Plus size={16} />
          Add Portfolio Item
        </Button>
      </div>

      {/* ── Grid ───────────────────────────────────────────────────────── */}
      {itemsLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-video bg-muted" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-full bg-muted rounded" />
                <div className="h-3 w-2/3 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-5">
            <FolderOpen size={36} className="text-muted-foreground opacity-40" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No portfolio items yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Showcase your best projects to stand out to potential clients
          </p>
          <Button onClick={handleAdd} className="gradient-amber text-white border-0 gap-2">
            <Plus size={16} />
            Add Your First Project
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map(item => (
            <PortfolioCard
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onDelete={id => deleteMutation.mutate(id)}
              isDeleting={deleteMutation.isPending}
            />
          ))}
          {/* Add more card */}
          <button
            onClick={handleAdd}
            className="border-2 border-dashed border-border rounded-2xl aspect-auto min-h-[200px] flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-muted/30 transition-colors group"
          >
            <div className="w-12 h-12 rounded-xl border-2 border-dashed border-border group-hover:border-primary/50 flex items-center justify-center transition-colors">
              <Plus size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors font-medium">Add New Project</span>
          </button>
        </div>
      )}

      {/* Form dialog */}
      {user && (
        <ItemDialog
          open={dialogOpen}
          onClose={handleClose}
          initialData={editingItem}
          userId={user.id}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['portfolio', user.id] })}
        />
      )}
    </div>
  )
}
