/**
 * SickDoc seed — provisions a demonstrable system (docs/DATA_MODEL.md §10).
 *
 * Idempotent: every run upserts entities by their natural key (email / slug /
 * licenseNumber / userId) and rebuilds derived rows (specialization links,
 * availability, symptom mappings, appointments and their records), so running
 * it twice against the same database leaves the data unchanged rather than
 * duplicating it.
 *
 * Seed credentials are placeholders, not secrets:
 *   admin    admin@sickdoc.dev / Admin12345
 *   doctors  dr.<lastname>@sickdoc.dev / Password123
 *   patients <firstname>@sickdoc.dev / Password123
 */
import {
  AppointmentStatus,
  AuditAction,
  DoctorStatus,
  NotificationType,
  PrismaClient,
  Role,
  SessionStatus,
  UserStatus,
} from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const SLOT = 30 * MINUTE;

const now = Date.now();
const at = (offsetMs: number) => new Date(now + offsetMs);
const dateOnly = (s: string) => new Date(`${s}T00:00:00.000Z`);
/** Floors to the previous 30-minute boundary. */
const toSlot = (ms: number) => new Date(Math.floor(ms / SLOT) * SLOT);
/** Ceils to the next 30-minute boundary. */
const ceilToSlot = (ms: number) => new Date(Math.ceil(ms / SLOT) * SLOT);

const SEED_PASSWORD = 'Password123';
const ADMIN_PASSWORD = 'Admin12345';

const AVATAR_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#6366F1',
  '#0EA5E9',
  '#84CC16',
  '#A855F7',
  '#F43F5E',
];

// ───────────────────────────── Specializations ─────────────────────────────

const SPECIALIZATIONS = [
  { slug: 'cardiology', name: 'Cardiology', description: 'Heart and blood-vessel conditions.', iconKey: 'heart-pulse' },
  { slug: 'dermatology', name: 'Dermatology', description: 'Skin, hair, and nail conditions.', iconKey: 'sparkles' },
  { slug: 'pediatrics', name: 'Pediatrics', description: 'Care for infants, children, and adolescents.', iconKey: 'baby' },
  { slug: 'internal-medicine', name: 'Internal Medicine', description: 'Adult primary and preventive care.', iconKey: 'stethoscope' },
  { slug: 'psychiatry', name: 'Psychiatry', description: 'Mental and behavioural health.', iconKey: 'brain' },
  { slug: 'orthopedics', name: 'Orthopedics', description: 'Bones, joints, muscles, and spine.', iconKey: 'bone' },
];

// ───────────────────────────── Symptoms ─────────────────────────────

type SymptomSeed = {
  slug: string;
  label: string;
  bodySystem: string;
  synonyms: string[];
  specialties: { slug: string; weight: number }[];
};

