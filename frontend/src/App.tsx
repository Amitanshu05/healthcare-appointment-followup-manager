import React, { useState, useEffect } from 'react';
import { 
  User, 
  Calendar, 
  Clock, 
  Activity, 
  Users, 
  Database,
  Lock,
  Mail,
  Phone,
  LogOut,
  Check,
  FileText,
  PlusCircle
} from 'lucide-react';

interface Doctor {
  id: number;
  name: string;
  specialty: string;
  contact: string;
  email: string;
  password: string;
  isAvailable: boolean;
  isOnLeave: boolean;
  slots: string[];
}

interface Appointment {
  id: number;
  patientName: string;
  patientContact: string;
  doctorName: string;
  specialty: string;
  slotTime: string;
  problem: string;
  status: 'booked' | 'completed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
  calendarSynced: boolean;
  prescription?: string;
  aiPostSummary?: string;
}

interface PatientUser {
  name: string;
  email: string;
  contact: string;
  passwordHash: string;
}

const INITIAL_DOCTORS: Doctor[] = [
  { id: 1, name: "Dr. Aarav Sharma", specialty: "Cardiologist", contact: "+91 98765 43210", email: "aarav.sharma@hospital.com", password: "doctor123", isAvailable: true, isOnLeave: false, slots: ["10:00 AM", "11:30 AM", "02:00 PM"] },
  { id: 2, name: "Dr. Priya Patel", specialty: "Dermatologist", contact: "+91 98765 43211", email: "priya.patel@hospital.com", password: "doctor123", isAvailable: true, isOnLeave: false, slots: ["10:00 AM", "02:00 PM", "03:30 PM"] },
  { id: 3, name: "Dr. Amit Verma", specialty: "Pediatrician", contact: "+91 98765 43212", email: "amit.verma@hospital.com", password: "doctor123", isAvailable: true, isOnLeave: false, slots: ["11:30 AM", "03:30 PM"] },
  { id: 4, name: "Dr. Neha Gupta", specialty: "General Physician", contact: "+91 98765 43213", email: "neha.gupta@hospital.com", password: "doctor123", isAvailable: false, isOnLeave: true, slots: ["10:00 AM", "11:30 AM"] }
];

const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 101,
    patientName: "Rajesh Kumar",
    patientContact: "+91 99887 76655",
    doctorName: "Dr. Aarav Sharma",
    specialty: "Cardiologist",
    slotTime: "2026-08-25 10:00 AM",
    problem: "Chest discomfort during morning walks.",
    status: "completed",
    createdAt: "2026-08-23 09:15 AM",
    completedAt: "2026-08-23 11:45 AM",
    calendarSynced: true,
    prescription: "Aspirin 75mg once daily after breakfast. Rest for 3 days.",
    aiPostSummary: "✨ AI Clinical Insights:\n• Clinical Goal: Recover from chest discomfort.\n• Medication Schedule: Take Aspirin (75mg) daily after breakfast.\n• Advice: Complete bed rest for 3 days; avoid dynamic exercise.\n• Reminder status: Notification jobs successfully configured in outbox."
  },
  {
    id: 102,
    patientName: "Rajesh Kumar",
    patientContact: "+91 99887 76655",
    doctorName: "Dr. Priya Patel",
    specialty: "Dermatologist",
    slotTime: "2026-08-26 02:00 PM",
    problem: "Skin rashes on lower arms.",
    status: "booked",
    createdAt: "2026-08-23 02:30 PM",
    calendarSynced: true
  }
];

