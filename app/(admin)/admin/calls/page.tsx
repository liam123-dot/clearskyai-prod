import { requireAdmin } from "@/app/(admin)/lib/admin-auth"
import { AdminCallsContent } from "./admin-calls-content"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Calls",
}

export default async function AdminCallsPage() {
  await requireAdmin()

  return <AdminCallsContent />
}