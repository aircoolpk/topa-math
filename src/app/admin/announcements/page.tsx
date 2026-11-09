'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminApi, type AdminAnnouncement, type AdminAnnouncementInput } from '@/lib/api/admin'

const emptyForm: AdminAnnouncementInput = {
  title: '',
  body: '',
  link_url: '',
  published: true,
  sort_order: 0,
}

function dateLabel(value?: string | null) {
  return value ? new Date(value).toLocaleString('th-TH') : '-'
}

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<AdminAnnouncement[]>([])
  const [form, setForm] = useState<AdminAnnouncementInput>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await adminApi.announcements()
      setItems(res.items)
    } catch (err) {
      setError(adminApi.errorMessage(err, 'โหลดประกาศไม่สำเร็จ'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function reset() {
    setForm(emptyForm)
    setEditingId(null)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.title.trim()) {
      setError('กรุณากรอกหัวข้อประกาศ')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    const payload: AdminAnnouncementInput = {
      title: form.title.trim(),
      body: form.body ?? '',
      link_url: form.link_url?.trim() ? form.link_url.trim() : null,
      published: form.published ?? false,
      sort_order: form.sort_order ?? 0,
    }
    try {
      if (editingId) {
        await adminApi.updateAnnouncement(editingId, payload)
        setNotice('อัปเดตประกาศเรียบร้อยแล้ว')
      } else {
        await adminApi.createAnnouncement(payload)
        setNotice('เพิ่มประกาศเรียบร้อยแล้ว')
      }
      reset()
      await load()
    } catch (err) {
      setError(adminApi.errorMessage(err, 'บันทึกประกาศไม่สำเร็จ'))
    } finally {
      setBusy(false)
    }
  }

  async function togglePublished(item: AdminAnnouncement) {
    setBusy(true)
    setError('')
    try {
      await adminApi.updateAnnouncement(item.id, { published: !item.published })
      await load()
    } catch (err) {
      setError(adminApi.errorMessage(err, 'เปลี่ยนสถานะประกาศไม่สำเร็จ'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(item: AdminAnnouncement) {
    if (!window.confirm(`ลบประกาศ "${item.title}" ใช่ไหม`)) return
    setBusy(true)
    setError('')
    try {
      await adminApi.deleteAnnouncement(item.id)
      if (editingId === item.id) reset()
      setNotice('ลบประกาศเรียบร้อยแล้ว')
      await load()
    } catch (err) {
      setError(adminApi.errorMessage(err, 'ลบประกาศไม่สำเร็จ'))
    } finally {
      setBusy(false)
    }
  }

  function edit(item: AdminAnnouncement) {
    setEditingId(item.id)
    setForm({
      title: item.title,
      body: item.body ?? '',
      link_url: item.link_url ?? '',
      published: item.published,
      sort_order: item.sort_order ?? 0,
    })
    setError('')
    setNotice('')
  }

  if (loading) return <main className="p-8 text-gray-500">กำลังโหลด...</main>

  return (
    <main className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-950">สาวสาร &amp; ฝากประกาศ</h1>
        <p className="mt-1 text-sm text-gray-500">
          ประกาศที่เผยแพร่จะแสดงในการ์ด &ldquo;สาวสาร &amp; ฝากประกาศ&rdquo; บนหน้าแรก และข้อมูลถูกเก็บในฐานข้อมูลจริง
          (ไม่หายเมื่ออัปเดตระบบ)
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-gray-950">
          {editingId ? 'แก้ไขประกาศ' : 'เพิ่มประกาศใหม่'}
        </h2>
        <form onSubmit={submit} className="mt-4 grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-sm font-bold text-gray-700">หัวข้อประกาศ</span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="เช่น เปิดเทอมใหม่ ป.1-ป.6"
              className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-sky-500"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-bold text-gray-700">เนื้อหา</span>
            <textarea
              value={form.body ?? ''}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={4}
              placeholder="รายละเอียดของประกาศ"
              className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-sky-500"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-1.5">
              <span className="text-sm font-bold text-gray-700">ลิงก์ (ถ้ามี)</span>
              <input
                value={form.link_url ?? ''}
                onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                placeholder="https://..."
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-sky-500"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-bold text-gray-700">ลำดับ</span>
              <input
                type="number"
                value={form.sort_order ?? 0}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-sky-500"
              />
            </label>
            <label className="flex items-end gap-2 pb-2">
              <input
                type="checkbox"
                checked={form.published ?? false}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
                className="h-5 w-5 accent-sky-600"
              />
              <span className="text-sm font-bold text-gray-700">เผยแพร่บนหน้าแรก</span>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มประกาศ'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={reset}
                className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-bold text-gray-700"
              >
                ยกเลิก
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-gray-50 text-xs font-extrabold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">ลำดับ</th>
                <th className="px-4 py-3">หัวข้อ</th>
                <th className="px-4 py-3">เนื้อหา</th>
                <th className="px-4 py-3">สถานะ</th>
                <th className="px-4 py-3">เผยแพร่เมื่อ</th>
                <th className="px-4 py-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    ยังไม่มีประกาศ — เพิ่มประกาศแรกด้านบน
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-4 py-3 font-bold text-gray-500">{item.sort_order}</td>
                  <td className="px-4 py-3 font-extrabold text-gray-900">{item.title}</td>
                  <td className="max-w-[280px] px-4 py-3 text-gray-600">
                    <p className="line-clamp-3 whitespace-pre-line">{item.body}</p>
                    {item.link_url && (
                      <a
                        href={item.link_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs font-bold text-sky-600 underline-offset-2 hover:underline"
                      >
                        ลิงก์
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${
                        item.published ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {item.published ? 'เผยแพร่' : 'ยังไม่เผยแพร่'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{dateLabel(item.published_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => edit(item)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                      >
                        แก้ไข
                      </button>
                      <button
                        onClick={() => togglePublished(item)}
                        disabled={busy}
                        className="rounded-lg border border-sky-300 px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-50 disabled:opacity-60"
                      >
                        {item.published ? 'ซ่อน' : 'เผยแพร่'}
                      </button>
                      <button
                        onClick={() => remove(item)}
                        disabled={busy}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
