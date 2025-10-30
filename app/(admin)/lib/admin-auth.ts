import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";

// Hardcoded list of admin email addresses
const ADMIN_EMAILS = [
  'liam@buchananautomations.com',
  // Add more admin emails here
];

export function checkIsAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function requireAdmin(): Promise<void> {
  const { isAdmin } = await getAuthSession();
  if (!isAdmin) {
    redirect('/');
  }
}