const SYMPTOMS: SymptomSeed[] = [
  { slug: 'chest-pain', label: 'Chest pain', bodySystem: 'cardiovascular', synonyms: ['chest tightness', 'angina', 'chest pressure'], specialties: [{ slug: 'cardiology', weight: 9 }, { slug: 'internal-medicine', weight: 5 }] },
  { slug: 'shortness-of-breath', label: 'Shortness of breath', bodySystem: 'respiratory', synonyms: ['dyspnea', 'breathlessness', "can't breathe"], specialties: [{ slug: 'cardiology', weight: 8 }, { slug: 'internal-medicine', weight: 6 }] },
  { slug: 'palpitations', label: 'Heart palpitations', bodySystem: 'cardiovascular', synonyms: ['racing heart', 'irregular heartbeat', 'fluttering chest'], specialties: [{ slug: 'cardiology', weight: 8 }] },
  { slug: 'high-blood-pressure', label: 'High blood pressure', bodySystem: 'cardiovascular', synonyms: ['hypertension', 'elevated blood pressure'], specialties: [{ slug: 'cardiology', weight: 7 }, { slug: 'internal-medicine', weight: 7 }] },
  { slug: 'dizziness', label: 'Dizziness', bodySystem: 'neurological', synonyms: ['lightheaded', 'vertigo', 'feeling faint'], specialties: [{ slug: 'cardiology', weight: 5 }, { slug: 'internal-medicine', weight: 5 }] },
  { slug: 'cough', label: 'Cough', bodySystem: 'respiratory', synonyms: ['persistent cough', 'dry cough', 'wet cough'], specialties: [{ slug: 'internal-medicine', weight: 6 }, { slug: 'pediatrics', weight: 5 }] },
  { slug: 'fever', label: 'Fever', bodySystem: 'general', synonyms: ['high temperature', 'chills', 'pyrexia'], specialties: [{ slug: 'internal-medicine', weight: 6 }, { slug: 'pediatrics', weight: 7 }] },
  { slug: 'sore-throat', label: 'Sore throat', bodySystem: 'respiratory', synonyms: ['throat pain', 'scratchy throat'], specialties: [{ slug: 'internal-medicine', weight: 5 }, { slug: 'pediatrics', weight: 5 }] },
  { slug: 'fatigue', label: 'Fatigue', bodySystem: 'general', synonyms: ['tiredness', 'exhaustion', 'low energy'], specialties: [{ slug: 'internal-medicine', weight: 5 }, { slug: 'psychiatry', weight: 3 }] },
  { slug: 'headache', label: 'Headache', bodySystem: 'neurological', synonyms: ['migraine', 'head pain'], specialties: [{ slug: 'internal-medicine', weight: 5 }] },
  { slug: 'abdominal-pain', label: 'Abdominal pain', bodySystem: 'digestive', synonyms: ['stomach ache', 'belly pain', 'cramps'], specialties: [{ slug: 'internal-medicine', weight: 7 }] },
  { slug: 'nausea', label: 'Nausea', bodySystem: 'digestive', synonyms: ['queasiness', 'feeling sick', 'vomiting'], specialties: [{ slug: 'internal-medicine', weight: 5 }] },
  { slug: 'rash', label: 'Skin rash', bodySystem: 'skin', synonyms: ['hives', 'red patches', 'itchy skin'], specialties: [{ slug: 'dermatology', weight: 9 }] },
  { slug: 'acne', label: 'Acne', bodySystem: 'skin', synonyms: ['pimples', 'breakouts', 'blackheads'], specialties: [{ slug: 'dermatology', weight: 8 }] },
  { slug: 'eczema', label: 'Eczema', bodySystem: 'skin', synonyms: ['atopic dermatitis', 'dry itchy patches'], specialties: [{ slug: 'dermatology', weight: 9 }] },
  { slug: 'hair-loss', label: 'Hair loss', bodySystem: 'skin', synonyms: ['alopecia', 'thinning hair', 'balding'], specialties: [{ slug: 'dermatology', weight: 7 }] },
  { slug: 'skin-lesion', label: 'Skin lesion', bodySystem: 'skin', synonyms: ['mole change', 'skin growth', 'wart'], specialties: [{ slug: 'dermatology', weight: 8 }] },
  { slug: 'child-fever', label: 'Child fever', bodySystem: 'pediatric', synonyms: ['baby fever', 'toddler temperature'], specialties: [{ slug: 'pediatrics', weight: 9 }] },
  { slug: 'child-cough', label: 'Child cough', bodySystem: 'pediatric', synonyms: ['baby cough', 'toddler cough'], specialties: [{ slug: 'pediatrics', weight: 9 }] },
  { slug: 'vaccination-consult', label: 'Vaccination consult', bodySystem: 'pediatric', synonyms: ['immunization schedule', 'vaccine advice'], specialties: [{ slug: 'pediatrics', weight: 8 }] },
  { slug: 'growth-concern', label: 'Growth concern', bodySystem: 'pediatric', synonyms: ['development delay', 'underweight child'], specialties: [{ slug: 'pediatrics', weight: 7 }] },
  { slug: 'anxiety', label: 'Anxiety', bodySystem: 'mental', synonyms: ['nervousness', 'worry', 'unease'], specialties: [{ slug: 'psychiatry', weight: 9 }] },
  { slug: 'depression', label: 'Depression', bodySystem: 'mental', synonyms: ['low mood', 'sadness', 'hopelessness'], specialties: [{ slug: 'psychiatry', weight: 9 }] },
  { slug: 'insomnia', label: 'Insomnia', bodySystem: 'mental', synonyms: ["can't sleep", 'sleep trouble', 'sleeplessness'], specialties: [{ slug: 'psychiatry', weight: 8 }] },
  { slug: 'panic-attack', label: 'Panic attacks', bodySystem: 'mental', synonyms: ['sudden fear', 'panic episodes'], specialties: [{ slug: 'psychiatry', weight: 9 }] },
  { slug: 'back-pain', label: 'Back pain', bodySystem: 'musculoskeletal', synonyms: ['lower back pain', 'sciatica'], specialties: [{ slug: 'orthopedics', weight: 8 }] },
  { slug: 'joint-pain', label: 'Joint pain', bodySystem: 'musculoskeletal', synonyms: ['arthritis', 'aching joints', 'stiff joints'], specialties: [{ slug: 'orthopedics', weight: 8 }] },
  { slug: 'sports-injury', label: 'Sports injury', bodySystem: 'musculoskeletal', synonyms: ['sprain', 'strain', 'pulled muscle'], specialties: [{ slug: 'orthopedics', weight: 9 }] },
  { slug: 'knee-pain', label: 'Knee pain', bodySystem: 'musculoskeletal', synonyms: ['knee injury', 'knee swelling'], specialties: [{ slug: 'orthopedics', weight: 8 }] },
  { slug: 'neck-pain', label: 'Neck pain', bodySystem: 'musculoskeletal', synonyms: ['stiff neck', 'cervical pain'], specialties: [{ slug: 'orthopedics', weight: 7 }] },
];

