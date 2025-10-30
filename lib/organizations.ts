import { WorkOS } from '@workos-inc/node'
import { createServiceClient } from './supabase/server'

export interface Organization {
  id: string
  external_id: string
  name: string
  createdAt: string
  updatedAt: string
  slug: string
}

/**
 * Generate a URL-safe slug from an organization name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Ensure slug is unique by appending a number if needed
 */
async function ensureUniqueSlug(supabase: any, baseSlug: string): Promise<string> {
  let slug = baseSlug
  let counter = 1
  
  while (true) {
    const { data } = await supabase
      .from('organisations')
      .select('slug')
      .eq('slug', slug)
      .single()
    
    if (!data) {
      return slug
    }
    
    slug = `${baseSlug}-${counter}`
    counter++
  }
}

/**
 * Fetches all organizations from WorkOS and automatically syncs them to the database.
 * Creates database records for any organizations that exist in WorkOS but not in the database.
 */
export async function getOrganizations(): Promise<Organization[]> {
  const workos = new WorkOS(process.env.WORKOS_API_KEY!)
  const supabase = await createServiceClient()

  // Fetch all organizations from WorkOS
  const result = await workos.organizations.listOrganizations()

  // Fetch all organizations from database
  const { data: dbOrgs, error: dbError } = await supabase
    .from('organisations')
    .select('id, external_id, slug, name')

  if (dbError) {
    throw new Error('Failed to load organizations from database')
  }

  // Process each WorkOS organization
  const organizations: Organization[] = []
  
  for (const workosOrg of result.data) {
    let dbOrg = dbOrgs?.find(o => o.external_id === workosOrg.id)
    
    // If organization doesn't exist in database, create it
    if (!dbOrg) {
      const baseSlug = generateSlug(workosOrg.name)
      const uniqueSlug = await ensureUniqueSlug(supabase, baseSlug)
      
      const { data: newOrg, error: insertError } = await supabase
        .from('organisations')
        .insert({
          external_id: workosOrg.id,
          slug: uniqueSlug,
          name: workosOrg.name,
        })
        .select('id, external_id, slug, name')
        .single()
      
      if (insertError) {
        console.error('Failed to create organization:', insertError)
        continue
      }
      
      dbOrg = newOrg
    } else if (dbOrg.name !== workosOrg.name) {
      // Update the name if it changed in WorkOS
      const { error: updateError } = await supabase
        .from('organisations')
        .update({ name: workosOrg.name })
        .eq('id', dbOrg.id)
      
      if (!updateError) {
        dbOrg.name = workosOrg.name
      }
    }
    
    organizations.push({
      id: dbOrg.id,
      external_id: workosOrg.id,
      name: workosOrg.name,
      createdAt: workosOrg.createdAt,
      updatedAt: workosOrg.updatedAt,
      slug: dbOrg.slug,
    })
  }

  return organizations
}

