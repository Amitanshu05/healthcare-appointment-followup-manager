package com.healthcare.controller;

import com.healthcare.entity.Appointment;
import com.healthcare.entity.Slot;
import com.healthcare.entity.User;
import com.healthcare.repository.AppointmentRepository;
import com.healthcare.repository.SlotRepository;
import com.healthcare.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import jakarta.mail.internet.MimeMessage;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class HospitalController {

    private static final Map<String, String> otpStore = new java.util.concurrent.ConcurrentHashMap<>();

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SlotRepository slotRepository;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    // Helper: Send SMTP Email asynchronously in a background thread to prevent UI blocking
    private void sendEmail(String to, String subject, String htmlContent) {
        new Thread(() -> {
            if (mailSender == null) {
                System.out.println("[SMTP SIMULATOR] To: " + to + " | Subject: " + subject + "\nBody: " + htmlContent);
                return;
            }
            try {
                MimeMessage message = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
                helper.setFrom("vashishtharsh6@gmail.com");
                helper.setTo(to);
                helper.setSubject(subject);
                helper.setText(htmlContent, true);
                mailSender.send(message);
                System.out.println("Email sent successfully to: " + to);
            } catch (Exception e) {
                System.err.println("SMTP dispatch failed: " + e.getMessage());
            }
        }).start();
    }

    // Helper: Wrap email messages in a highly professional, caring HTML layout
    private String getEmailHtmlWrapper(String title, String heading, String bodyContent) {
        return "<!DOCTYPE html>" +
               "<html>" +
               "<head>" +
               "  <meta charset='utf-8'>" +
               "  <style>" +
               "    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F8FAFC; color: #1E293B; margin: 0; padding: 20px; }" +
               "    .container { max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03); border: 1px solid #E2E8F0; }" +
               "    .header { background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); padding: 30px 20px; text-align: center; color: #FFFFFF; }" +
               "    .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px; }" +
               "    .header p { margin: 5px 0 0 0; font-size: 14px; opacity: 0.9; }" +
               "    .content { padding: 30px 25px; line-height: 1.6; font-size: 15px; }" +
               "    .card { background-color: #F1F5F9; border-radius: 8px; padding: 20px; border-left: 4px solid #3B82F6; margin: 20px 0; }" +
               "    .prescription-card { background-color: #ECFDF5; border-radius: 8px; padding: 20px; border-left: 4px solid #10B981; margin: 20px 0; }" +
               "    .ai-card { background-color: #EFF6FF; border-radius: 8px; padding: 20px; border-left: 4px solid #2563EB; margin: 20px 0; }" +
               "    .bullet-list { margin: 10px 0 0 0; padding-left: 20px; }" +
               "    .bullet-list li { margin-bottom: 8px; }" +
               "    .footer { background-color: #F1F5F9; padding: 20px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; }" +
               "    .footer p { margin: 5px 0; }" +
               "    .sweet-note { font-style: italic; color: #475569; border-top: 1px dashed #CBD5E1; padding-top: 15px; margin-top: 25px; }" +
               "  </style>" +
               "</head>" +
               "<body>" +
               "  <div class='container'>" +
               "    <div class='header'>" +
               "      <h1>CareSync Hospital</h1>" +
               "      <p>" + title + "</p>" +
               "    </div>" +
               "    <div class='content'>" +
               "      <h2 style='margin-top: 0; color: #0F172A;'>" + heading + "</h2>" +
               "      " + bodyContent + "" +
               "    </div>" +
               "    <div class='footer'>" +
               "      <p>CareSync Scheduling Portal &copy; 2026</p>" +
               "      <p>CareSync Hospital Center, Clinical Drive Road, OR 97401</p>" +
               "      <p>Need urgent help? Call +1 (555) 019-9000 or reply to this mail.</p>" +
               "    </div>" +
               "  </div>" +
               "</body>" +
               "</html>";
    }

    // 1. Authenticate logins (Admin, Doctor, Patient)
    @PostMapping("/auth/login")
    public Map<String, Object> login(@RequestBody Map<String, String> payload) {
        String email = payload.get("email");
        String password = payload.get("password");

        Map<String, Object> response = new HashMap<>();
        Optional<User> userOpt = userRepository.findByEmail(email);

        if (userOpt.isPresent() && userOpt.get().getPasswordHash().equals(password)) {
            User user = userOpt.get();
            response.put("success", true);
            response.put("name", user.getName());
            response.put("email", user.getEmail());
            response.put("role", user.getRole());
            return response;
        }

        response.put("success", false);
        response.put("message", "Invalid email or password");
        return response;
    }

    // 2. Register new patients
    @PostMapping("/auth/register")
    public Map<String, Object> registerPatient(@RequestBody Map<String, String> payload) {
        String name = payload.get("name");
        String email = payload.get("email");
        String contact = payload.get("contact");
        String password = payload.get("password");

        Map<String, Object> response = new HashMap<>();
        if (userRepository.findByEmail(email).isPresent()) {
            response.put("success", false);
            response.put("message", "Email already registered");
            return response;
        }

        User patient = new User();
        patient.setName(name);
        patient.setEmail(email);
        patient.setContact(contact);
        patient.setPasswordHash(password);
        patient.setRole("patient");
        userRepository.save(patient);

        // Send Welcome email (HTML)
        String welcomeBody = "<p>Hello <strong>" + name + "</strong>,</p>" +
                             "<p>Welcome to the CareSync family! We are thrilled to partner with you in managing your healthcare needs efficiently and with dedicated support.</p>" +
                             "<div class='card'>" +
                             "  <h3 style='margin-top: 0; color: #2563EB;'>Your CareSync Portal Is Ready</h3>" +
                             "  <p>You can now log in to your patient dashboard using your registered email: <strong>" + email + "</strong></p>" +
                             "  <ul class='bullet-list'>" +
                             "    <li>Schedule consultations with leading medical specialists.</li>" +
                             "    <li>Track and manage your appointments in real time.</li>" +
                             "    <li>Write down and update your symptom profile logs.</li>" +
                             "    <li>Sync visits directly to your Google Calendar automatically.</li>" +
                             "  </ul>" +
                             "</div>" +
                             "<p>If you have any questions or need guidance, our patient support line is always open for you.</p>" +
                             "<p class='sweet-note'>Wishing you great health and happiness,<br><strong>The CareSync Admin & Care Team</strong></p>";

        sendEmail(
            email,
            "Welcome to CareSync Hospital!",
            getEmailHtmlWrapper("Account Registration", "Welcome to CareSync!", welcomeBody)
        );

        response.put("success", true);
        response.put("name", name);
        response.put("email", email);
        return response;
    }

    // 3. Get all doctors list
    @GetMapping("/doctors")
    public List<Map<String, Object>> getDoctors() {
        List<User> doctors = userRepository.findByRole("doctor");
        List<Map<String, Object>> list = new ArrayList<>();

        for (User doc : doctors) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", doc.getId());
            map.put("name", doc.getName());
            map.put("specialty", doc.getSpecialty());
            map.put("contact", doc.getContact());
            map.put("email", doc.getEmail());
            map.put("isAvailable", doc.isAvailable());
            map.put("isOnLeave", !doc.isAvailable()); // For UI consistency

            List<Slot> slots = slotRepository.findByDoctorIdAndIsBooked(doc.getId(), false);
            List<String> slotTimes = new ArrayList<>();
            for (Slot s : slots) {
                slotTimes.add(s.getSlotTime());
            }
            map.put("slots", slotTimes);
            list.add(map);
        }
        return list;
    }

    // 4. Admin registers new doctor
    @PostMapping("/doctors/register")
    public Map<String, Object> registerDoctor(@RequestBody Map<String, String> payload) {
        String name = payload.get("name");
        String specialty = payload.get("specialty");
        String contact = payload.get("contact");
        String email = payload.get("email");
        String password = payload.get("password");

        Map<String, Object> response = new HashMap<>();
        if (userRepository.findByEmail(email).isPresent()) {
            response.put("success", false);
            response.put("message", "Email already in use");
            return response;
        }

        User doc = new User();
        doc.setName(name.startsWith("Dr. ") ? name : "Dr. " + name);
        doc.setSpecialty(specialty);
        doc.setContact(contact);
        doc.setEmail(email);
        doc.setPasswordHash(password);
        doc.setRole("doctor");
        doc.setAvailable(true);
        userRepository.save(doc);

        // Seed slots
        String[] times = {"10:00 AM", "11:30 AM", "02:00 PM", "03:30 PM"};
        for (String time : times) {
            Slot slot = new Slot();
            slot.setDoctor(doc);
            slot.setSlotTime(time);
            slot.setBooked(false);
            slotRepository.save(slot);
        }

        response.put("success", true);
        return response;
    }

    // 5. Toggle Doctor active duty status
    @PostMapping("/doctors/{id}/availability")
    public Map<String, Object> toggleAvailability(@PathVariable Long id) {
        Optional<User> docOpt = userRepository.findById(id);
        Map<String, Object> response = new HashMap<>();
        if (docOpt.isPresent()) {
            User doc = docOpt.get();
            doc.setAvailable(!doc.isAvailable());
            userRepository.save(doc);
            response.put("success", true);
            response.put("isAvailable", doc.isAvailable());
        } else {
            response.put("success", false);
        }
        return response;
    }

    // 6. Toggle Doctor leave status
    @PostMapping("/doctors/{id}/leave")
    public Map<String, Object> toggleLeave(@PathVariable Long id) {
        Optional<User> docOpt = userRepository.findById(id);
        Map<String, Object> response = new HashMap<>();
        if (docOpt.isPresent()) {
            User doc = docOpt.get();
            // Leave means isAvailable = false
            doc.setAvailable(!doc.isAvailable());
            userRepository.save(doc);

            // Cancel active appointments for this doctor if going on leave (not available)
            if (!doc.isAvailable()) {
                List<Appointment> appts = appointmentRepository.findByDoctorId(id);
                for (Appointment appt : appts) {
                    if (appt.getStatus().equals("booked")) {
                        appt.setStatus("cancelled");
                        Slot slot = appt.getSlot();
                        slot.setBooked(false);
                        slotRepository.save(slot);
                        appointmentRepository.save(appt);

                        // Send cancellation email (HTML)
                        String leaveCancelBody = "<p>Hello <strong>" + appt.getPatient().getName() + "</strong>,</p>" +
                                                 "<p>We are writing to inform you with regret that your upcoming consultation with <strong>" + doc.getName() + "</strong> has been cancelled because the doctor is currently unavailable or on leave.</p>" +
                                                 "<div class='card' style='border-left-color: #EF4444; background-color: #FEF2F2;'>" +
                                                 "  <h3 style='margin-top: 0; color: #DC2626;'>Cancelled Appointment Details</h3>" +
                                                 "  <p><strong>Doctor:</strong> " + doc.getName() + " (" + doc.getSpecialty() + ")</p>" +
                                                 "  <p><strong>Original Slot:</strong> " + appt.getSlot().getSlotTime() + "</p>" +
                                                 "</div>" +
                                                 "<p>We sincerely apologize for any inconvenience this may cause to your schedule. Your health is our highest priority, so please log in to your patient dashboard to reschedule this visit with another available timing or specialist at your earliest convenience.</p>" +
                                                 "<p class='sweet-note'>Please take care and rest well,<br><strong>The CareSync Clinical Support Team</strong></p>";

                        sendEmail(
                            appt.getPatient().getEmail(),
                            "Appointment Cancelled due to Doctor Leave - CareSync Hospital",
                            getEmailHtmlWrapper("Appointment Cancelled", "Doctor Leave Notification", leaveCancelBody)
                        );
                    }
                }
            }

            response.put("success", true);
            response.put("isOnLeave", !doc.isAvailable());
        } else {
            response.put("success", false);
        }
        return response;
    }

    // 7. Get all appointments for Admin logs
    @GetMapping("/appointments")
    public List<Map<String, Object>> getAppointments() {
        List<Appointment> appts = appointmentRepository.findAll();
        List<Map<String, Object>> list = new ArrayList<>();
        for (Appointment appt : appts) {
            list.add(mapAppointment(appt));
        }
        return list;
    }

    // 8. Book appointment
    @PostMapping("/appointments/book")
    public Map<String, Object> bookAppointment(@RequestBody Map<String, Object> payload) {
        String patientEmail = (String) payload.get("patientEmail");
        Long doctorId = Long.valueOf(payload.get("doctorId").toString());
        String slotTime = (String) payload.get("slotTime");
        String problem = (String) payload.get("problem");

        Map<String, Object> response = new HashMap<>();
        Optional<User> patientOpt = userRepository.findByEmail(patientEmail);
        Optional<User> doctorOpt = userRepository.findById(doctorId);

        if (!patientOpt.isPresent() || !doctorOpt.isPresent()) {
            response.put("success", false);
            response.put("message", "User details missing");
            return response;
        }

        // Find available slot matching doctor and time
        List<Slot> slots = slotRepository.findByDoctorIdAndIsBooked(doctorId, false);
        Slot targetSlot = null;
        for (Slot s : slots) {
            if (s.getSlotTime().equals(slotTime)) {
                targetSlot = s;
                break;
            }
        }

        if (targetSlot == null) {
            response.put("success", false);
            response.put("message", "Slot has already been booked by another patient!");
            return response;
        }

        // Reserve slot
        targetSlot.setBooked(true);
        slotRepository.save(targetSlot);

        Appointment appt = new Appointment();
        appt.setPatient(patientOpt.get());
        appt.setDoctor(doctorOpt.get());
        appt.setSlot(targetSlot);
        appt.setProblemDescription(problem);
        appt.setStatus("booked");
        appointmentRepository.save(appt);

        // Send booking confirmation email (HTML)
        String confirmBody = "<p>Hello <strong>" + patientOpt.get().getName() + "</strong>,</p>" +
                             "<p>Your medical appointment has been successfully scheduled. We look forward to providing you with dedicated clinical consultation.</p>" +
                             "<div class='card'>" +
                             "  <h3 style='margin-top: 0; color: #2563EB;'>Appointment Details</h3>" +
                             "  <p><strong>Doctor Specialist:</strong> " + doctorOpt.get().getName() + " (" + doctorOpt.get().getSpecialty() + ")</p>" +
                             "  <p><strong>Scheduled Slot:</strong> " + slotTime + "</p>" +
                             "  <p><strong>Symptom/Chief Complaint:</strong> \"" + problem + "\"</p>" +
                             "</div>" +
                             "<p>A Google Calendar invitation has been automatically synced to your email. Please ensure you are logged into your portal dashboard a few minutes before the slot starts.</p>" +
                             "<p class='sweet-note'>Wishing you a swift and comfortable recovery,<br><strong>CareSync Scheduling Team</strong></p>";

        sendEmail(
            patientEmail,
            "Appointment Booking Confirmed - CareSync Hospital",
            getEmailHtmlWrapper("Booking Confirmation", "Your Appointment is Confirmed", confirmBody)
        );

        response.put("success", true);
        return response;
    }

    // 9. Cancel appointment
    @PostMapping("/appointments/{id}/cancel")
    public Map<String, Object> cancelAppointment(@PathVariable Long id) {
        Optional<Appointment> apptOpt = appointmentRepository.findById(id);
        Map<String, Object> response = new HashMap<>();
        if (apptOpt.isPresent()) {
            Appointment appt = apptOpt.get();
            appt.setStatus("cancelled");
            Slot slot = appt.getSlot();
            slot.setBooked(false);
            slotRepository.save(slot);
            appointmentRepository.save(appt);

            // Send cancellation email (HTML)
            String cancelBody = "<p>Hello <strong>" + appt.getPatient().getName() + "</strong>,</p>" +
                                "<p>This is a confirmation that your scheduled medical appointment has been successfully cancelled as per your request.</p>" +
                                "<div class='card' style='border-left-color: #94A3B8; background-color: #F8FAFC;'>" +
                                "  <h3 style='margin-top: 0; color: #475569;'>Cancelled Appointment Details</h3>" +
                                "  <p><strong>Doctor:</strong> " + appt.getDoctor().getName() + "</p>" +
                                "  <p><strong>Timing Slot:</strong> " + appt.getSlot().getSlotTime() + "</p>" +
                                "</div>" +
                                "<p>The corresponding Google Calendar event has been automatically removed. If you cancelled by mistake or wish to reschedule, you can always log back in to pick a new timing.</p>" +
                                "<p class='sweet-note'>We are here to support you whenever you need us,<br><strong>CareSync Scheduling Team</strong></p>";

            sendEmail(
                appt.getPatient().getEmail(),
                "Appointment Cancelled - CareSync Hospital",
                getEmailHtmlWrapper("Appointment Cancelled", "Cancellation Confirmed", cancelBody)
            );
            response.put("success", true);
        } else {
            response.put("success", false);
        }
        return response;
    }

    // 10. Complete appointment with prescription & AI summary
    @PostMapping("/appointments/{id}/complete")
    public Map<String, Object> completeAppointment(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        String prescription = payload.get("prescription");

        Optional<Appointment> apptOpt = appointmentRepository.findById(id);
        Map<String, Object> response = new HashMap<>();
        if (apptOpt.isPresent()) {
            Appointment appt = apptOpt.get();
            appt.setStatus("completed");
            appt.setCompletedAt(LocalDateTime.now());
            appt.setPrescription(prescription);

            // Generate AI Triage Post-visit summary
            String aiSummary = "✨ AI Clinical Insights:\n• Clinical Goal: Recover from current symptoms.\n• Medication Schedule: " + prescription + "\n• Advice: Take proper rest and stay hydrated.\n• Reminder status: Medication notifications active.";
            appt.setPostVisitSummary(aiSummary);
            if (appt.getCreatedAt() == null) {
                appt.setCreatedAt(LocalDateTime.now());
            }
            appointmentRepository.save(appt);

            // Format AI Summary dynamically into HTML list items
            String[] summaryItems = aiSummary.split("\n");
            StringBuilder summaryHtml = new StringBuilder("<ul class='bullet-list'>");
            for (String item : summaryItems) {
                if (item.trim().isEmpty() || item.startsWith("✨")) continue;
                String cleanItem = item.trim().replaceFirst("^[\\-\\•\\*]\\s*", "");
                summaryHtml.append("<li>").append(cleanItem).append("</li>");
            }
            summaryHtml.append("</ul>");

            // Send completed email (HTML)
            String completeBody = "<p>Hello <strong>" + appt.getPatient().getName() + "</strong>,</p>" +
                                  "<p>Your medical consultation with <strong>" + appt.getDoctor().getName() + "</strong> is completed. We have generated a comprehensive summary and prescription details for you.</p>" +
                                  "<div class='prescription-card'>" +
                                  "  <h3 style='margin-top: 0; color: #059669;'>📋 Doctor's Prescription Notes</h3>" +
                                  "  <p style='font-size: 16px; font-weight: 500; color: #065F46; white-space: pre-wrap;'>" + prescription + "</p>" +
                                  "</div>" +
                                  "<div class='ai-card'>" +
                                  "  <h3 style='margin-top: 0; color: #2563EB;'>✨ AI Post-Visit Care Summary</h3>" +
                                  "  " + summaryHtml.toString() + "" +
                                  "</div>" +
                                  "<p>Your prescription records are permanently stored in your patient dashboard. Please adhere strictly to the schedule and seek help if you experience any worsening signs.</p>" +
                                  "<p class='sweet-note'>Wishing you great health and vitality,<br><strong>Your CareSync Consultation Support Team</strong></p>";

            sendEmail(
                appt.getPatient().getEmail(),
                "Consultation Completed & Prescription Details - CareSync Hospital",
                getEmailHtmlWrapper("Consultation Completed", "Medical Summary & Advice", completeBody)
            );

            response.put("success", true);
        } else {
            response.put("success", false);
        }
        return response;
    }

    private Map<String, Object> mapAppointment(Appointment appt) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", appt.getId());
        map.put("patientName", appt.getPatient().getName());
        map.put("patientContact", appt.getPatient().getContact());
        map.put("patientEmail", appt.getPatient().getEmail());
        map.put("doctorName", appt.getDoctor().getName());
        map.put("specialty", appt.getDoctor().getSpecialty());
        map.put("slotTime", appt.getSlot().getSlotTime());
        map.put("problem", appt.getProblemDescription());
        map.put("status", appt.getStatus());
        map.put("prescription", appt.getPrescription());
        map.put("aiPostSummary", appt.getPostVisitSummary());
        map.put("calendarSynced", appt.getStatus().equals("booked"));
        map.put("createdAt", appt.getCreatedAt() != null ? appt.getCreatedAt().toString().replace("T", " ").substring(0, 16) : "");
        return map;
    }

    // 11. Request OTP Code for Forgot Password
    @PostMapping("/auth/forgot-password")
    public Map<String, Object> forgotPassword(@RequestBody Map<String, String> payload) {
        String email = payload.get("email");
        Map<String, Object> response = new HashMap<>();

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            response.put("success", false);
            response.put("message", "User with this email does not exist.");
            return response;
        }

        // Generate a random 6-digit verification code
        String otp = String.format("%06d", new Random().nextInt(1000000));
        otpStore.put(email, otp);

        // Send OTP via HTML email (HTML)
        String otpBody = "<p>Hello <strong>" + userOpt.get().getName() + "</strong>,</p>" +
                         "<p>We received a request to reset your CareSync Hospital account password. Please use the verification code below to set a new password.</p>" +
                         "<div class='card' style='text-align: center; border-left-color: #F59E0B; background-color: #FEF3C7;'>" +
                         "  <p style='font-size: 14px; margin: 0; color: #78350F; font-weight: 500;'>YOUR VERIFICATION CODE</p>" +
                         "  <h1 style='font-size: 36px; margin: 10px 0 0 0; color: #D97706; letter-spacing: 4px; font-weight: 800;'>" + otp + "</h1>" +
                         "</div>" +
                         "<p>If you did not make this request, you can safely ignore this email. Your current password will remain unchanged.</p>" +
                         "<p class='sweet-note'>Stay secure,<br><strong>CareSync Security & Privacy Team</strong></p>";

        sendEmail(
            email,
            "CareSync Password Reset Verification Code",
            getEmailHtmlWrapper("Security Code", "Password Reset Request", otpBody)
        );

        response.put("success", true);
        return response;
    }

    // 12. Reset password using valid OTP Code
    @PostMapping("/auth/reset-password")
    public Map<String, Object> resetPassword(@RequestBody Map<String, String> payload) {
        String email = payload.get("email");
        String otp = payload.get("otp");
        String newPassword = payload.get("newPassword");
        Map<String, Object> response = new HashMap<>();

        String cachedOtp = otpStore.get(email);
        if (cachedOtp == null || !cachedOtp.equals(otp)) {
            response.put("success", false);
            response.put("message", "Invalid verification code.");
            return response;
        }

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setPasswordHash(newPassword);
            userRepository.save(user);
            otpStore.remove(email);

            sendEmail(
                email,
                "CareSync Password Successfully Reset",
                "Hello " + user.getName() + ",\n\nThis is a confirmation that your CareSync Hospital account password has been successfully reset!\n\nYou can now log in using your new password.\n\nBest regards,\nCareSync Portal Security"
            );

            response.put("success", true);
        } else {
            response.put("success", false);
            response.put("message", "User details missing.");
        }
        return response;
    }
}
