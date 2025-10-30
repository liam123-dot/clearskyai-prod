'use server'

import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSignInUrl } from "@workos-inc/authkit-nextjs";


export default async function Home() {
  const { user, slug, isAdmin } = await getAuthSession()
  console.log('user', user)
  console.log('slug', slug)
  console.log('isAdmin', isAdmin)

  if (isAdmin) {
    redirect("/admin")
  } else if (user && slug) {
    redirect(`/${slug}`)
  } else {
    redirect(await getSignInUrl({redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/signedin`}))
  }

}
