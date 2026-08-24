# CareSync Hospital Appointment & Follow-up Manager

An enterprise-grade, full-stack healthcare appointment scheduling, AI triage, and doctor follow-up manager. It is designed to run locally using Docker/Spring Boot/React or serverless on Vercel.

🚀 **Live Vercel Portal**: [https://healthcare-manager-pi.vercel.app](https://healthcare-manager-pi.vercel.app)

---

## 🛠️ Tech Stack & Integrations

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons.
- **Backend (Local)**: Java 21, Spring Boot 3.x, Spring Security (JWT), Spring Data JPA, Flyway (DB migrations), Quartz Scheduler.
- **Backend (Production Serverless)**: Node.js Vercel Functions, Nodemailer.
- **Database**: PostgreSQL (Docker-ready local orchestration).
- **Integrations**:
  - **Gemini AI**: Generates pre-visit triage reports & parses clinical notes into patient-friendly summaries.
  - **Google Calendar API**: Syncs appointment slots directly to patient & doctor calendars.
  - **SMTP Mail Server**: Outbox notification engine.

---

## 📂 Project Structure

```text
healthcare_manager/
├── docker-compose.yml           # Local PostgreSQL container service
├── README.md                    # System architecture documentation
├── run_full_system.sh           # Local workspace launcher script
├── backend/                     # Enterprise Spring Boot Java project
│   ├── pom.xml                  # Maven configurations
│   └── src/main/                # Java source & DB migrations files
└── frontend/                    # Vite React 19 TypeScript portal
    ├── package.json             # NPM dependencies (Vercel Serverless configurations)
    ├── api/                     # Node.js Vercel Serverless SMTP API endpoints
    │   └── send-email.ts        # Serverless Nodemailer pipeline
    └── src/                     # React core components & unified routes
```

---

## 👑 Evaluation Credentials (Live Portal)

All pre-seeded visual helper tags have been removed for privacy and security. Use the credentials below to evaluate role-based access control inside the live portal:

- **Hospital Administrator**:
  - **Email**: `admin@caresync.com`
  - **Password**: `AdminCareSync2026`
  - *(Admins can register new doctors with custom login emails and passwords).*
- **Patient Registration**:
  - Click **"register a new patient profile"** to dynamically sign up and receive a Welcome SMTP email.

---

## 📖 System Design Write-Up

### 1. Concurrency Control & Double-Booking Prevention
Simultaneous checkout attempts for the same doctor slot represent a classic concurrency race condition. The platform resolves this at three distinct layers:
* **Database Contraints**: The database schema enforces a compound unique index key on `(doctor_id, slot_time)` under the slots layout. This serves as a physical barrier preventing duplicate slot reservations from committing to disk.
* **Hibernate Optimistic Locking**: The `Slot` entities are configured with an incremental `@Version` attribute. Prior to booking confirmation, the engine compares the read version with the update version. If a concurrent transaction commits first, an `OptimisticLockException` is caught.
* **Spring Boot Transaction Isolation**: The transaction boundary is set to `Isolation.READ_COMMITTED`. If database constraint conflicts are triggered by concurrent requests, the system performs a roll back and returns a clean, localized alert to the UI.

### 2. Doctor Leave Conflict Handling
When a physician is marked on leave, all active client bookings must be processed safely to preserve scheduling trust:
* **Cascade State Resolution**: A domain event listener scans all active records matching the doctor's leave timeframe. It bulk-updates their status values to `cancelled` and frees up the respective time slots.
* **Quartz-Scheduled Cancellation Dispatches**: The database persists transaction state and dispatches asynchronous cancel events. The background Quartz worker scans the event queues to construct personalized SMTP messages.
* **Patient Notification Routing**: Real-time emails are routed to the affected patients, containing deep-links allowing them to immediately reschedule with another specialist.

### 3. Temporary Slot Hold Mechanism
To prevent "cart-snatching" while a user is actively describing their symptoms, the checkout pipeline reserves temporary holds:
* **Redis/Database TTL Cache**: Upon selecting a slot, a lightweight key is written to the cache: `slot_hold:{slot_id} = patient_id` with a Time-To-Live (TTL) of 5 minutes.
* **Visibility Filtering**: During the active TTL lease, the slot status changes to "On Hold" and is filtered out of directories for other patients.
* **Automatic Expiry**: If the patient completes checkout, the slot transitions to a permanent `booked` state. If the TTL timer expires without checkout completion, the key is automatically evicted, releasing the slot back to the directory pool.

### 4. Notification Failure Handling & Retry Logic
Network anomalies or third-party SMTP API rate limits are handled using a reliable **Outbox Pattern**:
* **Pending Outbox State**: Notification requests are written to the database outbox table in `PENDING` state with a retry count of `0`.
* **Asynchronous Quartz Poller**: A background scheduler checks for `PENDING` or `FAILED` outbox records every 5 minutes.
* **Exponential Backoff**: If an SMTP attempt fails, the retry count increments, scheduling the next attempt with a delay: $\text{Delay} = 2^{\text{retry}} \times 2 \text{ minutes}$.
* **Dead Letter Queue (DLQ)**: If a notification fails 5 consecutive times, it is flagged as `DLQ` for administrator monitoring, protecting the mail dispatch pipeline from loops.

### 5. Forgot Password & OTP Flow
* **Verification Loop**: Implemented `/api/auth/forgot-password` generating a secure 6-digit numeric OTP, matching it to the patient email inside an in-memory `ConcurrentHashMap` (`otpStore`).
* **Secure Verification**: A second endpoint `/api/auth/reset-password` validates the OTP and updates the user's password directly in the database.
* **OTP Email Dispatch**: Sends the OTP code to the patient dynamically via email.

### 6. Premium HTML Styled Email Notifications
* **MimeMessage Integration**: Upgraded the notification dispatcher from plain text `SimpleMailMessage` to responsive HTML `MimeMessage` and `MimeMessageHelper`.
* **Caring Templates**: Designed themed email alerts with tailored layouts (Welcome Registration, Booking Confirmation, Doctor Leave/Patient Cancellations, and Consultation Completion summaries) with grid cards for clinical prescriptions and AI insights.

### 7. Cold-Start Usability Loader UX
* **Visual Loaders**: Integrated active loaders (`isLoggingIn`, `isRegistering` states) on Sign In and Create Profile buttons.
* **Cold-Start Protection**: Disables inputs and renders a spinning circle with a clear `Signing In... (Waking up server)` status indicator, guiding the user while the Render Free Tier server performs a cold-start boot sequence.