// ───────────────────────────── Doctors ─────────────────────────────

type DoctorSeed = {
  key: string;
  email: string;
  firstName: string;
  lastName: string;
  title: string;
  licenseNumber: string;
  yearsOfExperience: number;
  consultationFee: number;
  languages: string[];
  timezone: string;
  bio: string;
  status: 'APPROVED' | 'PENDING';
  specializations: { slug: string; isPrimary: boolean }[];
  rules: [weekday: number, startMinute: number, endMinute: number][];
};

const DOCTORS: DoctorSeed[] = [
  {
    key: 'chen', email: 'dr.chen@sickdoc.dev', firstName: 'Mei', lastName: 'Chen', title: 'MD',
    licenseNumber: 'PH-100001', yearsOfExperience: 11, consultationFee: 1500,
    languages: ['English', 'Filipino'], timezone: 'Asia/Manila',
    bio: 'Cardiologist focused on preventive care and hypertension management.',
    status: 'APPROVED',
    specializations: [{ slug: 'cardiology', isPrimary: true }],
    rules: [[1, 540, 1020], [2, 540, 1020], [3, 540, 1020], [4, 540, 1020], [5, 540, 1020]],
  },
  {
    key: 'santos', email: 'dr.santos@sickdoc.dev', firstName: 'Rafael', lastName: 'Santos', title: 'MD',
    licenseNumber: 'PH-100002', yearsOfExperience: 15, consultationFee: 1800,
    languages: ['English', 'Filipino', 'Spanish'], timezone: 'Asia/Manila',
    bio: 'Cardiologist and internist with a focus on chronic disease management.',
    status: 'APPROVED',
    specializations: [{ slug: 'cardiology', isPrimary: true }, { slug: 'internal-medicine', isPrimary: false }],
    rules: [[1, 480, 960], [2, 480, 960], [3, 480, 960], [4, 480, 960], [5, 480, 960], [6, 540, 780]],
  },
  {
    key: 'reyes', email: 'dr.reyes@sickdoc.dev', firstName: 'Anna', lastName: 'Reyes', title: 'MD',
    licenseNumber: 'PH-100003', yearsOfExperience: 8, consultationFee: 1200,
    languages: ['English', 'Filipino'], timezone: 'Asia/Manila',
    bio: 'Dermatologist specialising in acne, eczema, and preventive skin health.',
    status: 'APPROVED',
    specializations: [{ slug: 'dermatology', isPrimary: true }],
    rules: [[1, 540, 1080], [3, 540, 1080], [5, 540, 1080]],
  },
  {
    key: 'cruz', email: 'dr.cruz@sickdoc.dev', firstName: 'Miguel', lastName: 'Cruz', title: 'MD',
    licenseNumber: 'PH-100004', yearsOfExperience: 12, consultationFee: 1300,
    languages: ['English', 'Filipino'], timezone: 'Asia/Manila',
    bio: 'Pediatrician covering well-child visits, vaccinations, and childhood illness.',
    status: 'APPROVED',
    specializations: [{ slug: 'pediatrics', isPrimary: true }],
    rules: [[1, 480, 1020], [2, 480, 1020], [3, 480, 1020], [4, 480, 1020], [5, 480, 1020]],
  },
  {
    key: 'lim', email: 'dr.lim@sickdoc.dev', firstName: 'Sofia', lastName: 'Lim', title: 'MD',
    licenseNumber: 'PH-100005', yearsOfExperience: 6, consultationFee: 1100,
    languages: ['English', 'Filipino'], timezone: 'Asia/Manila',
    bio: 'Pediatrician with a gentle approach to newborn and toddler care.',
    status: 'APPROVED',
    specializations: [{ slug: 'pediatrics', isPrimary: true }],
    rules: [[2, 540, 960], [4, 540, 960], [6, 540, 960]],
  },
  {
    key: 'garcia', email: 'dr.garcia@sickdoc.dev', firstName: 'Elena', lastName: 'Garcia', title: 'MD',
    licenseNumber: 'PH-100006', yearsOfExperience: 18, consultationFee: 1400,
    languages: ['English', 'Filipino'], timezone: 'Asia/Manila',
    bio: 'Internist focused on adult primary care and preventive screening.',
    status: 'APPROVED',
    specializations: [{ slug: 'internal-medicine', isPrimary: true }],
    rules: [[1, 540, 1020], [2, 540, 1020], [3, 540, 1020], [4, 540, 1020], [5, 540, 1020]],
  },
  {
    key: 'bautista', email: 'dr.bautista@sickdoc.dev', firstName: 'Paolo', lastName: 'Bautista', title: 'MD',
    licenseNumber: 'PH-100007', yearsOfExperience: 9, consultationFee: 1600,
    languages: ['English', 'Filipino'], timezone: 'Asia/Manila',
    bio: 'Psychiatrist for anxiety, mood, and sleep disorders.',
    status: 'APPROVED',
    specializations: [{ slug: 'psychiatry', isPrimary: true }],
    rules: [[1, 600, 1140], [2, 600, 1140], [3, 600, 1140], [4, 600, 1140]],
  },
  {
    key: 'tan', email: 'dr.tan@sickdoc.dev', firstName: 'Grace', lastName: 'Tan', title: 'MD',
    licenseNumber: 'PH-100008', yearsOfExperience: 14, consultationFee: 1500,
    languages: ['English', 'Filipino'], timezone: 'Asia/Manila',
    bio: 'Orthopedic surgeon covering sports injuries, joint, and spine conditions.',
    status: 'APPROVED',
    specializations: [{ slug: 'orthopedics', isPrimary: true }],
    rules: [[1, 540, 1020], [2, 540, 1020], [3, 540, 1020], [4, 540, 1020], [5, 540, 1020]],
  },
  {
    key: 'doe', email: 'dr.doe@sickdoc.dev', firstName: 'John', lastName: 'Doe', title: 'MD',
    licenseNumber: 'PH-100009', yearsOfExperience: 4, consultationFee: 1000,
    languages: ['English'], timezone: 'Asia/Manila',
    bio: 'Internist awaiting credential review.',
    status: 'PENDING',
    specializations: [{ slug: 'internal-medicine', isPrimary: true }],
    rules: [[1, 540, 1020], [2, 540, 1020], [3, 540, 1020], [4, 540, 1020], [5, 540, 1020]],
  },
];

