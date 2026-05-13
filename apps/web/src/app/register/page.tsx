'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'

// ─── Types ─────────────────────────────────────────────────────────────────────

type AvatarConfig = {
  gender?: 'girl' | 'boy'
  hair?: string
  eyes?: string
  outfit?: string
  accessory?: string
  background?: string
}

type AvatarItem = {
  id: string
  name: string
  category: string
  is_default?: boolean
  is_premium?: boolean
}

// ─── Static Avatar Items (used when API not available) ────────────────────────

const STATIC_ITEMS: AvatarItem[] = [
  // Hair (6)
  { id: 'hair_long', name: 'ผมยาว', category: 'hair', is_default: true },
  { id: 'hair_short', name: 'ผมสั้น', category: 'hair' },
  { id: 'hair_curly', name: 'ผมหยัก', category: 'hair' },
  { id: 'hair_ponytail', name: 'หางม้า', category: 'hair' },
  { id: 'hair_bun', name: 'ผมมวย', category: 'hair' },
  { id: 'hair_spiky', name: 'ผมชี้', category: 'hair' },
  // Eyes (4)
  { id: 'eyes_normal', name: 'ตาปกติ', category: 'eyes', is_default: true },
  { id: 'eyes_big', name: 'ตาใหญ่', category: 'eyes' },
  { id: 'eyes_blue', name: 'ตาสีฟ้า', category: 'eyes' },
  { id: 'eyes_green', name: 'ตาสีเขียว', category: 'eyes' },
  // Outfit (6)
  { id: 'outfit_pink', name: 'ชุดชมพู', category: 'outfit', is_default: true },
  { id: 'outfit_blue', name: 'ชุดฟ้า', category: 'outfit' },
  { id: 'outfit_green', name: 'ชุดเขียว', category: 'outfit' },
  { id: 'outfit_red', name: 'ชุดแดง', category: 'outfit' },
  { id: 'outfit_purple', name: 'ชุดม่วง', category: 'outfit' },
  { id: 'outfit_yellow', name: 'ชุดเหลือง', category: 'outfit' },
  // Accessory (4)
  { id: 'acc_none', name: 'ไม่สวม', category: 'accessory', is_default: true },
  { id: 'acc_crown', name: 'มงกุฎ', category: 'accessory', is_premium: true },
  { id: 'acc_glasses', name: 'แว่น', category: 'accessory' },
  { id: 'acc_bow', name: 'โบว์', category: 'accessory' },
  // Background (6)
  { id: 'bg_blue', name: 'ฟ้า', category: 'background', is_default: true },
  { id: 'bg_green', name: 'เขียว', category: 'background' },
  { id: 'bg_pink', name: 'ชมพู', category: 'background' },
  { id: 'bg_purple', name: 'ม่วง', category: 'background' },
  { id: 'bg_yellow', name: 'เหลือง', category: 'background' },
  { id: 'bg_default', name: 'พื้นหลัง', category: 'background' },
]

const CATEGORIES: Array<{ key: keyof AvatarConfig; label: string; emoji: string }> = [
  { key: 'gender', label: 'เพศ', emoji: '⚥' },
  { key: 'hair', label: 'ผม', emoji: '💇' },
  { key: 'eyes', label: 'ตา', emoji: '👁️' },
  { key: 'outfit', label: 'ชุด', emoji: '👕' },
  { key: 'accessory', label: 'เครื่องประดับ', emoji: '🎀' },
  { key: 'background', label: 'พื้นหลัง', emoji: '🌈' },
]

const HAIR_COLORS = [
  { id: 'amber-600', label: 'น้ำตาล', className: 'bg-amber-600' },
  { id: 'amber-800', label: 'ดำ', className: 'bg-amber-800' },
  { id: 'yellow-400', label: 'ทอง', className: 'bg-yellow-400' },
  { id: 'red-600', label: 'แดง', className: 'bg-red-600' },
  { id: 'pink-400', label: 'ชมพู', className: 'bg-pink-400' },
  { id: 'blue-400', label: 'ฟ้า', className: 'bg-blue-400' },
]

