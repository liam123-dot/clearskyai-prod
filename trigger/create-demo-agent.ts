import {task, tasks } from "@trigger.dev/sdk/v3"
import { assignKnowledgeBaseToAgent, createKnowledgeBase } from "@/lib/knowledge-bases"
import { generateAIText } from "@/lib/ai"
import { estateAgentDemoPrompt } from "@/lib/prompts/estate-agent-template"
import { generatePropertyQueryPrompt } from "@/lib/property-prompt"
import { updateAgent } from "@/lib/vapi/agents"

export const createDemoAgent = task({
  id: "create-demo-agent",
  run: async (payload: { agentId: string, organizationId: string, estateAgentName: string, forSaleUrl: string, rentalUrl: string }) => {
    const { agentId, organizationId, estateAgentName, forSaleUrl, rentalUrl } = payload
    console.log('Creating demo agent..., with payload:', payload)

    const knowledgeBase = await createKnowledgeBase({
      name: estateAgentName,
      organization_id: organizationId,
      type: "estate_agent",
      data: {
        for_sale_url: forSaleUrl,
        rental_url: rentalUrl,
      },
    })

    // trigger scrape-rightmove, but wait for it to complete
    await tasks.triggerAndWait('scrape-rightmove', {
      knowledgeBaseId: knowledgeBase.id,
    })

    const propertyQueryPrompt = await generatePropertyQueryPrompt(knowledgeBase.id)

    console.log('Generated property query prompt:', propertyQueryPrompt.prompt)
    console.log('Generating agent system prompt...')

    const response = await generateAIText({
        model: 'anthropic/claude-sonnet-4.5',
        system: estateAgentDemoPrompt,
        messages: [
            {
                role: 'user',
                parts: [
                    {
                        type: 'text',
                        text: `You are updating an estate agent AI assistant template for ${estateAgentName}.

CRITICAL: Keep the EXACT same structure, format, headings, sections, and flow as the template provided. DO NOT change the template structure or add/remove sections.

ONLY update these specific data points based on the property information below:
1. Replace "Southside Property" with "${estateAgentName}" everywhere it appears
2. Update the service coverage section with the actual cities and districts from the property data
3. Update the inventory details (number of properties, price ranges, available beds/baths)
4. Update the available filters section to match the actual property data
5. If the agent has BOTH rental AND sale properties, add "Are you looking to buy or rent?" as the FIRST qualification question (after bedrooms). If only rentals OR only sales, do NOT include this question.
6. Update the "Property Search Filters & Strategy" section with the correct inventory count and property types from the data

Here is the property query prompt with all the data about ${estateAgentName}'s properties:

${propertyQueryPrompt.prompt}

Return the complete updated template with the exact same structure, keeping all sections, headings, and formatting identical. Only change the specific data points mentioned above.`,
                    },
                ],
            },
        ],
    })

    console.log('Updating agent assistant...')
    
    await updateAgent(agentId, {
        firstMessage: `Welcome to ${estateAgentName}, can I get your name, please?`,
        prompt: response.text as string,
    })

    console.log('Assigning knowledge base to agent...')

    await assignKnowledgeBaseToAgent(agentId, knowledgeBase.id)
  },
})