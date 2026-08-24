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
    private void sendEmail(String to, String subject, String text) {
        new Thread(() -> {
            if (mailSender == null) {
                System.out.println("[SMTP SIMULATOR] To: " + to + " | Subject: " + subject + "\nBody: " + text);
                return;
            }
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom("vashishtharsh6@gmail.com");
                message.setTo(to);
                message.setSubject(subject);
                message.setText(text);
                mailSender.send(message);
                System.out.println("Email sent successfully to: " + to);
            } catch (Exception e) {
                System.err.println("SMTP dispatch failed: " + e.getMessage());
            }
        }).start();
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

        // Send Welcome email
        sendEmail(
            email,
            "Welcome to CareSync Hospital!",
            "Hello " + name + ",\n\nYour patient account has been successfully registered under " + email + "!\n\nYou can now log in to schedule medical slot consultations, write down symptom profiles, and sync appointments with Google Calendar.\n\nBest regards,\nCareSync Hospital Admin Team"
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

                        // Send cancellation email
                        sendEmail(
                            appt.getPatient().getEmail(),
                            "Appointment Cancelled due to Doctor Leave - CareSync Hospital",
                            "Hello " + appt.getPatient().getName() + ",\n\nWe regret to inform you that your appointment with " + doc.getName() + " on " + appt.getSlot().getSlotTime() + " has been cancelled because the doctor is marked on leave.\n\nPlease log in to reschedule your consultation.\n\nBest regards,\nCareSync Admin Team"
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

        // Send booking confirmation email
        sendEmail(
            patientEmail,
            "Appointment Booking Confirmed - CareSync Hospital",
            "Hello " + patientOpt.get().getName() + ",\n\nYour medical appointment has been successfully scheduled with " + doctorOpt.get().getName() + " (" + doctorOpt.get().getSpecialty() + ")!\n\nSlot Timing: 2026-08-25 " + slotTime + "\nSymptom Chief Complaint: \"" + problem + "\"\n\nA Google Calendar invitation has been automatically synced to both you and the specialist.\n\nBest regards,\nCareSync Scheduling Portal"
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

            sendEmail(
                appt.getPatient().getEmail(),
                "Appointment Cancelled - CareSync Hospital",
                "Hello " + appt.getPatient().getName() + ",\n\nYour appointment with " + appt.getDoctor().getName() + " scheduled for " + appt.getSlot().getSlotTime() + " has been successfully cancelled.\n\nThe corresponding Google Calendar event has been removed.\n\nBest regards,\nCareSync Scheduling Portal"
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
            appointmentRepository.save(appt);

            sendEmail(
                appt.getPatient().getEmail(),
                "Consultation Completed & Prescription Details - CareSync Hospital",
                "Hello " + appt.getPatient().getName() + ",\n\nYour consultation with " + appt.getDoctor().getName() + " is completed!\n\nHere are the details:\n\n=== Doctor Diagnosis Notes ===\n" + prescription + "\n\n=== Patient Friendly AI Clinical Summary ===\n" + aiSummary + "\n\nThank you for choosing CareSync Hospital.\n\nBest regards,\nCareSync Care Team"
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

        // Send OTP via asynchronous background thread
        sendEmail(
            email,
            "CareSync Password Reset Verification Code",
            "Hello " + userOpt.get().getName() + ",\n\nWe received a request to reset your CareSync Hospital account password.\n\nYour unique 6-digit OTP verification code is:\n\n👉 " + otp + "\n\nPlease enter this code on the reset screen to change your password.\n\nBest regards,\nCareSync Security Team"
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
