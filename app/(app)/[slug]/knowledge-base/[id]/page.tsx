import { getAuthSession } from '@/lib/auth'
import { getKnowledgeBase } from '@/lib/knowledge-bases'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { EstateAgentView } from '@/components/knowledge-base/estate-agent/estate-agent-view'
import { IconBrain } from '@tabler/icons-react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

interface KnowledgeBaseDetailPageProps {
  params: Promise<{ slug: string; id: string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params }: KnowledgeBaseDetailPageProps): Promise<Metadata> {
  const { slug, id } = await params
  
  try {
    const { organizationId } = await getAuthSession(slug)
    const knowledgeBase = await getKnowledgeBase(id)
    
    if (knowledgeBase && knowledgeBase.organization_id === organizationId && knowledgeBase.name) {
      return {
        title: knowledgeBase.name,
      }
    }
  } catch (error) {
    // Fallback to generic title if fetch fails
  }
  
  return {
    title: "Knowledge Base",
  }
}

export default async function KnowledgeBaseDetailPage({
  params,
  searchParams,
}: KnowledgeBaseDetailPageProps) {
  const { slug, id } = await params
  const { page: pageParam } = await searchParams
  const { organizationId, organisation } = await getAuthSession(slug)

  if (!organizationId || !organisation) {
    return notFound()
  }

  const knowledgeBase = await getKnowledgeBase(id)

  if (!knowledgeBase || knowledgeBase.organization_id !== organizationId) {
    return notFound()
  }

  // Pagination
  const page = parseInt(pageParam || '1', 10)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant={knowledgeBase.type === 'estate_agent' ? 'default' : 'secondary'}>
              {knowledgeBase.type === 'estate_agent' ? 'Estate Agent' : 'General'}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-2">
            Created {new Date(knowledgeBase.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Content Section - Type Specific */}
      {knowledgeBase.type === 'estate_agent' && (
        <EstateAgentView 
          knowledgeBase={knowledgeBase} 
          currentPage={page}
          organizationSlug={slug}
        />
      )}

      {knowledgeBase.type === 'general' && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconBrain />
            </EmptyMedia>
            <EmptyTitle>No items</EmptyTitle>
            <EmptyDescription>
              Items will appear here once they are added to this knowledge base
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  )
}

