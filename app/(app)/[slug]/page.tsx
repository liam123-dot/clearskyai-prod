import { redirect } from 'next/navigation'
import { getAuthSession } from '@/lib/auth'
import { getSignInUrl } from '@workos-inc/authkit-nextjs'
import { CallsAnalytics } from '@/components/calls/calls-analytics'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return {
    title: "Dashboard",
  }
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params
  const { user, organizationId, organisation, slug: userSlug } = await getAuthSession(slug)

  // If no user, redirect to sign in
  if (!user) {
    const signInUrl = await getSignInUrl()
    redirect(signInUrl)
  }

  // If no organizationId (no access to this slug), redirect to user's org or sign in
  if (!organizationId) {
    if (userSlug) {
      redirect(`/${userSlug}`)
    } else {
      const signInUrl = await getSignInUrl()
      redirect(signInUrl)
    }
  }

  // User has access to this organization
  return (
    <div className="space-y-6">
      <div className="@container/main">
        <CallsAnalytics slug={slug} />
      </div>
    </div>
  )
}