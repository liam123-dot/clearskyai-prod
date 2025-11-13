import { CallAnnotationsContent } from './call-annotations-content'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Call Annotations | Admin',
  description: 'View and manage call annotations across all organizations',
}

export default async function AdminCallAnnotationsPage() {
  return <CallAnnotationsContent />
}

