import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getSignInUrl, getSignUpUrl } from '@workos-inc/authkit-nextjs'
import { getAuthSession } from '@/lib/auth'

export async function AuthButtons() {
  const { user, slug } = await getAuthSession()

  if (user && slug) {
    return (
      <Button asChild size="lg">
        <Link href={`/${slug}`}>Go to Dashboard</Link>
      </Button>
    )
  }

  const signInUrl = await getSignInUrl()
  const signUpUrl = await getSignUpUrl()

  return (
    <div className="flex flex-col gap-4">
      <Button asChild size="lg">
        <Link href={signInUrl}>Sign In</Link>
      </Button>
      <Button asChild variant="outline" size="lg">
        <Link href={signUpUrl}>Sign Up</Link>
      </Button>
    </div>
  )
}

