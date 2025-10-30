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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { IconDownload, IconLoader2 } from '@tabler/icons-react'
import type { TwilioPhoneNumber } from '@/lib/twilio/phone-numbers'

interface ImportTwilioDialogProps {
  isAdmin: boolean
  organizationSlug?: string
  onImportComplete?: () => void
}

export function ImportTwilioDialog({ isAdmin, organizationSlug, onImportComplete }: ImportTwilioDialogProps) {
  const [open, setOpen] = useState(false)
  const [accountSid, setAccountSid] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [phoneNumbers, setPhoneNumbers] = useState<TwilioPhoneNumber[]>([])
  const [selectedNumbers, setSelectedNumbers] = useState<Set<string>>(new Set())

  const handleLoadNumbers = async () => {
    if (!accountSid || !authToken) {
      toast.error('Please enter both Account SID and Auth Token')
      return
    }

    setLoading(true)
    try {
      const endpoint = isAdmin 
        ? '/api/admin/phone-numbers/twilio/list'
        : `/api/${organizationSlug}/phone-numbers/twilio/list`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_sid: accountSid, auth_token: authToken }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to load phone numbers')
      }

      const numbers = await response.json()
      setPhoneNumbers(numbers)
      
      if (numbers.length === 0) {
        toast.info('No phone numbers found in this Twilio account')
      } else {
        toast.success(`Found ${numbers.length} phone number${numbers.length === 1 ? '' : 's'}`)
      }
    } catch (error) {
      console.error('Error loading numbers:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load phone numbers')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleNumber = (sid: string) => {
    const newSelected = new Set(selectedNumbers)
    if (newSelected.has(sid)) {
      newSelected.delete(sid)
    } else {
      newSelected.add(sid)
    }
    setSelectedNumbers(newSelected)
  }

  const handleImport = async () => {
    if (selectedNumbers.size === 0) {
      toast.error('Please select at least one phone number')
      return
    }

    setImporting(true)
    try {
      const numbersToImport = phoneNumbers
        .filter(num => selectedNumbers.has(num.sid))
        .map(num => ({
          phone_number: num.phoneNumber,
          account_sid: accountSid,
          auth_token: authToken,
          phone_number_sid: num.sid,
        }))

      const endpoint = isAdmin 
        ? '/api/admin/phone-numbers/import'
        : `/api/${organizationSlug}/phone-numbers/import`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_numbers: numbersToImport }),
      })

      if (!response.ok) {
        throw new Error('Failed to import phone numbers')
      }

      const { results } = await response.json()
      
      const successCount = results.filter((r: { success: boolean }) => r.success).length
      const failCount = results.length - successCount

      if (successCount > 0) {
        toast.success(`Imported ${successCount} phone number${successCount === 1 ? '' : 's'}`)
      }
      if (failCount > 0) {
        toast.error(`Failed to import ${failCount} phone number${failCount === 1 ? '' : 's'}`)
      }

      // Reset and close
      setOpen(false)
      setAccountSid('')
      setAuthToken('')
      setPhoneNumbers([])
      setSelectedNumbers(new Set())
      
      onImportComplete?.()
    } catch (error) {
      console.error('Error importing numbers:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to import phone numbers')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <IconDownload className="mr-2 size-4" />
          Import from Twilio
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Import Phone Numbers from Twilio</SheetTitle>
          <SheetDescription>
            Enter your Twilio credentials to load and import phone numbers.
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="account-sid">Account SID</Label>
            <Input
              id="account-sid"
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={accountSid}
              onChange={(e) => setAccountSid(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="auth-token">Auth Token</Label>
            <Input
              id="auth-token"
              type="password"
              placeholder="Your auth token"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
            />
          </div>

          <Button onClick={handleLoadNumbers} disabled={loading} className="w-full">
            {loading ? (
              <>
                <IconLoader2 className="mr-2 size-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load Phone Numbers'
            )}
          </Button>

          {phoneNumbers.length > 0 && (
            <div className="space-y-2">
              <Label>Select Numbers to Import</Label>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Friendly Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {phoneNumbers.map((number) => (
                      <TableRow key={number.sid}>
                        <TableCell>
                          <Checkbox
                            checked={selectedNumbers.has(number.sid)}
                            onCheckedChange={() => handleToggleNumber(number.sid)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{number.phoneNumber}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {number.friendlyName}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        {phoneNumbers.length > 0 && (
          <SheetFooter>
            <Button onClick={handleImport} disabled={importing || selectedNumbers.size === 0}>
              {importing ? (
                <>
                  <IconLoader2 className="mr-2 size-4 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import ${selectedNumbers.size} Selected`
              )}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}

