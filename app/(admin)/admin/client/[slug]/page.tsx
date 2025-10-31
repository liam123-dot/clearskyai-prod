import type { Metadata } from 'next'
import { getClientBySlug, getClientStats } from '@/lib/client'
import { getOrganizationBilling } from '@/lib/billing'
import { Card, CardContent } from '@/components/ui/card'
import { IconPhone, IconRobot, IconClock, IconCurrencyPound } from '@tabler/icons-react'

interface ClientPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ClientPageProps): Promise<Metadata> {
  const { slug } = await params
  
  try {
    const client = await getClientBySlug(slug)
    if (client?.name || client?.slug) {
      return {
        title: client.name || client.slug,
      }
    }
  } catch (error) {
    // Fallback to generic title if fetch fails
  }
  
  return {
    title: "Client",
  }
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(cents / 100)
}

export default async function AdminClientPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const client = await getClientBySlug(slug)

  if (!client) {
    return (
      <div>
        <p>Client not found</p>
      </div>
    )
  }

  // Fetch stats and billing
  const [stats, billing] = await Promise.all([
    getClientStats(client.id),
    getOrganizationBilling(client.id).catch(() => null),
  ])

  // Extract billing details
  const basePlan = billing?.activeSubscriptions.find(
    sub => sub.product.product_type === 'recurring'
  )
  const usageSubscription = billing?.activeSubscriptions.find(
    sub => sub.product.product_type === 'usage_based'
  )
  const usage = usageSubscription?.usage
  const baseMonthlyPrice = basePlan?.product.amount_cents || 0
  const currentOverageCost = usage?.estimatedOverageCost ? Math.round(usage.estimatedOverageCost * 100) : 0
  const nextInvoiceEstimate = baseMonthlyPrice + currentOverageCost
  const overagePricePerMinute = usageSubscription?.product.price_per_minute_cents || 0
  const minutesIncluded = usage?.minutesIncluded || 0
  const minutesUsed = usage?.minutesUsed || 0
  const minutesOverage = usage?.secondsOverage ? Math.ceil(usage.secondsOverage / 60) : 0

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Calls */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Calls</p>
                <p className="text-2xl font-bold mt-1">{stats.totalCalls.toLocaleString()}</p>
              </div>
              <IconPhone className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Agents */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Agents</p>
                <p className="text-2xl font-bold mt-1">{stats.totalAgents}</p>
              </div>
              <IconRobot className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Next Invoice */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Next Invoice</p>
                <p className="text-2xl font-bold mt-1">
                  {nextInvoiceEstimate > 0 ? formatCurrency(nextInvoiceEstimate) : 'N/A'}
                </p>
              </div>
              <IconCurrencyPound className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Details */}
      {usageSubscription && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Monthly Usage</h3>
                {overagePricePerMinute > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(overagePricePerMinute)}/min overage
                  </span>
                )}
              </div>

              {minutesIncluded > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-lg font-semibold">
                        {minutesUsed.toLocaleString()}m / {minutesIncluded.toLocaleString()}m
                      </p>
                      {minutesOverage > 0 && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {minutesOverage.toLocaleString()}m overage
                        </p>
                      )}
                      {minutesUsed < minutesIncluded && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(minutesIncluded - minutesUsed).toLocaleString()}m remaining
                        </p>
                      )}
                    </div>
                    {currentOverageCost > 0 && (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Overage Cost</p>
                        <p className="text-lg font-semibold text-destructive">
                          {formatCurrency(currentOverageCost)}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        minutesUsed > minutesIncluded ? 'bg-destructive' : 'bg-primary'
                      }`}
                      style={{
                        width: `${Math.min(100, (minutesUsed / minutesIncluded) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-semibold">{minutesUsed.toLocaleString()}m used</p>
                  {minutesOverage > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {minutesOverage.toLocaleString()}m overage • {formatCurrency(currentOverageCost)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}