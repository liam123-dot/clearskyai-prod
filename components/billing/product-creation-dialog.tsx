'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Package, DollarSign, Clock, TrendingUp, Receipt, Repeat, Activity } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

interface ProductCreationDialogProps {
  onProductCreated: () => void
}

type ProductType = 'one_time' | 'recurring' | 'usage_based'

export function ProductCreationDialog({ onProductCreated }: ProductCreationDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [productType, setProductType] = useState<ProductType>('recurring')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount_cents: '',
    interval: 'month',
    interval_count: '1',
    trial_days: '',
    minutes_included: '',
    price_per_minute_cents: '',
  })
  
  // Calculate preview amounts in pounds
  const amountPreview = formData.amount_cents 
    ? (parseInt(formData.amount_cents) / 100).toFixed(2) 
    : '0.00'
  const perMinutePreview = formData.price_per_minute_cents 
    ? (parseInt(formData.price_per_minute_cents) / 100).toFixed(4) 
    : '0.0000'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const basePayload = {
        type: productType,
        name: formData.name,
        description: formData.description || undefined,
        amount_cents: parseInt(formData.amount_cents),
        currency: 'gbp',
      }

      let payload: any = { ...basePayload }

      if (productType === 'recurring') {
        payload.interval = formData.interval
        payload.interval_count = parseInt(formData.interval_count)
        if (formData.trial_days) {
          payload.trial_days = parseInt(formData.trial_days)
        }
      } else if (productType === 'usage_based') {
        payload.amount_cents = 0 // Usage-based products don't have a fixed fee
        payload.minutes_included = parseInt(formData.minutes_included)
        payload.price_per_minute_cents = parseInt(formData.price_per_minute_cents)
      }

      const response = await fetch('/api/admin/products/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create product')
      }

      toast.success('Product created successfully')
      setOpen(false)
      setFormData({
        name: '',
        description: '',
        amount_cents: '',
        interval: 'month',
        interval_count: '1',
        trial_days: '',
        minutes_included: '',
        price_per_minute_cents: '',
      })
      onProductCreated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create product')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Package className="h-4 w-4 mr-2" />
          Create Product
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Create New Product
          </SheetTitle>
          <SheetDescription>
            Choose a product type and configure pricing details.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 p-4">
          {/* Product Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Product Type *</Label>
            <ToggleGroup 
              type="single" 
              value={productType}
              onValueChange={(value) => value && setProductType(value as ProductType)}
              className="grid grid-cols-3 gap-2"
            >
              <ToggleGroupItem 
                value="one_time" 
                className="flex flex-col items-center gap-2 h-auto p-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <Receipt className="h-5 w-5" />
                <div className="text-center">
                  <div className="font-medium text-sm">One-Time</div>
                  <div className="text-xs opacity-80">Setup fees</div>
                </div>
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="recurring" 
                className="flex flex-col items-center gap-2 h-auto p-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <Repeat className="h-5 w-5" />
                <div className="text-center">
                  <div className="font-medium text-sm">Recurring</div>
                  <div className="text-xs opacity-80">Subscriptions</div>
                </div>
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="usage_based" 
                className="flex flex-col items-center gap-2 h-auto p-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <Activity className="h-5 w-5" />
                <div className="text-center">
                  <div className="font-medium text-sm">Usage-Based</div>
                  <div className="text-xs opacity-80">Metered</div>
                </div>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Common Fields */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="name" className="text-sm">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={
                  productType === 'one_time' ? 'e.g., Setup Fee' :
                  productType === 'recurring' ? 'e.g., Professional Plan' :
                  'e.g., Voice AI Minutes'
                }
                required
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="description" className="text-sm">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description"
                className="mt-1"
                rows={2}
              />
            </div>

            {productType !== 'usage_based' && (
              <div>
                <Label htmlFor="amount_cents" className="text-sm">
                  {productType === 'one_time' ? 'Amount (pence) *' : 'Monthly Price (pence) *'}
                </Label>
                <Input
                  id="amount_cents"
                  type="number"
                  value={formData.amount_cents}
                  onChange={(e) => setFormData({ ...formData, amount_cents: e.target.value })}
                  placeholder="50000"
                  required
                  min="0"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  = £{amountPreview}
                  {productType === 'recurring' && '/month'}
                </p>
              </div>
            )}
          </div>

          {/* Recurring-specific Fields */}
          {productType === 'recurring' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Subscription Details</CardTitle>
                <CardDescription className="text-xs">Configure billing interval and trial period</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="interval" className="text-sm">Interval</Label>
                    <select
                      id="interval"
                      value={formData.interval}
                      onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-input bg-background rounded-md text-sm"
                    >
                      <option value="day">Daily</option>
                      <option value="week">Weekly</option>
                      <option value="month">Monthly</option>
                      <option value="year">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="interval_count" className="text-sm">Count</Label>
                    <Input
                      id="interval_count"
                      type="number"
                      value={formData.interval_count}
                      onChange={(e) => setFormData({ ...formData, interval_count: e.target.value })}
                      min="1"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="trial_days" className="text-sm">Trial Days (optional)</Label>
                  <Input
                    id="trial_days"
                    type="number"
                    value={formData.trial_days}
                    onChange={(e) => setFormData({ ...formData, trial_days: e.target.value })}
                    placeholder="0"
                    min="0"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Free trial period before first charge
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Usage-based Fields */}
          {productType === 'usage_based' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Usage Pricing</CardTitle>
                <CardDescription className="text-xs">Configure graduated tier pricing for minutes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="minutes_included" className="text-sm">Included Minutes *</Label>
                  <Input
                    id="minutes_included"
                    type="number"
                    value={formData.minutes_included}
                    onChange={(e) => setFormData({ ...formData, minutes_included: e.target.value })}
                    placeholder="1000"
                    required={productType === 'usage_based'}
                    min="0"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    First tier at £0 (included in base price)
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="price_per_minute_cents" className="text-sm">Overage Rate (pence/min) *</Label>
                  <Input
                    id="price_per_minute_cents"
                    type="number"
                    value={formData.price_per_minute_cents}
                    onChange={(e) => setFormData({ ...formData, price_per_minute_cents: e.target.value })}
                    placeholder="5"
                    required={productType === 'usage_based'}
                    min="0"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    = £{perMinutePreview}/min for usage above included minutes
                  </p>
                </div>

                {formData.minutes_included && formData.price_per_minute_cents && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium mb-1">Pricing Tiers Preview:</p>
                    <div className="text-xs space-y-1 text-muted-foreground">
                      <div>• 0 - {formData.minutes_included} minutes: £0.00</div>
                      <div>• {formData.minutes_included}+ minutes: £{perMinutePreview}/min</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="pt-2">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating...' : 'Create Product'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
