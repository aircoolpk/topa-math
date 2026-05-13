import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '4-Craft | ระบบเรียนรู้แบบปรับตัว',
  description: 'ระบบเรียนรู้คณิตศาสตร์แบบปรับตัวสำหรับเด็กไทย',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-background antialiased">
        {children}
      </body>
    </html>
  )
}
