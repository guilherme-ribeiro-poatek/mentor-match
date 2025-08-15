import { WeekOption } from '../types';

// Get the Monday of a given week (week key format)
export const getWeekKey = (date: Date): string => {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD format
};

// Get current week key
export const getCurrentWeekKey = (): string => {
  return getWeekKey(new Date());
};

// Generate available weeks (current week + next 8 weeks = 9 weeks total)
export const generateAvailableWeeks = (numWeeks: number = 9): WeekOption[] => {
  const weeks: WeekOption[] = [];
  const today = new Date();
  
  for (let i = 0; i < numWeeks; i++) {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + (i * 7) - today.getDay() + 1); // Get Monday of the week
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Get Sunday of the week
    
    const weekKey = getWeekKey(weekStart);
    
    let label: string;
    if (i === 0) {
      label = 'This Week';
    } else if (i === 1) {
      label = 'Next Week';
    } else {
      label = `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    
    weeks.push({
      weekKey,
      label,
      startDate: new Date(weekStart),
      endDate: new Date(weekEnd)
    });
  }
  
  return weeks;
};

// Get week dates for a specific week key
export const getWeekDates = (weekKey: string): Date[] => {
  const [year, month, day] = weekKey.split('-').map(Number);
  const monday = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
  
  const weekDates = [];
  // Start from Sunday (go back 1 day from Monday)
  const startDate = new Date(monday);
  startDate.setDate(monday.getDate() - 1);
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    weekDates.push(date);
  }
  
  return weekDates;
};

// Check if a date is in the past (considering time)
export const isDateInPast = (date: Date): boolean => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return compareDate < today;
};

// Get the actual date for a specific day of week within a week
export const getDateForWeekDay = (weekKey: string, dayOfWeek: number): Date => {
  const weekDates = getWeekDates(weekKey);
  return weekDates[dayOfWeek];
};

// Format a date to show "Month Day" (e.g., "August 23")
export const formatDateLong = (date: Date): string => {
  return date.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric' 
  });
};

// Get day name from date
export const getDayNameFromDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
};