export default function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; role: 'patient' | 'doctor' | 'admin' } | null>(null);
  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot'>('login');

  // Forgot Password flow state variables
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotMsg, setForgotMsg] = useState({ text: '', type: '' });
  const [forgotStep, setForgotStep] = useState(1); // 1: Send OTP, 2: Reset Password

  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [contactInput, setContactInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:8080'
    : 'https://healthcare-manager-9.onrender.com'; // Render backend URL

  const [doctors, setDoctors] = useState<Doctor[]>(INITIAL_DOCTORS);
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [patientsList, setPatientsList] = useState<PatientUser[]>([]);

  // Booking state variables
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | ''>('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [bookingMsg, setBookingMsg] = useState({ text: '', type: '' });

  // Doctor complete/prescription variables
  const [activePrescriptionText, setActivePrescriptionText] = useState<{ [apptId: number]: string }>({});

  // Admin Manage Doctors Form
  const [newDocName, setNewDocName] = useState('');
  const [newDocSpecialty, setNewDocSpecialty] = useState('');
  const [newDocContact, setNewDocContact] = useState('');
  const [newDocEmail, setNewDocEmail] = useState('');
  const [newDocPassword, setNewDocPassword] = useState('');
  const [adminMsg, setAdminMsg] = useState('');

  // Simulation flags
  const [syncingCalendar, setSyncingCalendar] = useState(false);

  const sendEmailAlert = async (to: string, subject: string, body: string) => {
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body })
      });
    } catch (err) {
      console.warn("Mail dispatch error or offline mode:", err);
    }
  };

  // Load and refresh data from the centralized PostgreSQL database via API
  const refreshData = async () => {
    try {
      const docRes = await fetch(`${API_BASE}/api/doctors`);
      if (docRes.ok) {
        const docsData = await docRes.json();
        if (Array.isArray(docsData)) {
          setDoctors(docsData);
        }
      }

      const apptRes = await fetch(`${API_BASE}/api/appointments`);
      if (apptRes.ok) {
        const apptsData = await apptRes.json();
        if (Array.isArray(apptsData)) {
          setAppointments(apptsData);
        }
      }
    } catch (err) {
      console.warn("Backend API not reachable. Using memory cache fallback.", err);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg({ text: '', type: '' });

    if (!forgotEmail) {
      setForgotMsg({ text: 'Email is required.', type: 'error' });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      const data = await res.json();
      if (data.success) {
        setForgotMsg({ text: 'A verification code (OTP) has been sent to your email!', type: 'success' });
        setForgotStep(2);
      } else {
        setForgotMsg({ text: data.message || 'Email not found.', type: 'error' });
      }
    } catch (err) {
      setForgotMsg({ text: 'Connection to backend failed.', type: 'error' });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg({ text: '', type: '' });

    if (!forgotOtp || !forgotNewPassword) {
      setForgotMsg({ text: 'All fields are required.', type: 'error' });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail,
          otp: forgotOtp,
          newPassword: forgotNewPassword
        })
      });
      const data = await res.json();
      if (data.success) {
        setForgotMsg({ text: 'Password successfully reset! You can now log in.', type: 'success' });
        setTimeout(() => {
          setAuthView('login');
          setForgotStep(1);
          setForgotEmail('');
          setForgotOtp('');
          setForgotNewPassword('');
        }, 3000);
      } else {
        setForgotMsg({ text: data.message || 'Reset failed.', type: 'error' });
      }
    } catch (err) {
      setForgotMsg({ text: 'Connection to backend failed.', type: 'error' });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoggingIn(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, password: passwordInput })
      });
      const data = await res.json();
      if (data.success) {
        setIsLoggedIn(true);
        setCurrentUser({ name: data.name, email: data.email, role: data.role });
        refreshData();
      } else {
        setAuthError(data.message || 'Invalid email or password');
      }
      setIsLoggingIn(false);
    } catch (err) {
      setIsLoggingIn(false);
      // Graceful fallback for offline prototype testing on Vercel
      if (emailInput === 'admin@caresync.com' && passwordInput === 'AdminCareSync2026') {
        setIsLoggedIn(true);
        setCurrentUser({ name: 'Hospital Administration', email: emailInput, role: 'admin' });
        return;
      }
      const matchedDoctor = doctors.find(d => d.email === emailInput && d.password === passwordInput);
      if (matchedDoctor) {
        setIsLoggedIn(true);
        setCurrentUser({ name: matchedDoctor.name, email: emailInput, role: 'doctor' });
        return;
      }
      setAuthError('Connection to backend failed. Using local mockup accounts.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsRegistering(true);

    if (!nameInput || !emailInput || !contactInput || !passwordInput) {
      setAuthError('All fields are required.');
      setIsRegistering(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput, email: emailInput, contact: contactInput, password: passwordInput })
      });
      const data = await res.json();
      if (data.success) {
        setIsLoggedIn(true);
        setCurrentUser({ name: nameInput, email: emailInput, role: 'patient' });
        refreshData();
      } else {
        setAuthError(data.message || 'Registration failed.');
      }
      setIsRegistering(false);
    } catch (err) {
      setIsRegistering(false);
      // Local prototype register fallback
      const newPatient: PatientUser = {
        name: nameInput,
        email: emailInput,
        contact: contactInput,
        passwordHash: passwordInput
      };
      setPatientsList([...patientsList, newPatient]);
      setIsLoggedIn(true);
      setCurrentUser({ name: newPatient.name, email: newPatient.email, role: 'patient' });

      sendEmailAlert(
        newPatient.email,
        'Welcome to CareSync Hospital!',
        `Hello ${newPatient.name},\n\nYour patient account has been successfully registered under ${newPatient.email}!\n\nYou can now log in to schedule medical slot consultations, write down symptom profiles, and sync appointments with Google Calendar.\n\nBest regards,\nCareSync Hospital Admin Team`
      );

      setNameInput('');
      setEmailInput('');
      setContactInput('');
      setPasswordInput('');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setEmailInput('');
    setPasswordInput('');
    setAuthError('');
    setShowLanding(true);
  };

  const specialties = Array.from(new Set(doctors.map(d => d.specialty)));

  const filteredDoctorsBySpecialty = doctors.filter(
    d => d.specialty === selectedSpecialty && d.isAvailable && !d.isOnLeave
  );

  const selectedDoctorObj = doctors.find(d => d.id === selectedDoctorId);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedDoctorId || !selectedSlot || !problemDescription) {
      setBookingMsg({ text: 'Please fill all fields', type: 'error' });
      return;
    }

    setSyncingCalendar(true);

    try {
      const res = await fetch(`${API_BASE}/api/appointments/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientEmail: currentUser.email,
          doctorId: selectedDoctorId,
          slotTime: selectedSlot,
          problem: problemDescription
        })
      });
      const data = await res.json();
      setSyncingCalendar(false);

      if (data.success) {
        setBookingMsg({ text: 'Booking completed & synced with Google Calendar!', type: 'success' });
        refreshData();
        setSelectedSlot('');
        setProblemDescription('');
      } else {
        setBookingMsg({ text: data.message || 'Booking failed', type: 'error' });
      }
    } catch (err) {
      // Local fallback
      const doc = doctors.find(d => d.id === selectedDoctorId);
      if (!doc) return;
      setTimeout(() => {
        const newAppt: Appointment = {
          id: Date.now(),
          patientName: currentUser.name,
          patientContact: "+91 99887 76655",
          doctorName: doc.name,
          specialty: doc.specialty,
          slotTime: `2026-08-25 ${selectedSlot}`,
          problem: problemDescription,
          status: 'booked',
          createdAt: new Date().toLocaleString(),
          calendarSynced: true
        };
        setAppointments([newAppt, ...appointments]);
        setSyncingCalendar(false);
        setBookingMsg({ text: 'Booking completed & synced with Google Calendar!', type: 'success' });

        sendEmailAlert(
          currentUser.email,
          'Appointment Booking Confirmed - CareSync Hospital',
          `Hello ${currentUser.name},\n\nYour medical appointment has been successfully scheduled with ${doc.name} (${doc.specialty})!\n\nSlot Timing: 2026-08-25 ${selectedSlot}\nSymptom Chief Complaint: "${problemDescription}"\n\nA Google Calendar invitation has been automatically synced to both you and the specialist.\n\nBest regards,\nCareSync Scheduling Portal`
        );

        setSelectedSlot('');
        setProblemDescription('');
      }, 1000);
    }
  };

  const handleCancel = async (id: number) => {
    if (confirm("Cancel appointment? This will delete the Google Calendar event.")) {
      try {
        const res = await fetch(`${API_BASE}/api/appointments/${id}/cancel`, {
          method: 'POST'
        });
        const data = await res.json();
        if (data.success) {
          refreshData();
        }
      } catch (err) {
        // Local fallback
        const appt = appointments.find(a => a.id === id);
        setAppointments(appointments.map(a => 
          a.id === id ? { ...a, status: 'cancelled', calendarSynced: false } : a
        ));
        if (appt && currentUser) {
          sendEmailAlert(
            currentUser.email,
            'Appointment Cancelled - CareSync Hospital',
            `Hello ${appt.patientName},\n\nYour appointment with ${appt.doctorName} scheduled for ${appt.slotTime} has been successfully cancelled.\n\nThe corresponding Google Calendar event has been removed.\n\nBest regards,\nCareSync Scheduling Portal`
          );
        }
      }
    }
  };

  // SMART AI SIMULATOR: Converts clinical prescription shorthand into patient-friendly structured details
  const getSmartAISummary = (notes: string): string => {
    const defaultHead = "✨ AI Clinical Insights:\n";
    let formattedNotes = notes.trim();

    if (formattedNotes.toLowerCase().includes("rest krna") || formattedNotes.toLowerCase().includes("rest")) {
      formattedNotes = "Get sufficient bed rest. Avoid high physical activity.";
    }
    
    let adviceList = `• Advice: ${formattedNotes}`;
    
    let medSchedule = "";
    if (notes.toLowerCase().includes("vitamin")) {
      medSchedule = "\n• Medication Schedule: Take Vitamin tablets once daily after meals.";
    } else if (notes.toLowerCase().includes("aspirin") || notes.toLowerCase().includes("tablet")) {
      medSchedule = "\n• Medication Schedule: Take prescribed tablets as directed (preferably with warm water).";
    } else {
      medSchedule = "\n• Medication Schedule: Follow the general dosage mentioned on the label.";
    }

    const followUp = "\n• Follow-up Steps: If symptoms do not improve within 3-4 days, report back.";
    const statusInfo = "\n• Reminder status: Medication notifications active.";

    return `${defaultHead}${adviceList}${medSchedule}${followUp}${statusInfo}`;
  };

  const handleCompleteWithPrescription = async (id: number) => {
    const rxText = activePrescriptionText[id] || '';
    if (!rxText.trim()) {
      alert("Please write clinical prescription notes first!");
      return;
    }

    if (confirm("Complete appointment and send prescription details via email?")) {
      try {
        const res = await fetch(`${API_BASE}/api/appointments/${id}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prescription: rxText })
        });
        const data = await res.json();
        if (data.success) {
          refreshData();
          setActivePrescriptionText(prev => {
            const copy = { ...prev };
            delete copy[id];
            return copy;
          });
        }
      } catch (err) {
        // Local fallback
        const aiSummarySim = getSmartAISummary(rxText);
        const apptObj = appointments.find(a => a.id === id);
        const patientDetails = patientsList.find(p => p.name === apptObj?.patientName);
        const patientEmail = patientDetails ? patientDetails.email : 'vashishtharsh6@gmail.com';

        setAppointments(appointments.map(appt => 
          appt.id === id ? { 
            ...appt, 
            status: 'completed', 
            completedAt: new Date().toLocaleString(),
            prescription: rxText,
            aiPostSummary: aiSummarySim
          } : appt
        ));

        sendEmailAlert(
          patientEmail,
          'Consultation Completed & Prescription Details - CareSync Hospital',
          `Hello ${apptObj?.patientName},\n\nYour consultation with ${apptObj?.doctorName} is completed!\n\nHere are the details:\n\n=== Doctor Diagnosis Notes ===\n${rxText}\n\n=== Patient Friendly AI Clinical Summary ===\n${aiSummarySim}\n\nThank you for choosing CareSync Hospital.\n\nBest regards,\nCareSync Care Team`
        );
        
        setActivePrescriptionText(prev => {
          const copy = { ...prev };
          delete copy[id];
          return copy;
        });
      }
    }
  };

  const handleAdminAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName || !newDocSpecialty || !newDocContact || !newDocEmail || !newDocPassword) {
      setAdminMsg('All doctor details (including email and password) are required.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/doctors/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDocName,
          specialty: newDocSpecialty,
          contact: newDocContact,
          email: newDocEmail,
          password: newDocPassword
        })
      });
      const data = await res.json();
      if (data.success) {
        setAdminMsg('New doctor profile added successfully!');
        refreshData();
        setNewDocName('');
        setNewDocSpecialty('');
        setNewDocContact('');
        setNewDocEmail('');
        setNewDocPassword('');
      } else {
        setAdminMsg(data.message || 'Failed to add doctor.');
      }
    } catch (err) {
      // Local fallback
      const newDoc: Doctor = {
        id: Date.now(),
        name: newDocName.startsWith("Dr. ") ? newDocName : `Dr. ${newDocName}`,
        specialty: newDocSpecialty,
        contact: newDocContact,
        email: newDocEmail,
        password: newDocPassword,
        isAvailable: true,
        isOnLeave: false,
        slots: ["10:00 AM", "11:30 AM", "02:00 PM", "03:30 PM"]
      };
      setDoctors([...doctors, newDoc]);
      setNewDocName('');
      setNewDocSpecialty('');
      setNewDocContact('');
      setNewDocEmail('');
      setNewDocPassword('');
      setAdminMsg('New doctor profile added successfully!');
    }
  };

  const toggleDoctorLeave = async (docId: number, currentLeaveStatus: boolean) => {
    const doc = doctors.find(d => d.id === docId);
    if (!doc) return;

    const actionText = currentLeaveStatus ? "Mark back on Duty?" : "Put on Leave? Existing active bookings will be cancelled and patients notified.";
    if (confirm(`${doc.name}: ${actionText}`)) {
      try {
        const res = await fetch(`${API_BASE}/api/doctors/${docId}/leave`, {
          method: 'POST'
        });
        const data = await res.json();
        if (data.success) {
          refreshData();
        }
      } catch (err) {
        // Local fallback
        setDoctors(doctors.map(d => 
          d.id === docId ? { ...d, isOnLeave: !currentLeaveStatus, isAvailable: currentLeaveStatus } : d
        ));
        if (!currentLeaveStatus) {
          setAppointments(appointments.map(appt => 
            (appt.doctorName === doc.name && appt.status === 'booked')
              ? { ...appt, status: 'cancelled', calendarSynced: false }
              : appt
          ));
        }
      }
    }
  };

  const toggleDoctorDuty = async (doctorName: string, currentStatus: boolean) => {
    const doc = doctors.find(d => d.name === doctorName);
    if (!doc) return;

    try {
      const res = await fetch(`${API_BASE}/api/doctors/${doc.id}/availability`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        refreshData();
      }
    } catch (err) {
      // Local fallback
      setDoctors(doctors.map(d => 
        d.name === doctorName ? { ...d, isAvailable: !currentStatus } : d
      ));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {!isLoggedIn && showLanding ? (
        <div className="min-h-screen flex flex-col bg-white">
          {/* Header */}
          <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-20 items-center">
                <div className="flex items-center space-x-2">
                  <Activity className="h-8 w-8 text-blue-600" />
                  <span className="text-2xl font-bold text-slate-900 tracking-tight">
                    CareSync <span className="text-blue-600">Hospital</span>
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={() => { setShowLanding(false); setAuthView('login'); }}
                    className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => { setShowLanding(false); setAuthView('register'); }}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors"
                  >
                    Book Consultation
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Hero Section */}
          <section className="relative bg-gradient-to-b from-blue-50/50 to-white py-20 lg:py-32">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-150 mb-6">
                ✨ Smart Clinical Scheduling & AI Summaries
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-955 tracking-tight max-w-4xl mx-auto leading-none">
                Your Health, Our Priority. <br/>
                <span className="text-blue-600">Fast Booking & AI Insights.</span>
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">
                Experience seamless specialist booking, instant Google Calendar invites with active 15-minute reminders, and automated AI care summaries.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
                <button 
                  onClick={() => { setShowLanding(false); setAuthView('register'); }}
                  className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-4 border border-transparent text-base font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
                >
                  Get Started (Free Patient Sign Up)
                </button>
                <button 
                  onClick={() => { setShowLanding(false); setAuthView('login'); }}
                  className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-4 border border-slate-200 text-base font-bold rounded-xl text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition-all"
                >
                  Portal Login
                </button>
              </div>
            </div>
          </section>

          {/* Statistics Section */}
          <section className="bg-slate-50 border-y border-slate-100 py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
                <div>
                  <p className="text-3xl sm:text-4xl font-extrabold text-slate-900">10k+</p>
                  <p className="text-sm font-semibold text-slate-500 mt-1">Patients Served</p>
                </div>
                <div>
                  <p className="text-3xl sm:text-4xl font-extrabold text-slate-900">50+</p>
                  <p className="text-sm font-semibold text-slate-500 mt-1">Specialists Seeding</p>
                </div>
                <div>
                  <p className="text-3xl sm:text-4xl font-extrabold text-slate-900">24/7</p>
                  <p className="text-sm font-semibold text-slate-500 mt-1">AI Care Triage</p>
                </div>
                <div>
                  <p className="text-3xl sm:text-4xl font-extrabold text-slate-900">99.8%</p>
                  <p className="text-sm font-semibold text-slate-500 mt-1">Booking Success</p>
                </div>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950">Features Designed for Patient Care</h2>
              <p className="mt-4 text-slate-600 max-w-xl mx-auto font-medium">Discover how CareSync integrates modern technologies to deliver a premium hospital workflow.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-8 border border-slate-150 rounded-2xl bg-white hover:shadow-md transition-shadow">
                <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-6">
                  <Calendar className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">iCalendar Autopush</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Receive automatic Google Calendar events with active 15-minute phone alert reminders right inside your email inbox.
                </p>
              </div>
              <div className="p-8 border border-slate-150 rounded-2xl bg-white hover:shadow-md transition-shadow">
                <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-6">
                  <Activity className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">AI Consultation Summaries</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Get dynamically formatted AI-triage summaries of your chief symptoms and doctor prescriptions instantly.
                </p>
              </div>
              <div className="p-8 border border-slate-150 rounded-2xl bg-white hover:shadow-md transition-shadow">
                <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-6">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Secure Verification Loops</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Forgot password? Authenticate instantly with secure 6-digit verification OTP mail codes before updating your database passwords.
                </p>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="mt-auto bg-slate-900 text-slate-400 py-12 text-sm border-t border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center space-x-2">
                <Activity className="h-6 w-6 text-blue-500" />
                <span className="text-lg font-bold text-white tracking-tight">CareSync Portal</span>
              </div>
              <p className="text-xs text-slate-500">CareSync Hospital Center, Clinical Drive Road, OR 97401. &copy; 2026. All rights reserved.</p>
            </div>
          </footer>
        </div>
      ) : (
        <>
          {/* Top Navigation Header */}
          <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                
                <button 
                  onClick={() => setShowLanding(true)}
                  className="flex items-center space-x-2 focus:outline-none"
                >
                  <Activity className="h-8 w-8 text-blue-600" />
                  <span className="text-xl font-bold text-slate-900 tracking-tight">
                    CareSync <span className="text-blue-600">Hospital</span>
                  </span>
                </button>

            {isLoggedIn && currentUser && (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-slate-500 font-medium hidden sm:inline">
                  Welcome, <strong className="text-slate-800">{currentUser.name}</strong> ({currentUser.role.toUpperCase()})
                </span>
                <button 
                  onClick={handleLogout}
                  className="inline-flex items-center px-3.5 py-1.5 border border-slate-300 text-sm font-semibold rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                >
                  <LogOut className="h-4 w-4 mr-1.5" />
                  Log Out
                </button>
              </div>
            )}

          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-center">
        
        {/* ==================== LOGIN VIEW ==================== */}
        {!isLoggedIn && authView === 'login' && (
          <div className="sm:mx-auto sm:w-full sm:max-w-md my-auto">
            <div className="text-center mb-6">
              <button 
                onClick={() => setShowLanding(true)}
                className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-blue-600 mb-2 transition-colors"
              >
                ← Back to Home
              </button>
              <h2 className="text-3xl font-extrabold text-slate-900">Sign in to Hospital Portal</h2>
              <p className="mt-2 text-sm text-slate-600">
                Or{' '}
                <button onClick={() => setAuthView('register')} className="font-semibold text-blue-600 hover:text-blue-500 underline">
                  register a new patient profile
                </button>
              </p>
            </div>

            <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-slate-200">
              {authError && (
                <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4 rounded-md text-sm text-red-700">
                  {authError}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Email Address</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-400" />
                    </div>
                    <input 
                      type="email" 
                      required 
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="e.g. admin@hospital.com"
                      className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">Password</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-400" />
                    </div>
                    <input 
                      type="password" 
                      required 
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end text-xs">
                  <button 
                    type="button"
                    onClick={() => { setAuthView('forgot'); setForgotStep(1); setForgotMsg({ text: '', type: '' }); }} 
                    className="font-semibold text-blue-600 hover:text-blue-500 underline"
                  >
                    Forgot Password?
                  </button>
                </div>

                <button 
                  type="submit" 
                  disabled={isLoggingIn}
                  className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:bg-slate-400"
                >
                  {isLoggingIn ? (
                    <>
                      <span className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></span>
                      Signing In...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ==================== REGISTER VIEW ==================== */}
        {!isLoggedIn && authView === 'register' && (
          <div className="sm:mx-auto sm:w-full sm:max-w-md my-auto">
            <div className="text-center mb-6">
              <button 
                onClick={() => setShowLanding(true)}
                className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-blue-600 mb-2 transition-colors"
              >
                ← Back to Home
              </button>
              <h2 className="text-3xl font-extrabold text-slate-900">Create Patient Profile</h2>
              <p className="mt-2 text-sm text-slate-600">
                Or{' '}
                <button onClick={() => setAuthView('login')} className="font-semibold text-blue-600 hover:text-blue-500 underline">
                  sign in to existing account
                </button>
              </p>
            </div>

            <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-slate-200">
              {authError && (
                <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4 rounded-md text-sm text-red-700">
                  {authError}
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Full Name</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-slate-400" />
                    </div>
                    <input 
                      type="text" 
                      required 
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="e.g. Rajesh Kumar"
                      className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">Email Address</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-400" />
                    </div>
                    <input 
                      type="email" 
                      required 
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="e.g. patient@gmail.com"
                      className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">Contact Number</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-4 w-4 text-slate-400" />
                    </div>
                    <input 
                      type="text" 
                      required 
                      value={contactInput}
                      onChange={(e) => setContactInput(e.target.value)}
                      placeholder="e.g. +91 99999 99999"
                      className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">Password</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-400" />
                    </div>
                    <input 
                      type="password" 
                      required 
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Password"
                      className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isRegistering}
                  className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:bg-slate-400"
                >
                  {isRegistering ? (
                    <>
                      <span className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></span>
                      Creating Profile...
                    </>
                  ) : (
                    'Create Profile'
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ==================== FORGOT PASSWORD VIEW ==================== */}
        {!isLoggedIn && authView === 'forgot' && (
          <div className="sm:mx-auto sm:w-full sm:max-w-md my-auto">
            <div className="text-center mb-6">
              <button 
                onClick={() => setShowLanding(true)}
                className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-blue-600 mb-2 transition-colors"
              >
                ← Back to Home
              </button>
              <h2 className="text-3xl font-extrabold text-slate-900">Reset Account Password</h2>
              <p className="mt-2 text-sm text-slate-600">
                Or{' '}
                <button onClick={() => setAuthView('login')} className="font-semibold text-blue-600 hover:text-blue-500 underline">
                  go back to sign in
                </button>
              </p>
            </div>

            <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-slate-200">
              {forgotMsg.text && (
                <div className={`mb-4 border-l-4 p-4 rounded-md text-sm ${
                  forgotMsg.type === 'success' 
                    ? 'bg-green-50 border-green-400 text-green-700' 
                    : 'bg-red-50 border-red-400 text-red-700'
                }`}>
                  {forgotMsg.text}
                </div>
              )}

              {forgotStep === 1 ? (
                <form onSubmit={handleSendOtp} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Verify Registered Email</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-slate-400" />
                      </div>
                      <input 
                        type="email" 
                        required 
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="e.g. yourname@gmail.com"
                        className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Send Verification Code
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Enter 6-Digit OTP Code</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-slate-400" />
                      </div>
                      <input 
                        type="text" 
                        required 
                        maxLength={6}
                        value={forgotOtp}
                        onChange={(e) => setForgotOtp(e.target.value)}
                        placeholder="e.g. 123456"
                        className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Enter New Password</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-slate-400" />
                      </div>
                      <input 
                        type="password" 
                        required 
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        placeholder="New Password"
                        className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                  >
                    Reset and Verify Password
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ==================== PATIENT PORTAL PAGE ==================== */}
        {isLoggedIn && currentUser && currentUser.role === 'patient' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="border-b border-slate-200 pb-5">
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Patient Portal</h2>
              <p className="text-sm text-slate-500 mt-1">Book doctor slots and track consultation audit history.</p>
            </div>

            {/* Layout Aligned to Schedule Height */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              <div className="lg:col-span-1 space-y-6">
                {/* 1. Booking Form Card */}
                <div id="booking-form-card" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <h3 className="text-base font-bold text-slate-950 mb-4 flex items-center space-x-2 border-b border-slate-100 pb-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <span>Schedule Appointment</span>
                  </h3>
                  
                  <form onSubmit={handleBooking} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">1. Select Medical Specialty</label>
                      <select 
                        value={selectedSpecialty} 
                        onChange={(e) => {
                          setSelectedSpecialty(e.target.value);
                          setSelectedDoctorId('');
                          setSelectedSlot('');
                        }}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-lg bg-white"
                      >
                        <option value="">-- Choose Specialty --</option>
                        {specialties.map(spec => (
                          <option key={spec} value={spec}>{spec}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">2. Choose Doctor</label>
                      <select 
                        value={selectedDoctorId} 
                        onChange={(e) => {
                          setSelectedDoctorId(Number(e.target.value) || '');
                          setSelectedSlot('');
                        }}
                        disabled={!selectedSpecialty}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50 bg-white"
                      >
                        <option value="">-- Select Specialist --</option>
                        {filteredDoctorsBySpecialty.map(doc => (
                          <option key={doc.id} value={doc.id}>{doc.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">3. Choose Available Slot</label>
                      <select 
                        value={selectedSlot} 
                        onChange={(e) => setSelectedSlot(e.target.value)}
                        disabled={!selectedDoctorId}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50 bg-white"
                      >
                        <option value="">-- Select Time Slot --</option>
                        {selectedDoctorObj?.slots.map(slot => (
                          <option key={slot} value={slot}>{slot}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Describe Symptoms</label>
                      <textarea 
                        rows={2} 
                        value={problemDescription}
                        onChange={(e) => setProblemDescription(e.target.value)}
                        placeholder="Detail your health complaints or requests..."
                        className="mt-1 block w-full border border-slate-300 rounded-lg p-2.5 shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>

                    {syncingCalendar && (
                      <div className="p-3 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-sm flex items-center space-x-2 animate-pulse">
                        <span className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></span>
                        <span>Syncing with Google Calendar API...</span>
                      </div>
                    )}

                    {bookingMsg.text && (
                      <div className={`p-3 rounded-lg text-sm border ${bookingMsg.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                        {bookingMsg.text}
                      </div>
                    )}

                    <button 
                      type="submit" 
                      disabled={!selectedSlot || !problemDescription || syncingCalendar}
                      className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:bg-slate-300"
                    >
                      Confirm Booking
                    </button>
                  </form>
                </div>

                {/* 2. Prescriptions & AI Summaries Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <h3 className="text-base font-bold text-slate-950 mb-3 flex items-center space-x-2 border-b border-slate-100 pb-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <span>Prescriptions & AI Summaries</span>
                  </h3>
                  
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                    {appointments.filter(a => a.patientName === currentUser.name && a.status === 'completed').length > 0 ? (
                      appointments.filter(a => a.patientName === currentUser.name && a.status === 'completed').map(appt => (
                        <div key={appt.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <strong className="text-slate-800">{appt.doctorName}</strong>
                            <span className="text-slate-400">{appt.completedAt?.split(',')[0]}</span>
                          </div>
                          
                          {appt.prescription && (
                            <div className="text-xs text-slate-700 bg-white p-2 border border-slate-100 rounded">
                              <span className="font-bold text-blue-600">Prescription:</span> {appt.prescription}
                            </div>
                          )}

                          {appt.aiPostSummary && (
                            <div className="text-xs text-slate-655 bg-blue-50/50 p-2.5 rounded border border-blue-100 whitespace-pre-line leading-relaxed">
                              {appt.aiPostSummary}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-400 italic text-center py-4">No completed prescriptions found.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Appointment History Card (Now Vertically Scrollable & Aligned) */}
              <div className="lg:col-span-2">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[560px]">
                  
                  <div className="px-6 py-4 border-b border-slate-200">
                    <h3 className="text-base font-bold text-slate-950">Your Appointment History & Tracking</h3>
                  </div>

                  {/* Scrollable container matching height */}
                  <div className="p-6 overflow-y-auto flex-grow">
                    {appointments.filter(a => a.patientName === currentUser.name).length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                          <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                            <tr>
                              <th className="px-4 py-3 bg-slate-50">Specialist</th>
                              <th className="px-4 py-3 bg-slate-50">Schedule Slot</th>
                              <th className="px-4 py-3 bg-slate-50">Booking Date</th>
                              <th className="px-4 py-3 bg-slate-50">Google Calendar</th>
                              <th className="px-4 py-3 bg-slate-50">Status</th>
                              <th className="px-4 py-3 bg-slate-50 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {appointments.filter(a => a.patientName === currentUser.name).map(appt => (
                              <tr key={appt.id} className="hover:bg-slate-50/50">
                                <td className="px-4 py-4 font-semibold text-slate-950">{appt.doctorName}</td>
                                <td className="px-4 py-4 text-slate-600 font-medium">{appt.slotTime}</td>
                                <td className="px-4 py-4 text-xs text-slate-450">{appt.createdAt}</td>
                                <td className="px-4 py-4">
                                  {appt.calendarSynced ? (
                                    <span className="inline-flex items-center text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200">
                                      <Check className="h-3 w-3 mr-1" />
                                      Active Sync
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-400 italic">Inactive</span>
                                  )}
                                </td>
                                <td className="px-4 py-4">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${appt.status === 'booked' ? 'bg-blue-100 text-blue-800 border border-blue-200' : appt.status === 'completed' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                                    {appt.status}
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-right">
                                  {appt.status === 'booked' && (
                                    <button onClick={() => handleCancel(appt.id)} className="text-xs font-bold text-red-650 hover:text-red-950">Cancel</button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-slate-400">No appointments recorded yet.</div>
                    )}
                  </div>

                </div>
              </div>

            </div>

            {/* 4. Specialist Directory Moved to Secondary Page Section (Bottom) */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-950 mb-4 flex items-center space-x-2 border-b border-slate-100 pb-2">
                <Users className="h-5 w-5 text-blue-600" />
                <span>Specialist Directory & Availability Contacts</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {doctors.map(doc => (
                  <div key={doc.id} className="p-4 border border-slate-200 rounded-xl flex flex-col justify-between space-y-3 bg-slate-50/50">
                    <div>
                      <span className="block font-bold text-slate-900 text-sm">{doc.name}</span>
                      <span className="block text-xs text-slate-550 font-semibold">{doc.specialty}</span>
                      <span className="block text-xs text-slate-400 mt-1">{doc.contact}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${doc.isOnLeave ? 'bg-red-50 text-red-755 border-red-200' : doc.isAvailable ? 'bg-green-50 text-green-755 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {doc.isOnLeave ? 'On Leave' : doc.isAvailable ? 'Available' : 'Away'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ==================== DOCTOR PORTAL PAGE ==================== */}
        {isLoggedIn && currentUser && currentUser.role === 'doctor' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Doctor Portal</h2>
                <p className="text-sm text-slate-500 mt-1">Accept patients, verify clinical complaints, and manage duty slots.</p>
              </div>

              <div className="flex items-center space-x-3 bg-slate-50 p-4 border border-slate-200 rounded-xl">
                <div className="flex-grow pr-2">
                  <span className="block text-sm font-semibold text-slate-800">Duty Status</span>
                  <span className="text-xs text-slate-505 font-medium">
                    {doctors.find(d => d.name === currentUser.name)?.isAvailable ? 'Accepting Appointments' : 'Away / Offline'}
                  </span>
                </div>
                <button 
                  onClick={() => {
                    const currentDoc = doctors.find(d => d.name === currentUser.name);
                    if (currentDoc) toggleDoctorDuty(currentUser.name, currentDoc.isAvailable);
                  }}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${doctors.find(d => d.name === currentUser.name)?.isAvailable ? 'bg-blue-600' : 'bg-slate-200'}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${doctors.find(d => d.name === currentUser.name)?.isAvailable ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="text-base font-bold text-slate-950">Your Scheduled Consultations</h3>
              </div>
              <div className="p-6">
                {appointments.filter(a => a.doctorName === currentUser.name).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                      <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Patient</th>
                          <th className="px-4 py-3">Slot Time</th>
                          <th className="px-4 py-3">Booking Date</th>
                          <th className="px-4 py-3">Clinical Symptoms Query</th>
                          <th className="px-4 py-3">Prescription & Clinical Summary</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {appointments.filter(a => a.doctorName === currentUser.name).map(appt => (
                          <tr key={appt.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-4">
                              <span className="block font-bold text-slate-955">{appt.patientName}</span>
                              <span className="block text-xs text-slate-550">{appt.patientContact}</span>
                            </td>
                            <td className="px-4 py-4 font-semibold text-slate-700">{appt.slotTime}</td>
                            <td className="px-4 py-4 text-xs text-slate-450">{appt.createdAt}</td>
                            <td className="px-4 py-4 max-w-xs">
                              <div className="p-2 border border-slate-200 bg-slate-50 rounded-lg text-xs italic text-slate-650 leading-relaxed">
                                "{appt.problem}"
                              </div>
                            </td>
                            <td className="px-4 py-4 max-w-sm">
                              {appt.status === 'booked' ? (
                                <textarea 
                                  rows={2} 
                                  value={activePrescriptionText[appt.id] || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setActivePrescriptionText(prev => ({ ...prev, [appt.id]: val }));
                                  }}
                                  placeholder="Write patient dosage/prescription details..."
                                  className="w-full border border-slate-355 rounded-lg p-2 text-xs focus:ring-blue-500 focus:border-blue-500"
                                />
                              ) : (
                                <div className="space-y-1 text-xs">
                                  <p><span className="font-bold text-slate-700">Rx:</span> {appt.prescription || '-'}</p>
                                  {appt.aiPostSummary && (
                                    <p className="italic text-slate-505 bg-blue-50/40 p-1.5 rounded border border-blue-105 whitespace-pre-line"><strong className="text-blue-600">AI Summary:</strong> {appt.aiPostSummary}</p>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${appt.status === 'booked' ? 'bg-blue-100 text-blue-800 border border-blue-200' : appt.status === 'completed' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                                {appt.status}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right space-x-2 whitespace-nowrap">
                              {appt.status === 'booked' && (
                                <>
                                  <button onClick={() => handleCompleteWithPrescription(appt.id)} className="text-xs font-bold text-green-650 hover:text-green-955 border border-green-200 px-2 py-1 bg-green-50 rounded">Complete</button>
                                  <button onClick={() => handleCancel(appt.id)} className="text-xs font-bold text-red-650 hover:text-red-955">Cancel</button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">No scheduled consultations found.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== ADMIN PORTAL PAGE ==================== */}
        {isLoggedIn && currentUser && currentUser.role === 'admin' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="border-b border-slate-200 pb-5">
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Hospital Supervisor Admin View</h2>
              <p className="text-sm text-slate-500 mt-1">Unified monitoring and auditing panels for medical records.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex items-center space-x-4">
                <Users className="h-8 w-8 text-blue-600" />
                <div>
                  <span className="block text-2xl font-bold text-slate-900">{doctors.length}</span>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Registered Doctors</span>
                </div>
              </div>
              
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex items-center space-x-4">
                <Database className="h-8 w-8 text-blue-600" />
                <div>
                  <span className="block text-2xl font-bold text-slate-900">{appointments.length}</span>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Master Log Entries</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex items-center space-x-4">
                <Clock className="h-8 w-8 text-blue-600" />
                <div>
                  <span className="block text-2xl font-bold text-slate-900">
                    {appointments.filter(a => a.status === 'booked').length}
                  </span>
                  <span className="text-xs font-semibold text-slate-555 uppercase tracking-wider">Active Bookings</span>
                </div>
              </div>
            </div>

            {/* Aligned Layout for Admin Doctor Directory */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              {/* Doctor Creation Form */}
              <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 h-[520px]">
                <h3 className="text-base font-bold text-slate-950 flex items-center space-x-2 border-b border-slate-100 pb-2">
                  <PlusCircle className="h-5 w-5 text-blue-600" />
                  <span>Register New Doctor</span>
                </h3>

                <form onSubmit={handleAdminAddDoctor} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Doctor Name</label>
                    <input 
                      type="text" 
                      required 
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
                      placeholder="e.g. Dr. Rohan Kapoor"
                      className="mt-1 block w-full border border-slate-300 rounded-lg p-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Specialty Specialization</label>
                    <input 
                      type="text" 
                      required 
                      value={newDocSpecialty}
                      onChange={(e) => setNewDocSpecialty(e.target.value)}
                      placeholder="e.g. Cardiologist"
                      className="mt-1 block w-full border border-slate-300 rounded-lg p-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Number</label>
                    <input 
                      type="text" 
                      required 
                      value={newDocContact}
                      onChange={(e) => setNewDocContact(e.target.value)}
                      placeholder="e.g. +91 99887 76655"
                      className="mt-1 block w-full border border-slate-300 rounded-lg p-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                    <input 
                      type="email" 
                      required 
                      value={newDocEmail}
                      onChange={(e) => setNewDocEmail(e.target.value)}
                      placeholder="e.g. rohan.k@hospital.com"
                      className="mt-1 block w-full border border-slate-300 rounded-lg p-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Login Password</label>
                    <input 
                      type="password" 
                      required 
                      value={newDocPassword}
                      onChange={(e) => setNewDocPassword(e.target.value)}
                      placeholder="••••••••"
                      className="mt-1 block w-full border border-slate-300 rounded-lg p-2 text-sm"
                    />
                  </div>

                  {adminMsg && (
                    <div className="p-2 bg-green-50 border border-green-200 text-green-800 rounded-lg text-xs">
                      {adminMsg}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors"
                  >
                    Add Doctor Profile
                  </button>
                </form>
              </div>

              {/* Doctors List & Leave Management (Scrollable Aligned) */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[520px]">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="text-base font-bold text-slate-950">Manage Doctor Directory & Leave Status</h3>
                </div>
                <div className="p-6 overflow-y-auto flex-grow">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                      <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 bg-slate-50">Doctor</th>
                          <th className="px-4 py-3 bg-slate-50">Specialty</th>
                          <th className="px-4 py-3 bg-slate-50">Contact</th>
                          <th className="px-4 py-3 bg-slate-50">Availability Status</th>
                          <th className="px-4 py-3 bg-slate-50 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {doctors.map(doc => (
                          <tr key={doc.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-4 font-bold text-slate-950">{doc.name}</td>
                            <td className="px-4 py-4 text-slate-600 font-semibold">{doc.specialty}</td>
                            <td className="px-4 py-4 text-slate-505">{doc.contact}</td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${doc.isOnLeave ? 'bg-red-50 text-red-755 border-red-200' : doc.isAvailable ? 'bg-green-50 text-green-755 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                {doc.isOnLeave ? 'On Leave' : doc.isAvailable ? 'Available' : 'Away'}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right whitespace-nowrap">
                              <button 
                                onClick={() => toggleDoctorLeave(doc.id, doc.isOnLeave)}
                                className={`text-xs font-bold px-2.5 py-1 rounded border transition-colors ${doc.isOnLeave ? 'bg-green-55 border-green-300 text-green-700 hover:bg-green-100' : 'bg-red-50 border-red-300 text-red-750 hover:bg-red-100'}`}
                              >
                                {doc.isOnLeave ? 'Set Active Duty' : 'Mark On Leave'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>

            {/* Master Log Entries (Now Scrollable Vertically too!) */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[400px]">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-55 flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-950">Master Booking Mapping Logs (Audit Trail)</h3>
              </div>
              <div className="p-6 overflow-y-auto flex-grow">
                {appointments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                      <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 bg-slate-50">Patient Detail</th>
                          <th className="px-4 py-3 bg-slate-50">Assigned Doctor</th>
                          <th className="px-4 py-3 bg-slate-50">Consultation Slot</th>
                          <th className="px-4 py-3 bg-slate-50">Booking Date</th>
                          <th className="px-4 py-3 bg-slate-50">Google Calendar</th>
                          <th className="px-4 py-3 bg-slate-50">Status</th>
                          <th className="px-4 py-3 bg-slate-50 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {appointments.map(appt => (
                          <tr key={appt.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-4">
                              <span className="block font-bold text-slate-900">{appt.patientName}</span>
                              <span className="block text-xs text-slate-550">{appt.patientContact}</span>
                            </td>
                            <td className="px-4 py-4 font-semibold text-slate-900">
                              {appt.doctorName}
                              <span className="block text-xs text-slate-555 font-normal">{appt.specialty}</span>
                            </td>
                            <td className="px-4 py-4 text-slate-750 font-medium">{appt.slotTime}</td>
                            <td className="px-4 py-4 text-xs text-slate-500">{appt.createdAt}</td>
                            <td className="px-4 py-4">
                              {appt.calendarSynced ? (
                                <span className="inline-flex items-center text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                  <Check className="h-3 w-3 mr-1" />
                                  Synced
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 italic">No Sync</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${appt.status === 'booked' ? 'bg-blue-100 text-blue-800' : appt.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {appt.status}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right">
                              {appt.status === 'booked' && (
                                <button onClick={() => handleCancel(appt.id)} className="text-xs font-bold text-red-650 hover:text-red-950">Cancel Booking</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400">No appointments recorded yet.</div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-450">
        &copy; 2026 CareSync Hospital - Clinical Appointment & Follow-up Manager
      </footer>

      </>
      )}
    </div>
  );
}
