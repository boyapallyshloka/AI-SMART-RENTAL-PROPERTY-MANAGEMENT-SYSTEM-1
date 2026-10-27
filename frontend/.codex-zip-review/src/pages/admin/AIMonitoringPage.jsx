import React from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'
import AdminApiUnavailableCard from '../../components/common/AdminApiUnavailableCard'
import { Sparkles, Brain, Cpu, Activity } from 'lucide-react'

const AI_MONITORING_ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/admin/ai/metrics',
    auth: 'ROLE_SUPER_ADMIN',
    description:
      'Retrieve real-time and aggregate inference telemetry (request volume, error rates, p50/p95/p99 latency) across M1 Rent Prediction, M2 Recommendation, and M5 Maintenance Prediction models.',
    params: ['timeRange (e.g. 1h, 24h, 7d)', 'modelId', 'granularity'],
  },
  {
    method: 'GET',
    path: '/api/admin/ai/models/health',
    auth: 'ROLE_SUPER_ADMIN',
    description:
      'Check operational status, active model weights/version, host memory and GPU utilization, and heartbeat of FastAPI/Flask microservices.',
  },
  {
    method: 'GET',
    path: '/api/admin/ai/accuracy-history',
    auth: 'ROLE_SUPER_ADMIN',
    description:
      'Fetch historical accuracy evaluations (R² score, RMSE, Mean Absolute Error, recommendation CTR) compared against verified ground-truth rental contracts.',
    params: ['modelName', 'interval', 'startDate', 'endDate'],
  },
  {
    method: 'GET',
    path: '/api/admin/ai/alerts',
    auth: 'ROLE_SUPER_ADMIN',
    description:
      'Stream or list active model alerts (input feature distribution drift, out-of-distribution feature warnings, latency threshold violations).',
    params: ['status (ACTIVE | RESOLVED)', 'severity'],
  },
]

const BACKEND_REQUIREMENTS = [
  'Operational inference endpoints exist in the AI service, but require an administrative telemetry layer (Prometheus/Micrometer instrumentation or database logging of inference requests).',
  'Implement an inference_logs table capturing model_name, execution_time_ms, input_payload_hash, prediction_output, and status_code.',
  'Implement Spring Boot AiMonitoringController with @PreAuthorize("hasRole(\'SUPER_ADMIN\')") proxying metrics from the AI microservice.',
]

export default function AIMonitoringPage() {
  return (
    <DashboardLayout
      defaultRole="admin"
      activeItem="ai-monitoring"
      pageTitle="AI Model Monitoring"
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#243447]">
            AI Model Telemetry & Monitoring
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#5B6875]">
            Live telemetry, model health, latency percentiles, and drift monitoring for platform machine learning models.
          </p>
        </div>

        <AdminApiUnavailableCard
          title="AI Telemetry & Monitoring API Unavailable"
          subtitle="Administrative Model Observability Endpoints Not Implemented"
          icon={<Sparkles className="h-5 w-5 text-[#315A7D]" />}
          description="Operational machine learning endpoints (such as POST /ai/rent-prediction/predict-unit and maintenance prediction) are active for application workflows, but the backend does not expose authenticated administrative telemetry endpoints for monitoring model health, inference latency, drift detection, or accuracy degradation. In accordance with zero-fake-data policy, no synthetic metrics or mock charts are rendered."
          endpoints={AI_MONITORING_ENDPOINTS}
          backendRequirements={BACKEND_REQUIREMENTS}
        />
      </div>
    </DashboardLayout>
  )
}
