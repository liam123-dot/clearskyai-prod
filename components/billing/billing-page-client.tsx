'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { SetupFeeDialog } from './setup-fee-dialog'
import { CheckoutLinkDialog } from './checkout-link-dialog'
import { OrganizationBillingState } from '@/lib/billing'
import { toast } from 'sonner'
import { 
  CreditCard, 
  Package, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  Receipt,
  Plus,
  ExternalLink,
  DollarSign,
  Calendar
} from 'lucide-react'

interface BillingPageClientProps {
  initialState: OrganizationBillingState
}

export function BillingPageClient({ initialState }: BillingPageClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(cents / 100)
  }

  const handleAttachProduct = async (productId: string) => {
    setLoading(`attach-${productId}`)
    try {
      const response = await fetch(
        `/api/admin/organizations/${initialState.organization.id}/products/attach`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_id: productId }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to attach product')
      }

      toast.success('Product attached successfully')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to attach product')
    } finally {
      setLoading(null)
    }
  }

  const handleGeneratePaymentLink = async () => {
    setLoading('payment-link')
    try {
      const response = await fetch(
        `/api/admin/organizations/${initialState.organization.id}/billing/payment-link`,
        {
          method: 'POST',
        }
      )

      if (!response.ok) {
        throw new Error('Failed to generate payment link')
      }

      const { url } = await response.json()
      
      window.open(url, '_blank')
      toast.success('Payment link opened in new tab')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate payment link')
    } finally {
      setLoading(null)
    }
  }

  const handleStartSubscription = async (productId: string) => {
    setLoading(`start-${productId}`)
    try {
      const response = await fetch(
        `/api/admin/organizations/${initialState.organization.id}/subscriptions/start`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_id: productId }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start subscription')
      }

      toast.success('Subscription started successfully')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start subscription')
    } finally {
      setLoading(null)
    }
  }

  const handleCancelSubscription = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to cancel this subscription? It will remain active until the end of the billing period.')) {
      return
    }

    setLoading(`cancel-${subscriptionId}`)
    try {
      const response = await fetch(
        `/api/admin/organizations/${initialState.organization.id}/subscriptions/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription_id: subscriptionId }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to cancel subscription')
      }

      toast.success('Subscription will be cancelled at period end')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel subscription')
    } finally {
      setLoading(null)
    }
  }

  const handleInvoiceCreated = (url: string) => {
    setInvoiceUrl(url)
    router.refresh()
  }

  const handleChargeInvoice = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to charge this invoice now using the saved payment method?')) {
      return
    }

    setLoading(`charge-invoice-${invoiceId}`)
    try {
      const response = await fetch(
        `/api/admin/organizations/${initialState.organization.id}/billing/charge-invoice`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoice_id: invoiceId }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to charge invoice')
      }

      toast.success('Invoice charged successfully!')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to charge invoice')
    } finally {
      setLoading(null)
    }
  }

  // Calculate summary metrics
  const openInvoices = initialState.invoices.filter(inv => inv.status === 'open')
  const totalOutstanding = openInvoices.reduce((sum, inv) => sum + (inv.amount_due || 0), 0)
  const totalMonthlySpend = initialState.activeSubscriptions.reduce(
    (sum, sub) => sum + sub.product.amount_cents, 0
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted-foreground mt-1">
            Billing & Subscription Management
          </p>
        </div>
        <div className="flex gap-2">
          <CheckoutLinkDialog
            organizationId={initialState.organization.id}
            products={initialState.allProducts || []}
          />
          <SetupFeeDialog
            organizationId={initialState.organization.id}
            currentEmail={initialState.organization.billing_email}
            hasPaymentMethod={initialState.hasPaymentMethod}
            onInvoiceCreated={handleInvoiceCreated}
          />
        </div>
      </div>

      {/* Alert for pending invoices */}
      {openInvoices.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900">Pending Payment</h3>
                <p className="text-sm text-orange-700 mt-1">
                  You have {openInvoices.length} outstanding invoice{openInvoices.length > 1 ? 's' : ''} totaling {formatCurrency(totalOutstanding)}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="border-orange-600 text-orange-600 hover:bg-orange-100"
                onClick={() => document.getElementById('invoices-section')?.scrollIntoView({ behavior: 'smooth' })}
              >
                View Invoices
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Payment Method Card */}
        <Card className={initialState.hasPaymentMethod ? 'border-green-200' : 'border-orange-200'}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className={`h-4 w-4 ${initialState.hasPaymentMethod ? 'text-green-600' : 'text-orange-600'}`} />
                  <p className="text-sm font-medium text-muted-foreground">Payment Method</p>
                </div>
                {initialState.hasPaymentMethod ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <p className="text-xl font-bold">Active</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xl font-bold text-orange-600 mb-2">Not Set</p>
                    <Button
                      size="sm"
                      onClick={handleGeneratePaymentLink}
                      disabled={loading === 'payment-link'}
                      className="w-full"
                    >
                      {loading === 'payment-link' ? 'Generating...' : 'Add Payment Method'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Subscriptions Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">Active Subscriptions</p>
                </div>
                <p className="text-3xl font-bold">{initialState.activeSubscriptions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Spend Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">Monthly Spend</p>
                </div>
                <p className="text-3xl font-bold">{formatCurrency(totalMonthlySpend)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice URL Display */}
      {invoiceUrl && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Receipt className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900">Invoice Created Successfully</h3>
                <p className="text-sm text-blue-700 mt-1">
                  A new invoice has been generated. Click below to view it.
                </p>
                <a
                  href={invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 mt-2"
                >
                  View Invoice <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Subscriptions */}
      {initialState.activeSubscriptions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                Active Subscriptions
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Your currently active product subscriptions
              </p>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            {initialState.activeSubscriptions.map((sub) => (
              <Card key={sub.id} className="border-green-100">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {sub.product.name}
                        <Badge variant={sub.status === 'active' ? 'default' : 'secondary'} className="ml-auto">
                          {sub.status}
                        </Badge>
                      </CardTitle>
                      {sub.product.description && (
                        <CardDescription className="mt-2">{sub.product.description}</CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Show price for recurring products */}
                    {sub.product.product_type === 'recurring' && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Monthly Price</p>
                        <p className="text-2xl font-bold">{formatCurrency(sub.product.amount_cents)}</p>
                      </div>
                    )}
                    
                    {/* Show included minutes for usage-based products */}
                    {sub.product.product_type === 'usage_based' && sub.product.minutes_included && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Included Minutes</p>
                          <p className="text-2xl font-bold">{sub.product.minutes_included.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Overage Rate</p>
                          <p className="text-2xl font-bold">{formatCurrency(sub.product.price_per_minute_cents || 0)}/min</p>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {new Date(sub.current_period_start).toLocaleDateString('en-GB', { 
                        month: 'short', 
                        day: 'numeric' 
                      })} - {new Date(sub.current_period_end).toLocaleDateString('en-GB', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleCancelSubscription(sub.id)}
                      disabled={loading === `cancel-${sub.id}`}
                    >
                      {loading === `cancel-${sub.id}` ? 'Cancelling...' : 'Cancel Subscription'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {initialState.allProducts && initialState.allProducts.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Package className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900">Create Checkout Link</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Select any combination of products to create a customized checkout link for this client. 
                  You can combine one-time fees, recurring subscriptions, and usage-based pricing.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices */}
      {initialState.invoices.length > 0 && (
        <div id="invoices-section" className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Receipt className="h-6 w-6 text-muted-foreground" />
              Invoice History
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              View and manage your invoices
            </p>
          </div>

          <div className="space-y-3">
            {initialState.invoices.map((invoice) => (
              <Card 
                key={invoice.id} 
                className={
                  invoice.status === 'open' 
                    ? 'border-orange-200 bg-orange-50/50' 
                    : invoice.status === 'paid'
                    ? 'border-green-200'
                    : ''
                }
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">
                          {invoice.description || 'Invoice'}
                        </h3>
                        <Badge
                          variant={
                            invoice.status === 'paid'
                              ? 'default'
                              : invoice.status === 'open'
                              ? 'secondary'
                              : invoice.status === 'draft'
                              ? 'outline'
                              : 'destructive'
                          }
                        >
                          {invoice.status === 'open' ? 'Pending Payment' : 
                           invoice.status === 'paid' ? 'Paid' :
                           invoice.status === 'draft' ? 'Draft' :
                           invoice.status === 'void' ? 'Void' :
                           invoice.status === 'uncollectible' ? 'Uncollectible' :
                           invoice.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        {invoice.number && (
                          <span>Invoice #{invoice.number}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {invoice.created ? new Date(invoice.created * 1000).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          }) : '—'}
                        </span>
                        {invoice.status === 'open' && invoice.due_date && (
                          <span className="text-orange-600 font-medium">
                            Due: {new Date(invoice.due_date * 1000).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold">
                          {invoice.amount_due ? formatCurrency(invoice.amount_due) : '—'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {invoice.status === 'open' && initialState.hasPaymentMethod && (
                          <Button
                            size="sm"
                            onClick={() => handleChargeInvoice(invoice.id)}
                            disabled={loading === `charge-invoice-${invoice.id}`}
                          >
                            {loading === `charge-invoice-${invoice.id}` ? 'Charging...' : 'Pay Now'}
                          </Button>
                        )}
                        {invoice.hosted_invoice_url && (
                          <Button
                            variant={invoice.status === 'open' ? 'outline' : 'ghost'}
                            size="sm"
                            asChild
                          >
                            <a
                              href={invoice.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1"
                            >
                              View <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