// ─── Avatar Preview Component ────────────────────────────────────────────────

function AvatarPreview({ config, nickname }: { config: AvatarConfig; nickname: string }) {
  const isGirl = (config.gender ?? 'girl') === 'girl'
  const bgColors: Record<string, string> = {
    bg_blue: 'from-blue-200 to-blue-400',
    bg_green: 'from-green-200 to-green-400',
    bg_pink: 'from-pink-200 to-pink-400',
    bg_purple: 'from-purple-200 to-purple-400',
    bg_yellow: 'from-yellow-200 to-yellow-400',
    bg_default: 'from-rose-100 to-fuchsia-100',
  }
  const bg = config.background ? bgColors[config.background] || bgColors.bg_default : (isGirl ? bgColors.bg_pink : 'from-blue-200 to-cyan-200')

  // Hair style
  const hairStyles: Record<string, string> = {
    hair_long: 'rounded-b-full',
    hair_short: 'rounded-t-lg',
    hair_curly: 'rounded-3xl',
    hair_ponytail: 'rounded-b-full',
    hair_bun: 'rounded-b-full',
    hair_spiky: 'rounded-sm',
  }
  const hairClass = hairStyles[config.hair ?? ''] ?? 'rounded-b-full'
  const hairTop = config.hair === 'hair_spiky'
    ? 'absolute top-1 flex gap-0.5'
    : 'absolute top-1 left-2 right-2 h-7 rounded-t-full'

  if (isGirl) {
    return (
      <div className={`w-52 h-60 rounded-3xl bg-gradient-to-br ${bg} flex flex-col items-center justify-center shadow-2xl border-4 border-white/60 relative overflow-hidden mx-auto`}>
        <div className="absolute top-3 right-3 w-5 h-5 bg-white/20 rounded-full" />
        <div className="absolute bottom-6 left-3 w-3 h-3 bg-white/20 rounded-full" />
        <div className="absolute top-6 left-4 w-2 h-2 bg-white/20 rounded-full" />

        {/* Hair */}
        {config.hair === 'hair_spiky' ? (
          <div className={hairTop}>
            {[0, 1, 2].map((i) => (
              <div key={i} className={`w-3 h-4 bg-pink-400 rounded-sm ${i === 1 ? '-mt-2' : ''}`} />
            ))}
          </div>
        ) : (
          <>
            <div className={hairTop} />
            <div className="absolute top-[22%] left-0 w-4 h-10 bg-pink-400 rounded-l-full" />
            <div className="absolute top-[22%] right-0 w-4 h-10 bg-pink-400 rounded-r-full" />
          </>
        )}

        {/* Head */}
        <div className="w-28 h-28 rounded-full bg-yellow-50 border-4 border-yellow-200 relative flex items-center justify-center shadow-inner mt-3">
          {/* Eyes */}
          <div className="absolute top-[30%] flex gap-5">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${config.eyes?.includes('blue') ? 'bg-blue-500' : config.eyes?.includes('green') ? 'bg-green-500' : config.eyes?.includes('big') ? 'bg-gray-800' : 'bg-gray-800'}`}>
              <div className="w-2.5 h-2.5 bg-white rounded-full" />
            </div>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${config.eyes?.includes('blue') ? 'bg-blue-500' : config.eyes?.includes('green') ? 'bg-green-500' : config.eyes?.includes('big') ? 'bg-gray-800' : 'bg-gray-800'}`}>
              <div className="w-2.5 h-2.5 bg-white rounded-full" />
            </div>
          </div>
          {/* Smile */}
          <div className="absolute bottom-6 w-7 h-3.5 border-b-2 border-yellow-800 rounded-b-full" />
          {/* Cheeks */}
          <div className="absolute top-[40%] left-1 w-5 h-3 bg-pink-200 rounded-full opacity-70" />
          <div className="absolute top-[40%] right-1 w-5 h-3 bg-pink-200 rounded-full opacity-70" />
        </div>

        {/* Body */}
        <div className={`w-32 h-16 -mt-1 rounded-t-3xl ${config.outfit?.includes('red') ? 'bg-red-400' : config.outfit?.includes('blue') ? 'bg-blue-400' : config.outfit?.includes('green') ? 'bg-green-400' : config.outfit?.includes('purple') ? 'bg-purple-400' : config.outfit?.includes('yellow') ? 'bg-yellow-400' : 'bg-pink-400'} border-t-4 border-white/30 relative`}>
          {config.accessory === 'acc_crown' && <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xl">👑</div>}
          {config.accessory === 'acc_glasses' && <div className="absolute top-1 left-1/2 -translate-x-1/2 text-base">🤓</div>}
          {config.accessory === 'acc_bow' && <div className="absolute -top-3 right-4 text-xl">🎀</div>}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white/30 rounded-full" />
        </div>
      </div>
    )
  }

  // Boy
  return (
    <div className={`w-52 h-60 rounded-3xl bg-gradient-to-br ${bg} flex flex-col items-center justify-center shadow-2xl border-4 border-white/60 relative overflow-hidden mx-auto`}>
      <div className="absolute top-3 right-3 w-5 h-5 bg-white/20 rounded-full" />
      <div className="absolute bottom-6 left-3 w-3 h-3 bg-white/20 rounded-full" />

      {/* Spiky hair */}
      {config.hair === 'hair_spiky' ? (
        <div className="absolute top-1 flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`w-3.5 h-5 bg-amber-700 rounded-sm ${i === 1 ? '-mt-2.5' : ''}`} />
          ))}
        </div>
      ) : (
        <>
          <div className="absolute top-1 left-2 right-2 h-7 bg-amber-700 rounded-t-full" />
          <div className="absolute top-[22%] left-0 w-4 h-10 bg-amber-700 rounded-l-full" />
          <div className="absolute top-[22%] right-0 w-4 h-10 bg-amber-700 rounded-r-full" />
        </>
      )}

      {/* Head */}
      <div className="w-28 h-28 rounded-full bg-yellow-100 border-4 border-yellow-200 relative flex items-center justify-center shadow-inner mt-3">
        <div className="absolute top-[30%] flex gap-5">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${config.eyes?.includes('blue') ? 'bg-blue-500' : config.eyes?.includes('green') ? 'bg-green-500' : 'bg-gray-800'}`}>
            <div className="w-2.5 h-2.5 bg-white rounded-full" />
          </div>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${config.eyes?.includes('blue') ? 'bg-blue-500' : config.eyes?.includes('green') ? 'bg-green-500' : 'bg-gray-800'}`}>
            <div className="w-2.5 h-2.5 bg-white rounded-full" />
          </div>
        </div>
        <div className="absolute bottom-6 w-7 h-3.5 border-b-2 border-yellow-800 rounded-b-full" />
        <div className="absolute top-[40%] left-1 w-5 h-3 bg-pink-200 rounded-full opacity-60" />
        <div className="absolute top-[40%] right-1 w-5 h-3 bg-pink-200 rounded-full opacity-60" />
      </div>

      {/* Body */}
      <div className={`w-32 h-16 -mt-1 rounded-t-3xl ${config.outfit?.includes('red') ? 'bg-red-400' : config.outfit?.includes('green') ? 'bg-green-400' : config.outfit?.includes('blue') ? 'bg-blue-400' : config.outfit?.includes('purple') ? 'bg-purple-400' : config.outfit?.includes('yellow') ? 'bg-yellow-400' : 'bg-blue-400'} border-t-4 border-white/30 relative`}>
        {config.accessory === 'acc_crown' && <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xl">👑</div>}
        {config.accessory === 'acc_glasses' && <div className="absolute top-1 left-1/2 -translate-x-1/2 text-base">🤓</div>}
        {config.accessory === 'acc_bow' && <div className="absolute -top-3 right-4 text-xl">🎀</div>}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white/30 rounded-full" />
      </div>
    </div>
  )
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

