import { getAuthSession } from "@/lib/auth"
import { CredentialsList } from "@/components/tools/credentials-list"

interface CredentialsPageProps {
  params: Promise<{ slug: string }>
}

export default async function OrganizationToolsCredentialsPage({ params }: CredentialsPageProps) {
  const { slug } = await params
  await getAuthSession(slug) // Verify authentication

  return (
    <div className="space-y-6">
      <CredentialsList slug={slug} />
    </div>
  )
}