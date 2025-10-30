'use client'

import { useState } from "react"
import Image from 'next/image'
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, XCircle, AlertCircle, Trash2, Loader2, ChevronDown, Key } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { CredentialsDialog } from "./credentials-dialog"
import type { AccountsResponse, DeleteAccountResponse, PipedreamAccount } from "@/lib/pipedream/types"

interface CredentialsListProps {
  slug: string
}

export function CredentialsList({ slug }: CredentialsListProps) {
  const queryClient = useQueryClient()
  const [accountToDelete, setAccountToDelete] = useState<PipedreamAccount | null>(null)
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set())

  // Fetch connected accounts
  const { data: accountsData, isLoading, error, refetch } = useQuery<AccountsResponse>({
    queryKey: ['pipedream-accounts', slug],
    queryFn: async () => {
      const response = await fetch(`/api/${slug}/tools/credentials`)
      if (!response.ok) {
        throw new Error('Failed to fetch accounts')
      }
      return response.json()
    },
  })

  // Delete account mutation
  const deleteMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const response = await fetch(`/api/${slug}/tools/credentials/${accountId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete account')
      }
      
      return response.json() as Promise<DeleteAccountResponse>
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Account disconnected successfully')
      queryClient.invalidateQueries({ queryKey: ['pipedream-accounts', slug] })
      setAccountToDelete(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to disconnect account')
    },
  })

  const handleDelete = () => {
    if (accountToDelete) {
      deleteMutation.mutate(accountToDelete.id)
    }
  }

  const toggleAppExpanded = (appName: string) => {
    const newExpanded = new Set(expandedApps)
    if (newExpanded.has(appName)) {
      newExpanded.delete(appName)
    } else {
      newExpanded.add(appName)
    }
    setExpandedApps(newExpanded)
  }

  const accounts = accountsData?.accounts || []

  if (isLoading && accounts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="w-10 h-10 rounded flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'Failed to load accounts'}
        </p>
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Key />
          </EmptyMedia>
          <EmptyTitle>No Credentials Yet</EmptyTitle>
          <EmptyDescription>
            You haven&apos;t connected any apps yet. Get started by connecting
            your first app integration.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <CredentialsDialog slug={slug} />
        </EmptyContent>
      </Empty>
    )
  }

  // Group accounts by app name
  const groupedAccounts = accounts.reduce((groups, account) => {
    const appName = account.app?.name || 'Unknown App'
    if (!groups[appName]) {
      groups[appName] = []
    }
    groups[appName].push(account)
    return groups
  }, {} as Record<string, PipedreamAccount[]>)

  // Sort groups alphabetically by app name
  const sortedAppNames = Object.keys(groupedAccounts).sort()

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {accounts.length} {accounts.length === 1 ? 'credential' : 'credentials'}
          </p>
          <CredentialsDialog slug={slug} onConnectionSuccess={() => refetch()} />
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedAppNames.map((appName) => {
            const appAccounts = groupedAccounts[appName]
            const firstAccount = appAccounts[0]
            const isExpanded = expandedApps.has(appName)
            const hasIssues = appAccounts.some(acc => acc.dead || !acc.healthy)
            
            return (
              <Card key={appName}>
                <CardContent className="p-4">
                  {/* App Header - Clickable to expand/collapse */}
                  <button
                    onClick={() => toggleAppExpanded(appName)}
                    className="w-full flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
                  >
                    {firstAccount.app?.imgSrc ? (
                      <Image
                        src={firstAccount.app.imgSrc}
                        alt={appName}
                        width={40}
                        height={40}
                        className="flex-shrink-0 rounded object-contain"
                      />
                    ) : (
                      <div className="w-10 h-10 flex-shrink-0 bg-muted rounded flex items-center justify-center text-sm font-medium">
                        {appName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{appName}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {appAccounts.length} {appAccounts.length === 1 ? 'account' : 'accounts'}
                        </span>
                        {hasIssues ? (
                          <div className="flex items-center gap-1 text-xs text-yellow-600">
                            <AlertCircle className="h-3 w-3" />
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                    </div>

                    <ChevronDown 
                      className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Accounts List - Collapsible */}
                  {isExpanded && (
                    <div className="space-y-2 mt-3 pt-3 border-t">
                      {appAccounts.map((account) => {
                        const isHealthy = account.healthy && !account.dead
                        const isDead = account.dead
                        
                        return (
                          <div 
                            key={account.id}
                            className={`flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors ${isDead ? 'opacity-60' : ''}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm truncate">
                                {account.name || 'Connected Account'}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {isDead ? (
                                  <div className="flex items-center gap-1 text-xs text-destructive">
                                    <XCircle className="h-3 w-3" />
                                    <span>Disconnected</span>
                                  </div>
                                ) : isHealthy ? (
                                  <div className="flex items-center gap-1 text-xs text-green-600">
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>Connected</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-xs text-yellow-600">
                                    <AlertCircle className="h-3 w-3" />
                                    <span>Issues</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                setAccountToDelete(account)
                              }}
                              disabled={deleteMutation.isPending && accountToDelete?.id === account.id}
                            >
                              {deleteMutation.isPending && accountToDelete?.id === account.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!accountToDelete} onOpenChange={(open) => !open && setAccountToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect <strong>{accountToDelete?.name || accountToDelete?.app?.name}</strong>? 
              This will revoke access and you&apos;ll need to reconnect to use this integration again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                'Disconnect'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

