'use client'

import { NavTabs } from "@/components/nav-tabs"

interface AgentNavProps {
  agentId: string
  slug: string
  provider: 'vapi' | 'elevenlabs'
}

export function AgentNav({ agentId, slug, provider }: AgentNavProps) {
  // Base tabs shown for all providers
  const baseTabs = [
    {
      href: `/${slug}/agents/${agentId}`,
      label: "Prompts"
    },
    {
      href: `/${slug}/agents/${agentId}/settings`,
      label: "Settings"
    },
    {
      href: `/${slug}/agents/${agentId}/knowledge-base`,
      label: "Knowledge Base"
    },
    {
      href: `/${slug}/agents/${agentId}/tools`,
      label: "Tools"
    },
  ]

  // Vapi-specific tabs
  const vapiTabs = [
    {
      href: `/${slug}/agents/${agentId}/success-eval`,
      label: "Success & Eval"
    },
  ]

  const widgetTab = {
    href: `/${slug}/agents/${agentId}/website-widget`,
    label: "Website Widget"
  }

  // Build tabs array based on provider
  let tabs = [...baseTabs]
  
  if (provider === 'vapi') {
    tabs = [...tabs, ...vapiTabs]
  }
  
  // Add widget tab for both providers
  tabs.push(widgetTab)

  return <NavTabs tabs={tabs} />
}
