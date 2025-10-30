'use client'

import React, { type FC, useState, useEffect, useRef } from 'react'
import { Button } from './button'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Calendar } from './calendar'
import { DateInput } from './date-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './select'
import { ChevronUpIcon, ChevronDownIcon, CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DateRangePickerProps {
  /** Click handler for applying the updates from DateRangePicker. */
  onUpdate?: (values: { range: DateRange }) => void
  /** Initial value for start date */
  initialDateFrom?: Date | string
  /** Initial value for end date */
  initialDateTo?: Date | string
  /** Alignment of popover */
  align?: 'start' | 'center' | 'end'
  /** Option for locale */
  locale?: string
  /** Minimum date that can be selected */
  minDate?: Date
}

const formatDate = (date: Date, locale: string = 'en-us'): string => {
  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const getDateAdjustedForTimezone = (dateInput: Date | string): Date => {
  if (typeof dateInput === 'string') {
    const parts = dateInput.split('-').map((part) => parseInt(part, 10))
    const date = new Date(parts[0], parts[1] - 1, parts[2])
    return date
  } else {
    return dateInput
  }
}

interface DateRange {
  from: Date
  to: Date | undefined
}

interface Preset {
  name: string
  label: string
}

// Define presets
const PRESETS: Preset[] = [
  { name: 'today', label: 'Today' },
  { name: 'yesterday', label: 'Yesterday' },
  { name: 'last7', label: 'Last 7 days' },
  { name: 'last14', label: 'Last 14 days' },
  { name: 'last30', label: 'Last 30 days' },
  { name: 'thisWeek', label: 'This Week' },
  { name: 'lastWeek', label: 'Last Week' },
  { name: 'thisMonth', label: 'This Month' },
  { name: 'lastMonth', label: 'Last Month' }
]

/** The DateRangePicker component allows a user to select a range of dates */
export const DateRangePicker: FC<DateRangePickerProps> = ({
  initialDateFrom = new Date(new Date().setHours(0, 0, 0, 0)),
  initialDateTo,
  onUpdate,
  align = 'end',
  locale = 'en-US',
  minDate,
}): React.JSX.Element => {
  const [isOpen, setIsOpen] = useState(false)

  const [range, setRange] = useState<DateRange>({
    from: getDateAdjustedForTimezone(initialDateFrom),
    to: initialDateTo
      ? getDateAdjustedForTimezone(initialDateTo)
      : getDateAdjustedForTimezone(initialDateFrom)
  })

  // Refs to store the values of range when the date picker is opened
  const openedRangeRef = useRef<DateRange | undefined>(undefined)

  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(undefined)

  const [isSmallScreen, setIsSmallScreen] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 960 : false
  )

  useEffect(() => {
    const handleResize = (): void => {
      setIsSmallScreen(window.innerWidth < 960)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const getPresetRange = (presetName: string): DateRange => {
    const preset = PRESETS.find(({ name }) => name === presetName)
    if (!preset) throw new Error(`Unknown date range preset: ${presetName}`)
    const from = new Date()
    const to = new Date()
    const first = from.getDate() - from.getDay()

    switch (preset.name) {
      case 'today':
        from.setHours(0, 0, 0, 0)
        to.setHours(23, 59, 59, 999)
        break
      case 'yesterday':
        from.setDate(from.getDate() - 1)
        from.setHours(0, 0, 0, 0)
        to.setDate(to.getDate() - 1)
        to.setHours(23, 59, 59, 999)
        break
      case 'last7':
        from.setDate(from.getDate() - 6)
        from.setHours(0, 0, 0, 0)
        to.setHours(23, 59, 59, 999)
        break
      case 'last14':
        from.setDate(from.getDate() - 13)
        from.setHours(0, 0, 0, 0)
        to.setHours(23, 59, 59, 999)
        break
      case 'last30':
        from.setDate(from.getDate() - 29)
        from.setHours(0, 0, 0, 0)
        to.setHours(23, 59, 59, 999)
        break
      case 'thisWeek':
        from.setDate(first)
        from.setHours(0, 0, 0, 0)
        to.setHours(23, 59, 59, 999)
        break
      case 'lastWeek':
        from.setDate(from.getDate() - 7 - from.getDay())
        to.setDate(to.getDate() - to.getDay() - 1)
        from.setHours(0, 0, 0, 0)
        to.setHours(23, 59, 59, 999)
        break
      case 'thisMonth':
        from.setDate(1)
        from.setHours(0, 0, 0, 0)
        to.setHours(23, 59, 59, 999)
        break
      case 'lastMonth':
        from.setMonth(from.getMonth() - 1)
        from.setDate(1)
        from.setHours(0, 0, 0, 0)
        to.setDate(0)
        to.setHours(23, 59, 59, 999)
        break
    }

    return { from, to }
  }

  const setPreset = (preset: string): void => {
    const range = getPresetRange(preset)
    // Ensure preset range respects minDate
    const adjustedRange = {
      from: minDate && range.from < minDate ? minDate : range.from,
      to: minDate && range.to && range.to < minDate ? minDate : range.to,
    }
    setRange(adjustedRange)
  }

  const checkPreset = (): void => {
    for (const preset of PRESETS) {
      const presetRange = getPresetRange(preset.name)

      const normalizedRangeFrom = new Date(range.from);
      normalizedRangeFrom.setHours(0, 0, 0, 0);
      const normalizedPresetFrom = new Date(
        presetRange.from.setHours(0, 0, 0, 0)
      )

      const normalizedRangeTo = new Date(range.to ?? 0);
      normalizedRangeTo.setHours(0, 0, 0, 0);
      const normalizedPresetTo = new Date(
        presetRange.to?.setHours(0, 0, 0, 0) ?? 0
      )

      if (
        normalizedRangeFrom.getTime() === normalizedPresetFrom.getTime() &&
        normalizedRangeTo.getTime() === normalizedPresetTo.getTime()
      ) {
        setSelectedPreset(preset.name)
        return
      }
    }

    setSelectedPreset(undefined)
  }

  const resetValues = (): void => {
    const from = typeof initialDateFrom === 'string'
      ? getDateAdjustedForTimezone(initialDateFrom)
      : initialDateFrom
    const to = initialDateTo
      ? typeof initialDateTo === 'string'
        ? getDateAdjustedForTimezone(initialDateTo)
        : initialDateTo
      : typeof initialDateFrom === 'string'
        ? getDateAdjustedForTimezone(initialDateFrom)
        : initialDateFrom
    
    // Ensure reset values respect minDate
    setRange({
      from: minDate && from < minDate ? minDate : from,
      to: minDate && to < minDate ? minDate : to,
    })
  }

  useEffect(() => {
    checkPreset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range])

  const PresetButton = ({
    preset,
    label,
    isSelected
  }: {
    preset: string
    label: string
    isSelected: boolean
  }): React.JSX.Element => {
    const presetRange = getPresetRange(preset)
    const isDisabled = minDate && presetRange.from < minDate
    
    return (
      <Button
        className={cn(isSelected && 'pointer-events-none', isDisabled && 'opacity-50 cursor-not-allowed')}
        variant="ghost"
        disabled={isDisabled}
        onClick={() => {
          if (!isDisabled) {
            setPreset(preset)
          }
        }}
      >
        <>
          <span className={cn('pr-2 opacity-0', isSelected && 'opacity-70')}>
            <CheckIcon className="size-4" />
          </span>
          {label}
        </>
      </Button>
    )
  }

  // Helper function to check if two date ranges are equal
  const areRangesEqual = (a?: DateRange, b?: DateRange): boolean => {
    if (!a || !b) return a === b
    return (
      a.from.getTime() === b.from.getTime() &&
      (!a.to || !b.to || a.to.getTime() === b.to.getTime())
    )
  }

  useEffect(() => {
    if (isOpen) {
      openedRangeRef.current = range
    }
  }, [isOpen, range])

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open: boolean) => {
        if (!open) {
          resetValues()
        }
        setIsOpen(open)
      }}
    >
      <PopoverTrigger asChild>
        <Button size={'lg'} variant="outline">
          <div className="text-right">
            <div className="py-1">
              <div>{`${formatDate(range.from, locale)}${
                range.to != null ? ' - ' + formatDate(range.to, locale) : ''
              }`}</div>
            </div>
          </div>
          <div className="pl-1 opacity-60 -mr-2 scale-125">
            {isOpen ? (<ChevronUpIcon className="size-4" />) : (<ChevronDownIcon className="size-4" />)}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto">
        <div className="flex py-2">
          <div className="flex">
            <div className="flex flex-col">
              <div className="flex flex-col lg:flex-row gap-2 px-3 justify-end items-center lg:items-start pb-4 lg:pb-0">
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <DateInput
                      value={range.from}
                      onChange={(date) => {
                        // Ensure date is not before minDate
                        const validDate = minDate && date < minDate ? minDate : date
                        const toDate =
                          range.to == null || validDate > range.to ? validDate : range.to
                        setRange((prevRange) => ({
                          ...prevRange,
                          from: validDate,
                          to: toDate
                        }))
                      }}
                      showTime={true}
                    />
                    <div className="py-1">-</div>
                    <DateInput
                      value={range.to}
                      onChange={(date) => {
                        // Ensure date is not before minDate
                        const validDate = minDate && date < minDate ? minDate : date
                        const fromDate = validDate < range.from ? validDate : range.from
                        setRange((prevRange) => ({
                          ...prevRange,
                          from: fromDate,
                          to: validDate
                        }))
                      }}
                      showTime={true}
                    />
                  </div>
                </div>
              </div>
              { isSmallScreen && (
                <Select defaultValue={selectedPreset} onValueChange={(value) => { setPreset(value) }}>
                  <SelectTrigger className="w-[180px] mx-auto mb-2">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.map((preset) => {
                      const presetRange = getPresetRange(preset.name)
                      const isDisabled = minDate && presetRange.from < minDate
                      return (
                        <SelectItem 
                          key={preset.name} 
                          value={preset.name}
                          disabled={isDisabled}
                        >
                          {preset.label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              )}
              <div>
                <Calendar
                  mode="range"
                  onSelect={(value: { from?: Date, to?: Date } | undefined) => {
                    if (value?.from != null) {
                      // Ensure selected dates are not before minDate
                      const fromDate = minDate && value.from < minDate ? minDate : value.from
                      const toDate = value.to && minDate && value.to < minDate ? minDate : value.to
                      setRange({ from: fromDate, to: toDate })
                    }
                  }}
                  selected={range}
                  disabled={minDate ? { before: minDate } : undefined}
                  numberOfMonths={isSmallScreen ? 1 : 2}
                  defaultMonth={
                    new Date(
                      new Date().setMonth(
                        new Date().getMonth() - (isSmallScreen ? 0 : 1)
                      )
                    )
                  }
                />
              </div>
            </div>
          </div>
          {!isSmallScreen && (
            <div className="flex flex-col items-end gap-1 pr-2 pl-6 pb-6">
              <div className="flex w-full flex-col items-end gap-1 pr-2 pl-6 pb-6">
                {PRESETS.map((preset) => (
                  <PresetButton
                    key={preset.name}
                    preset={preset.name}
                    label={preset.label}
                    isSelected={selectedPreset === preset.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 py-2 pr-4">
          <Button
            onClick={() => {
              setIsOpen(false)
              resetValues()
            }}
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              setIsOpen(false)
              if (!areRangesEqual(range, openedRangeRef.current)) {
                onUpdate?.({ range })
              }
            }}
          >
            Update
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

DateRangePicker.displayName = 'DateRangePicker'

