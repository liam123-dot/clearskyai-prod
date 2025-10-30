import type { Metadata } from 'next'
import { getClientBySlug } from '@/lib/client'

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

export default async function AdminClientPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <div>
      <h1>Client Details</h1>
    </div>
  )

}