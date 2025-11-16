"use client"

import { useState, useEffect } from 'react'
import { TransferCallToolConfig } from '@/lib/tools/types'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, Plus, AlertCircle } from 'lucide-react'

interface TransferCallToolFormProps {
  initialData?: Partial<TransferCallToolConfig>
  onChange: (config: TransferCallToolConfig) => void
  slug: string
}

// E.164 phone number validation
const E164_REGEX = /^\+[1-9]\d{1,14}$/

export function TransferCallToolForm({ initialData, onChange, slug }: TransferCallToolFormProps) {
  const [destinations, setDestinations] = useState<TransferCallToolConfig['destinations']>(
    initialData?.destinations || [
      {
        type: 'number',
        number: '',
        description: '',
        transferPlan: {
          mode: 'blind-transfer',
          message: '',
        },
        numberE164CheckEnabled: true,
      },
    ]
  )

  const [phoneErrors, setPhoneErrors] = useState<{ [key: number]: string }>({})

  useEffect(() => {
    // Validate phone numbers and emit config
    const errors: { [key: number]: string } = {}
    destinations.forEach((dest, index) => {
      if (dest.number && !E164_REGEX.test(dest.number)) {
        errors[index] = 'Must be in E.164 format (e.g., +14155551234)'
      }
    })
    setPhoneErrors(errors)

    // Emit the config
    const config: TransferCallToolConfig = {
      type: 'transfer_call',
      label: initialData?.label || '',
      description: initialData?.description || '',
      destinations,
    }
    onChange(config)
  }, [destinations, initialData?.label, initialData?.description, onChange])

  const addDestination = () => {
    setDestinations([
      ...destinations,
      {
        type: 'number',
        number: '',
        description: '',
        transferPlan: {
          mode: 'blind-transfer',
          message: '',
        },
        numberE164CheckEnabled: true,
      },
    ])
  }

  const removeDestination = (index: number) => {
    if (destinations.length > 1) {
      setDestinations(destinations.filter((_, i) => i !== index))
    }
  }

  const updateDestination = (index: number, updates: Partial<TransferCallToolConfig['destinations'][0]>) => {
    const newDestinations = [...destinations]
    newDestinations[index] = { ...newDestinations[index], ...updates }
    setDestinations(newDestinations)
  }

  const updateTransferPlan = (
    index: number,
    updates: Partial<TransferCallToolConfig['destinations'][0]['transferPlan']>
  ) => {
    const newDestinations = [...destinations]
    newDestinations[index] = {
      ...newDestinations[index],
      transferPlan: { ...newDestinations[index].transferPlan, ...updates },
    }
    setDestinations(newDestinations)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Transfer Destinations</Label>
        <Button type="button" variant="outline" size="sm" onClick={addDestination}>
          <Plus className="h-4 w-4 mr-2" />
          Add Destination
        </Button>
      </div>

      {destinations.map((destination, index) => (
        <Card key={index}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Destination {index + 1}</CardTitle>
              {destinations.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeDestination(index)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor={`phone-${index}`}>
                Phone Number * <span className="text-xs text-muted-foreground">(E.164 format)</span>
              </Label>
              <Input
                id={`phone-${index}`}
                placeholder="+14155551234"
                value={destination.number}
                onChange={(e) => updateDestination(index, { number: e.target.value })}
                className={phoneErrors[index] ? 'border-destructive' : ''}
              />
              {phoneErrors[index] && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {phoneErrors[index]}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Must start with + followed by country code and number (1-15 digits total)
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor={`description-${index}`}>Description (Optional)</Label>
              <Input
                id={`description-${index}`}
                placeholder="e.g., Sales Department"
                value={destination.description || ''}
                onChange={(e) => updateDestination(index, { description: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Helpful label for identifying this destination
              </p>
            </div>

            {/* Transfer Mode */}
            <div className="space-y-2">
              <Label htmlFor={`transfer-mode-${index}`}>Transfer Mode *</Label>
              <Select
                value={destination.transferPlan.mode}
                onValueChange={(value: any) => updateTransferPlan(index, { mode: value })}
              >
                <SelectTrigger id={`transfer-mode-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blind-transfer">
                    <div>
                      <div className="font-medium">Blind Transfer</div>
                      <div className="text-xs text-muted-foreground">
                        Immediately transfer without speaking to the operator
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="warm-transfer-say-message">
                    <div>
                      <div className="font-medium">Warm Transfer with Message</div>
                      <div className="text-xs text-muted-foreground">
                        Say a specific message to the operator before transferring
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="warm-transfer-say-summary">
                    <div>
                      <div className="font-medium">Warm Transfer with Summary</div>
                      <div className="text-xs text-muted-foreground">
                        Generate AI summary and say it to the operator
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Message for warm transfer with message */}
            {destination.transferPlan.mode === 'warm-transfer-say-message' && (
              <div className="space-y-2">
                <Label htmlFor={`transfer-message-${index}`}>Transfer Message *</Label>
                <Textarea
                  id={`transfer-message-${index}`}
                  placeholder="e.g., I'm transferring you to our sales team who can help you further."
                  value={destination.transferPlan.message || ''}
                  onChange={(e) => updateTransferPlan(index, { message: e.target.value })}
                  className="min-h-[80px]"
                />
                <p className="text-xs text-muted-foreground">
                  The agent will say this message before transferring the call
                </p>
              </div>
            )}

            {/* Summary configuration for warm transfer with summary */}
            {destination.transferPlan.mode === 'warm-transfer-say-summary' && (
              <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                <Label className="text-sm font-medium">Summary Configuration</Label>
                <p className="text-xs text-muted-foreground">
                  The AI will automatically generate a summary of the conversation and say it to the
                  operator before connecting the caller. This gives the operator context about the conversation.
                </p>
                <div className="text-xs text-muted-foreground mt-2">
                  <strong>Timeout:</strong> 30 seconds (default)
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {Object.keys(phoneErrors).length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          Please fix the phone number errors above before creating the tool
        </div>
      )}
    </div>
  )
}

