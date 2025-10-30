export default async function ToolsLayout({ params, children }: { params: Promise<{ slug: string }>, children: React.ReactNode }) {
  return <>{children}</>
}