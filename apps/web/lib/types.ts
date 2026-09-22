/** Wire shapes returned by the API (subset used by the frontend). */

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Specialization {
  id: string;
  slug: string;
  name: string;
  doctorCount?: number;
  isPrimary?: boolean;
}

export interface DoctorCard {
  id: string;
  displayName: string;
  title: string | null;
  initials: string;
  avatarColor: string;
  bio: string | null;
  yearsOfExperience: number;
  languages: string[];
  timezone: string;
  consultationFee: string | null;
  specializations: Specialization[];
  nextAvailableAt: string | null;
}

export interface AppointmentCard {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  reason: string;
  patient: { id: string; displayName: string; initials: string; avatarColor: string };
  doctor: { id: string; displayName: string; initials: string; avatarColor: string; primarySpecialization: string | null };
  session: { id: string; status: string } | null;
  hasNote: boolean;
  prescriptionCount: number;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  appointmentId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface Slot {
  startsAt: string;
  endsAt: string;
  available: boolean;
}

export interface SlotDay {
  date: string;
  slots: Slot[];
}

export interface MatchingSuggestion {
  doctor: DoctorCard;
  score: number;
  nextAvailableAt: string | null;
  rationale: {
    specializations: { name: string; weight: number }[];
    availabilityBonus: number;
    experienceBonus: number;
  };
}

export interface Symptom {
  id: string;
  slug: string;
  label: string;
  bodySystem: string | null;
}
