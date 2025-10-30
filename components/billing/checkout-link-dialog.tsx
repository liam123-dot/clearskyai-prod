'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { ExternalLink, Copy, Check, Receipt, Repeat, Activity } from 'lucide-react'
import { Product } from '@/lib/products'
import { Checkbox } from '@/components/ui/checkbox'

interface CheckoutLinkDialogProps {
  organizationId: string
  products: Product[]
}

export function CheckoutLinkDialog({ organizationId, products }: CheckoutLinkDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])

  // Group products by type
  const oneTimeProducts = products.filter(p => p.product_type === 'one_time')
  const recurringProducts = products.filter(p => p.product_type === 'recurring')
  const usageBasedProducts = products.filter(p => p.product_type === 'usage_based')

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(cents / 100)
  }

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  const getSelectedProductDetails = () => {
    return products.filter(p => selectedProducts.includes(p.id))
  }

  const calculateTotal = () => {
    const selected = getSelectedProductDetails()
    const oneTimeTotal = selected
      .filter(p => p.product_type === 'one_time')
      .reduce((sum, p) => sum + p.amount_cents, 0)
    const recurringTotal = selected
      .filter(p => p.product_type === 'recurring')
      .reduce((sum, p) => sum + p.amount_cents, 0)
    
    return { oneTimeTotal, recurringTotal }
  }

  const handleGenerateLink = async () => {
    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product')
      return
    }

    setLoading(true)
    setCheckoutUrl(null)

    try {
      const response = await fetch(
        `/api/admin/organizations/${organizationId}/checkout-link`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_ids: selectedProducts }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate checkout link')
      }

      const { url } = await response.json()
      setCheckoutUrl(url)
      toast.success('Checkout link generated!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate link')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = async () => {
    if (checkoutUrl) {
      await navigator.clipboard.writeText(checkoutUrl)
      setCopied(true)
      toast.success('Link copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleOpenLink = () => {
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank')
    }
  }

  const handleClose = () => {
    setOpen(false)
    setCheckoutUrl(null)
    setSelectedProducts([])
    setCopied(false)
  }

  const totals = calculateTotal()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <ExternalLink className="h-4 w-4 mr-2" />
          Create Checkout Link
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Checkout Link</DialogTitle>
          <DialogDescription>
            Select products to include in the checkout session. You can combine different product types.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* One-Time Products */}
          {oneTimeProducts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">One-Time Products</h3>
              </div>
              <div className="space-y-2">
                {oneTimeProducts.map((product) => (
                  <Card 
                    key={product.id}
                    className={selectedProducts.includes(product.id) ? 'ring-2 ring-primary' : ''}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={() => toggleProduct(product.id)}
                        />
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">{product.name}</p>
                              {product.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {product.description}
                                </p>
                              )}
                            </div>
                            <p className="font-semibold">
                              {formatCurrency(product.amount_cents)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Recurring Products */}
          {recurringProducts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Recurring Products</h3>
              </div>
              <div className="space-y-2">
                {recurringProducts.map((product) => (
                  <Card 
                    key={product.id}
                    className={selectedProducts.includes(product.id) ? 'ring-2 ring-primary' : ''}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={() => toggleProduct(product.id)}
                        />
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">{product.name}</p>
                              {product.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {product.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  {product.interval_count > 1 ? `Every ${product.interval_count} ` : ''}
                                  {product.interval}
                                  {product.interval_count > 1 ? 's' : ''}
                                </span>
                                {product.trial_days && product.trial_days > 0 && (
                                  <>
                                    <span className="text-xs text-muted-foreground">•</span>
                                    <span className="text-xs text-green-600 font-medium">
                                      {product.trial_days} day trial
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <p className="font-semibold">
                              {formatCurrency(product.amount_cents)}
                              <span className="text-xs text-muted-foreground">/{product.interval}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Usage-Based Products */}
          {usageBasedProducts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Usage-Based Products</h3>
              </div>
              <div className="space-y-2">
                {usageBasedProducts.map((product) => (
                  <Card 
                    key={product.id}
                    className={selectedProducts.includes(product.id) ? 'ring-2 ring-primary' : ''}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={() => toggleProduct(product.id)}
                        />
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">{product.name}</p>
                              {product.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {product.description}
                                </p>
                              )}
                              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                <div>
                                  First {product.minutes_included?.toLocaleString()} minutes free
                                </div>
                                <div>
                                  Then {formatCurrency(product.price_per_minute_cents || 0)}/min
                                </div>
                                <div className="text-xs italic mt-1">
                                  Billed per second
                                </div>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Pay as you go
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {selectedProducts.length > 0 && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="font-semibold text-sm">Selected Products Summary</p>
                  <div className="space-y-1 text-sm">
                    {totals.oneTimeTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">One-time total:</span>
                        <span className="font-medium">{formatCurrency(totals.oneTimeTotal)}</span>
                      </div>
                    )}
                    {totals.recurringTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monthly recurring:</span>
                        <span className="font-medium">{formatCurrency(totals.recurringTotal)}</span>
                      </div>
                    )}
                    {getSelectedProductDetails().some(p => p.product_type === 'usage_based') && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Usage-based pricing:</span>
                        <span className="font-medium text-xs">Metered per call</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Checkout URL Display */}
          {checkoutUrl && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="font-semibold text-sm text-green-900">Checkout Link Generated</p>
                  <p className="text-xs text-green-700 mt-1">
                    Share this link with your client to complete the checkout
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    className="flex-1"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 mr-2" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-2" />
                        Copy Link
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenLink}
                    className="flex-1"
                  >
                    <ExternalLink className="h-3 w-3 mr-2" />
                    Open Link
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {!checkoutUrl ? (
              <>
                <Button
                  onClick={handleGenerateLink}
                  disabled={loading || selectedProducts.length === 0}
                  className="flex-1"
                >
                  {loading ? 'Generating...' : 'Generate Checkout Link'}
                </Button>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={handleClose} className="flex-1">
                Done
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

