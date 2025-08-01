
'use client'

import { AuthProvider } from "@/hooks/use-auth"
import { Toaster } from "@/components/ui/toaster"

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
        {children}
        <Toaster />
    </AuthProvider>
  )
}
