'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import type { CallAnnotation } from '@/lib/calls-helpers'

interface CallAnnotationDialogProps {
  open: boolean
  onClose: () => void
  callId: string
  slug?: string // For client, undefined for admin
  isAdmin?: boolean
  annotationLevel: 'call' | 'transcript_item'
  transcriptItemIndex?: number
  transcriptItemLabel?: string
  existingAnnotation?: CallAnnotation | null
}

export function CallAnnotationDialog({
  open,
  onClose,
  callId,
  slug,
  isAdmin = false,
  annotationLevel,
  transcriptItemIndex,
  transcriptItemLabel,
  existingAnnotation,
}: CallAnnotationDialogProps) {
  const [issueCategory, setIssueCategory] = useState(existingAnnotation?.issue_category || '')
  const [customCategory, setCustomCategory] = useState('')
  const [note, setNote] = useState(existingAnnotation?.note || '')
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false)

  const queryClient = useQueryClient()
  const baseUrl = isAdmin ? '/api/admin/calls' : `/api/${slug}/calls`

  // Fetch existing categories
  const { data: categoriesData } = useQuery<{ categories: string[] }>({
    queryKey: ['annotation-categories', isAdmin ? 'admin' : slug],
    queryFn: async () => {
      const url = isAdmin ? '/api/admin/calls/annotations/categories' : `/api/${slug}/calls/annotations/categories`
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch categories')
      return response.json()
    },
    enabled: open,
  })

  const categories = categoriesData?.categories || []

  // Reset form when dialog opens/closes or annotation changes
  useEffect(() => {
    if (open) {
      setIssueCategory(existingAnnotation?.issue_category || '')
      setNote(existingAnnotation?.note || '')
      setCustomCategory('')
      setIsAddingNewCategory(false)
    }
  }, [open, existingAnnotation])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: { annotation_level: string; transcript_item_index?: number; issue_category: string; note: string }) => {
      const response = await fetch(`${baseUrl}/${callId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create annotation')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-annotations', callId] })
      queryClient.invalidateQueries({ queryKey: ['annotation-categories'] })
      toast.success('Annotation created successfully')
      onClose()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { issue_category: string; note: string }) => {
      if (!existingAnnotation) throw new Error('No annotation to update')
      const response = await fetch(`${baseUrl}/${callId}/annotations/${existingAnnotation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update annotation')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-annotations', callId] })
      queryClient.invalidateQueries({ queryKey: ['annotation-categories'] })
      toast.success('Annotation updated successfully')
      onClose()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!existingAnnotation) throw new Error('No annotation to delete')
      const response = await fetch(`${baseUrl}/${callId}/annotations/${existingAnnotation.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete annotation')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-annotations', callId] })
      toast.success('Annotation deleted successfully')
      onClose()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = () => {
    const finalCategory = isAddingNewCategory ? customCategory.trim() : issueCategory

    if (!finalCategory || !note.trim()) {
      toast.error('Please fill in all fields')
      return
    }

    const data = {
      annotation_level: annotationLevel,
      transcript_item_index: annotationLevel === 'transcript_item' ? transcriptItemIndex : undefined,
      issue_category: finalCategory,
      note: note.trim(),
    }

    if (existingAnnotation) {
      updateMutation.mutate({
        issue_category: finalCategory,
        note: note.trim(),
      })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this annotation?')) {
      deleteMutation.mutate()
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {existingAnnotation ? 'Edit Annotation' : 'Add Annotation'}
          </DialogTitle>
          <DialogDescription>
            {annotationLevel === 'call' 
              ? 'Add notes about the overall call quality or issues.'
              : `Add notes about: ${transcriptItemLabel || 'this transcript item'}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="issue-category">Issue Category</Label>
            {isAddingNewCategory ? (
              <div className="space-y-2">
                <Input
                  id="custom-category"
                  placeholder="Enter new category..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsAddingNewCategory(false)
                    setCustomCategory('')
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Select value={issueCategory} onValueChange={setIssueCategory} disabled={isLoading}>
                  <SelectTrigger id="issue-category">
                    <SelectValue placeholder="Select a category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                    <SelectItem value="__add_new__">+ Add new category</SelectItem>
                  </SelectContent>
                </Select>
                {issueCategory === '__add_new__' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setIsAddingNewCategory(true)
                      setIssueCategory('')
                    }}
                    disabled={isLoading}
                  >
                    Enter custom category
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              placeholder="Describe what should have happened or what went wrong..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          {existingAnnotation && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
            >
              Delete
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || (!isAddingNewCategory && !issueCategory) || !note.trim()}
          >
            {isLoading ? 'Saving...' : existingAnnotation ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

