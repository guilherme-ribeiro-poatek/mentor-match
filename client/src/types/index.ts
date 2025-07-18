export type UserType = 'mentor' | 'mentee';

export type AbilityType = 
  | 'User Experience (UX)'
  | 'User Interface (UI)'
  | 'Information Architecture'
  | 'Prototyping (Interactive)'
  | 'Accessibility'
  | 'Visual Design'
  | 'Graphic Design & Typography'
  | 'Data Visualization'
  | 'Motion Design'
  | 'Interaction Design'
  | 'Content Design'
  | 'Game Design'
  | 'Storytelling/Presentation'
  | 'Branding/Logos'
  | 'Illustration'
  | '3D Modeling & Rendering'
  | 'AI-Based Design Tools (LLMs, Generative AI, Plugins)'
  | 'Figma Proficiency'
  | 'Creativity/Concept Development';

export const ABILITIES: AbilityType[] = [
  'User Experience (UX)',
  'User Interface (UI)',
  'Information Architecture',
  'Prototyping (Interactive)',
  'Accessibility',
  'Visual Design',
  'Graphic Design & Typography',
  'Data Visualization',
  'Motion Design',
  'Interaction Design',
  'Content Design',
  'Game Design',
  'Storytelling/Presentation',
  'Branding/Logos',
  'Illustration',
  '3D Modeling & Rendering',
  'AI-Based Design Tools (LLMs, Generative AI, Plugins)',
  'Figma Proficiency',
  'Creativity/Concept Development'
];

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
  abilities?: AbilityType[]; // For mentors
}

export interface Match {
  partnerId: string;
  partnerEmail: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  abilities?: AbilityType[]; // For mentors, displayed to mentees
}

export interface UserData {
  userId: string;
  email: string;
  userType: UserType;
  selectedSlots: TimeSlot[];
  abilities?: AbilityType[]; // For mentors
} 