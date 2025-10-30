'use server'
import { getSignInUrl, withAuth } from '@workos-inc/authkit-nextjs';
import { WorkOS } from '@workos-inc/node';
import { createServiceClient } from '@/lib/supabase/server';
import { Organisation, DEFAULT_PERMISSIONS } from '@/types/organisation';
import { checkIsAdminEmail } from '@/app/(admin)/lib/admin-auth';
import { redirect } from 'next/navigation';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Helper function to generate a URL-safe slug from a string
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars (except spaces and hyphens)
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

// Helper function to generate a unique slug
async function generateUniqueSlug(supabase: Awaited<ReturnType<typeof createServiceClient>>, baseName: string): Promise<string> {
  const baseSlug = slugify(baseName);
  let slug = baseSlug;
  let counter = 1;

  // Keep trying until we find a unique slug
  while (true) {
    const { data, error } = await supabase
      .from('organisations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      throw new Error(`Error checking slug uniqueness: ${error.message}`);
    }

    // If no organization exists with this slug, it's unique
    if (!data) {
      return slug;
    }

    // Try the next iteration
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

export async function getOrgBySlug(slug: string): Promise<Organisation | null> {
  const supabase = await createServiceClient();

  const { data: org, error } = await supabase
    .from('organisations')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    throw new Error(`Error fetching organization by slug: ${error.message}`);
  }

  return org as Organisation;
}

export async function getOrg(workosOrganizationId: string): Promise<Organisation> {
  const supabase = await createServiceClient();

  // Check if organization exists in database
  const { data: existingOrg, error: fetchError } = await supabase
    .from('organisations')
    .select('*')
    .eq('external_id', workosOrganizationId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 is "not found" error, which is expected for new orgs
    throw new Error(`Error fetching organization: ${fetchError.message}`);
  }

  // If organization exists, return it
  if (existingOrg) {
    return existingOrg as Organisation;
  }

  // Organization doesn't exist, fetch details from WorkOS and create it
  let orgName = 'organization'; // Fallback name
  try {
    const workosOrg = await workos.organizations.getOrganization(workosOrganizationId);
    orgName = workosOrg.name || orgName;
  } catch (error) {
    console.error('Error fetching organization from WorkOS:', error);
    // Continue with fallback name
  }

  // Generate a unique slug
  const uniqueSlug = await generateUniqueSlug(supabase, orgName);

  // Create the organization
  const { data: newOrg, error: insertError } = await supabase
    .from('organisations')
    .insert({
      external_id: workosOrganizationId,
      slug: uniqueSlug,
      permissions: DEFAULT_PERMISSIONS,
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Error creating organization: ${insertError.message}`);
  }

  // Sync the internal ID back to WorkOS as externalId
  try {
    await workos.organizations.updateOrganization({
      organization: workosOrganizationId,
      externalId: newOrg.id,
    });
  } catch (error) {
    console.error('Error syncing organization ID to WorkOS:', error);
    // Don't throw here - organization is created in our DB, WorkOS sync is secondary
  }

  return newOrg as Organisation;
}

export async function getAuthSession(requestedSlug?: string) {
  const { user, organizationId: userWorkosOrgId } = await withAuth();

  // Check if user is an admin
  const isAdmin = checkIsAdminEmail(user?.email);

  // Determine which organization to use (always use DB ID, not WorkOS ID)
  let effectiveOrgId: string | undefined = undefined;
  let organisation: Organisation | null = null;
  let slug: string | undefined = undefined;
  let userOrganisation: Organisation | null = null;
  let userSlug: string | undefined = undefined;

  // Always load the user's organization if they have one (converts WorkOS ID to DB org)
  if (userWorkosOrgId) {
    try {
      userOrganisation = await getOrg(userWorkosOrgId);
      userSlug = userOrganisation?.slug;
      effectiveOrgId = userOrganisation?.id; // Use DB ID, not WorkOS ID
    } catch (error) {
      console.error('Error loading user organization:', error);
    }
  }

  if (requestedSlug) {
    // Look up organization by slug
    try {
      const orgBySlug = await getOrgBySlug(requestedSlug);
      
      if (!orgBySlug) {
        // Slug doesn't exist - user should be redirected to their org
        effectiveOrgId = undefined;
        organisation = userOrganisation;
        slug = userSlug;
      } else {
        // Slug exists - check if user has access (compare external_id with WorkOS ID)
        if (!isAdmin && orgBySlug.external_id !== userWorkosOrgId) {
          // Non-admin trying to access another org's slug
          // Return user's org info so they can be redirected
          effectiveOrgId = undefined;
          organisation = userOrganisation;
          slug = userSlug;
        } else {
          // User has access - return DB ID
          effectiveOrgId = orgBySlug.id;
          organisation = orgBySlug;
          slug = orgBySlug.slug;
        }
      }
    } catch (error) {
      console.error('Error loading organization by slug:', error);
      effectiveOrgId = undefined;
      organisation = userOrganisation;
      slug = userSlug;
      
    }
  } else {
    // No slug requested, use user's org
    organisation = userOrganisation;
    slug = userSlug;
  }

  if (!effectiveOrgId || !organisation) {
    const signInUrl = await getSignInUrl()
    redirect(signInUrl)
  }

  return { 
    user, 
    organizationId: effectiveOrgId, // Always the DB ID, never WorkOS ID
    organisation, 
    isAdmin,
    slug
  };
}


