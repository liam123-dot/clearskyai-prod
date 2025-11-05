import type { Metadata } from 'next'
import { getAuthSession } from '@/lib/auth'
import { getWorkOSUsers } from '@/lib/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { IconUser, IconBuilding, IconMail } from '@tabler/icons-react'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { redirect } from 'next/navigation'

interface SettingsPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: SettingsPageProps): Promise<Metadata> {
  const { slug } = await params
  
  return {
    title: `Settings - ${slug}`,
  }
}

export default async function GeneralSettingsPage({ params }: SettingsPageProps) {
  const { slug } = await params
  const { user, organisation } = await getAuthSession(slug)

  if (!organisation || !user) {
    redirect(`/${slug}`)
  }

  // Fetch users from WorkOS using the organization's external_id
  const users = await getWorkOSUsers(organisation.external_id)

  const userFullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || null
  const orgName = (organisation as any).name || organisation.slug

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account and organization settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconUser className="size-5" />
            Your Account
          </CardTitle>
          <CardDescription>
            Information about your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {userFullName && (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconUser className="size-4" />
                  <span>Name</span>
                </div>
                <p className="font-medium">{userFullName}</p>
              </div>
              <Separator />
            </>
          )}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconMail className="size-4" />
              <span>Email</span>
            </div>
            <p className="font-medium">{user.email}</p>
          </div>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconBuilding className="size-4" />
              <span>Organization</span>
            </div>
            <p className="font-medium">{orgName}</p>
          </div>
        </CardContent>
      </Card>

      {/* Organization Users Section */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Users</CardTitle>
          <CardDescription>
            All users who have access to this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconUser />
                </EmptyMedia>
                <EmptyTitle>No Users Found</EmptyTitle>
                <EmptyDescription>
                  No users found for this organization in WorkOS.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                {users.length} {users.length === 1 ? 'user' : 'users'}
              </p>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="font-semibold">Name</TableHead>
                      <TableHead className="font-semibold">Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'N/A'

                      return (
                        <TableRow key={user.id}>
                          <TableCell className="w-12">
                            <div className="flex items-center justify-center">
                              <div className="bg-muted flex size-8 items-center justify-center rounded-md">
                                <IconUser className="text-muted-foreground size-4" />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{fullName}</TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}