'use client'

import { useEffect, useMemo, useState } from 'react'

import Link from 'next/link'
import { Save, ShieldCheck, RotateCcw, Archive } from 'lucide-react'
import { adminApi } from '@/lib/api/admin'
import { fallbackHomepageConfig, type HomepageConfig } from '@/lib/topa-content'

const sectionLabels: Record<keyof HomepageConfig, string> = {
  hero: 'Hero',
  features: 'Feature cards',
  ranking: 'Ranking preview',
  reviews: 'Reviews',
  announcements: 'Announcements (สาวสาร/ฝากประกาศ)',
  mascots: 'Mascots',
  curriculum: 'Curriculum',
  parent_trust: 'Parent trust',
  cta_banner: 'CTA banner',
  footer: 'Footer',
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-sky-400" />
    </label>
  )
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-sky-400" />
    </label>
  )
}

export default function AdminHomepagePage() {
  const [config, setConfig] = useState<HomepageConfig>(fallbackHomepageConfig)
  const [active, setActive] = useState<keyof HomepageConfig>('hero')
  const [raw, setRaw] = useState('')
  const [backups, setBackups] = useState<Array<{ name: string; created_at: string }>>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.homepage()
      .then((data) => {
        setConfig(data.config)
        setRaw(JSON.stringify(data.config, null, 2))
        setBackups(data.backups)
      })
      .catch((err) => setError(adminApi.errorMessage(err, 'โหลด Homepage CMS ไม่สำเร็จ')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setRaw(JSON.stringify(config, null, 2))
  }, [config])

  const sectionJson = useMemo(() => JSON.stringify(config[active], null, 2), [active, config])

  const patch = (next: Partial<HomepageConfig>) => {
    setConfig((current) => {
      const updated = { ...current, ...next }
      setRaw(JSON.stringify(updated, null, 2))
      return updated
    })
    setMessage('')
    setError('')
  }

  const save = async () => {
    setMessage('')
    setError('')
    try {
      const parsed = JSON.parse(raw) as HomepageConfig
      const result = await adminApi.saveHomepage(parsed)
      setConfig(result.config)
      setRaw(JSON.stringify(result.config, null, 2))
      await fetch('/api/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/' }),
        cache: 'no-store',
      }).catch(() => null)
      setMessage(`Saved and homepage refreshed. Backup created${result.backup?.backup_path ? `: ${result.backup.backup_path}` : ''}`)
      const fresh = await adminApi.homepage()
      setBackups(fresh.backups)
    } catch (err) {
      setError(err instanceof SyntaxError ? err.message : adminApi.errorMessage(err, 'บันทึก Homepage CMS ไม่สำเร็จ'))
    }
  }

  const validate = async () => {
    setMessage('')
    setError('')
    try {
      await adminApi.validateHomepage(JSON.parse(raw) as HomepageConfig)
      setMessage('Homepage JSON is valid.')
    } catch (err) {
      setError(err instanceof SyntaxError ? err.message : adminApi.errorMessage(err, 'ตรวจสอบ Homepage JSON ไม่สำเร็จ'))
    }
  }

  const backup = async () => {
    setMessage('')
    setError('')
    try {
      const result = await adminApi.backupHomepage()
      setMessage(`Backup created: ${result.backup_path}`)
      const fresh = await adminApi.homepage()
      setBackups(fresh.backups)
    } catch (err) {
      setError(adminApi.errorMessage(err, 'สร้าง backup ไม่สำเร็จ'))
    }
  }

  const restore = async (name: string) => {
    setMessage('')
    setError('')
    try {
      const result = await adminApi.restoreHomepage(name)
      setConfig(result.config)
      setMessage(`Restored ${name}`)
    } catch (err) {
      setError(adminApi.errorMessage(err, 'restore ไม่สำเร็จ'))
    }
  }

  if (loading) return <main className="p-8 text-gray-500">Loading Homepage CMS...</main>

  return (
    <main className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-950">หน้าแรก / Homepage CMS</h1>
            <p className="mt-1 text-sm text-gray-500">จัดการทุก section ของหน้าแรกด้วย structured JSON และ quick fields สำหรับ hero</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={validate} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700"><ShieldCheck className="h-4 w-4" /> Validate</button>
            <button onClick={backup} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700"><Archive className="h-4 w-4" /> Backup</button>
            <button onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white"><Save className="h-4 w-4" /> Save</button>
          </div>
        </div>

        {message && <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{message}</div>}
        {error && <pre className="mb-4 whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</pre>}

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="grid gap-1">
              {(Object.keys(sectionLabels) as Array<keyof HomepageConfig>)
                .filter((key) => key !== 'announcements')
                .map((key) => (
                <button key={key} onClick={() => setActive(key)} className={`rounded-xl px-3 py-2 text-left text-sm font-bold ${active === key ? 'bg-sky-100 text-sky-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {sectionLabels[key]}
                </button>
                ))}
              <Link
                href="/admin/announcements"
                className="rounded-xl px-3 py-2 text-left text-sm font-bold text-sky-700 hover:bg-sky-50"
              >
                สาวสาร &amp; ฝากประกาศ (ฐานข้อมูล)
              </Link>
            </div>
            <div className="mt-6 border-t border-gray-100 pt-4">
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-gray-400">Backups</p>
              <div className="grid max-h-64 gap-2 overflow-auto">
                {backups.slice(0, 8).map((item) => (
                  <button key={item.name} onClick={() => restore(item.name)} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-2 text-left text-xs font-semibold text-gray-600 hover:bg-amber-50">
                    <RotateCcw className="h-3 w-3" />
                    <span className="truncate">{item.name}</span>
                  </button>
                ))}
                {!backups.length && <p className="text-xs text-gray-400">ยังไม่มี backup</p>}
              </div>
            </div>
          </aside>

          <section className="grid gap-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-black text-gray-950">Quick edit: Hero</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Headline" value={config.hero.headline} onChange={(headline) => patch({ hero: { ...config.hero, headline } })} />
                <TextField label="Subheadline" value={config.hero.subheadline} onChange={(subheadline) => patch({ hero: { ...config.hero, subheadline } })} />
                <Field label="Primary CTA text" value={config.hero.primary_cta_text} onChange={(primary_cta_text) => patch({ hero: { ...config.hero, primary_cta_text } })} />
                <Field label="Primary CTA link" value={config.hero.primary_cta_link} onChange={(primary_cta_link) => patch({ hero: { ...config.hero, primary_cta_link } })} />
                <Field label="Secondary CTA text" value={config.hero.secondary_cta_text} onChange={(secondary_cta_text) => patch({ hero: { ...config.hero, secondary_cta_text } })} />
                <Field label="Mascot group image" value={config.hero.mascot_group_image} onChange={(mascot_group_image) => patch({ hero: { ...config.hero, mascot_group_image } })} />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-black text-gray-950">{sectionLabels[active]} JSON</h2>
                <p className="text-xs font-semibold text-gray-400">Read-only preview of current section</p>
              </div>
              <pre className="max-h-72 overflow-auto rounded-xl bg-gray-950 p-4 text-xs text-gray-100">{sectionJson}</pre>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3">
                <h2 className="text-lg font-black text-gray-950">Full homepage JSON</h2>
                <p className="text-sm text-gray-500">แก้ได้ทุก field: cards, order, enabled, image paths, ranking demo rows, footer links และ CTA</p>
              </div>
              <textarea value={raw} onChange={(event) => setRaw(event.target.value)} rows={28} className="w-full rounded-xl border border-gray-200 bg-slate-950 p-4 font-mono text-xs text-slate-100 outline-none focus:border-sky-400" />
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
