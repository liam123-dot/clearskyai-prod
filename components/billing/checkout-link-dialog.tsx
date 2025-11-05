'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

interface CheckoutLinkDialogProps {
  organizationId: string
  organizationSlug?: string
}

export function CheckoutLinkDialog({ organizationId, organizationSlug }: CheckoutLinkDialogProps) {
  const router = useRouter()
  const pathname = usePathname()
  
  // Determine the slug from the pathname if not provided
  const slug = organizationSlug || pathname.split('/')[3]
  
  const handleNavigate = () => {
    router.push(`/admin/client/${slug}/billing/checkout-link/new`)
  }

  return (
    <Button onClick={handleNavigate}>
      <ExternalLink className="h-4 w-4 mr-2" />
      Create Checkout Link
    </Button>
  )
}

