import { ApiRequestTool } from "@/lib/vapi/ToolTypes"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface ApiRequestToolViewProps {
  tool: ApiRequestTool
}

export function ApiRequestToolView({ tool }: ApiRequestToolViewProps) {
  const methodColor = {
    GET: "bg-blue-100 text-blue-700 hover:bg-blue-100",
    POST: "bg-green-100 text-green-700 hover:bg-green-100",
    PUT: "bg-orange-100 text-orange-700 hover:bg-orange-100",
    PATCH: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
    DELETE: "bg-red-100 text-red-700 hover:bg-red-100",
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>API Request Details</CardTitle>
          <CardDescription>Configuration for the API request tool</CardDescription>
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
          <div>
            <div className="text-sm font-medium mb-2">Endpoint</div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={methodColor[tool.method]}>
                {tool.method}
              </Badge>
              <code className="text-sm bg-muted px-2 py-1 rounded flex-1">{tool.url}</code>
            </div>
          </div>
        </CardContent>
      </Card>

      {tool.headers && Object.keys(tool.headers.properties || {}).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Headers</CardTitle>
            <CardDescription>HTTP headers sent with the request</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(tool.headers.properties).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between border-l-2 border-muted pl-3">
                  <code className="text-sm font-medium">{key}</code>
                  <code className="text-sm text-muted-foreground">{value.value}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tool.function.parameters && (
        <Card>
          <CardHeader>
            <CardTitle>Function Parameters</CardTitle>
            <CardDescription>Parameters passed to the function</CardDescription>
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

      {tool.body && Object.keys(tool.body.properties || {}).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Request Body</CardTitle>
            <CardDescription>Body parameters sent with the request</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(tool.body.properties).map(([key, value]) => (
                <div key={key} className="border-l-2 border-muted pl-3">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-sm font-medium">{key}</code>
                    {tool.body?.required?.includes(key) && (
                      <Badge variant="destructive" className="text-xs">Required</Badge>
                    )}
                  </div>
                  {value.description && (
                    <p className="text-sm text-muted-foreground">{value.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Type: {value.type}</p>
                  {value.enum && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {value.enum.map((option) => (
                        <Badge key={option} variant="outline" className="text-xs">
                          {option}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Response Schema</CardTitle>
          <CardDescription>Expected response structure</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(tool.variableExtractionPlan.schema.properties).map(([key, value]) => (
              <div key={key} className="border-l-2 border-muted pl-3">
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-sm font-medium">{key}</code>
                  {tool.variableExtractionPlan.schema.required?.includes(key) && (
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

