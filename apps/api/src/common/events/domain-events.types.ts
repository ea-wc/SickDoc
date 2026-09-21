/** In-process domain events (docs/ARCHITECTURE.md §6.5). */
export type DomainEvent =
  | { type: 'appointment.booked'; appointmentId: string; patientUserId: string; doctorUserId: string; startsAt: Date }
  | {
      type: 'appointment.rescheduled';
      appointmentId: string;
      patientUserId: string;
      doctorUserId: string;
      startsAt: Date;
      byRole: 'PATIENT' | 'DOCTOR';
    }
  | { type: 'appointment.cancelled'; appointmentId: string; patientUserId: string; doctorUserId: string; byRole: 'PATIENT' | 'DOCTOR' | 'ADMIN' }
  | { type: 'consultation.completed'; appointmentId: string; patientUserId: string }
  | { type: 'note.available'; appointmentId: string; patientUserId: string }
  | { type: 'prescription.issued'; appointmentId: string; patientUserId: string }
  | { type: 'schedule.changed'; patientUserIds: string[] }
  | { type: 'account.status_changed'; userId: string; status: 'SUSPENDED' | 'DEACTIVATED' | 'ACTIVE' }
  | { type: 'doctor.reviewed'; userId: string; decision: 'APPROVED' | 'REJECTED' };
