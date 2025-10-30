import { createServiceClient } from './supabase/server'
export async function getClientBySlug(slug: string) {

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('organisations')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) {
    return null
  }

  return data
}