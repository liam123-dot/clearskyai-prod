import { getAuthSession } from "@/lib/auth"
import { getToolsByOrganization } from "@/lib/tools"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { IconTool, IconPlus } from "@tabler/icons-react"
import { ToolsTable } from "@/components/tools/tools-table"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Metadata } from "next"

interface ToolsPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ToolsPageProps): Promise<Metadata> {
  return {
    title: "Tools",
  }
}

export default async function OrganizationToolsPage({ params }: ToolsPageProps) {
  const { slug } = await params
  const { organizationId } = await getAuthSession(slug)

  let tools: Awaited<ReturnType<typeof getToolsByOrganization>> = []
  let error: string | null = null

  try {
    tools = await getToolsByOrganization(organizationId)
  } catch (e) {
    console.error('Error fetching tools:', e)
    error = e instanceof Error ? e.message : 'Failed to load tools'
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (tools.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href={`/${slug}/tools/credentials`}>
                Credentials
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <IconPlus className="w-4 h-4 mr-2" />
                  Create Tool
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Choose Tool Type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/${slug}/tools/create?type=pipedream_action`}>
                  <div className="flex flex-col gap-1">
                    <div className="font-medium">External App</div>
                    <div className="text-xs text-muted-foreground">
                      Connect to 2,000+ apps via Pipedream
                    </div>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/${slug}/tools/create?type=sms`}>
                  <div className="flex flex-col gap-1">
                    <div className="font-medium">SMS / Text Message</div>
                    <div className="text-xs text-muted-foreground">
                      Send text messages during calls
                    </div>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/${slug}/tools/create?type=transfer_call`}>
                  <div className="flex flex-col gap-1">
                    <div className="font-medium">Transfer Call</div>
                    <div className="text-xs text-muted-foreground">
                      Transfer calls to another number
                    </div>
                  </div>
                </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
          </div>
        </div>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconTool />
            </EmptyMedia>
            <EmptyTitle>No Tools Yet</EmptyTitle>
            <EmptyDescription>
              Create your first tool to give your agents new capabilities like sending SMS, making API calls, or transferring calls.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/${slug}/tools/credentials`}>
              Credentials
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <IconPlus className="w-4 h-4 mr-2" />
                Create Tool
              </Button>
            </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Choose Tool Type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/${slug}/tools/create?type=pipedream_action`}>
                <div className="flex flex-col gap-1">
                  <div className="font-medium">External App</div>
                  <div className="text-xs text-muted-foreground">
                    Connect to 2,000+ apps via Pipedream
                  </div>
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/${slug}/tools/create?type=sms`}>
                <div className="flex flex-col gap-1">
                  <div className="font-medium">SMS / Text Message</div>
                  <div className="text-xs text-muted-foreground">
                    Send text messages during calls
                  </div>
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/${slug}/tools/create?type=transfer_call`}>
                <div className="flex flex-col gap-1">
                  <div className="font-medium">Transfer Call</div>
                  <div className="text-xs text-muted-foreground">
                    Transfer calls to another number
                  </div>
                </div>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {tools.length} {tools.length === 1 ? 'tool' : 'tools'}
        </p>
        <ToolsTable tools={tools} slug={slug} />
      </div>
    </div>
  )
}