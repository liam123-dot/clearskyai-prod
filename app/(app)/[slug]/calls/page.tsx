import { CallsPageClient } from "./calls-page-client"
import { getAuthSession } from "@/lib/auth"
import type { Metadata } from "next"

interface CallsPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: CallsPageProps): Promise<Metadata> {
  return {
    title: "Calls",
  }
}

export default async function CallsPage({ params }: CallsPageProps) {
  const { slug } = await params
  await getAuthSession(slug)

  return <CallsPageClient slug={slug} />
}