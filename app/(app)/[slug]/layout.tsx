import { redirect } from 'next/navigation'
import { getAuthSession } from '@/lib/auth'
import { getSignInUrl } from '@workos-inc/authkit-nextjs'
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

interface SlugLayoutProps {
  params: Promise<{ slug: string }>
  children: React.ReactNode
}

export default async function SlugLayout({ params, children }: SlugLayoutProps) {
  const { slug } = await params
  const { user, organizationId, organisation, isAdmin, slug: userSlug } = await getAuthSession(slug)

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

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar 
        type="organization" 
        slug={slug} 
        orgName={organisation?.slug}
        user={{
          name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email,
          email: user.email,
        }}
        variant="inset" 
      />
      <SidebarInset className="flex flex-col overflow-hidden">
        <SiteHeader isAdmin={isAdmin} />
        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-screen-2xl mx-auto p-6">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

