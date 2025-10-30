// Pipedream type definitions

export interface PipedreamApp {
    id: string
    nameSlug: string
    name: string
    description?: string
    imgSrc?: string
    authType?: string
    customFieldsJson?: string
    categories?: string[]
    featuredWeight?: number
    connect?: {
      allowed_domains?: string[]
      base_proxy_target_url?: string
      proxy_enabled?: boolean
    }
  }
  
  export interface PipedreamAccount {
    id: string
    name?: string
    healthy: boolean
    dead: boolean
    app?: {
      name: string
      nameSlug: string
      imgSrc?: string
    }
    createdAt?: string
    updatedAt?: string
  }
  
  export interface PipedreamToken {
    token: string
    expiresAt: string
    connectLinkUrl: string
  }
  
  // API Response Types
  export interface TokenResponse {
    success: boolean
    token?: string
    expiresAt?: string
    connectLinkUrl?: string
    organizationId?: string
    error?: string
  }
  
  export interface AccountsResponse {
    success: boolean
    accounts: PipedreamAccount[]
    total: number
    error?: string
  }
  
  export interface AppsResponse {
    success: boolean
    apps: PipedreamApp[]
    total: number
    error?: string
  }
  
  export interface DeleteAccountResponse {
    success: boolean
    message?: string
    error?: string
  }
  
  export type ConnectionMethod = 'popup' | 'new-tab' | 'same-tab'
  
  export interface AppCredentialResponse {
    success: boolean
    app: PipedreamApp | null
    accounts: PipedreamAccount[]
    total: number
    error?: string
  }
  