'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { OrganizationBillingState } from '@/lib/billing'
import { toast } from 'sonner'
import { 
  CreditCard, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
} from 'lucide-react'

interface UserBillingPageClientProps {
  initialState: OrganizationBillingState
  slug: string
}

export function UserBillingPageClient({ initialState, slug }: UserBillingPageClientProps) {
  const [loading, setLoading] = useState(false)

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(cents / 100)
  }

  const handleOpenCustomerPortal = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/${slug}/billing/customer-portal`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to create portal session')
      }

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open customer portal')
      setLoading(false)
    }
  }

  // Find base plan (recurring subscription)
  const basePlan = initialState.activeSubscriptions.find(
    sub => sub.product.product_type === 'recurring'
  )
  
  // Find usage-based subscription
  const usageSubscription = initialState.activeSubscriptions.find(
    sub => sub.product.product_type === 'usage_based'
  )
  
  const usage = usageSubscription?.usage

  // Calculate estimated next month bill
  const baseMonthlyPrice = basePlan?.product.amount_cents || 0
  const currentOverageCost = usage?.estimatedOverageCost ? Math.round(usage.estimatedOverageCost * 100) : 0
  const estimatedNextMonthBill = baseMonthlyPrice + currentOverageCost

  return (
    <div className="space-y-6">
      {/* Payment Method Alert */}
      {!initialState.hasPaymentMethod && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-orange-900">Payment method required</p>
                  <p className="text-sm text-orange-700">Add a payment method to continue</p>
                </div>
              </div>
              <Button
                onClick={handleOpenCustomerPortal}
                disabled={loading}
                size="sm"
                className="bg-orange-600 hover:bg-orange-700"
              >
                {loading ? 'Opening...' : 'Add Payment'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing Overview */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-6">
            {/* Payment Method */}
            <div className="flex items-center justify-between pb-4 border-b">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Payment Method</span>
              </div>
              <div className="flex items-center gap-2">
                {initialState.hasPaymentMethod ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-muted-foreground">On file</span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">Not set</span>
                )}
              </div>
            </div>

            {/* Current Subscription */}
            {basePlan && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Current Subscription</span>
                  <Badge variant="default" className="text-xs">Active</Badge>
                </div>
                <div className="flex items-baseline justify-between">
                  <p className="text-xl font-semibold">{basePlan.product.name}</p>
                  <p className="text-xl font-bold">{formatCurrency(basePlan.product.amount_cents)}/month</p>
                </div>
              </div>
            )}

            {/* Estimated Next Month Bill */}
            {basePlan && (
              <div className="space-y-2 pt-2 border-t">
                <span className="text-sm text-muted-foreground">Estimated Next Month Bill</span>
                <div className="flex items-baseline justify-between">
                  <div className="space-y-1">
                    <p className="text-2xl font-bold">{formatCurrency(estimatedNextMonthBill)}</p>
                    {currentOverageCost > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(baseMonthlyPrice)} base + {formatCurrency(currentOverageCost)} overage
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Current Usage */}
            {usage && (
              <div className="space-y-2 pt-2 border-t">
                <span className="text-sm text-muted-foreground">Current Monthly Usage</span>
                <div className="flex items-baseline justify-between">
                  <div className="space-y-1">
                    <p className="text-xl font-semibold">
                      {usage.minutesUsed}m {usage.secondsRemainder}s / {usage.minutesIncluded}m
                    </p>
                    {usage.secondsUsed <= usage.secondsIncluded && (
                      <p className="text-xs text-muted-foreground">
                        {Math.floor((usage.secondsIncluded - usage.secondsUsed) / 60)}m {(usage.secondsIncluded - usage.secondsUsed) % 60}s remaining
                      </p>
                    )}
                  </div>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full ${
                      usage.secondsUsed > usage.secondsIncluded ? 'bg-red-500' : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (usage.secondsUsed / usage.secondsIncluded) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Current Overage */}
            {usage && usage.secondsOverage > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <span className="text-sm text-muted-foreground">Current Overage</span>
                <div className="flex items-baseline justify-between">
                  <div className="space-y-1">
                    <p className="text-xl font-semibold text-red-600">
                      {Math.floor(usage.secondsOverage / 60)}m {usage.secondsOverage % 60}s
                    </p>
                    {usageSubscription?.product.price_per_minute_cents && (
                      <p className="text-xs text-muted-foreground">
                        @ {formatCurrency(usageSubscription.product.price_per_minute_cents)}/min
                      </p>
                    )}
                  </div>
                  <p className="text-xl font-bold text-red-600">
                    {formatCurrency(Math.round(usage.estimatedOverageCost * 100))}
                  </p>
                </div>
              </div>
            )}

            {/* Manage Billing Button */}
            <Button
              variant="outline"
              onClick={handleOpenCustomerPortal}
              disabled={loading}
              className="w-full mt-4"
            >
              {loading ? 'Opening...' : 'Manage Billing'}
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
