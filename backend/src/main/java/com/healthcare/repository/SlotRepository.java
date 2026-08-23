package com.healthcare.repository;

import com.healthcare.entity.Slot;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SlotRepository extends JpaRepository<Slot, Long> {
    List<Slot> findByDoctorId(Long doctorId);
    List<Slot> findByDoctorIdAndIsBooked(Long doctorId, boolean isBooked);
}
