import type { Metadata } from 'next'
import { getClientBySlug, getWorkOSUsers } from '@/lib/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { IconUser } from '@tabler/icons-react'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

interface ClientUsersPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ClientUsersPageProps): Promise<Metadata> {
  const { slug } = await params
  
  try {
    const client = await getClientBySlug(slug)
    if (client?.name || client?.slug) {
      return {
        title: `Users - ${client.name || client.slug}`,
      }
    }
  } catch (error) {
    // Fallback to generic title if fetch fails
  }
  
  return {
    title: "Users",
  }
}

export default async function AdminClientUsersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const client = await getClientBySlug(slug)

  if (!client) {
    return (
      <div>
        <p>Client not found</p>
      </div>
    )
  }

  // Fetch users from WorkOS using the organization's external_id
  const users = await getWorkOSUsers(client.external_id)

  if (users.length === 0) {
    return (
      <div className="space-y-6">
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
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {users.length} {users.length === 1 ? 'user' : 'users'}
        </p>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12"></TableHead>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Email</TableHead>
                <TableHead className="font-semibold">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'N/A'
                const createdDate = new Date(user.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })

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
                    <TableCell className="text-muted-foreground">{createdDate}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}