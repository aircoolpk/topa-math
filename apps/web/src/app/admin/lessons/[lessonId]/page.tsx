import { redirect } from 'next/navigation'

export default function AdminLessonAliasPage({ params, searchParams }: { params: { lessonId: string }; searchParams: { lang?: string } }) {
  const suffix = searchParams.lang ? `?language=${encodeURIComponent(searchParams.lang)}` : ''
  redirect(`/admin/content/lesson/${params.lessonId}${suffix}`)
}
