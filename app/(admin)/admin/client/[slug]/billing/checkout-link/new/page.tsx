import { CreateCheckoutLinkClient } from '@/components/billing/create-checkout-link-client'
import { getClientBySlug } from '@/lib/client'
import { getProducts } from '@/lib/products'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

interface CreateCheckoutLinkPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: CreateCheckoutLinkPageProps): Promise<Metadata> {
  const { slug } = await params
  
  try {
    const client = await getClientBySlug(slug)
    if (client?.name || client?.slug) {
      return {
        title: `Create Checkout Link - ${client.name || client.slug}`,
      }
    }
  } catch (error) {
    // Fallback to generic title if fetch fails
  }
  
  return {
    title: "Create Checkout Link",
  }
}

export default async function CreateCheckoutLinkPage({ params }: CreateCheckoutLinkPageProps) {
  const { slug } = await params
  
  const client = await getClientBySlug(slug)
  
  if (!client) {
    redirect('/admin/client')
  }
  
  const products = await getProducts()
  
  return <CreateCheckoutLinkClient organizationId={client.id} organizationSlug={slug} products={products} />
}