// ───────────────────────────── Patients ─────────────────────────────

type PatientSeed = {
  key: string;
  email: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  sex: string;
  weightKg: number;
  heightCm: number;
  phone: string;
  addressLine: string;
  city: string;
  country: string;
  medicalHistory: string;
  allergies: string[];
  conditions: string[];
};

const PATIENTS: PatientSeed[] = [
  {
    key: 'ada', email: 'ada@sickdoc.dev', firstName: 'Ada', lastName: 'Lovelace',
    birthDate: '1990-12-10', sex: 'Female', weightKg: 64.5, heightCm: 165,
    phone: '+63 917 000 0001', addressLine: '12 Binary Street', city: 'Manila', country: 'Philippines',
    medicalHistory: 'Mild asthma; no surgeries.', allergies: ['Penicillin'], conditions: ['Asthma'],
  },
  {
    key: 'grace', email: 'grace@sickdoc.dev', firstName: 'Grace', lastName: 'Hopper',
    birthDate: '1985-03-22', sex: 'Female', weightKg: 58, heightCm: 160,
    phone: '+63 917 000 0002', addressLine: '7 Compiler Avenue', city: 'Quezon City', country: 'Philippines',
    medicalHistory: 'Hypertension under control.', allergies: [], conditions: ['Hypertension'],
  },
  {
    key: 'alan', email: 'alan@sickdoc.dev', firstName: 'Alan', lastName: 'Turing',
    birthDate: '1988-06-15', sex: 'Male', weightKg: 72, heightCm: 178,
    phone: '+63 917 000 0003', addressLine: '42 Enigma Lane', city: 'Makati', country: 'Philippines',
    medicalHistory: 'No known chronic conditions.', allergies: ['Sulfa drugs'], conditions: [],
  },
  {
    key: 'margaret', email: 'margaret@sickdoc.dev', firstName: 'Margaret', lastName: 'Hamilton',
    birthDate: '1992-08-17', sex: 'Female', weightKg: 55, heightCm: 158,
    phone: '+63 917 000 0004', addressLine: '9 Apollo Way', city: 'Taguig', country: 'Philippines',
    medicalHistory: 'Seasonal allergies.', allergies: ['Pollen'], conditions: ['Allergic rhinitis'],
  },
  {
    key: 'barbara', email: 'barbara@sickdoc.dev', firstName: 'Barbara', lastName: 'Liskov',
    birthDate: '1979-11-07', sex: 'Female', weightKg: 68, heightCm: 162,
    phone: '+63 917 000 0005', addressLine: '3 Abstraction Road', city: 'Pasig', country: 'Philippines',
    medicalHistory: 'Type 2 diabetes, diet-managed.', allergies: [], conditions: ['Type 2 diabetes'],
  },
];

// ───────────────────────────── Appointments ─────────────────────────────

type NoteSeed = {
  subjective?: string;
  objective?: string;
  assessment: string;
  plan: string;
  summary: string;
  followUpInDays: number;
};

type PrescriptionSeed = {
  notes?: string;
  validUntilInDays: number;
  items: { drugName: string; dosage: string; frequency: string; durationDays?: number; instructions?: string }[];
};

type AppointmentSeed = {
  patient: string;
  doctor: string;
  startsAt: Date;
  status: AppointmentStatus;
  reason: string;
  symptomSlugs: string[];
  cancelledBy?: 'PATIENT';
  cancellationReason?: string;
  note?: NoteSeed;
  prescription?: PrescriptionSeed;
};

