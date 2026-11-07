import { redirect } from 'next/navigation'

export default function AdminContentRedirectPage() {
  redirect('/admin/lessons')
}
