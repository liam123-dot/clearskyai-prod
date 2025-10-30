import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Settings",
}

export default function GeneralSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-6">
        <p className="text-sm text-muted-foreground">
          General settings options will appear here.
        </p>
      </div>
    </div>
  )
}