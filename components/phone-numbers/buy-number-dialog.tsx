'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { IconShoppingCart, IconLoader2, IconSearch } from '@tabler/icons-react'
import type { AvailablePhoneNumber } from '@/lib/twilio/phone-numbers'

interface BuyNumberDialogProps {
  isAdmin: boolean
  organizationSlug?: string
  onPurchaseComplete?: () => void
}

export function BuyNumberDialog({ isAdmin, organizationSlug, onPurchaseComplete }: BuyNumberDialogProps) {
  const [open, setOpen] = useState(false)
  const [accountSid, setAccountSid] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [countryCode, setCountryCode] = useState('US')
  const [areaCode, setAreaCode] = useState('')
  const [contains, setContains] = useState('')
  const [searching, setSearching] = useState(false)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [availableNumbers, setAvailableNumbers] = useState<AvailablePhoneNumber[]>([])

  const handleSearch = async () => {
    if (!accountSid || !authToken) {
      toast.error('Please enter both Account SID and Auth Token')
      return
    }

    setSearching(true)
    try {
      const endpoint = isAdmin 
        ? '/api/admin/phone-numbers/twilio/available'
        : `/api/${organizationSlug}/phone-numbers/twilio/available`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_sid: accountSid,
          auth_token: authToken,
          country_code: countryCode,
          area_code: areaCode || undefined,
          contains: contains || undefined,
          limit: 20,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to search phone numbers')
      }

      const numbers = await response.json()
      setAvailableNumbers(numbers)
      
      if (numbers.length === 0) {
        toast.info('No phone numbers found matching your criteria')
      } else {
        toast.success(`Found ${numbers.length} available number${numbers.length === 1 ? '' : 's'}`)
      }
    } catch (error) {
      console.error('Error searching numbers:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to search phone numbers')
    } finally {
      setSearching(false)
    }
  }

  const handlePurchase = async (phoneNumber: string) => {
    setPurchasing(phoneNumber)
    try {
      const endpoint = isAdmin 
        ? '/api/admin/phone-numbers/purchase'
        : `/api/${organizationSlug}/phone-numbers/purchase`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phoneNumber,
          account_sid: accountSid,
          auth_token: authToken,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to purchase phone number')
      }

      toast.success(`Successfully purchased ${phoneNumber}`)
      
      // Reset and close
      setOpen(false)
      setAccountSid('')
      setAuthToken('')
      setAreaCode('')
      setContains('')
      setAvailableNumbers([])
      
      onPurchaseComplete?.()
    } catch (error) {
      console.error('Error purchasing number:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to purchase phone number')
    } finally {
      setPurchasing(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <IconShoppingCart className="mr-2 size-4" />
          Buy Number
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Buy Phone Number from Twilio</SheetTitle>
          <SheetDescription>
            Search for and purchase a new phone number from Twilio.
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="buy-account-sid">Account SID</Label>
            <Input
              id="buy-account-sid"
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={accountSid}
              onChange={(e) => setAccountSid(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="buy-auth-token">Auth Token</Label>
            <Input
              id="buy-auth-token"
              type="password"
              placeholder="Your auth token"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country-code">Country</Label>
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger id="country-code">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                  <SelectItem value="GB">United Kingdom</SelectItem>
                  <SelectItem value="AU">Australia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="area-code">Area Code (optional)</Label>
              <Input
                id="area-code"
                placeholder="415"
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contains">Contains (optional)</Label>
            <Input
              id="contains"
              placeholder="Search for numbers containing..."
              value={contains}
              onChange={(e) => setContains(e.target.value)}
            />
          </div>

          <Button onClick={handleSearch} disabled={searching} className="w-full">
            {searching ? (
              <>
                <IconLoader2 className="mr-2 size-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <IconSearch className="mr-2 size-4" />
                Search Available Numbers
              </>
            )}
          </Button>

          {availableNumbers.length > 0 && (
            <div className="space-y-2">
              <Label>Available Numbers</Label>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableNumbers.map((number) => (
                      <TableRow key={number.phoneNumber}>
                        <TableCell className="font-medium">{number.phoneNumber}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {number.locality && number.region 
                            ? `${number.locality}, ${number.region}`
                            : number.region || '—'}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handlePurchase(number.phoneNumber)}
                            disabled={purchasing !== null}
                          >
                            {purchasing === number.phoneNumber ? (
                              <IconLoader2 className="size-4 animate-spin" />
                            ) : (
                              'Buy'
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

