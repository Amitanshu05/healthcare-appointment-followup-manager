package com.healthcare;

import com.healthcare.entity.User;
import com.healthcare.entity.Slot;
import com.healthcare.repository.UserRepository;
import com.healthcare.repository.SlotRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

import java.util.List;

@SpringBootApplication
public class HealthcareApplication {
    public static void main(String[] args) {
        SpringApplication.run(HealthcareApplication.class, args);
    }

    @Bean
    public CommandLineRunner initData(UserRepository userRepository, SlotRepository slotRepository) {
        return args -> {
            if (userRepository.findByEmail("admin@caresync.com").isEmpty()) {
                // Seed Admin
                User admin = new User();
                admin.setName("Hospital Administration");
                admin.setEmail("admin@caresync.com");
                admin.setPasswordHash("AdminCareSync2026");
                admin.setRole("admin");
                admin.setContact("1234567890");
                userRepository.save(admin);
                System.out.println("Admin account seeded successfully!");
            }

            if (userRepository.findByRole("doctor").isEmpty()) {
                // Seed Doctors
                User doc1 = createDoctor("Dr. Aarav Sharma", "Cardiologist", "+91 98765 43210", "aarav.sharma@hospital.com", "doctor123");
                User doc2 = createDoctor("Dr. Priya Patel", "Dermatologist", "+91 98765 43211", "priya.patel@hospital.com", "doctor123");
                User doc3 = createDoctor("Dr. Amit Verma", "Pediatrician", "+91 98765 43212", "amit.verma@hospital.com", "doctor123");
                User doc4 = createDoctor("Dr. Neha Gupta", "General Physician", "+91 98765 43213", "neha.gupta@hospital.com", "doctor123");
                doc4.setAvailable(false);

                userRepository.saveAll(List.of(doc1, doc2, doc3, doc4));

                // Seed Slots
                String[] times = {
                    "2026-08-25 10:00 AM", "2026-08-25 11:30 AM", "2026-08-25 02:00 PM", "2026-08-25 03:30 PM",
                    "2026-08-26 10:00 AM", "2026-08-26 11:30 AM", "2026-08-26 02:00 PM", "2026-08-26 03:30 PM"
                };
                for (User doc : List.of(doc1, doc2, doc3, doc4)) {
                    for (String time : times) {
                        Slot slot = new Slot();
                        slot.setDoctor(doc);
                        slot.setSlotTime(time);
                        slot.setBooked(false);
                        slotRepository.save(slot);
                    }
                }
                System.out.println("Demo doctors and slots seeded successfully!");
            }

            // Force update of slots in-place if they are in the old format to prevent foreign key violations
            if (slotRepository.count() > 0) {
                List<Slot> allSlots = slotRepository.findAll();
                boolean needsUpdate = false;
                for (Slot s : allSlots) {
                    if (!s.getSlotTime().startsWith("2026")) {
                        needsUpdate = true;
                        break;
                    }
                }
                if (needsUpdate) {
                    System.out.println("Updating existing slots to include dates in-place...");
                    for (Slot s : allSlots) {
                        String oldTime = s.getSlotTime();
                        if (!oldTime.startsWith("2026")) {
                            s.setSlotTime("2026-08-25 " + oldTime);
                            slotRepository.save(s);
                        }
                    }
                    System.out.println("Slots successfully updated with dates in-place!");
                }
            }
        };
    }

    private User createDoctor(String name, String specialty, String contact, String email, String password) {
        User doc = new User();
        doc.setName(name);
        doc.setSpecialty(specialty);
        doc.setContact(contact);
        doc.setEmail(email);
        doc.setPasswordHash(password); // Store password for simplified POC auth
        doc.setRole("doctor");
        doc.setAvailable(true);
        return doc;
    }
}
