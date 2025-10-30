'use client'

import { useState, useEffect } from 'react'
import { IconClock, IconTrash, IconPlus } from '@tabler/icons-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import type { PhoneNumberSchedule } from '@/lib/call-routing'

interface TimeBasedRoutingDrawerProps {
  phoneNumberId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  timeBasedRoutingEnabled: boolean
}

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

interface ScheduleFormData {
  id?: string
  days: number[]
  start_time: string
  end_time: string
  transfer_to_number: string
  dial_timeout: number
  agent_fallback_enabled: boolean
  enabled: boolean
}

export function TimeBasedRoutingDrawer({
  phoneNumberId,
  open,
  onOpenChange,
  timeBasedRoutingEnabled: initialEnabled,
}: TimeBasedRoutingDrawerProps) {
  const [timeBasedRoutingEnabled, setTimeBasedRoutingEnabled] = useState(initialEnabled)
  const [schedules, setSchedules] = useState<ScheduleFormData[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      loadSchedules()
      setTimeBasedRoutingEnabled(initialEnabled)
    }
  }, [open, phoneNumberId, initialEnabled])

  const loadSchedules = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/phone-number/${phoneNumberId}/schedules`)
      if (!response.ok) {
        let errorMessage = 'Failed to load schedules'
        try {
          const error = await response.json()
          errorMessage = error.error || errorMessage
        } catch {
          errorMessage = `Failed to load schedules: ${response.status} ${response.statusText}`
        }
        throw new Error(errorMessage)
      }
      const data = await response.json()
      setSchedules(data.schedules || [])
    } catch (error) {
      console.error('Error loading schedules:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load schedules')
      setSchedules([]) // Reset to empty array on error
    } finally {
      setLoading(false)
    }
  }

  const handleToggleRouting = async (enabled: boolean) => {
    try {
      const response = await fetch(`/api/phone-number/${phoneNumberId}/time-based-routing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      if (!response.ok) {
        let errorMessage = 'Failed to update routing setting'
        try {
          const error = await response.json()
          errorMessage = error.error || errorMessage
        } catch {
          errorMessage = `Failed to update routing setting: ${response.status} ${response.statusText}`
        }
        throw new Error(errorMessage)
      }
      setTimeBasedRoutingEnabled(enabled)
      toast.success(`Time-based routing ${enabled ? 'enabled' : 'disabled'}`)
    } catch (error) {
      console.error('Error updating routing:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update routing setting')
      // Revert the toggle on error
      setTimeBasedRoutingEnabled(!enabled)
    }
  }

  const handleAddSchedule = () => {
    setSchedules([
      ...schedules,
      {
        days: [1, 2, 3, 4, 5], // Mon-Fri default
        start_time: '09:00',
        end_time: '17:00',
        transfer_to_number: '',
        dial_timeout: 30,
        agent_fallback_enabled: true,
        enabled: true,
      },
    ])
  }

  const handleDeleteSchedule = async (index: number) => {
    const schedule = schedules[index]
    if (schedule.id) {
      // Delete from server
      try {
        const response = await fetch(`/api/phone-number/${phoneNumberId}/schedules?schedule_id=${schedule.id}`, {
          method: 'DELETE',
        })
        if (!response.ok) {
          let errorMessage = 'Failed to delete schedule'
          try {
            const error = await response.json()
            errorMessage = error.error || errorMessage
          } catch {
            errorMessage = `Failed to delete schedule: ${response.status} ${response.statusText}`
          }
          toast.error(errorMessage)
          return
        }
        toast.success('Schedule deleted')
      } catch (error) {
        console.error('Error deleting schedule:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to delete schedule')
        return
      }
    }
    setSchedules(schedules.filter((_, i) => i !== index))
  }

  const handleScheduleChange = (index: number, field: keyof ScheduleFormData, value: unknown) => {
    const updated = [...schedules]
    updated[index] = { ...updated[index], [field]: value }
    setSchedules(updated)
  }

  const handleToggleDay = (index: number, day: number) => {
    const schedule = schedules[index]
    const days = schedule.days.includes(day)
      ? schedule.days.filter((d) => d !== day)
      : [...schedule.days, day]
    handleScheduleChange(index, 'days', days.sort())
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      // Update routing enabled
      if (timeBasedRoutingEnabled !== initialEnabled) {
        await handleToggleRouting(timeBasedRoutingEnabled)
      }

      // Save all schedules
      for (const schedule of schedules) {
        if (schedule.id) {
          // Update existing
          const response = await fetch(`/api/phone-number/${phoneNumberId}/schedules`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              schedule_id: schedule.id,
              ...schedule,
            }),
          })
          if (!response.ok) {
            let errorMessage = 'Failed to update schedule'
            try {
              const error = await response.json()
              errorMessage = error.error || errorMessage
            } catch {
              errorMessage = `Failed to update schedule: ${response.status} ${response.statusText}`
            }
            throw new Error(errorMessage)
          }
        } else {
          // Create new
          const response = await fetch(`/api/phone-number/${phoneNumberId}/schedules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(schedule),
          })
          if (!response.ok) {
            let errorMessage = 'Failed to create schedule'
            try {
              const error = await response.json()
              errorMessage = error.error || errorMessage
            } catch {
              errorMessage = `Failed to create schedule: ${response.status} ${response.statusText}`
            }
            throw new Error(errorMessage)
          }
        }
      }

      toast.success('Schedules saved successfully')
      await loadSchedules() // Reload to get IDs for new schedules
    } catch (error) {
      console.error('Error saving schedules:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save schedules')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconClock className="size-5" />
              <SheetTitle>Time-Based Routing</SheetTitle>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? 'Saving...' : 'Save Rules'}
              </Button>
              <Switch
                checked={timeBasedRoutingEnabled}
                onCheckedChange={handleToggleRouting}
              />
            </div>
          </div>
          <SheetDescription>
            Route calls to specific numbers during business hours. Outside those times, calls go directly to the agent.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading schedules...</div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No schedules configured. Click "Add Schedule" to create one.
            </div>
          ) : (
            schedules.map((schedule, index) => (
              <div key={schedule.id || index} className="border rounded-lg p-4 space-y-4 bg-card">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Schedule {index + 1}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteSchedule(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <IconTrash className="size-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block">Days</Label>
                    <div className="flex gap-2 flex-wrap">
                      {DAYS.map((day) => (
                        <Button
                          key={day.value}
                          type="button"
                          variant={schedule.days.includes(day.value) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleToggleDay(index, day.value)}
                          className="min-w-[60px]"
                        >
                          {day.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`start-${index}`}>Start Time</Label>
                      <div className="relative">
                        <Input
                          id={`start-${index}`}
                          type="time"
                          value={schedule.start_time}
                          onChange={(e) => handleScheduleChange(index, 'start_time', e.target.value)}
                          className="pr-10"
                        />
                        <IconClock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`end-${index}`}>End Time</Label>
                      <div className="relative">
                        <Input
                          id={`end-${index}`}
                          type="time"
                          value={schedule.end_time}
                          onChange={(e) => handleScheduleChange(index, 'end_time', e.target.value)}
                          className="pr-10"
                        />
                        <IconClock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`transfer-${index}`}>Transfer to Number</Label>
                    <Input
                      id={`transfer-${index}`}
                      type="tel"
                      placeholder="+1234567890"
                      value={schedule.transfer_to_number}
                      onChange={(e) => handleScheduleChange(index, 'transfer_to_number', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      During these hours, calls will be transferred to this number
                    </p>
                  </div>

                  <div>
                    <Label htmlFor={`timeout-${index}`}>Dial Timeout (seconds)</Label>
                    <Input
                      id={`timeout-${index}`}
                      type="number"
                      min="1"
                      max="300"
                      value={schedule.dial_timeout}
                      onChange={(e) => handleScheduleChange(index, 'dial_timeout', parseInt(e.target.value) || 30)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor={`fallback-${index}`} className="cursor-pointer">
                        Agent Fallback
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        If no one answers the transferred call, automatically route it to the agent
                      </p>
                    </div>
                    <Switch
                      id={`fallback-${index}`}
                      checked={schedule.agent_fallback_enabled}
                      onCheckedChange={(checked) =>
                        handleScheduleChange(index, 'agent_fallback_enabled', checked)
                      }
                    />
                  </div>
                </div>
              </div>
            ))
          )}

          <Button onClick={handleAddSchedule} variant="outline" className="w-full">
            <IconPlus className="size-4 mr-2" />
            Add Schedule
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

