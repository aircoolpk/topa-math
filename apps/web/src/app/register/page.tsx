'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Camera, Check, ImagePlus, Trash2, Upload } from 'lucide-react'
import { TopaLogo } from '@/components/brand/TopaBrand'
import { ReferralCapture } from '@/components/referral/ReferralCapture'
import { getStoredReferralToken } from '@/lib/referral'
import { apiClient } from '@/lib/api-client'
import { buildApiUrl } from '@/lib/public-env'
import { useAuthStore } from '@/store/auth'
import type { ChildOut } from '@/lib/api/children'

type StudentGender = 'girl' | 'boy' | 'unspecified'

const STEP_LABELS = ['ข้อมูลนักเรียน', 'เลือกโปรแกรม', 'อัปโหลดรูป', 'พร้อมผจญภัย']
const GRADE_LABELS: Record<number, string> = { 1: 'ป.1', 2: 'ป.2', 3: 'ป.3', 4: 'ป.4', 5: 'ป.5', 6: 'ป.6' }
const GENDER_LABELS: Record<StudentGender, string> = {
  girl: 'เด็กหญิง',
  boy: 'เด็กชาย',
  unspecified: 'ไม่ระบุ',
}
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
      {STEP_LABELS.map((label, idx) => {
        const n = idx + 1
        const active = current === n
        const done = current > n
        return (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${done ? 'bg-green-400 text-white' : active ? 'bg-primary-500 text-white ring-4 ring-primary-100' : 'bg-gray-200 text-gray-400'}`}>
              {done ? <Check className="h-4 w-4" /> : n}
            </div>
            <span className={`hidden text-xs font-bold sm:block ${active ? 'text-primary-700' : done ? 'text-green-600' : 'text-gray-400'}`}>{label}</span>
            {n < STEP_LABELS.length && <div className={`h-px w-6 ${done ? 'bg-green-300' : 'bg-gray-200'}`} />}
          </div>
        )
      })}
    </div>
  )
}

function StudentPhotoPreview({ previewUrl, gender, nickname, size = 'lg' }: { previewUrl: string | null; gender: StudentGender; nickname: string; size?: 'lg' | 'xl' }) {
  const dim = size === 'xl' ? 'h-56 w-56' : 'h-44 w-44'
  if (previewUrl) {
    return (
      <div className={`${dim} overflow-hidden rounded-3xl border-4 border-white bg-white shadow-2xl`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt={`รูปโปรไฟล์ของ ${nickname || 'นักเรียน'}`} className="h-full w-full object-cover" />
      </div>
    )
  }
  const label = gender === 'boy' ? 'ช' : gender === 'girl' ? 'ญ' : (nickname || 'T').slice(0, 1)
  const colors = gender === 'boy' ? 'from-sky-300 to-blue-500' : gender === 'girl' ? 'from-pink-300 to-amber-300' : 'from-sky-300 to-amber-300'
  return (
    <div className={`${dim} flex items-center justify-center rounded-3xl border-4 border-white bg-gradient-to-br ${colors} text-6xl font-black text-white shadow-2xl`}>
      {label}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-gray-700">{label}</span>
      {children}
    </label>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const { register, isLoading } = useAuthStore()
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [referralToken, setReferralToken] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nickname, setNickname] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [gradeLevel, setGradeLevel] = useState(1)
  const [schoolProvince, setSchoolProvince] = useState('')
  const [schoolDistrict, setSchoolDistrict] = useState('')
  const [program, setProgram] = useState<'THP' | 'EP'>('THP')
  const [gender, setGender] = useState<StudentGender>('unspecified')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [createdChild, setCreatedChild] = useState<ChildOut | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('ref')
    setReferralToken(param || getStoredReferralToken())
  }, [])

  useEffect(() => {
    return () => {
      if (photoPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(photoPreviewUrl)
    }
  }, [photoPreviewUrl])

  const canSubmit = useMemo(() => !isLoading && !photoUploading, [isLoading, photoUploading])

  const setPreviewFromFile = (file: File | null) => {
    if (photoPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(photoPreviewUrl)
    setPhotoFile(file)
    setPhotoPreviewUrl(file ? URL.createObjectURL(file) : null)
  }

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError('')
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP เท่านั้น')
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError('ไฟล์รูปภาพใหญ่เกินไป กรุณาเลือกรูปไม่เกิน 5MB')
      return
    }
    setPreviewFromFile(file)
  }

  const next = () => {
    setError('')
    if (step === 1) {
      if (!firstName.trim()) return setError('กรุณากรอกชื่อจริง')
      if (!lastName.trim()) return setError('กรุณากรอกนามสกุล')
      if (!nickname.trim()) return setError('กรุณากรอกชื่อเล่น')
    }
    setStep((value) => Math.min(4, value + 1))
  }

  const back = () => {
    setError('')
    setStep((value) => Math.max(1, value - 1))
  }

  const uploadPhoto = async (childId: string) => {
    if (!photoFile) return null
    setPhotoUploading(true)
    try {
      const form = new FormData()
      form.append('file', photoFile)
      const token = localStorage.getItem('access_token')
      const res = await fetch(buildApiUrl(`/me/students/${childId}/avatar`), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
        body: form,
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(detail || 'Photo upload failed')
      }
      return await res.json() as { student_photo_url: string }
    } finally {
      setPhotoUploading(false)
    }
  }

  const completeWithoutPhoto = () => {
    router.push('/dashboard')
  }

  const handleFinalSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setInfo('')
    if (!createdChild) {
      if (password.length < 8) return setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
      if (password !== confirmPassword) return setError('รหัสผ่านไม่ตรงกัน')
    }

    try {
      let child = createdChild
      if (!child) {
        await register(email, password, referralToken || getStoredReferralToken())
        const childRes = await apiClient.post('/children', {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          nickname: nickname.trim(),
          grade_level: gradeLevel,
          province: schoolProvince || undefined,
          district: schoolDistrict || undefined,
          school_name: schoolName || undefined,
          school_province: schoolProvince || undefined,
          school_district: schoolDistrict || undefined,
          avatar_gender: gender,
          avatar_config: {},
          program_type: program,
          membership_status: 'free',
        })
        child = childRes.data as ChildOut
        setCreatedChild(child)
      }

      if (photoFile) {
        try {
          const uploaded = await uploadPhoto(child.id)
          setInfo(uploaded?.student_photo_url ? 'อัปโหลดรูปสำเร็จ กำลังไปที่แดชบอร์ด...' : '')
          router.push('/dashboard')
          return
        } catch {
          setError('สร้างบัญชีสำเร็จแล้ว แต่อัปโหลดรูปไม่สำเร็จ กรุณาลองอัปโหลดอีกครั้ง หรือกดข้ามไปแดชบอร์ด')
          return
        }
      }

      router.push('/dashboard')
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { detail?: string } }; message?: string }
      if (e.response?.status === 409) setError('อีเมลนี้หรือโปรไฟล์นักเรียนนี้มีอยู่แล้ว')
      else if (e.response?.data?.detail) setError(e.response.data.detail)
      else setError('ลงทะเบียนไม่สำเร็จ กรุณาลองใหม่')
    }
  }

  return (
    <>
      <ReferralCapture token={referralToken} />
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-background to-secondary-50 px-4 py-8">
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-4 text-center">
            <Link href="/" className="inline-flex items-center gap-2">
              <TopaLogo size="lg" />
            </Link>
          </div>

          <StepIndicator current={step} />

          <div className="rounded-3xl border border-primary-100 bg-white p-6 shadow-xl">
            {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
            {info && <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">{info}</div>}

            {step === 1 && (
              <div className="space-y-4">
                <div className="text-center">
                  <h1 className="text-2xl font-black text-gray-950">ข้อมูลนักเรียน</h1>
                  <p className="mt-1 text-sm text-gray-500">บอก TOPA นิดนึงว่าใครกำลังจะเริ่มฝึกเลข</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="ชื่อจริง"><input className="input-field" value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></Field>
                  <Field label="นามสกุล"><input className="input-field" value={lastName} onChange={(e) => setLastName(e.target.value)} required /></Field>
                  <Field label="ชื่อเล่น"><input className="input-field" value={nickname} onChange={(e) => setNickname(e.target.value)} required /></Field>
                  <Field label="ระดับชั้น">
                    <select className="input-field" value={gradeLevel} onChange={(e) => setGradeLevel(Number(e.target.value))}>
                      {[1, 2, 3, 4, 5, 6].map((grade) => <option key={grade} value={grade}>{GRADE_LABELS[grade]}</option>)}
                    </select>
                  </Field>
                  <Field label="โรงเรียน"><input className="input-field" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} /></Field>
                  <Field label="จังหวัด"><input className="input-field" value={schoolProvince} onChange={(e) => setSchoolProvince(e.target.value)} /></Field>
                  <Field label="เขต/อำเภอ"><input className="input-field" value={schoolDistrict} onChange={(e) => setSchoolDistrict(e.target.value)} /></Field>
                </div>
                <button type="button" onClick={next} className="btn-primary w-full">ถัดไป →</button>
                <p className="text-center text-sm text-gray-500">มีบัญชีอยู่แล้ว? <Link href="/login" className="font-bold text-primary-600">เข้าสู่ระบบ</Link></p>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="text-center">
                  <h1 className="text-2xl font-black text-gray-950">เลือกโปรแกรม</h1>
                  <p className="mt-1 text-sm text-gray-500">เลือกเส้นทางเรียนที่เหมาะกับนักเรียน</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <button type="button" onClick={() => setProgram('THP')} className={`rounded-3xl border-2 p-6 text-center ${program === 'THP' ? 'border-primary-400 bg-primary-50 ring-4 ring-primary-100' : 'border-gray-200 hover:border-primary-200'}`}>
                    <div className="mb-3 text-5xl">🇹🇭</div>
                    <h2 className="text-xl font-black text-gray-950">THP</h2>
                    <p className="text-sm text-gray-500">Thai Program</p>
                  </button>
                  <button type="button" disabled className="relative rounded-3xl border-2 border-gray-200 bg-gray-50 p-6 text-center opacity-60">
                    <span className="absolute right-3 top-3 rounded-full bg-amber-100 px-2 py-1 text-xs font-black text-amber-700">เร็ว ๆ นี้</span>
                    <div className="mb-3 text-5xl grayscale">🇬🇧</div>
                    <h2 className="text-xl font-black text-gray-400">EP</h2>
                    <p className="text-sm text-gray-400">English Program</p>
                  </button>
                </div>
                <div className="flex gap-3"><button type="button" onClick={back} className="btn-secondary flex-1">← กลับ</button><button type="button" onClick={next} className="btn-primary flex-1">ถัดไป →</button></div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div className="text-center">
                  <h1 className="text-2xl font-black text-gray-950">อัปโหลดรูปนักเรียน</h1>
                  <p className="mt-1 text-sm text-gray-500">เลือกรูปโปรไฟล์ของนักเรียน เพื่อใช้ในแดชบอร์ดและกิจกรรมการเรียน</p>
                </div>
                <div className="grid gap-6 md:grid-cols-[1fr_260px]">
                  <div className="space-y-5">
                    <div>
                      <p className="mb-3 text-sm font-black text-gray-700">เลือกเพศนักเรียน</p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {(['girl', 'boy', 'unspecified'] as const).map((item) => (
                          <button key={item} type="button" onClick={() => setGender(item)} className={`rounded-2xl border-2 px-4 py-3 text-sm font-black ${gender === item ? 'border-primary-400 bg-primary-50 text-primary-700 ring-4 ring-primary-100' : 'border-gray-200 text-gray-600 hover:border-primary-200'}`}>
                            {GENDER_LABELS[item]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-3xl border-2 border-dashed border-sky-200 bg-sky-50/50 p-5">
                      <div className="flex flex-col items-center text-center">
                        <ImagePlus className="mb-3 h-10 w-10 text-sky-500" />
                        <p className="font-black text-gray-900">อัปโหลดรูปโปรไฟล์</p>
                        <p className="mt-1 text-sm text-gray-500">JPG, PNG หรือ WebP ขนาดไม่เกิน 5MB</p>
                        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-primary-500 px-5 py-3 text-sm font-black text-white shadow-lg hover:bg-primary-600">
                          <Upload className="h-4 w-4" />
                          {photoFile ? 'เปลี่ยนรูป' : 'เลือกรูป'}
                          <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="hidden" />
                        </label>
                        {photoFile && (
                          <button type="button" onClick={() => setPreviewFromFile(null)} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600">
                            <Trash2 className="h-3.5 w-3.5" /> ลบรูป
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-3xl bg-gradient-to-br from-primary-50 to-secondary-50 p-5">
                    <StudentPhotoPreview previewUrl={photoPreviewUrl} gender={gender} nickname={nickname} />
                    <p className="mt-4 text-center text-lg font-black text-gray-900">{nickname || 'นักเรียน TOPA'}</p>
                    <p className="text-sm font-semibold text-gray-500">{GENDER_LABELS[gender]}</p>
                  </div>
                </div>
                <div className="flex gap-3"><button type="button" onClick={back} className="btn-secondary flex-1">← กลับ</button><button type="button" onClick={next} className="btn-primary flex-1">ถัดไป →</button></div>
              </div>
            )}

            {step === 4 && (
              <form onSubmit={handleFinalSubmit} className="space-y-5">
                <div className="text-center">
                  <h1 className="text-2xl font-black text-gray-950">พร้อมผจญภัย</h1>
                  <p className="mt-1 text-sm text-gray-500">ตรวจสอบข้อมูลและสร้างบัญชีผู้ปกครอง</p>
                </div>
                <div className="flex justify-center">
                  <div className="rounded-3xl bg-gradient-to-br from-primary-50 to-secondary-50 p-5 text-center">
                    <StudentPhotoPreview previewUrl={photoPreviewUrl} gender={gender} nickname={nickname} size="xl" />
                    <p className="mt-4 text-2xl font-black text-gray-900">{nickname}</p>
                  </div>
                </div>
                <div className="rounded-3xl border border-primary-100 bg-primary-50 p-4">
                  <h2 className="mb-3 text-sm font-black text-primary-700">ข้อมูลนักเรียน</h2>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-gray-500">ชื่อ-นามสกุล</span><span className="text-right font-bold text-gray-800">{firstName} {lastName}</span>
                    <span className="text-gray-500">ชื่อเล่น</span><span className="text-right font-bold text-gray-800">{nickname}</span>
                    <span className="text-gray-500">ระดับชั้น</span><span className="text-right font-bold text-gray-800">{GRADE_LABELS[gradeLevel]}</span>
                    <span className="text-gray-500">โปรแกรม</span><span className="text-right font-bold text-gray-800">{program === 'THP' ? 'THP (ไทย)' : 'EP'}</span>
                    <span className="text-gray-500">โรงเรียน</span><span className="text-right font-bold text-gray-800">{schoolName || '-'}</span>
                    <span className="text-gray-500">เพศ</span><span className="text-right font-bold text-gray-800">{GENDER_LABELS[gender]}</span>
                    <span className="text-gray-500">รูปโปรไฟล์</span><span className="text-right font-bold text-gray-800">{photoFile ? photoFile.name : 'ใช้รูปเริ่มต้น'}</span>
                  </div>
                </div>
                {!createdChild && (
                  <div className="space-y-3 border-t border-gray-100 pt-4">
                    <h2 className="text-sm font-black text-gray-700">สร้างบัญชีผู้ปกครอง</h2>
                    <Field label="อีเมลผู้ปกครอง"><input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
                    <Field label="รหัสผ่าน"><input type="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /></Field>
                    <Field label="ยืนยันรหัสผ่าน"><input type="password" className="input-field" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></Field>
                  </div>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={back} className="btn-secondary flex-1" disabled={!canSubmit}>← กลับ</button>
                  <button type="submit" className="btn-primary flex-1" disabled={!canSubmit}>{isLoading || photoUploading ? 'กำลังบันทึก...' : createdChild ? 'ลองอัปโหลดรูปอีกครั้ง' : 'เริ่มผจญภัย!'}</button>
                </div>
                {createdChild && (
                  <button type="button" onClick={completeWithoutPhoto} className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700">
                    ข้ามไปแดชบอร์ดก่อน
                  </button>
                )}
                <p className="text-center text-sm text-gray-500">มีบัญชีอยู่แล้ว? <Link href="/login" className="font-bold text-primary-600">เข้าสู่ระบบ</Link></p>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
