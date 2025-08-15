import React, { useState } from 'react';
import { TimeSlot, UserType, WeekAvailability } from '../types';
import { getWeekDates, isDateInPast } from '../utils/weekUtils';

interface WeeklyCalendarProps {
  selectedSlots: TimeSlot[];
  onSlotsChange: (slots: TimeSlot[]) => void;
  selectedWeekKey: string;
  weekAvailability: WeekAvailability[];
  isLoadingAvailability: boolean;
  userType: UserType;
}

const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  selectedSlots,
  onSlotsChange,
  selectedWeekKey,
  weekAvailability,
  isLoadingAvailability,
  userType,
}) => {
  // Get the dates for the selected week
  const weekDates = getWeekDates(selectedWeekKey);
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const isCurrentDay = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };



  // Days of the week (0 = Sunday)
  const days = [
    { name: 'Sunday', short: 'Sun', value: 0 },
    { name: 'Monday', short: 'Mon', value: 1 },
    { name: 'Tuesday', short: 'Tue', value: 2 },
    { name: 'Wednesday', short: 'Wed', value: 3 },
    { name: 'Thursday', short: 'Thu', value: 4 },
    { name: 'Friday', short: 'Fri', value: 5 },
    { name: 'Saturday', short: 'Sat', value: 6 },
  ];

  // Generate time slots from 8 AM to 8 PM in 30-minute intervals
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 19; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === 19 && minute > 0) break; // Stop at 8:00 PM
        
        const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const endHour = minute === 30 ? hour + 1 : hour;
        const endMinute = minute === 30 ? 0 : minute + 30;
        const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
        
        slots.push({ startTime, endTime });
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const formatTimeDisplay = (time: string): string => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const isSlotSelected = (dayOfWeek: number, startTime: string, endTime: string): boolean => {
    return selectedSlots.some(
      slot => 
        slot.dayOfWeek === dayOfWeek && 
        slot.startTime === startTime && 
        slot.endTime === endTime &&
        (slot.weekKey === selectedWeekKey || !slot.weekKey) // Support legacy slots without weekKey
    );
  };

  const getSlotAvailability = (dayOfWeek: number, startTime: string, endTime: string): WeekAvailability | null => {
    return weekAvailability.find(
      availability => 
        availability.dayOfWeek === dayOfWeek &&
        availability.startTime === startTime &&
        availability.endTime === endTime
    ) || null;
  };

  const hasAvailableUsers = (dayOfWeek: number, startTime: string, endTime: string): boolean => {
    const availability = getSlotAvailability(dayOfWeek, startTime, endTime);
    return availability !== null && availability.users.length > 0;
  };

  const toggleSlot = (dayOfWeek: number, startTime: string, endTime: string) => {
    // Check if the day is in the past - if so, don't allow selection
    const dayDate = weekDates[dayOfWeek];
    if (isDateInPast(dayDate)) {
      return;
    }

    const isSelected = isSlotSelected(dayOfWeek, startTime, endTime);

    if (isSelected) {
      // Remove the slot
      const newSlots = selectedSlots.filter(
        slot => !(
          slot.dayOfWeek === dayOfWeek && 
          slot.startTime === startTime && 
          slot.endTime === endTime &&
          (slot.weekKey === selectedWeekKey || !slot.weekKey)
        )
      );
      onSlotsChange(newSlots);
    } else {
      // Add the slot with week key
      const newSlot: TimeSlot = { 
        dayOfWeek, 
        startTime, 
        endTime, 
        weekKey: selectedWeekKey 
      };
      onSlotsChange([...selectedSlots, newSlot]);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header with days */}
      <div className="grid grid-cols-8 border-b border-gray-200">
        <div className="p-3 bg-gray-50 font-medium text-sm text-gray-600">
          Time
        </div>
        {days.map(day => {
          const dayDate = weekDates[day.value];
          const isCurrent = isCurrentDay(dayDate);
          const isPast = isDateInPast(dayDate);
          
          return (
            <div key={day.value} className={`p-3 text-center ${
              isCurrent 
                ? 'bg-primary-100' 
                : isPast 
                  ? 'bg-gray-100' 
                  : 'bg-gray-50'
            }`}>
              <div className={`font-medium text-sm ${
                isCurrent 
                  ? 'text-primary-900' 
                  : isPast 
                    ? 'text-gray-500' 
                    : 'text-gray-900'
              }`}>
                {day.name}
              </div>
              <div className={`text-xs ${
                isCurrent 
                  ? 'text-primary-700' 
                  : isPast 
                    ? 'text-gray-400' 
                    : 'text-gray-600'
              }`}>
                {formatDate(dayDate)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time slots grid */}
      <div className="max-h-96 overflow-y-auto">
        {timeSlots.map((timeSlot, timeIndex) => (
          <div key={timeIndex} className="grid grid-cols-8 border-b border-gray-100 hover:bg-gray-50">
            {/* Time label */}
            <div className="p-2 text-xs text-gray-600 bg-gray-50 flex items-center justify-center border-r border-gray-200">
              <div className="text-center">
                <div>{formatTimeDisplay(timeSlot.startTime)}</div>
                <div className="text-gray-400">-</div>
                <div>{formatTimeDisplay(timeSlot.endTime)}</div>
              </div>
            </div>

            {/* Day columns */}
            {days.map(day => {
              const selected = isSlotSelected(day.value, timeSlot.startTime, timeSlot.endTime);
              const dayDate = weekDates[day.value];
              const isPast = isDateInPast(dayDate);
              const hasUsers = hasAvailableUsers(day.value, timeSlot.startTime, timeSlot.endTime);
              const availability = getSlotAvailability(day.value, timeSlot.startTime, timeSlot.endTime);
              const slotKey = `${day.value}-${timeSlot.startTime}-${timeSlot.endTime}`;
              const isHovered = hoveredSlot === slotKey;
              
              return (
                <div
                  key={`${day.value}-${timeIndex}`}
                  className={`p-2 text-center transition-colors duration-200 border-r border-gray-100 relative ${
                    isPast
                      ? 'cursor-not-allowed bg-gray-50'
                      : selected
                        ? 'bg-primary-600 text-white hover:bg-primary-700 cursor-pointer'
                        : hasUsers
                          ? 'bg-green-50 hover:bg-green-100 cursor-pointer'
                          : 'hover:bg-primary-50 cursor-pointer'
                  }`}
                  onClick={() => toggleSlot(day.value, timeSlot.startTime, timeSlot.endTime)}
                  onMouseEnter={() => hasUsers && setHoveredSlot(slotKey)}
                  onMouseLeave={() => setHoveredSlot(null)}
                >
                  <div className={`w-full h-8 rounded flex items-center justify-center text-xs ${
                    isPast
                      ? 'bg-gray-200 text-gray-400'
                      : selected
                        ? 'bg-primary-700 text-white'
                        : hasUsers
                          ? 'bg-green-200 text-green-700 hover:bg-green-300'
                          : 'bg-gray-100 text-gray-600 hover:bg-primary-200'
                  }`}>
                    {isPast ? '×' : selected ? '✓' : hasUsers ? '👥' : '+'}
                  </div>
                  
                  {/* Tooltip */}
                  {isHovered && availability && availability.users.length > 0 && (
                    <div className="absolute z-50 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg -top-2 left-full ml-2 min-w-max max-w-xs">
                      <div className="font-medium mb-2">
                        Available {userType === 'mentor' ? 'Mentees' : 'Mentors'}:
                      </div>
                      <div className="space-y-1">
                        {availability.users.map((user, idx) => (
                          <div key={idx}>
                            <div className="font-medium">{user.email}</div>
                            {userType === 'mentee' && user.abilities && user.abilities.length > 0 && (
                              <div className="text-gray-300 text-xs mt-1">
                                {user.abilities.slice(0, 3).join(', ')}
                                {user.abilities.length > 3 && ` +${user.abilities.length - 3} more`}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {/* Triangle pointer */}
                      <div className="absolute top-3 -left-1 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-primary-600 rounded mr-2"></div>
              <span>Selected</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-200 rounded mr-2"></div>
              <span>Has {userType === 'mentor' ? 'Mentees' : 'Mentors'}</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded mr-2"></div>
              <span>Available</span>
            </div>
          </div>
          <div>
            {isLoadingAvailability && (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-600 mr-2"></div>
                <span className="text-xs">Loading availability...</span>
              </div>
            )}
            {!isLoadingAvailability && (
              <span>Click time slots to select your availability</span>
            )}
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          💡 Hover over green slots to see who's available
        </div>
      </div>
    </div>
  );
};

export default WeeklyCalendar; 