'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SetupFeeDialog } from './setup-fee-dialog'
import { CheckoutLinkDialog } from './checkout-link-dialog'
import { OrganizationBillingState } from '@/lib/billing'
import { toast } from 'sonner'
import { 
  CreditCard, 
  Package, 
  DollarSign,
  Calendar
} from 'lucide-react'

interface BillingPageClientProps {
  initialState: OrganizationBillingState
}

export function BillingPageClient({ initialState }: BillingPageClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(cents / 100)
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

  const totalMonthlySpend = initialState.activeSubscriptions.reduce(
    (sum, sub) => sum + sub.product.amount_cents, 0
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
          <CheckoutLinkDialog
            organizationId={initialState.organization.id}
            products={initialState.allProducts || []}
          />
          <SetupFeeDialog
            organizationId={initialState.organization.id}
            currentEmail={initialState.organization.billing_email}
            hasPaymentMethod={initialState.hasPaymentMethod}
          />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Payment Method</p>
                {initialState.hasPaymentMethod ? (
                  <p className="text-lg font-semibold">Active</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-lg font-semibold text-orange-600">Not Set</p>
                    <Button
                      size="sm"
                      onClick={handleGeneratePaymentLink}
                      disabled={loading === 'payment-link'}
                      variant="outline"
                    >
                      {loading === 'payment-link' ? 'Generating...' : 'Add'}
                    </Button>
                  </div>
                )}
              </div>
              <CreditCard className={`h-5 w-5 ${initialState.hasPaymentMethod ? 'text-green-600' : 'text-muted-foreground'}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Subscriptions</p>
                <p className="text-lg font-semibold">{initialState.activeSubscriptions.length}</p>
              </div>
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Monthly Spend</p>
                <p className="text-lg font-semibold">{formatCurrency(totalMonthlySpend)}</p>
              </div>
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {initialState.activeSubscriptions.length > 0 && (
        <div className="space-y-3">
            {initialState.activeSubscriptions.map((sub) => (
            <Card key={sub.id}>
              <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{sub.product.name}</h3>
                      <Badge variant="secondary" className="text-xs">{sub.status}</Badge>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    {sub.product.product_type === 'recurring' && (
                        <span>{formatCurrency(sub.product.amount_cents)}/month</span>
                    )}
                    {sub.product.product_type === 'usage_based' && sub.product.minutes_included && (
                      <>
                          <span>{sub.product.minutes_included.toLocaleString()} min included</span>
                          <span>{formatCurrency(sub.product.price_per_minute_cents || 0)}/min overage</span>
                      </>
                    )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
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
                  </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelSubscription(sub.id)}
                      disabled={loading === `cancel-${sub.id}`}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                    Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  )
}

