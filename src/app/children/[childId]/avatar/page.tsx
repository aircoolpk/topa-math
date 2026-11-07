'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { avatarApi, type AvatarItem, type AvatarConfig } from '@/lib/api/avatar'
import { childrenApi, type ChildOut } from '@/lib/api/children'
import { AvatarPreview } from '@/components/avatar/AvatarPreview'
import { GenderSelector } from '@/components/avatar/GenderSelector'
import { ItemPicker } from '@/components/avatar/ItemPicker'

const CATEGORIES: Array<{ key: keyof AvatarConfig; label: string; emoji: string }> = [
  { key: 'gender', label: 'เพศ', emoji: '⚥' },
  { key: 'hair', label: 'ผม', emoji: '💇' },
  { key: 'eyes', label: 'ตา', emoji: '👁️' },
  { key: 'outfit', label: 'ชุด', emoji: '👕' },
  { key: 'accessory', label: 'เครื่องประดับ', emoji: '🎀' },
  { key: 'background', label: 'พื้นหลัง', emoji: '🌈' },
]

export default function AvatarPage() {
  const params = useParams()
  const childId = params.childId as string
  const router = useRouter()
  const { checkAuth } = useAuthStore()
  const [child, setChild] = useState<ChildOut | null>(null)
  const [items, setItems] = useState<AvatarItem[]>([])
  const [config, setConfig] = useState<AvatarConfig>({})
  const [activeCategory, setActiveCategory] = useState<keyof AvatarConfig>('gender')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth().then((authenticatedUser) => {
      if (!authenticatedUser) router.push('/login')
    })
  }, [])

  useEffect(() => {
    if (!childId) return
    Promise.all([childrenApi.get(childId), avatarApi.getItems()])
      .then(([childData, itemsData]) => {
        setChild(childData)
        setItems(itemsData)
        const stored = (childData.avatar_config || {}) as AvatarConfig
        if (!stored.gender) stored.gender = 'girl'
        setConfig(stored)
      })
      .catch(() => router.push('/dashboard'))
      .finally(() => setLoading(false))
  }, [childId])

  const handleSave = async () => {
    setSaving(true)
    try {
      await avatarApi.updateAvatar(childId, config)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      alert('บันทึกไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setSaving(false)
    }
  }

  const selectItem = (category: keyof AvatarConfig, itemId: string) => {
    setConfig((prev) => ({
      ...prev,
      [category]: prev[category] === itemId ? undefined : itemId,
    }))
  }

  const handleGenderChange = (g: 'girl' | 'boy') => {
    setConfig((prev) => ({
      ...prev,
      gender: g,
      // Reset features when gender changes — new gender = new defaults
      hair: undefined,
      eyes: undefined,
      outfit: undefined,
      accessory: undefined,
    }))
  }

  const filteredItems = items.filter((item) => item.category === activeCategory)

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">👗</div>
          <p className="text-gray-500 font-medium">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  if (!child) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">😢</div>
          <p className="text-gray-500 font-medium">ไม่พบข้อมูลเด็ก</p>
          <Link href="/dashboard" className="text-primary-600 font-semibold hover:underline mt-2 block">
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-primary-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            href={`/children/${childId}`}
            className="text-2xl hover:opacity-70 transition-opacity"
          >
            ←
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xl">🎨</span>
            <h1 className="font-bold text-gray-900">สร้างตัวละคร</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* LEFT: Avatar Preview (larger, 2/5 width) */}
          <div className="lg:col-span-2">
            <div className="card sticky top-20 text-center">
              <h3 className="section-title mb-4">👤 ตัวละครของ {child.nickname}</h3>

              {/* Large Avatar */}
              <div className="mb-4 flex justify-center">
                <div className="scale-125 origin-top">
                  <AvatarPreview config={config} nickname={child.nickname} />
                </div>
              </div>

              {/* Level + XP */}
              <div className="mb-4 p-3 bg-primary-50 rounded-xl">
                <div className="flex justify-between text-xs text-primary-700 mb-1.5">
                  <span>เลเวล {child.current_level}</span>
                  <span>
                    {child.total_xp % 1000}/1000 XP
                  </span>
                </div>
                <div className="h-2.5 bg-primary-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all"
                    style={{ width: `${(child.total_xp % 1000) / 10}%` }}
                  />
                </div>
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={saving}
                className={`w-full font-bold py-3 rounded-xl shadow-md transition-all ${
                  saved ? 'bg-green-500 text-white' : 'btn-primary'
                }`}
              >
                {saving
                  ? '⏳ กำลังบันทึก...'
                  : saved
                    ? '✅ บันทึกสำเร็จ!'
                    : '💾 บันทึกตัวละคร'}
              </button>

              {saved && (
                <Link
                  href={`/children/${childId}`}
                  className="block mt-2 text-sm text-primary-600 font-semibold hover:underline"
                >
                  ← กลับหน้าหลัก
                </Link>
              )}
            </div>
          </div>

          {/* RIGHT: Customization panel (3/5 width) */}
          <div className="lg:col-span-3">
            {/* Category tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                    activeCategory === cat.key
                      ? 'bg-primary-500 text-white shadow-md'
                      : 'bg-white text-gray-600 hover:bg-primary-50 border border-gray-200'
                  }`}
                >
                  <span>{cat.emoji}</span> {cat.label}
                </button>
              ))}
            </div>

            {/* Category content */}
            <div className="card">
              <h3 className="section-title mb-4">
                เลือก{CATEGORIES.find((c) => c.key === activeCategory)?.label}
                <span className="text-sm font-normal text-gray-400 ml-2">
                  {activeCategory === 'gender' ? '' : `(${filteredItems.length} ไอเทม)`}
                </span>
              </h3>

              {activeCategory === 'gender' ? (
                <GenderSelector config={config} onSelect={handleGenderChange} />
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">🎨</div>
                  <h4 className="font-bold text-gray-700 mb-1">ยังไม่มีไอเทมในหมวดนี้</h4>
                  <p className="text-sm text-gray-400">ติดตามอัปเดตใหม่ๆ นะ!</p>
                </div>
              ) : (
                <ItemPicker
                  items={filteredItems}
                  selectedId={config[activeCategory]}
                  onSelect={(id) => selectItem(activeCategory, id)}
                  category={activeCategory}
                />
              )}

              {/* Clear selection */}
              {config[activeCategory] && activeCategory !== 'gender' && (
                <button
                  onClick={() =>
                    setConfig((prev) => ({ ...prev, [activeCategory]: undefined }))
                  }
                  className="mt-3 w-full py-2 text-sm text-gray-500 hover:text-gray-700 border border-dashed border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  ล้างการเลือก
                </button>
              )}
            </div>

            {/* Tips */}
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
              <h4 className="text-sm font-bold text-amber-800 mb-2">💡 เคล็ดลับ</h4>
              <ul className="text-xs text-amber-700 space-y-1">
                <li>• เริ่มจากเลือกเพศก่อน จะเปลี่ยนทรงผมและชุดตามเพศที่เลือก</li>
                <li>• คลิกไอเทมเพื่อเลือก คลิกอีกครั้งเพื่อยกเลิก</li>
                <li>• ไอเทม PRO เป็นของแพลน Plus ขึ้นไป</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
