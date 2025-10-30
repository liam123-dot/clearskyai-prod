'use server'

import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSignInUrl } from "@workos-inc/authkit-nextjs";


export default async function Home() {
  const { user, slug, isAdmin } = await getAuthSession()
// 
  if (isAdmin) {
    redirect("/admin")
  } else if (user && slug) {
    redirect(`/${slug}`)
  } else {
    redirect(await getSignInUrl())
  }

}
