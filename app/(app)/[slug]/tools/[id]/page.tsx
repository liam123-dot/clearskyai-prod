import { getAuthSession } from "@/lib/auth"
import { getTool } from "@/lib/tools"
import { ToolDatabaseRecord } from "@/lib/tools/types"
import { vapiClient } from "@/lib/vapi/VapiClients"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SmsToolView } from "@/components/tools/sms-tool-view"
import { ApiRequestToolView } from "@/components/tools/api-request-tool-view"
import { TransferCallToolView } from "@/components/tools/transfer-call-tool-view"
import { EditToolForm } from "@/components/tools/edit-tool-form"
import { SmsTool, ApiRequestTool, TransferCallTool } from "@/lib/vapi/ToolTypes"
import { IconArrowLeft } from "@tabler/icons-react"
import Link from "next/link"
import type { Metadata } from "next"

interface ToolPageProps {
  params: Promise<{ slug: string; id: string }>
}

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const { slug, id } = await params
  
  try {
    const { organizationId } = await getAuthSession(slug)
    const dbTool = await getTool(id)
    
    if (dbTool && dbTool.organization_id === organizationId) {
      const toolName = dbTool.label || dbTool.name
      if (toolName) {
        return {
          title: toolName,
        }
      }
    }
  } catch (error) {
    // Fallback to generic title if fetch fails
  }
  
  return {
    title: "Tools",
  }
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { slug, id } = await params
  const { organizationId } = await getAuthSession(slug)

  // First, get tool from database to verify ownership and type
  const dbTool = await getTool(id)

  if (!dbTool) {
    return (
      <div className="space-y-6">
        <Link
          href={`/${slug}/tools`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft className="w-4 h-4 mr-1" />
          Back to Tools
        </Link>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Tool not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Verify the tool belongs to this organization
  if (dbTool.organization_id !== organizationId) {
    return (
      <div className="space-y-6">
        <Link
          href={`/${slug}/tools`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft className="w-4 h-4 mr-1" />
          Back to Tools
        </Link>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Unauthorized access</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  function getToolTypeBadgeColor(type: string) {
    switch (type) {
      case 'query':
        return 'bg-purple-100 text-purple-700 hover:bg-purple-100'
      case 'sms':
        return 'bg-blue-100 text-blue-700 hover:bg-blue-100'
      case 'apiRequest':
        return 'bg-green-100 text-green-700 hover:bg-green-100'
      case 'transferCall':
        return 'bg-orange-100 text-orange-700 hover:bg-orange-100'
      case 'externalApp':
      case 'pipedream_action':
        return 'bg-gray-100 text-gray-700 hover:bg-gray-100'
      default:
        return 'bg-gray-100 text-gray-700 hover:bg-gray-100'
    }
  }

  function getToolTypeLabel(type: string) {
    switch (type) {
      case 'query':
        return 'Query Tool'
      case 'sms':
        return 'SMS Tool'
      case 'apiRequest':
        return 'API Request Tool'
      case 'transferCall':
        return 'Transfer Call Tool'
      case 'externalApp':
      case 'pipedream_action':
        return 'External App Tool'
      default:
        return type
    }
  }

  // For pipedream_action tools, use EditToolForm directly (no need to fetch from VAPI)
  if (dbTool.type === 'pipedream_action') {
    return (
      <div className="space-y-6">
        <Link
          href={`/${slug}/tools`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft className="w-4 h-4 mr-1" />
          Back to Tools
        </Link>

        <div className="flex items-start justify-between">
          <div>
          </div>
          <Badge
            variant="secondary"
            className={getToolTypeBadgeColor(dbTool.type)}
          >
            {getToolTypeLabel(dbTool.type)}
          </Badge>
        </div>

        <EditToolForm tool={dbTool as ToolDatabaseRecord} slug={slug} />
      </div>
    )
  }

  // Now fetch from VAPI using the external tool ID
  let vapiTool
  let error: string | null = null

  try {
    // Fetch live data from VAPI using the external tool ID from our DB
    vapiTool = await vapiClient.tools.get(dbTool.external_tool_id)
  } catch (e) {
    console.error('Error fetching tool from VAPI:', e)
    error = e instanceof Error ? e.message : 'Failed to load tool data'
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/${slug}/tools`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <IconArrowLeft className="w-4 h-4 mr-1" />
        Back to Tools
      </Link>

      <div className="flex items-start justify-between">
        <div>
        </div>
        <Badge
          variant="secondary"
          className={getToolTypeBadgeColor(dbTool.type)}
        >
          {getToolTypeLabel(dbTool.type)}
        </Badge>
      </div>

      {error ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : vapiTool ? (
        <>
          {/* SMS Tool */}
          {dbTool.type === 'sms' && vapiTool.type === 'sms' && (
            <SmsToolView tool={vapiTool as SmsTool} />
          )}
          
          {/* API Request, Query, and External App tools (all use apiRequest in VAPI) */}
          {(dbTool.type === 'apiRequest' || dbTool.type === 'query' || dbTool.type === 'externalApp') && 
           vapiTool.type === 'apiRequest' && (
            <ApiRequestToolView tool={vapiTool as ApiRequestTool} />
          )}
          
          {/* Transfer Call Tool */}
          {dbTool.type === 'transferCall' && vapiTool.type === 'transferCall' && (
            <TransferCallToolView tool={vapiTool as TransferCallTool} />
          )}
        </>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Loading tool details...</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}