const STEP_LABELS = ['ข้อมูลนักเรียน', 'เลือกโปรแกรม', 'สร้างตัวละคร', 'พร้อมผจญภัย']

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEP_LABELS.map((label, idx) => {
        const n = idx + 1
        const done = current > n
        const active = current === n
        return (
          <div key={n} className="flex items-center gap-1.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              done ? 'bg-green-400 text-white' : active ? 'bg-primary-500 text-white ring-2 ring-primary-200' : 'bg-gray-200 text-gray-400'
            }`}>
              {done ? '✓' : n}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${active ? 'text-primary-700' : done ? 'text-green-600' : 'text-gray-400'}`}>
              {label}
            </span>
            {n < 4 && <div className={`w-6 h-px mx-1 ${done ? 'bg-green-300' : 'bg-gray-200'}`} />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter()
  const { register, isLoading } = useAuthStore()
  const [error, setError] = useState('')

  // ── Shared fields ──
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // ── Step 1: Student info ──
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nickname, setNickname] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [gradeLevel, setGradeLevel] = useState(1)
  const [schoolProvince, setSchoolProvince] = useState('')
  const [schoolDistrict, setSchoolDistrict] = useState('')

  // ── Step 2: Program ──
  const [program, setProgram] = useState<'THP' | 'EP'>('THP')

  // ── Step 3: Avatar ──
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>({ gender: 'girl' })
  const [activeCategory, setActiveCategory] = useState<keyof AvatarConfig>('gender')
  const [avatarItems] = useState<AvatarItem[]>(STATIC_ITEMS)

  const [step, setStep] = useState(1)

  // ── Validation helpers ──
  const validateStep1 = () => {
    if (!firstName.trim()) { setError('กรุณากรอกชื่อจริง'); return false }
    if (!lastName.trim()) { setError('กรุณากรอกนามสกุล'); return false }
    if (!nickname.trim()) { setError('กรุณากรอกชื่อเล่น'); return false }
    return true
  }

  const handleNextStep = () => {
    setError('')
    if (step === 1) {
      if (!validateStep1()) return
      setStep(2)
    } else if (step === 2) {
      setStep(3)
    } else if (step === 3) {
      setStep(4)
    }
  }

  const handlePrevStep = () => {
    setError('')
    if (step > 1) setStep(step - 1)
  }

  const handleProgramSelect = (p: 'THP' | 'EP') => {
    if (p === 'EP') return // EP locked
    setProgram(p)
  }

  const selectItem = (category: keyof AvatarConfig, itemId: string) => {
    setAvatarConfig((prev) => ({ ...prev, [category]: prev[category] === itemId ? undefined : itemId }))
  }

  const handleGenderChange = (g: 'girl' | 'boy') => {
    setAvatarConfig((prev) => ({ ...prev, gender: g }))
  }

  const filteredItems = avatarItems.filter((item) => item.category === activeCategory)

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return }
    if (password !== confirmPassword) { setError('รหัสผ่านไม่ตรงกัน'); return }

    try {
      // Step A: Register parent account
      await register(email, password)

      // Step B: Token is already stored by register() via localStorage.setItem('access_token', ...)

      // Step C: Create child profile — send only backend-supported fields
      // Fields NOT yet supported by backend: first_name, last_name (stored in localStorage for now)
      const childPayload = {
        nickname: nickname.trim(),
        grade_level: gradeLevel,
        province: schoolProvince || undefined,
        district: schoolDistrict || undefined,
        school_name: schoolName || undefined,
        school_province: schoolProvince || undefined,
        school_district: schoolDistrict || undefined,
        avatar_gender: avatarConfig.gender || 'girl',
        avatar_config: {
          hair: avatarConfig.hair || undefined,
          eyes: avatarConfig.eyes || undefined,
          outfit: avatarConfig.outfit || undefined,
          accessory: avatarConfig.accessory || undefined,
          background: avatarConfig.background || undefined,
        },
        program_type: program,
        membership_status: 'free',
      }

      const childRes = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/children`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify(childPayload),
      })

      if (!childRes.ok) {
        let detail = 'สร้างโปรไฟล์นักเรียนไม่สำเร็จ'
        try {
          const errData = await childRes.json()
          detail = errData.detail || detail
        } catch {}
        // 409 = user already has a child profile
        if (childRes.status === 409) {
          detail = 'คุณมีโปรไฟล์นักเรียนอยู่แล้ว'
        }
        console.error('[register] POST /children failed', childRes.status, detail)
        setError(detail)
        return
      }

      const child = await childRes.json()

      // Step D: Redirect to dashboard (one child = one dashboard)
      router.push('/dashboard')
    } catch (err: unknown) {
      // eslint-disable-next-line no-console
      console.error('[register] Registration error:', err)
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } }; message?: string }

      const status = axiosErr.response?.status
      const detail = axiosErr.response?.data?.detail

      if (status === 409) {
        setError('อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ')
      } else if (status === 401) {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      } else if (detail) {
        setError(detail)
      } else if (axiosErr.message?.includes('fetch') || axiosErr.message?.includes('network')) {
        setError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาตรวจสอบว่า backend เปิดอยู่ที่ port 8001')
      } else {
        setError('ลงทะเบียนไม่สำเร็จ กรุณาลองใหม่')
      }
    }
  }

  const gradeLabels: Record<number, string> = { 1: 'ป.1', 2: 'ป.2', 3: 'ป.3', 4: 'ป.4', 5: 'ป.5', 6: 'ป.6' }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-background to-accent-50 px-4 py-8">
      <div className="w-full max-w-2xl">

        {/* Logo */}
        <div className="text-center mb-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white text-xl font-black">4</span>
            </div>
            <span className="text-2xl font-extrabold text-gray-900">4-Craft</span>
          </Link>
          <p className="text-gray-500 mt-1 text-sm">สร้างบัญชีและเลือกตัวละครให้ลูก</p>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Card */}
        <div className="card shadow-xl border-primary-100">

          {/* ── STEP 1: Student Info ── */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900 mb-2 text-center flex items-center justify-center gap-2">
                <span>🎓</span> ข้อมูลนักเรียน
              </h2>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">ชื่อจริง <span className="text-red-400">*</span></label>
                  <input type="text" className="input-field" placeholder="เช่น ดาว" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div>
                  <label className="label">นามสกุล <span className="text-red-400">*</span></label>
                  <input type="text" className="input-field" placeholder="เช่น ใจดี" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
              </div>

              <div>
                <label className="label">ชื่อเล่น <span className="text-red-400">*</span></label>
                <input type="text" className="input-field" placeholder="เช่น น้องดาว" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
              </div>

              <div>
                <label className="label">ระดับชั้น</label>
                <select className="input-field" value={gradeLevel} onChange={(e) => setGradeLevel(Number(e.target.value))}>
                  <option value={1}>ป.1</option>
                  <option value={2}>ป.2</option>
                  <option value={3}>ป.3</option>
                  <option value={4}>ป.4</option>
                  <option value={5}>ป.5</option>
                  <option value={6}>ป.6</option>
                </select>
              </div>

              <div>
                <label className="label">ชื่อโรงเรียน <span className="text-xs text-gray-400 font-normal">(ไม่บังคับ)</span></label>
                <input type="text" className="input-field" placeholder="เช่น โรงเรียนวัดใจดี" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">จังหวัด <span className="text-xs text-gray-400 font-normal">(ไม่บังคับ)</span></label>
                  <input type="text" className="input-field" placeholder="เช่น กรุงเทพมหานคร" value={schoolProvince} onChange={(e) => setSchoolProvince(e.target.value)} />
                </div>
                <div>
                  <label className="label">เขต/อำเภอ <span className="text-xs text-gray-400 font-normal">(ไม่บังคับ)</span></label>
                  <input type="text" className="input-field" placeholder="เช่น วัฒนา" value={schoolDistrict} onChange={(e) => setSchoolDistrict(e.target.value)} />
                </div>
              </div>

              <button type="button" onClick={handleNextStep} className="btn-primary w-full">
                ถัดไป →
              </button>

              <p className="text-center text-sm text-gray-500">
                มีบัญชีอยู่แล้ว?{' '}
                <Link href="/login" className="text-primary-600 hover:text-primary-700 font-semibold">เข้าสู่ระบบ</Link>
              </p>
            </div>
          )}

          {/* ── STEP 2: Program Selection ── */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900 mb-2 text-center flex items-center justify-center gap-2">
                <span>📚</span> เลือกโปรแกรม
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* THP Card */}
                <button
                  type="button"
                  onClick={() => handleProgramSelect('THP')}
                  className={`p-6 rounded-2xl border-2 text-center transition-all relative ${
                    program === 'THP'
                      ? 'border-primary-400 bg-primary-50 shadow-lg ring-2 ring-primary-200'
                      : 'border-gray-200 bg-white hover:border-primary-200 hover:bg-primary-50'
                  }`}
                >
                  {program === 'THP' && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center text-white text-xs shadow">✓</div>
                  )}
                  <div className="text-5xl mb-3">🇹🇭</div>
                  <h3 className="font-bold text-lg text-gray-900 mb-1">THP</h3>
                  <p className="text-sm text-gray-500">Thai Program</p>
                  <p className="text-xs text-gray-400 mt-1">โปรแกรมภาษาไทย<br />สำหรับนักเรียนไทย</p>
                </button>

                {/* EP Card - Locked */}
                <button
                  type="button"
                  disabled
                  className="p-6 rounded-2xl border-2 border-gray-200 bg-gray-50 text-center transition-all relative opacity-60 cursor-not-allowed"
                  title="ยังไม่พร้อมให้บริการ"
                >
                  <span className="absolute top-2 right-2 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">เร็ว ๆ นี้</span>
                  <div className="text-5xl mb-3 grayscale">🇬🇧</div>
                  <h3 className="font-bold text-lg text-gray-400 mb-1">EP</h3>
                  <p className="text-sm text-gray-400">English Program</p>
                  <p className="text-xs text-gray-400 mt-1">Coming soon<br />Stay tuned!</p>
                </button>
              </div>

              <div className="flex gap-3 mt-2">
                <button type="button" onClick={handlePrevStep} className="btn-secondary flex-1">← กลับ</button>
                <button type="button" onClick={handleNextStep} className="btn-primary flex-1">ถัดไป →</button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Avatar Creation ── */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900 mb-2 text-center flex items-center justify-center gap-2">
                <span>🎨</span> สร้างตัวละคร
              </h2>

              <div className="grid md:grid-cols-2 gap-4">

                {/* Left: Options */}
                <div className="space-y-3">

                  {/* Category tabs */}
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.key}
                        onClick={() => setActiveCategory(cat.key)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
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
                  <div className="bg-white border border-gray-100 rounded-2xl p-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2">
                      {activeCategory === 'gender' ? 'เลือกเพศ' :
                       activeCategory === 'hair' ? 'เลือกทรงผม' :
                       activeCategory === 'eyes' ? 'เลือกตา' :
                       activeCategory === 'outfit' ? 'เลือกชุด' :
                       activeCategory === 'accessory' ? 'เลือกเครื่องประดับ' :
                       'เลือกพื้นหลัง'}
                    </p>

                    {activeCategory === 'gender' ? (
                      <div className="grid grid-cols-2 gap-3">
                        {(['girl', 'boy'] as const).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => handleGenderChange(g)}
                            className={`p-3 rounded-xl border-2 text-center transition-all ${
                              avatarConfig.gender === g
                                ? 'border-primary-400 bg-primary-50 shadow ring-2 ring-primary-200'
                                : 'border-gray-200 hover:border-primary-200'
                            }`}
                          >
                            <div className="text-3xl mb-1">{g === 'girl' ? '👧' : '👦'}</div>
                            <p className={`text-xs font-semibold ${avatarConfig.gender === g ? 'text-primary-700' : 'text-gray-600'}`}>
                              {g === 'girl' ? 'เด็กผู้หญิง' : 'เด็กผู้ชาย'}
                            </p>
                          </button>
                        ))}
                      </div>
                    ) : activeCategory === 'hair' ? (
                      <>
                        {/* Hair color */}
                        <div className="mb-3">
                          <p className="text-xs text-gray-400 mb-2 font-medium">สีผม</p>
                          <div className="flex gap-2 flex-wrap">
                            {HAIR_COLORS.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                className={`w-7 h-7 rounded-full border-2 transition-all ${c.className} ${avatarConfig.hair?.startsWith(c.id.split('-')[0]) ? 'ring-2 ring-primary-400 border-white' : 'border-gray-200'}`}
                                title={c.label}
                              />
                            ))}
                          </div>
                        </div>
                        {/* Hair styles */}
                        <div className="grid grid-cols-3 gap-2">
                          {filteredItems.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => selectItem('hair', item.id)}
                              className={`p-2 rounded-xl border-2 text-center transition-all ${
                                avatarConfig.hair === item.id
                                  ? 'border-primary-400 bg-primary-50 shadow ring-2 ring-primary-200'
                                  : 'border-gray-200 hover:border-primary-200'
                              }`}
                            >
                              <div className="text-2xl mb-0.5">{item.is_default ? '💇' : '💇‍♀️'}</div>
                              <p className="text-xs font-medium text-gray-700">{item.name}</p>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : activeCategory === 'eyes' ? (
                      <div className="grid grid-cols-2 gap-2">
                        {filteredItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => selectItem('eyes', item.id)}
                            className={`p-2 rounded-xl border-2 text-center transition-all ${
                              avatarConfig.eyes === item.id
                                ? 'border-primary-400 bg-primary-50 shadow ring-2 ring-primary-200'
                                : 'border-gray-200 hover:border-primary-200'
                            }`}
                          >
                            <div className="text-2xl mb-0.5">👁️</div>
                            <p className="text-xs font-medium text-gray-700">{item.name}</p>
                          </button>
                        ))}
                      </div>
                    ) : activeCategory === 'outfit' ? (
                      <div className="grid grid-cols-3 gap-2">
                        {filteredItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => selectItem('outfit', item.id)}
                            className={`p-2 rounded-xl border-2 text-center transition-all ${
                              avatarConfig.outfit === item.id
                                ? 'border-primary-400 bg-primary-50 shadow ring-2 ring-primary-200'
                                : 'border-gray-200 hover:border-primary-200'
                            }`}
                          >
                            <div className="text-2xl mb-0.5">{item.is_premium ? '👑' : '👕'}</div>
                            <p className="text-xs font-medium text-gray-700">{item.name}</p>
                          </button>
                        ))}
                      </div>
                    ) : activeCategory === 'accessory' ? (
                      <div className="grid grid-cols-2 gap-2">
                        {filteredItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => selectItem('accessory', item.id)}
                            className={`p-2 rounded-xl border-2 text-center transition-all ${
                              avatarConfig.accessory === item.id
                                ? 'border-primary-400 bg-primary-50 shadow ring-2 ring-primary-200'
                                : 'border-gray-200 hover:border-primary-200'
                            }`}
                          >
                            <div className="text-2xl mb-0.5">{item.id === 'acc_none' ? '—' : item.is_premium ? '⭐' : '🎀'}</div>
                            <p className="text-xs font-medium text-gray-700">{item.name}</p>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {filteredItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => selectItem('background', item.id)}
                            className={`p-2 rounded-xl border-2 text-center transition-all ${
                              avatarConfig.background === item.id
                                ? 'border-primary-400 bg-primary-50 shadow ring-2 ring-primary-200'
                                : 'border-gray-200 hover:border-primary-200'
                            }`}
                          >
                            <div className="text-2xl mb-0.5">🌈</div>
                            <p className="text-xs font-medium text-gray-700">{item.name}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Avatar Preview */}
                <div className="flex flex-col items-center justify-center sticky top-4">
                  <div className="p-4 bg-gradient-to-br from-primary-50 to-accent-50 rounded-2xl border border-primary-100 w-full flex flex-col items-center">
                    <p className="text-sm font-semibold text-primary-700 mb-3">👤 ตัวอย่างตัวละคร</p>
                    <AvatarPreview config={avatarConfig} nickname={nickname || 'นักเรียน'} />
                    {nickname && (
                      <p className="mt-3 text-center font-bold text-gray-700 text-lg">{nickname}</p>
                    )}
                  </div>
                </div>

              </div>

              <div className="flex gap-3 mt-2">
                <button type="button" onClick={handlePrevStep} className="btn-secondary flex-1">← กลับ</button>
                <button type="button" onClick={handleNextStep} className="btn-primary flex-1">ถัดไป →</button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Summary & Account Creation ── */}
          {step === 4 && (
            <form onSubmit={handleFinalSubmit} className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900 mb-2 text-center flex items-center justify-center gap-2">
                <span>🚀</span> พร้อมผจญภัย
              </h2>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
              )}

              {/* Large avatar preview */}
              <div className="flex justify-center">
                <div className="p-5 bg-gradient-to-br from-primary-50 to-accent-50 rounded-2xl border border-primary-100">
                  <AvatarPreview config={avatarConfig} nickname={nickname || 'นักเรียน'} />
                  {nickname && (
                    <p className="mt-3 text-center font-bold text-gray-800 text-xl">{nickname}</p>
                  )}
                </div>
              </div>

              {/* Info summary */}
              <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-primary-700 mb-3 flex items-center gap-1">
                  <span>📋</span> ข้อมูลนักเรียน
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-500">ชื่อ-นามสกุล</div>
                  <div className="font-semibold text-gray-800 text-right">{firstName} {lastName}</div>
                  <div className="text-gray-500">ชื่อเล่น</div>
                  <div className="font-semibold text-gray-800 text-right">{nickname}</div>
                  <div className="text-gray-500">ระดับชั้น</div>
                  <div className="font-semibold text-gray-800 text-right">{gradeLabels[gradeLevel]}</div>
                  <div className="text-gray-500">โปรแกรม</div>
                  <div className="font-semibold text-gray-800 text-right">{program === 'THP' ? '🇹🇭 THP (ไทย)' : '🇬🇧 EP'}</div>
                  {schoolName && (
                    <>
                      <div className="text-gray-500">โรงเรียน</div>
                      <div className="font-semibold text-gray-800 text-right">{schoolName}</div>
                    </>
                  )}
                </div>
              </div>

              {/* Account fields */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <h3 className="text-sm font-bold text-gray-600 flex items-center gap-1">
                  <span>🔐</span> สร้างบัญชีผู้ปกครอง
                </h3>
                <div>
                  <label className="label">อีเมลผู้ปกครอง</label>
                  <input type="email" className="input-field" placeholder="mom@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <label className="label">รหัสผ่าน</label>
                  <input type="password" className="input-field" placeholder="อย่างน้อย 8 ตัวอักษร" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                </div>
                <div>
                  <label className="label">ยืนยันรหัสผ่าน</label>
                  <input type="password" className="input-field" placeholder="พิมพ์รหัสผ่านอีกครั้ง" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={handlePrevStep} className="btn-secondary flex-1" disabled={isLoading}>← กลับ</button>
                <button type="submit" className="btn-primary flex-1" disabled={isLoading}>
                  {isLoading ? '⏳ กำลังสมัคร...' : '🚀 เริ่มผจญภัย!'}
                </button>
              </div>

              <p className="text-center text-sm text-gray-500">
                มีบัญชีอยู่แล้ว?{' '}
                <Link href="/login" className="text-primary-600 hover:text-primary-700 font-semibold">เข้าสู่ระบบ</Link>
              </p>
            </form>
          )}

        </div>
      </div>
    </div>
  )
}
