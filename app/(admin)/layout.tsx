import { redirect } from 'next/navigation'
import { getAuthSession } from '@/lib/auth'
import { getSignInUrl } from '@workos-inc/authkit-nextjs'
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isAdmin, slug } = await getAuthSession()

  // If no user, redirect to sign in
  if (!user) {
    const signInUrl = await getSignInUrl()
    redirect(signInUrl)
  }

  // If not admin, redirect to their org or sign in
  if (!isAdmin) {
    if (slug) {
      redirect(`/${slug}`)
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
        type="admin"
        user={{
          name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email,
          email: user.email,
        }}
        variant="inset" 
      />
      <SidebarInset className="flex flex-col overflow-hidden">
        <SiteHeader isAdmin={isAdmin} showAdminButton={false}/>
        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-screen-2xl mx-auto p-6">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

