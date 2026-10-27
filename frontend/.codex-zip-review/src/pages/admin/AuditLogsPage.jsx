import React from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'
import AdminApiUnavailableCard from '../../components/common/AdminApiUnavailableCard'
import { History } from 'lucide-react'

const AUDIT_LOG_ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/admin/audit-logs',
    auth: 'ROLE_SUPER_ADMIN',
    description:
      'Retrieve paginated platform audit events with filtering by actor, target entity, action type, and date range.',
    params: [
      'page',
      'size',
      'userId',
      'action',
      'entityType',
      'startDate',
      'endDate',
    ],
  },
  {
    method: 'GET',
    path: '/api/admin/audit-logs/{id}',
    auth: 'ROLE_SUPER_ADMIN',
    description:
      'Fetch a single audit log entry with detailed before/after diffs, client IP, actor user-agent, and execution duration.',
  },
  {
    method: 'POST',
    path: '/api/admin/audit-logs/export',
    auth: 'ROLE_SUPER_ADMIN',
    description:
      'Generate and download compliance export files (CSV or JSON format) of filtered audit trails.',
    body: "{ format: 'csv' | 'json', startDate: 'ISO-8601', endDate: 'ISO-8601', entityType?: string }",
  },
]

const BACKEND_REQUIREMENTS = [
  'Create audit_logs database table (id, timestamp, actor_id, actor_role, action, entity_type, entity_id, ip_address, change_summary, details_json).',
  'Implement Spring AOP aspect or JPA EntityListeners to capture state mutations across Users, Properties, Agreements, and Payments automatically.',
  'Implement AuditLogController with @PreAuthorize("hasRole(\'SUPER_ADMIN\')") and AuditLogService with pagination support.',
]

export default function AuditLogsPage() {
  return (
    <DashboardLayout
      defaultRole="admin"
      activeItem="audit-logs"
      pageTitle="Platform Audit Logs"
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#243447]">
            Platform Audit Logs
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#5B6875]">
            Immutable record of administrative operations, security events, and entity lifecycle changes.
          </p>
        </div>

        <AdminApiUnavailableCard
          title="Platform Audit Logging API Unavailable"
          subtitle="Spring Boot Controller & Persistence Layer Not Implemented"
          icon={<History className="h-5 w-5" />}
          description="The platform backend currently does not expose an authenticated audit-log controller or database schema. To preserve compliance integrity, no simulated logs or hard-coded sample events are displayed. The following endpoints must be added to the Spring Boot service to enable live audit streaming."
          endpoints={AUDIT_LOG_ENDPOINTS}
          backendRequirements={BACKEND_REQUIREMENTS}
        />
      </div>
    </DashboardLayout>
  )
}
