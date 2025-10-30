import { BillingPageClient } from '@/components/billing/billing-page-client'
import { getClientBySlug } from '@/lib/client'
import { getOrganizationBilling } from '@/lib/billing'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

interface ClientBillingPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ClientBillingPageProps): Promise<Metadata> {
  const { slug } = await params
  
  try {
    const client = await getClientBySlug(slug)
    if (client?.name || client?.slug) {
      return {
        title: `Billing - ${client.name || client.slug}`,
      }
    }
  } catch (error) {
    // Fallback to generic title if fetch fails
  }
  
  return {
    title: "Billing",
  }
}

export default async function AdminClientBillingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  
  const client = await getClientBySlug(slug)
  
  if (!client) {
    redirect('/admin/client')
  }
  
  const billingState = await getOrganizationBilling(client.id)
  
  return <BillingPageClient initialState={billingState} />
}