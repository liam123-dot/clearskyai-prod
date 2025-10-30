import { getAuthSession } from '@/lib/auth'
import { getKnowledgeBases } from '@/lib/knowledge-bases'
import { CreateKnowledgeBaseDialog } from '@/components/knowledge-base/create-knowledge-base-dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { IconBrain } from '@tabler/icons-react'
import { notFound } from 'next/navigation'
import { KnowledgeBasesTable } from '@/components/knowledge-base/knowledge-bases-table'
import type { Metadata } from 'next'

interface KnowledgeBasePageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: KnowledgeBasePageProps): Promise<Metadata> {
  return {
    title: "Knowledge Base",
  }
}

export default async function KnowledgeBasePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { organizationId, organisation } = await getAuthSession(slug)

  if (!organizationId || !organisation) {
    return notFound()
  }

  const knowledgeBases = await getKnowledgeBases(organizationId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
        </div>
        <CreateKnowledgeBaseDialog organizationSlug={slug} />
      </div>

      {knowledgeBases.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconBrain />
            </EmptyMedia>
            <EmptyTitle>No knowledge bases</EmptyTitle>
            <EmptyDescription>
              Create your first knowledge base to get started
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {knowledgeBases.length} {knowledgeBases.length === 1 ? 'knowledge base' : 'knowledge bases'}
          </p>
          <KnowledgeBasesTable knowledgeBases={knowledgeBases} slug={slug} />
        </div>
      )}
    </div>
  )
}