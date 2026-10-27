import React from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'
import AdminApiUnavailableCard from '../../components/common/AdminApiUnavailableCard'
import { Settings, Sliders, Shield } from 'lucide-react'

const SYSTEM_SETTINGS_ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/admin/settings',
    auth: 'ROLE_SUPER_ADMIN',
    description:
      'Retrieve active global system configuration keys, including notification preferences, security timeouts, payment gateway environment flags, and maintenance automation toggles.',
  },
  {
    method: 'PUT',
    path: '/api/admin/settings',
    auth: 'ROLE_SUPER_ADMIN',
    description:
      'Persist updated global platform settings with server-side validation and emit a configuration mutation event for audit trail retention.',
  },
  {
    method: 'POST',
    path: '/api/admin/settings/reset',
    auth: 'ROLE_SUPER_ADMIN',
    description:
      'Reset platform settings back to default values defined in application.properties / application.yml.',
    body: '{ "confirmReset": true }',
  },
]

const BACKEND_REQUIREMENTS = [
  'Create system_settings database table (id, config_key, config_value, value_type, description, updated_at, updated_by).',
  'Implement SystemSettingsController with @PreAuthorize("hasRole(\'SUPER_ADMIN\')") and a service layer that reloads runtime properties without requiring JVM restart.',
  'Encrypt sensitive values (such as SMTP credentials or third-party payment gateway private secrets) at rest.',
]

export default function SystemSettingsPage() {
  return (
    <DashboardLayout
      defaultRole="admin"
      activeItem="settings"
      pageTitle="System Settings"
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#243447]">
            Platform System Settings
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#5B6875]">
            Global platform configuration, notification triggers, security controls, and integration credentials.
          </p>
        </div>

        <AdminApiUnavailableCard
          title="System Settings Persistence API Unavailable"
          subtitle="Spring Boot Settings Entity & Endpoints Not Implemented"
          icon={<Settings className="h-5 w-5 text-[#8A5B16]" />}
          description="The platform backend currently does not provide an endpoint to read or save global platform settings. Controls that only mutate ephemeral local state without database persistence have been removed to prevent deceptive success messages. The following endpoints must be added to the backend to enable persistent platform settings management."
          endpoints={SYSTEM_SETTINGS_ENDPOINTS}
          backendRequirements={BACKEND_REQUIREMENTS}
        />
      </div>
    </DashboardLayout>
  )
}
