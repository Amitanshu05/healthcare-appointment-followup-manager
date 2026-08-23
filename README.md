# Healthcare Appointment & Follow-up Manager

An enterprise-grade, full-stack healthcare appointment scheduling and follow-up platform built with a React 19 frontend and a Spring Boot (Java 21) backend. Features AI-powered clinical summaries, dynamic slot availability management, email notifications, and Google Calendar event synchronization.

---

## 🛠️ Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, TanStack Query (React Query), Lucide React.
- **Backend**: Java 21, Spring Boot 3.x, Spring Security (JWT), Spring Data JPA, Flyway (DB migrations), Quartz Scheduler (Medication reminders/retry logs).
- **Database**: PostgreSQL (Docker-ready).
- **Integrations**: Gemini AI (symptom summary & pre-visit triage), SMTP Mail Server, Google Calendar API.

---

## 📂 Project Structure
```text
healthcare_manager/
├── docker-compose.yml           # Runs PostgreSQL database locally
├── README.md                    # Project documentation & design write-up
├── backend/
│   ├── pom.xml                  # Maven dependencies configuration
│   └── src/main/
│       ├── java/com/healthcare/ # Spring Boot source codes
│       └── resources/
│           ├── db/migration/    # Flyway schema migrations (V1__init.sql)
│           └── application.yml  # API keys & integration settings
└── frontend/
    ├── package.json             # React 19 packages
    ├── index.html               # Vite entry template
    └── src/
        ├── App.tsx              # Router, login portal, and dashboard layouts
        └── index.css            # Tailwind directives
```

---

## 🔐 Integrations Setup Guide

### 1. Gemini AI Integration (Symptom & Post-Visit Summaries)
To parse symptom urgency levels and generate clinical summaries:
1. Obtain an API key from the [Google AI Studio](https://aistudio.google.com/).
2. Add your key in the environment variables: `GEMINI_API_KEY=your_key_here`.
- **Pre-visit Urgency prompt**: `"Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: <symptoms>"`
- **Post-visit summary prompt**: `"Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: <notes>"`

### 2. Google Calendar Event Sync (OAuth 2.0)
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project, enable the **Google Calendar API**, and configure the OAuth consent screen.
3. Generate an OAuth 2.0 Client ID and Client Secret, and set the redirect URL to `/api/calendar/callback`.
4. Provide credentials in application configuration. The backend will request permission on booking confirmation to automatically sync appointment events to both patient and doctor calendars.

### 3. SMTP Email Configuration (Reminders & Notifications)
Configure SMTP settings in `application.yml` (using SendGrid, Mailgun, or standard Gmail SMTP):
```yaml
spring:
  mail:
    host: smtp.gmail.com
    port: 587
    username: ${SMTP_USERNAME}
    password: ${SMTP_PASSWORD}
    properties:
      mail.smtp.auth: true
      mail.smtp.starttls.enable: true
```
Used for booking confirmations, daily agenda updates, cancellations, and Quartz-scheduled medication frequency alerts.

---

## 📖 System Design Write-Up

### 1. Double-Booking Prevention & Concurrency
To safely handle simultaneous booking attempts for the same doctor slot, we implement a database-level optimistic locking mechanism combined with a unique index constraint. The `slots` table contains a unique compound index on `(doctor_id, slot_time)`. When booking, a database transaction attempts to write to the `appointments` table and updates `is_booked = TRUE` in the `slots` table. If two threads attempt to book the exact same slot concurrently, the database unique constraint throws an `IntegrityViolationException`, rollbacks the transaction, and safely rejects the second request.

### 2. Doctor Leave Conflict Handling
When a doctor is marked as "On Leave" for a specific date range, a listener triggers in the system that retrieves all active appointments assigned to that doctor during the leave dates. These affected appointments are automatically transitioned to `cancelled` (with slot `is_booked` marked `FALSE`). The Quartz scheduler immediately spawns high-priority asynchronous tasks to notify the affected patients via SMTP email, providing options to reschedule.

### 3. Notification Failure Handling & Retry Logic
To ensure reliable delivery of calendar invitations and SMTP emails, a custom Quartz Scheduler job (`EmailRetryJob`) polls a local `outbox` table in the database. When an email fails to send due to network issues, it is saved in the outbox with a status of `PENDING` and a retry count of `0`. The background Quartz job triggers every 5 minutes, retrieves all pending emails, and retries the SMTP execution using exponential backoff up to 5 times.
