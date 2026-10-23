
# Avenue360 - AI Smart Rental Property Management System

Avenue360 is a smart rental property management platform designed to simplify
property discovery, rental management, and decision-making using modern web
technologies and AI/ML.

## Project Overview

The system consists of three major components:

- **Frontend** - React-based user interface
- **Backend** - Spring Boot REST API
- **AI Service** - Python-based AI/ML service

## System Architecture

```text
                    Avenue360
                        |
          +-------------+-------------+
          |             |             |
       Frontend      Backend       AI Service
        React       Spring Boot      Python
                                      |
                       +--------------+--------------+
                       |              |              |
                  Rent Prediction  Property       Demand
                                  Recommendation Prediction
                       |
                    Scout AI
                     Chatbot
```

## Browser Push Notifications

Browser notifications use the standard Push API subscription (`endpoint`,
`keys.p256dh`, and `keys.auth`) with VAPID. Generate one VAPID key pair and
configure the private key only on the backend:

- Backend: `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, and
  `WEB_PUSH_VAPID_SUBJECT` (for example, a `mailto:` contact URI).
- Frontend build: `VITE_WEB_PUSH_PUBLIC_KEY` must contain the matching public
  key. This key is public by design; never expose the private key.
- Backend CORS: set `CORS_ALLOWED_ORIGINS` to the exact deployed frontend
  origin(s), comma-separated. The default remains `http://localhost:5173`.

The frontend's **Enable browser notifications** action registers
`/service-worker.js` and posts the browser's subscription to
`POST /api/v1/notifications/register-device`. This route requires the user's
JWT; the recipient account is taken from its authenticated principal. To
deactivate a device, call
`DELETE /api/v1/notifications/devices/{deviceId}` with the same authentication.
Responses never contain subscription endpoints or cryptographic keys.
Subscription endpoints are accepted only from the Google, Mozilla, Microsoft,
and Apple browser push services to prevent arbitrary outbound requests.

The backend persists subscriptions in `user_device_tokens`. Hibernate
`ddl-auto=update` can create the table automatically. For databases managed
with SQL migrations, apply
`backend/rental-management-backend/src/main/resources/db/migration/V2__create_user_device_tokens.sql`
after the existing schema. This repository does not include Flyway, so the SQL
file must be applied by the deployment's migration process.

Push is sent after the in-app notification transaction commits. A failed push
does not roll back the notification; expired (404/410) subscriptions are
deactivated and transient errors are retried up to three times. Push delivery
requires a secure browser context (HTTPS, or localhost during development).
