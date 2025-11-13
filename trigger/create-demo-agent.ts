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
                        text: `Take a look at this prompt template: ${estateAgentDemoPrompt}, return a new version of this for ${estateAgentName}, here is the prompt and information for this estate agent. Update the prompt accordingly. If they have rentals and sale properties, then one of the filtering questions should be "Are you looking to buy or rent?" Otherwise, that question is not necessary. Here is the property query prompt: ${propertyQueryPrompt.prompt}`,
                    },
                ],
            },
        ],
    })

    console.log('Updating agent assistant...')
    
    await updateAgent(agentId, {
        firstMessage: `Welcome to ${estateAgentName}, how can I help you today?`,
        prompt: response.text as string,
    })

    console.log('Assigning knowledge base to agent...')

    await assignKnowledgeBaseToAgent(agentId, knowledgeBase.id)
  },
})