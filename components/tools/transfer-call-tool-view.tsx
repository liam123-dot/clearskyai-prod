import { TransferCallTool } from "@/lib/vapi/ToolTypes"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface TransferCallToolViewProps {
  tool: TransferCallTool
}

export function TransferCallToolView({ tool }: TransferCallToolViewProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Function Details</CardTitle>
          <CardDescription>Configuration for the transfer call tool</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-1">Function Name</div>
            <code className="text-sm bg-muted px-2 py-1 rounded">{tool.function.name}</code>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Description</div>
            <p className="text-sm text-muted-foreground">{tool.function.description}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transfer Destinations</CardTitle>
          <CardDescription>Available destinations for call transfers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tool.destinations?.map((destination, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {destination.type === 'number' && 'Phone Number'}
                    {destination.type === 'assistant' && 'Assistant'}
                    {destination.type === 'sip' && 'SIP'}
                  </Badge>
                  {destination.number && (
                    <code className="text-sm bg-muted px-2 py-1 rounded">{destination.number}</code>
                  )}
                </div>
                
                {destination.description && (
                  <div>
                    <div className="text-sm font-medium mb-1">Description</div>
                    <p className="text-sm text-muted-foreground">{destination.description}</p>
                  </div>
                )}

                {destination.message && (
                  <div>
                    <div className="text-sm font-medium mb-1">Message</div>
                    <p className="text-sm text-muted-foreground">{destination.message}</p>
                  </div>
                )}

                {destination.transferPlan && (
                  <div>
                    <div className="text-sm font-medium mb-2">Transfer Plan</div>
                    <div className="space-y-2 ml-3">
                      <div className="text-xs">
                        <span className="font-medium">Mode:</span>{' '}
                        <Badge variant="outline" className="text-xs ml-1">
                          {destination.transferPlan.mode}
                        </Badge>
                      </div>
                      {destination.transferPlan.message && (
                        <div className="text-xs">
                          <span className="font-medium">Message:</span>{' '}
                          <span className="text-muted-foreground">{destination.transferPlan.message}</span>
                        </div>
                      )}
                      {destination.transferPlan.summaryPlan && (
                        <div className="text-xs">
                          <span className="font-medium">Summary:</span>{' '}
                          <Badge variant="outline" className="text-xs ml-1">
                            {destination.transferPlan.summaryPlan.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {destination.numberE164CheckEnabled !== undefined && (
                  <div className="text-xs text-muted-foreground">
                    E164 Check: {destination.numberE164CheckEnabled ? 'Enabled' : 'Disabled'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {tool.function.parameters && (
        <Card>
          <CardHeader>
            <CardTitle>Parameters</CardTitle>
            <CardDescription>Function parameters schema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(tool.function.parameters.properties).map(([key, value]) => (
                <div key={key} className="border-l-2 border-muted pl-3">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-sm font-medium">{key}</code>
                    {tool.function.parameters?.required?.includes(key) && (
                      <Badge variant="destructive" className="text-xs">Required</Badge>
                    )}
                  </div>
                  {typeof value === 'object' && 'description' in value && (
                    <p className="text-sm text-muted-foreground">{value.description as string}</p>
                  )}
                  {typeof value === 'object' && 'type' in value && (
                    <p className="text-xs text-muted-foreground mt-1">Type: {value.type as string}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
          <CardDescription>Tool response messages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tool.messages.map((message, index) => (
              <div key={index} className="border-l-2 border-muted pl-3">
                <div className="text-sm font-medium mb-1">{message.type}</div>
                {message.content && (
                  <p className="text-sm text-muted-foreground">{message.content}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

