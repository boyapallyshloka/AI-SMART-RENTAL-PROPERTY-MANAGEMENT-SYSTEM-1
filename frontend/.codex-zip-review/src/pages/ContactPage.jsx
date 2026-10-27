import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CircleHelp, Home, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Footer from '../components/common/Footer'
import Button from '../components/ui/Button'
import { getDashboardPath } from '../utils/roles'

export default function ContactPage() {
  const { user } = useAuth()
  const dashboardPath = user ? getDashboardPath(user.role) : '/login'

  useEffect(() => {
    document.title = 'Contact Support | SmartEstate Property Management'
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA] font-sans text-[#243447]">
      <header className="border-b border-[#D9E0E6] bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-serif text-lg font-bold">
            <span className="rounded-md bg-[#315A7D] p-2 text-white"><Home className="h-5 w-5" /></span>
            SmartEstate
          </Link>
          <Link to={dashboardPath}>
            <Button variant="outline" size="sm">{user ? 'Back to dashboard' : 'Sign in'}</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-12 sm:px-6">
        <section className="w-full rounded-xl border border-[#D9E0E6] bg-white p-6 shadow-2xs sm:p-9">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-[#D9E0E6] bg-[#EAF2F7] text-[#315A7D]">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Contact Support</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#5B6875]">
            Support contact details and message submission are not configured in the current application.
          </p>
          <div role="status" className="mt-6 flex items-start gap-3 rounded-lg border border-[#F4E2B6] bg-[#FEF7EC] p-4 text-sm text-[#8A5B16]">
            <CircleHelp className="mt-0.5 h-5 w-5 shrink-0" />
            <p>No support request has been sent. Use the relevant signed-in page to manage your property, payment, application, or maintenance request.</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={dashboardPath}>
              <Button>{user ? 'Open my dashboard' : 'Sign in'}</Button>
            </Link>
            <Link to="/">
              <Button variant="outline">Home</Button>
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
