# Healthcare Appointment & Follow-up Manager

An enterprise-grade, full-stack healthcare appointment scheduling and follow-up platform built with a React 19 frontend and a Spring Boot (Java 21) backend. Features AI-powered clinical summaries, dynamic slot availability management, email notifications, and Google Calendar event synchronization.

🚀 **Live Portal Link**: [https://healthcare-manager-pi.vercel.app](https://healthcare-manager-pi.vercel.app)

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
├── run_full_system.sh           # Auto-launcher script (Port cleanup, JDK & Maven paths)
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
Configure SMTP settings in `.env` (using SendGrid, Mailgun, or standard Gmail SMTP):
```env
SMTP_USERNAME=your_gmail@gmail.com
SMTP_PASSWORD=your_google_app_password
```
Used for booking confirmations, daily agenda updates, cancellations, and Quartz-scheduled medication frequency alerts.

---

## 📖 System Design Write-Up (800 Words Max)

### 1. Double-Booking Prevention & Concurrency Control
In a multi-user environment, simultaneous booking attempts for the same doctor and timeslot present a classic race condition. To solve this, we implement a multi-layered prevention mechanism:
* **Database Constraints**: The `slots` table contains a unique compound key on `(doctor_id, slot_time)`. Additionally, the `appointments` table has a partial unique index on `(slot_id, status)` where `status = 'booked'`. This guarantees that the database itself physically blocks any duplicate records from committing.
* **Hibernate Optimistic Locking**: The `slots` entity is annotated with `@Version`. When a transaction reads a slot to check availability, it reads the version number. When updating `is_booked = TRUE`, it checks if the version matches. If another thread committed first, a `OptimisticLockException` is thrown.
* **Spring Boot Transactional Isolation**: The booking method is wrapped in `@Transactional(isolation = Isolation.READ_COMMITTED)`. If concurrent attempts happen, the second transaction catches the integrity violation exception and rollbacks cleanly, displaying a user-friendly alert: *"This slot has already been booked. Please choose another."*

### 2. Doctor Leave Conflict Handling
When a doctor is marked "On Leave" by the admin for a specific date range, the system must maintain scheduling integrity and notify affected patients:
* **Cascade Cancellation**: A service listener queries all active appointments scheduled with the doctor during the leave duration. It marks these appointments as `cancelled` and marks their slots back to `is_booked = FALSE`.
* **Asynchronous Alert Dispatching**: The cancellation process registers an asynchronous event. A background service fetches the patient and doctor details and pushes notification payloads to the Outbox repository.
* **Patient Notification**: The Quartz Scheduler instantly picks up the outbox payloads and dispatches email notifications alerting patients of the cancellation, containing a direct link to reschedule.

### 3. Temporary Slot Hold Mechanism
To prevent a user from losing a slot while they are actively filling out the patient symptom form (which takes time), we implement a temporary slot hold mechanism:
* **Redis/TTL Cache Locks**: When a user selects a timeslot and clicks "Start Booking", the system creates a temporary hold entry in the database/cache with a Time-To-Live (TTL) of 5 minutes: `slot_hold:{slot_id} = patient_id`.
* **State Verification**: During this 5-minute window, the slot is marked as "On Hold" and is hidden from other patients.
* **Auto-Release Lifecycle**: If the patient completes the symptom form and clicks "Confirm" within the TTL, the hold is upgraded to a permanent `booked` appointment. If the TTL expires, the key is automatically evicted, releasing the slot back into the available pool for other users.

### 4. Notification Failure Handling & Retry Logic
Network glitches or mail server outages must not result in lost notifications. We implement a local database Outbox Pattern:
* **The Outbox Table**: When a notification is generated (email/calendar invite), the details are saved in the `outbox` table with status `PENDING` and `retry_count = 0`.
* **Quartz Scheduler Engine**: A Quartz job (`EmailRetryJob`) triggers every 5 minutes, polling all `PENDING` or `FAILED` emails.
* **Exponential Backoff**: If an email fail due to SMTP timeout, the system increments the retry count. It schedules the next retry using exponential backoff: $Delay = 2^{retry\_count} \times 2\text{ minutes}$.
* **Dead Letter Queue (DLQ)**: If a notification fails 5 consecutive times, it is moved to `DLQ` status for administrator audit logs, preventing database connection overhead.
