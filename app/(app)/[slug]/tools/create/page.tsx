import { getAuthSession } from "@/lib/auth"
import { CreateToolForm } from "@/components/tools/create-tool-form"
import { IconArrowLeft } from "@tabler/icons-react"
import Link from "next/link"

interface CreateToolPageProps {
  params: Promise<{ slug: string }>
}

export default async function CreateToolPage({ params }: CreateToolPageProps) {
  const { slug } = await params
  await getAuthSession(slug) // Verify authentication

  return (
    <div className="space-y-6">
      <Link
        href={`/${slug}/tools`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <IconArrowLeft className="w-4 h-4 mr-1" />
        Back to Tools
      </Link>

      <CreateToolForm slug={slug} />
    </div>
  )
}

