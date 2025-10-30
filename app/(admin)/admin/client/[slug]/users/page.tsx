import type { Metadata } from 'next'
import { getClientBySlug } from '@/lib/client'

interface ClientUsersPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ClientUsersPageProps): Promise<Metadata> {
  const { slug } = await params
  
  try {
    const client = await getClientBySlug(slug)
    if (client?.name || client?.slug) {
      return {
        title: `Users - ${client.name || client.slug}`,
      }
    }
  } catch (error) {
    // Fallback to generic title if fetch fails
  }
  
  return {
    title: "Users",
  }
}

export default async function AdminClientUsersPage({ params }: { params: Promise<{ slug: string }> }) {

  const { slug } = await params
  return (
    <div>
      <h1>Users</h1>
    </div>
  )
}