const APPOINTMENTS: AppointmentSeed[] = [
  // ── Completed (past) with notes and prescriptions ──
  {
    patient: 'ada', doctor: 'chen', startsAt: toSlot(at(-10 * DAY + 1 * HOUR)),
    status: AppointmentStatus.COMPLETED,
    reason: 'Chest tightness on exertion',
    symptomSlugs: ['chest-pain', 'shortness-of-breath'],
    note: {
      subjective: 'Tightness across the chest when climbing stairs, relieved by rest.',
      objective: 'BP 135/85, HR 78, regular. No murmurs.',
      assessment: 'Stable angina, suspected.',
      plan: 'ECG, start low-dose aspirin, review in 2 weeks.',
      summary: 'Discussed exertional chest tightness; advised ECG and follow-up.',
      followUpInDays: 14,
    },
    prescription: {
      notes: 'Take with food.',
      validUntilInDays: 30,
      items: [{ drugName: 'Aspirin', dosage: '81 mg', frequency: 'once daily', durationDays: 30, instructions: 'Morning, after breakfast' }],
    },
  },
  {
    patient: 'grace', doctor: 'santos', startsAt: toSlot(at(-20 * DAY + 2 * HOUR)),
    status: AppointmentStatus.COMPLETED,
    reason: 'Routine check-up and blood pressure review',
    symptomSlugs: ['high-blood-pressure'],
    note: {
      subjective: 'Feeling well, occasional morning headache.',
      objective: 'BP 142/90 on repeat reading.',
      assessment: 'Hypertension, stage 1.',
      plan: 'Continue lifestyle changes, start amlodipine, recheck in 4 weeks.',
      summary: 'Reviewed blood pressure; started medication and scheduled recheck.',
      followUpInDays: 28,
    },
    prescription: {
      validUntilInDays: 60,
      items: [{ drugName: 'Amlodipine', dosage: '5 mg', frequency: 'once daily', durationDays: 60, instructions: 'Evening, same time each day' }],
    },
  },
  {
    patient: 'alan', doctor: 'bautista', startsAt: toSlot(at(-30 * DAY + 3 * HOUR)),
    status: AppointmentStatus.COMPLETED,
    reason: 'Persistent low mood and difficulty sleeping',
    symptomSlugs: ['depression', 'insomnia'],
    note: {
      subjective: 'Two months of low mood, early waking, reduced interest in usual activities.',
      objective: 'PHQ-9 14. No suicidal ideation.',
      assessment: 'Moderate depressive episode.',
      plan: 'Start sertraline, weekly follow-up, sleep hygiene plan.',
      summary: 'Started medication and agreed a follow-up schedule for mood symptoms.',
      followUpInDays: 7,
    },
    prescription: {
      validUntilInDays: 90,
      items: [{ drugName: 'Sertraline', dosage: '50 mg', frequency: 'once daily', durationDays: 90, instructions: 'Morning, with food' }],
    },
  },
  {
    patient: 'margaret', doctor: 'tan', startsAt: toSlot(at(-14 * DAY + 1 * HOUR)),
    status: AppointmentStatus.COMPLETED,
    reason: 'Knee pain after running',
    symptomSlugs: ['knee-pain'],
    note: {
      subjective: 'Anterior knee pain after a 10 km run, worse on stairs.',
      objective: 'Mild swelling, full range of motion, no instability.',
      assessment: 'Patellofemoral pain syndrome.',
      plan: 'Relative rest, quadriceps strengthening, ibuprofen as needed.',
      summary: 'Advised rest and a home exercise programme for the knee.',
      followUpInDays: 21,
    },
    prescription: {
      notes: 'Take with food; stop if stomach upset.',
      validUntilInDays: 14,
      items: [{ drugName: 'Ibuprofen', dosage: '400 mg', frequency: 'three times daily', durationDays: 14, instructions: 'After meals, as needed for pain' }],
    },
  },
  {
    patient: 'barbara', doctor: 'garcia', startsAt: toSlot(at(-25 * DAY + 2 * HOUR)),
    status: AppointmentStatus.COMPLETED,
    reason: 'Persistent cough and fever',
    symptomSlugs: ['cough', 'fever'],
    note: {
      subjective: 'Dry cough and fever for five days, no shortness of breath.',
      objective: 'Temp 38.2 C, clear chest on auscultation.',
      assessment: 'Upper respiratory tract infection.',
      plan: 'Supportive care, amoxicillin course, return if symptoms worsen.',
      summary: 'Diagnosed an upper respiratory infection and prescribed antibiotics.',
      followUpInDays: 10,
    },
    prescription: {
      validUntilInDays: 7,
      items: [{ drugName: 'Amoxicillin', dosage: '500 mg', frequency: 'three times daily', durationDays: 7, instructions: 'Complete the full course' }],
    },
  },

  // ── Upcoming (future, CONFIRMED) ──
  {
    patient: 'ada', doctor: 'chen', startsAt: toSlot(at(2 * DAY + 1 * HOUR)),
    status: AppointmentStatus.CONFIRMED,
    reason: 'Follow-up on ECG results',
    symptomSlugs: ['chest-pain'],
  },
  {
    patient: 'grace', doctor: 'reyes', startsAt: toSlot(at(3 * DAY + 2 * HOUR)),
    status: AppointmentStatus.CONFIRMED,
    reason: 'Acne follow-up',
    symptomSlugs: ['acne'],
  },
  {
    patient: 'alan', doctor: 'cruz', startsAt: toSlot(at(4 * DAY + 1 * HOUR)),
    status: AppointmentStatus.CONFIRMED,
    reason: 'Persistent cough',
    symptomSlugs: ['cough'],
  },
  {
    // Starts within the demo join window: the next 30-minute boundary from now.
    patient: 'barbara', doctor: 'garcia', startsAt: ceilToSlot(at(20 * MINUTE)),
    status: AppointmentStatus.CONFIRMED,
    reason: 'Follow-up on lab results',
    symptomSlugs: ['fatigue'],
  },

  // ── Cancelled ──
  {
    patient: 'margaret', doctor: 'reyes', startsAt: toSlot(at(-3 * DAY + 3 * HOUR)),
    status: AppointmentStatus.CANCELLED,
    reason: 'Skin rash consult',
    symptomSlugs: ['rash'],
    cancelledBy: 'PATIENT',
    cancellationReason: 'Schedule conflict',
  },
];

