import { Navigate, useSearchParams } from 'react-router-dom'

const isValidId = (id) => /^\d+$/.test(id) && Number(id) > 0

const resolveDestinations = {
  tenant: {
    PROPERTY: (id) => `/tenant/properties/${id}`,
    MAINTENANCE: (id) => `/tenant/maintenance?requestId=${id}`,
    APPLICATION: (id) => `/tenant/applications/${id}`,
    RENT_INVOICE: (id) => `/tenant/payments?invoiceId=${id}`,
    PAYMENT: (id) => `/tenant/payments?paymentId=${id}`,
  },
  owner: {
    PROPERTY: (id) => `/owner/properties/${id}`,
    MAINTENANCE: (id) => `/owner/maintenance/${id}`,
    APPLICATION: (id) => `/owner/applications/${id}`,
    PAYMENT: (id) => `/owner/payments/${id}`,
  },
  manager: {
    PROPERTY: (id) => `/manager/properties/${id}`,
    MAINTENANCE: (id) => `/manager/maintenance?requestId=${id}`,
    APPLICATION: (id) => `/manager/applications/${id}`,
    PAYMENT: (id) => `/manager/payments/${id}`,
  },
}

export default function NotificationResolvePage({ role }) {
  const [searchParams] = useSearchParams()
  const type = searchParams.get('type')
  const id = searchParams.get('id')
  const destination = isValidId(id)
    ? resolveDestinations[role]?.[type]?.(id)
    : null

  return (
    <Navigate
      to={destination || `/${role}/dashboard`}
      replace
    />
  )
}
