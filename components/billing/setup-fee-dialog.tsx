'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { Receipt, Mail, DollarSign, Calendar, FileText, Zap } from 'lucide-react'

interface SetupFeeDialogProps {
  organizationId: string
  currentEmail?: string | null
  hasPaymentMethod?: boolean
  onInvoiceCreated?: (invoiceUrl: string) => void
}

export function SetupFeeDialog({ organizationId, currentEmail, hasPaymentMethod, onInvoiceCreated }: SetupFeeDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [email, setEmail] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [daysUntilDue, setDaysUntilDue] = useState('30')
  
  // Initialize email when dialog opens or currentEmail changes
  useEffect(() => {
    if (open && currentEmail) {
      setEmail(currentEmail)
    }
  }, [open, currentEmail])
  
  // Calculate preview amount in pounds
  const previewAmount = amount ? (parseInt(amount) / 100).toFixed(2) : '0.00'

  const handleSubmit = async (e: React.FormEvent, chargeNow: boolean = false) => {
    e.preventDefault()
    
    if (!email) {
      toast.error('Billing email is required')
      return
    }
    
    setLoading(true)

    try {
      const endpoint = chargeNow 
        ? `/api/admin/organizations/${organizationId}/billing/charge-now`
        : `/api/admin/organizations/${organizationId}/billing/setup-fee`
        
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_cents: parseInt(amount),
          billing_email: email,
          title: title || undefined,
          description: description || undefined,
          days_until_due: chargeNow ? undefined : parseInt(daysUntilDue),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to ${chargeNow ? 'charge' : 'create'} invoice`)
      }

      const { invoice } = await response.json()
      
      toast.success(chargeNow ? 'Payment charged successfully!' : 'Invoice created successfully!')
      setOpen(false)
      
      // Reset form
      setAmount('')
      setTitle('')
      setDescription('')
      setDaysUntilDue('30')
      
      if (invoice.hosted_invoice_url) {
        onInvoiceCreated?.(invoice.hosted_invoice_url)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${chargeNow ? 'charge' : 'create'} invoice`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Receipt className="h-4 w-4 mr-2" />
          Create Invoice
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-lg p-4">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Create Invoice
          </SheetTitle>
          <SheetDescription>
            {hasPaymentMethod 
              ? 'Charge immediately or send an invoice to pay later.'
              : 'Generate a one-time invoice for any charges.'
            }
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {hasPaymentMethod && (
            <div className="p-3 bg-green-50 rounded-md border border-green-200">
              <div className="flex items-center gap-2 text-sm text-green-900">
                <Zap className="h-4 w-4 text-green-600" />
                <span className="font-medium">Payment method on file</span>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <Label htmlFor="email" className="text-sm">Billing Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="billing@example.com"
                required
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="title" className="text-sm">Invoice Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Setup Fee"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="description" className="text-sm">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details"
                className="mt-1"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <Label htmlFor="amount" className="text-sm">Amount (pence) *</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000"
                required
                min="0"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                = £{previewAmount}
              </p>
            </div>
            
            <div>
              <Label htmlFor="daysUntilDue" className="text-sm">Days Until Due *</Label>
              <Input
                id="daysUntilDue"
                type="number"
                value={daysUntilDue}
                onChange={(e) => setDaysUntilDue(e.target.value)}
                placeholder="30"
                required
                min="1"
                max="365"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Due: {new Date(Date.now() + parseInt(daysUntilDue || '30') * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {hasPaymentMethod && (
              <Button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={loading}
                className="w-full"
              >
                <Zap className="h-4 w-4 mr-2" />
                {loading ? 'Processing...' : 'Charge Now'}
              </Button>
            )}
            <Button
              type="submit"
              variant={hasPaymentMethod ? 'outline' : 'default'}
              disabled={loading}
              className="w-full"
            >
              <Mail className="h-4 w-4 mr-2" />
              {loading ? 'Creating...' : 'Send Invoice'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

