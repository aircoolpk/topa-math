import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TOPA Math | เรียนเลขให้สนุก เข้าใจง่าย มั่นใจทุกโจทย์',
  description: 'แพลตฟอร์มเรียนคณิตสำหรับเด็กประถม ที่ช่วยให้เรียนอย่างเป็นขั้นตอน ฝึกคิดแบบเห็นภาพ ทำแบบทดสอบได้ และพัฒนาความมั่นใจในคณิตศาสตร์ทุกวัน',
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
