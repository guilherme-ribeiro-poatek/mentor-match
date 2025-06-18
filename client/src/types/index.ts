export type UserType = 'mentor' | 'mentee';

export interface TimeSlot {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  startTime: string; // Format: "HH:MM"
  endTime: string;   // Format: "HH:MM"
}

export interface User {
  id: string;
  email: string;
  userType: UserType;
  availability: TimeSlot[];
}

export interface Match {
  partnerId: string;
  partnerEmail: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
}

export interface UserData {
  userId: string;
  email: string;
  userType: UserType;
  selectedSlots: TimeSlot[];
} 