'use client'

export default function AdminSettingsPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-5 px-6 py-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-950">Settings</h1>
        <p className="text-sm text-gray-500">Owner-only operational settings for local development.</p>
      </div>
      <section className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-gray-950">Admin access</h2>
        <p className="mt-2 text-sm text-gray-600">
          Local development seeds the owner account <span className="font-mono">infomilliongarden@gmail.com</span>.
          Use production identity management before enabling defaults outside local/dev.
        </p>
      </section>
    </main>
  )
}
