import React from 'react'
import ReportsPage from '../owner/ReportsPage'
import { ROLES } from '../../utils/roles'

export default function AdminReportsPage() {
  return <ReportsPage role={ROLES.SUPER_ADMIN} />
}
