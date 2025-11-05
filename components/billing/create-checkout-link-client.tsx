'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { ExternalLink, Copy, Check, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'
import { Product } from '@/lib/products'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'

interface CreateCheckoutLinkClientProps {
  organizationId: string
  organizationSlug: string
  products: Product[]
}

export function CreateCheckoutLinkClient({ organizationId, organizationSlug, products }: CreateCheckoutLinkClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [expandedSections, setExpandedSections] = useState({
    oneTime: true,
    recurring: true,
    usageBased: true,
  })

  // Group products by type
  const oneTimeProducts = products.filter(p => p.product_type === 'one_time')
  const recurringProducts = products.filter(p => p.product_type === 'recurring')
  const usageBasedProducts = products.filter(p => p.product_type === 'usage_based')

  const toggleSection = (section: 'oneTime' | 'recurring' | 'usageBased') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(cents / 100)
  }

  const toggleProduct = (productId: string, productType: string) => {
    setSelectedProducts(prev => {
      const isSelected = prev.includes(productId)
      
      if (isSelected) {
        // Deselect
        return prev.filter(id => id !== productId)
      } else {
        // Check constraints before selecting
        const selectedDetails = products.filter(p => prev.includes(p.id))
        
        // Only allow one recurring product
        if (productType === 'recurring') {
          const hasRecurring = selectedDetails.some(p => p.product_type === 'recurring')
          if (hasRecurring) {
            toast.error('Only one recurring product can be selected per checkout link')
            return prev
          }
        }
        
        // Only allow one usage-based product
        if (productType === 'usage_based') {
          const hasUsageBased = selectedDetails.some(p => p.product_type === 'usage_based')
          if (hasUsageBased) {
            toast.error('Only one usage-based product can be selected per checkout link')
            return prev
          }
        }
        
        // Add product
        return [...prev, productId]
      }
    })
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

  const totals = calculateTotal()
  const selectedRecurring = getSelectedProductDetails().filter(p => p.product_type === 'recurring')
  const selectedUsageBased = getSelectedProductDetails().filter(p => p.product_type === 'usage_based')

  return (
    <div className="container max-w-6xl py-6 space-y-4">
      {/* Simple Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push(`/admin/client/${organizationSlug}/billing`)}
        className="mb-2"
      >
        <ArrowLeft className="h-3 w-3 mr-1" />
        Billing
      </Button>

      {/* Product Table */}
      <div>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="w-12 px-4 py-2"></th>
                <th className="text-left px-4 py-2 text-sm font-medium">Product</th>
                <th className="text-left px-4 py-2 text-sm font-medium">Type</th>
                <th className="text-right px-4 py-2 text-sm font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {/* One-Time Products Section */}
              {oneTimeProducts.length > 0 && (
                <>
                  <tr className="border-t-2 border-b bg-muted/30">
                    <td colSpan={4} className="px-4 py-2">
                      <button
                        onClick={() => toggleSection('oneTime')}
                        className="flex items-center gap-2 w-full text-left hover:opacity-70 transition-opacity"
                      >
                        {expandedSections.oneTime ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-medium text-sm">One-Time Products</span>
                        <Badge variant="secondary" className="text-xs ml-2">
                          {oneTimeProducts.length}
                        </Badge>
                      </button>
                    </td>
                  </tr>
                  {expandedSections.oneTime && oneTimeProducts.map((product) => (
                    <tr
                      key={product.id}
                      className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedProducts.includes(product.id) ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => toggleProduct(product.id, product.product_type)}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={() => toggleProduct(product.id, product.product_type)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-sm">{product.name}</p>
                          {product.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{product.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs">One-time</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(product.amount_cents)}
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {/* Recurring Products Section */}
              {recurringProducts.length > 0 && (
                <>
                  <tr className="border-t-2 border-b bg-muted/30">
                    <td colSpan={4} className="px-4 py-2">
                      <button
                        onClick={() => toggleSection('recurring')}
                        className="flex items-center gap-2 w-full text-left hover:opacity-70 transition-opacity"
                      >
                        {expandedSections.recurring ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-medium text-sm">Recurring Products</span>
                        <Badge variant="secondary" className="text-xs ml-2">
                          {recurringProducts.length}
                        </Badge>
                      </button>
                    </td>
                  </tr>
                  {expandedSections.recurring && recurringProducts.map((product) => {
                    const isDisabled = selectedRecurring.length > 0 && !selectedProducts.includes(product.id)
                    return (
                      <tr
                        key={product.id}
                        className={`transition-colors ${
                          isDisabled
                            ? 'opacity-40 cursor-not-allowed'
                            : selectedProducts.includes(product.id)
                            ? 'bg-primary/5 cursor-pointer'
                            : 'cursor-pointer hover:bg-muted/50'
                        }`}
                        onClick={() => !isDisabled && toggleProduct(product.id, product.product_type)}
                      >
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedProducts.includes(product.id)}
                            disabled={isDisabled}
                            onCheckedChange={() => toggleProduct(product.id, product.product_type)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-sm">{product.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>
                                {product.interval_count > 1 ? `Every ${product.interval_count} ` : ''}
                                {product.interval}
                                {product.interval_count > 1 ? 's' : ''}
                              </span>
                              {product.trial_days && product.trial_days > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-green-600">{product.trial_days}d trial</span>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-xs">Recurring</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-semibold">{formatCurrency(product.amount_cents)}</div>
                          <div className="text-xs text-muted-foreground">/{product.interval}</div>
                        </td>
                      </tr>
                    )
                  })}
                </>
              )}

              {/* Usage-Based Products Section */}
              {usageBasedProducts.length > 0 && (
                <>
                  <tr className="border-t-2 border-b bg-muted/30">
                    <td colSpan={4} className="px-4 py-2">
                      <button
                        onClick={() => toggleSection('usageBased')}
                        className="flex items-center gap-2 w-full text-left hover:opacity-70 transition-opacity"
                      >
                        {expandedSections.usageBased ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-medium text-sm">Usage-Based Products</span>
                        <Badge variant="secondary" className="text-xs ml-2">
                          {usageBasedProducts.length}
                        </Badge>
                      </button>
                    </td>
                  </tr>
                  {expandedSections.usageBased && usageBasedProducts.map((product) => {
                    const isDisabled = selectedUsageBased.length > 0 && !selectedProducts.includes(product.id)
                    return (
                      <tr
                        key={product.id}
                        className={`transition-colors ${
                          isDisabled
                            ? 'opacity-40 cursor-not-allowed'
                            : selectedProducts.includes(product.id)
                            ? 'bg-primary/5 cursor-pointer'
                            : 'cursor-pointer hover:bg-muted/50'
                        }`}
                        onClick={() => !isDisabled && toggleProduct(product.id, product.product_type)}
                      >
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedProducts.includes(product.id)}
                            disabled={isDisabled}
                            onCheckedChange={() => toggleProduct(product.id, product.product_type)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-sm">{product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {product.minutes_included?.toLocaleString()} min free, then {formatCurrency(product.price_per_minute_cents || 0)}/min
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-xs">Usage</Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                          Pay as you go
                        </td>
                      </tr>
                    )
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Limit: Multiple one-time products, one recurring, one usage-based
        </p>
      </div>

      {/* Summary and Actions at Bottom */}
      <div className="space-y-3">
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="space-y-2 flex-1 min-w-[200px]">
                <p className="text-sm font-medium">
                  {selectedProducts.length === 0 
                    ? 'No products selected' 
                    : `${selectedProducts.length} selected`
                  }
                </p>
                
                {selectedProducts.length > 0 && (
                  <div className="flex items-center gap-6 text-sm">
                    {totals.oneTimeTotal > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">One-time:</span>
                        <span className="font-semibold">{formatCurrency(totals.oneTimeTotal)}</span>
                      </div>
                    )}
                    {totals.recurringTotal > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Monthly:</span>
                        <span className="font-semibold">{formatCurrency(totals.recurringTotal)}</span>
                      </div>
                    )}
                    {getSelectedProductDetails().some(p => p.product_type === 'usage_based') && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Usage:</span>
                        <span className="text-xs">Metered</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <Button
                onClick={handleGenerateLink}
                disabled={loading || selectedProducts.length === 0}
                size="lg"
              >
                {loading ? 'Generating...' : 'Generate Link'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {checkoutUrl && (
          <Card className="border-green-600">
            <CardContent className="pt-6 space-y-3">
              <div className="p-2 bg-muted rounded text-xs break-all">
                {checkoutUrl}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="flex-1"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenLink}
                  className="flex-1"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