// ───────────────────────────── Helpers ─────────────────────────────

const passwordCache = new Map<string, string>();

async function hashPassword(password: string): Promise<string> {
  const cached = passwordCache.get(password);
  if (cached) return cached;
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  passwordCache.set(password, hash);
  return hash;
}

// ───────────────────────────── Main ─────────────────────────────

async function main(): Promise<void> {
  // 1. Specializations
  const specIdBySlug = new Map<string, string>();
  for (const spec of SPECIALIZATIONS) {
    const row = await prisma.specialization.upsert({
      where: { slug: spec.slug },
      update: { name: spec.name, description: spec.description, iconKey: spec.iconKey },
      create: spec,
    });
    specIdBySlug.set(spec.slug, row.id);
  }

  // 2. Symptoms
  const symptomIdBySlug = new Map<string, string>();
  for (const symptom of SYMPTOMS) {
    const { specialties, ...rest } = symptom;
    const row = await prisma.symptom.upsert({
      where: { slug: symptom.slug },
      update: rest,
      create: rest,
    });
    symptomIdBySlug.set(symptom.slug, row.id);
  }

  // 3. Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sickdoc.dev' },
    update: {},
    create: {
      email: 'admin@sickdoc.dev',
      passwordHash: await hashPassword(ADMIN_PASSWORD),
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  // 4. Doctors
  const doctorProfileIdByKey = new Map<string, string>();
  const doctorUserIdByKey = new Map<string, string>();
  for (const doctor of DOCTORS) {
    const user = await prisma.user.upsert({
      where: { email: doctor.email },
      update: { role: Role.DOCTOR },
      create: {
        email: doctor.email,
        passwordHash: await hashPassword(SEED_PASSWORD),
        role: Role.DOCTOR,
        status: UserStatus.ACTIVE,
      },
    });

    const profile = await prisma.doctorProfile.upsert({
      where: { userId: user.id },
      update: {
        firstName: doctor.firstName,
        lastName: doctor.lastName,
        title: doctor.title,
        bio: doctor.bio,
        licenseNumber: doctor.licenseNumber,
        yearsOfExperience: doctor.yearsOfExperience,
        consultationFee: doctor.consultationFee,
        languages: doctor.languages,
        timezone: doctor.timezone,
        status: doctor.status === 'APPROVED' ? DoctorStatus.APPROVED : DoctorStatus.PENDING,
        reviewedByUserId: doctor.status === 'APPROVED' ? admin.id : null,
        reviewedAt: doctor.status === 'APPROVED' ? at(-10 * DAY) : null,
        avatarColor: AVATAR_COLORS[DOCTORS.indexOf(doctor) % AVATAR_COLORS.length],
      },
      create: {
        userId: user.id,
        firstName: doctor.firstName,
        lastName: doctor.lastName,
        title: doctor.title,
        bio: doctor.bio,
        licenseNumber: doctor.licenseNumber,
        yearsOfExperience: doctor.yearsOfExperience,
        consultationFee: doctor.consultationFee,
        languages: doctor.languages,
        timezone: doctor.timezone,
        status: doctor.status === 'APPROVED' ? DoctorStatus.APPROVED : DoctorStatus.PENDING,
        reviewedByUserId: doctor.status === 'APPROVED' ? admin.id : null,
        reviewedAt: doctor.status === 'APPROVED' ? at(-10 * DAY) : null,
        avatarColor: AVATAR_COLORS[DOCTORS.indexOf(doctor) % AVATAR_COLORS.length],
      },
    });
    doctorProfileIdByKey.set(doctor.key, profile.id);
    doctorUserIdByKey.set(doctor.key, user.id);
  }

  // 5. Patients
  const patientProfileIdByKey = new Map<string, string>();
  const patientUserIdByKey = new Map<string, string>();
  for (const patient of PATIENTS) {
    const user = await prisma.user.upsert({
      where: { email: patient.email },
      update: { role: Role.PATIENT },
      create: {
        email: patient.email,
        passwordHash: await hashPassword(SEED_PASSWORD),
        role: Role.PATIENT,
        status: UserStatus.ACTIVE,
      },
    });

    const profile = await prisma.patientProfile.upsert({
      where: { userId: user.id },
      update: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        birthDate: dateOnly(patient.birthDate),
        sex: patient.sex,
        weightKg: patient.weightKg,
        heightCm: patient.heightCm,
        phone: patient.phone,
        addressLine: patient.addressLine,
        city: patient.city,
        country: patient.country,
        medicalHistory: patient.medicalHistory,
        allergies: patient.allergies,
        conditions: patient.conditions,
        avatarColor: AVATAR_COLORS[(DOCTORS.length + PATIENTS.indexOf(patient)) % AVATAR_COLORS.length],
      },
      create: {
        userId: user.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        birthDate: dateOnly(patient.birthDate),
        sex: patient.sex,
        weightKg: patient.weightKg,
        heightCm: patient.heightCm,
        phone: patient.phone,
        addressLine: patient.addressLine,
        city: patient.city,
        country: patient.country,
        medicalHistory: patient.medicalHistory,
        allergies: patient.allergies,
        conditions: patient.conditions,
        avatarColor: AVATAR_COLORS[(DOCTORS.length + PATIENTS.indexOf(patient)) % AVATAR_COLORS.length],
      },
    });
    patientProfileIdByKey.set(patient.key, profile.id);
    patientUserIdByKey.set(patient.key, user.id);
  }

  // 6. Doctor ↔ Specialization links (rebuilt each run)
  for (const doctor of DOCTORS) {
    const doctorProfileId = doctorProfileIdByKey.get(doctor.key)!;
    await prisma.doctorSpecialization.deleteMany({ where: { doctorProfileId } });
    await prisma.doctorSpecialization.createMany({
      data: doctor.specializations.map((link) => ({
        doctorProfileId,
        specializationId: specIdBySlug.get(link.slug)!,
        isPrimary: link.isPrimary,
      })),
    });
  }

  // 7. Availability rules + exceptions (rebuilt each run)
  for (const doctor of DOCTORS) {
    const doctorProfileId = doctorProfileIdByKey.get(doctor.key)!;
    await prisma.availabilityRule.deleteMany({ where: { doctorProfileId } });
    await prisma.availabilityRule.createMany({
      data: doctor.rules.map(([weekday, startMinute, endMinute]) => ({
        doctorProfileId,
        weekday,
        startMinute,
        endMinute,
        slotMinutes: 30,
        isActive: true,
      })),
    });

    await prisma.availabilityException.deleteMany({ where: { doctorProfileId } });
  }
  // One blocked morning for Dr. Chen so slot derivation has an exception to subtract.
  const chenProfileId = doctorProfileIdByKey.get('chen')!;
  await prisma.availabilityException.create({
    data: {
      doctorProfileId: chenProfileId,
      startsAt: toSlot(at(1 * DAY + 1 * HOUR)),
      endsAt: toSlot(at(1 * DAY + 3 * HOUR)),
      reason: 'Conference',
    },
  });

  // 8. Symptom ↔ Specialty mappings (rebuilt each run)
  await prisma.symptomSpecialty.deleteMany({});
  const symptomSpecialtyRows = SYMPTOMS.flatMap((symptom) =>
    symptom.specialties.map((link) => ({
      symptomId: symptomIdBySlug.get(symptom.slug)!,
      specializationId: specIdBySlug.get(link.slug)!,
      weight: link.weight,
    })),
  );
  await prisma.symptomSpecialty.createMany({ data: symptomSpecialtyRows });

  // 9. Appointments, sessions, notes, prescriptions (rebuilt each run)
  const seededPatientIds = [...patientProfileIdByKey.values()];
  const seededDoctorIds = [...doctorProfileIdByKey.values()];
  await prisma.appointment.deleteMany({
    where: {
      OR: [
        { patientProfileId: { in: seededPatientIds } },
        { doctorProfileId: { in: seededDoctorIds } },
      ],
    },
  });

  // Notifications are rebuilt alongside appointments; clear seeded recipients'
  // rows first so a re-run does not duplicate them.
  const seededUserIds = [...doctorUserIdByKey.values(), ...patientUserIdByKey.values(), admin.id];
  await prisma.notification.deleteMany({ where: { userId: { in: seededUserIds } } });

  for (const appt of APPOINTMENTS) {
    const patientProfileId = patientProfileIdByKey.get(appt.patient)!;
    const doctorProfileId = doctorProfileIdByKey.get(appt.doctor)!;
    const doctorUserId = doctorUserIdByKey.get(appt.doctor)!;
    const patientUserId = patientUserIdByKey.get(appt.patient)!;
    const endsAt = new Date(appt.startsAt.getTime() + 30 * MINUTE);

    const appointment = await prisma.appointment.create({
      data: {
        patientProfileId,
        doctorProfileId,
        startsAt: appt.startsAt,
        endsAt,
        status: appt.status,
        reason: appt.reason,
        symptomIds: appt.symptomSlugs.map((slug) => symptomIdBySlug.get(slug)!),
        cancelledBy: appt.cancelledBy ?? null,
        cancellationReason: appt.cancellationReason ?? null,
        cancelledAt: appt.status === AppointmentStatus.CANCELLED ? appt.startsAt : null,
      },
    });

    const sessionData = {
      appointmentId: appointment.id,
      status:
        appt.status === AppointmentStatus.COMPLETED
          ? SessionStatus.COMPLETED
          : appt.status === AppointmentStatus.CANCELLED
            ? SessionStatus.CANCELLED
            : SessionStatus.SCHEDULED,
      startedAt: appt.status === AppointmentStatus.COMPLETED ? appt.startsAt : null,
      endedAt: appt.status === AppointmentStatus.COMPLETED ? endsAt : null,
      durationSeconds: appt.status === AppointmentStatus.COMPLETED ? 1800 : null,
    };
    await prisma.consultationSession.create({ data: sessionData });

    if (appt.note) {
      await prisma.consultationNote.create({
        data: {
          appointmentId: appointment.id,
          authorUserId: doctorUserId,
          subjective: appt.note.subjective ?? null,
          objective: appt.note.objective ?? null,
          assessment: appt.note.assessment,
          plan: appt.note.plan,
          summary: appt.note.summary,
          followUpAt: at(appt.note.followUpInDays * DAY),
        },
      });
    }

    if (appt.prescription) {
      await prisma.prescription.create({
        data: {
          appointmentId: appointment.id,
          issuedByUserId: doctorUserId,
          patientProfileId,
          notes: appt.prescription.notes ?? null,
          validUntil: at(appt.prescription.validUntilInDays * DAY),
          items: { create: appt.prescription.items },
        },
      });
    }

    // Notifications tied to the appointment.
    if (appt.status === AppointmentStatus.CONFIRMED) {
      await prisma.notification.create({
        data: {
          userId: patientUserId,
          type: NotificationType.APPOINTMENT_BOOKED,
          title: 'Appointment booked',
          body: `Your consultation is scheduled for ${appt.startsAt.toISOString()}.`,
          appointmentId: appointment.id,
        },
      });
      await prisma.notification.create({
        data: {
          userId: doctorUserId,
          type: NotificationType.APPOINTMENT_BOOKED,
          title: 'New appointment',
          body: `A patient has booked ${appt.startsAt.toISOString()}.`,
          appointmentId: appointment.id,
        },
      });
    }

    if (appt.status === AppointmentStatus.COMPLETED && appt.note) {
      await prisma.notification.create({
        data: {
          userId: patientUserId,
          type: NotificationType.NOTE_AVAILABLE,
          title: 'Consultation note available',
          body: 'Your doctor has shared the consultation note.',
          appointmentId: appointment.id,
        },
      });
    }

    if (appt.status === AppointmentStatus.COMPLETED && appt.prescription) {
      await prisma.notification.create({
        data: {
          userId: patientUserId,
          type: NotificationType.PRESCRIPTION_ISSUED,
          title: 'Prescription issued',
          body: 'A new prescription has been added to your records.',
          appointmentId: appointment.id,
        },
      });
    }
  }

  // 10. Audit log for the approved doctors (admin actions).
  await prisma.auditLog.deleteMany({ where: { actorUserId: admin.id } });
  for (const doctor of DOCTORS) {
    if (doctor.status !== 'APPROVED') continue;
    await prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: AuditAction.DOCTOR_APPROVED,
        entityType: 'DoctorProfile',
        entityId: doctorProfileIdByKey.get(doctor.key)!,
        reason: 'Credentials verified',
        createdAt: at(-10 * DAY),
      },
    });
  }

  const counts = {
    specializations: await prisma.specialization.count(),
    symptoms: await prisma.symptom.count(),
    symptomSpecialties: await prisma.symptomSpecialty.count(),
    users: await prisma.user.count(),
    doctors: await prisma.doctorProfile.count(),
    patients: await prisma.patientProfile.count(),
    availabilityRules: await prisma.availabilityRule.count(),
    appointments: await prisma.appointment.count(),
    sessions: await prisma.consultationSession.count(),
    notes: await prisma.consultationNote.count(),
    prescriptions: await prisma.prescription.count(),
    notifications: await prisma.notification.count(),
    auditLogs: await prisma.auditLog.count(),
  };

  console.log('Seed complete:', counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
