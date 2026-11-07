import { redirect } from 'next/navigation'

export default function AdminTestByLessonAliasPage({ params }: { params: { lessonId: string } }) {
  redirect(`/admin/questions?lesson_id=${encodeURIComponent(params.lessonId)}`)
}
