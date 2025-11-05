"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Plus, X } from 'lucide-react'

interface IdleMessagesFormProps {
  initialIdleMessages: string[]
  initialIdleTimeoutSeconds: number
  onChange: (idleMessages: string[], idleTimeoutSeconds: number) => void
}

export function IdleMessagesForm({
  initialIdleMessages,
  initialIdleTimeoutSeconds,
  onChange,
}: IdleMessagesFormProps) {
  const [idleMessages, setIdleMessages] = useState<string[]>(initialIdleMessages)
  const [idleTimeoutSeconds, setIdleTimeoutSeconds] = useState<number>(initialIdleTimeoutSeconds)

  const handleMessageChange = (index: number, value: string) => {
    const newMessages = [...idleMessages]
    newMessages[index] = value
    setIdleMessages(newMessages)
    onChange(newMessages, idleTimeoutSeconds)
  }

  const handleRemoveMessage = (index: number) => {
    const newMessages = idleMessages.filter((_, i) => i !== index)
    setIdleMessages(newMessages)
    onChange(newMessages, idleTimeoutSeconds)
  }

  const handleAddMessage = () => {
    const newMessages = [...idleMessages, '']
    setIdleMessages(newMessages)
    onChange(newMessages, idleTimeoutSeconds)
  }

  const handleTimeoutChange = (value: string) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue >= 0) {
      setIdleTimeoutSeconds(numValue)
      onChange(idleMessages, numValue)
    } else if (value === '') {
      setIdleTimeoutSeconds(0)
      onChange(idleMessages, 0)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Idle Messages</CardTitle>
        <CardDescription>
          Configure messages that the agent will say when there is no user input for a period of time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="idleTimeoutSeconds">Idle Timeout (seconds)</Label>
          <Input
            id="idleTimeoutSeconds"
            type="number"
            step="0.1"
            min="0"
            value={idleTimeoutSeconds}
            onChange={(e) => handleTimeoutChange(e.target.value)}
            placeholder="7.5"
          />
          <p className="text-xs text-muted-foreground">
            The number of seconds of silence before the agent will send an idle message.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Idle Messages</Label>
          <div className="space-y-2">
            {idleMessages.map((message, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => handleMessageChange(index, e.target.value)}
                  placeholder="Enter an idle message..."
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleRemoveMessage(index)}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAddMessage}
            className="w-full border border-dashed"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Message
          </Button>
          <p className="text-xs text-muted-foreground">
            Add messages that will be randomly selected and spoken when the user is idle.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

