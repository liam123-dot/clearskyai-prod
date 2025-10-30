export interface Organisation {
  id: string;
  external_id: string;
  slug: string;
  permissions: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_PERMISSIONS = {
  // Add default permissions here as needed
  // Example: feature_analytics: true
};


