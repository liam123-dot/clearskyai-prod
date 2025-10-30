import { SmsTool } from "@/lib/vapi/ToolTypes"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface SmsToolViewProps {
  tool: SmsTool
}

export function SmsToolView({ tool }: SmsToolViewProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Function Details</CardTitle>
          <CardDescription>Configuration for the SMS tool function</CardDescription>
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
          {tool.metadata.from && (
            <div>
              <div className="text-sm font-medium mb-1">From Number</div>
              <code className="text-sm bg-muted px-2 py-1 rounded">{tool.metadata.from}</code>
            </div>
          )}
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

