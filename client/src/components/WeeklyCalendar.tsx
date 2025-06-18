import React from 'react';
import { TimeSlot } from '../types';

interface WeeklyCalendarProps {
  selectedSlots: TimeSlot[];
  onSlotsChange: (slots: TimeSlot[]) => void;
}

const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  selectedSlots,
  onSlotsChange,
}) => {
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
        slot.endTime === endTime
    );
  };

  const toggleSlot = (dayOfWeek: number, startTime: string, endTime: string) => {
    const slotKey = `${dayOfWeek}-${startTime}-${endTime}`;
    const isSelected = isSlotSelected(dayOfWeek, startTime, endTime);

    if (isSelected) {
      // Remove the slot
      const newSlots = selectedSlots.filter(
        slot => !(
          slot.dayOfWeek === dayOfWeek && 
          slot.startTime === startTime && 
          slot.endTime === endTime
        )
      );
      onSlotsChange(newSlots);
    } else {
      // Add the slot
      const newSlot: TimeSlot = { dayOfWeek, startTime, endTime };
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
        {days.map(day => (
          <div key={day.value} className="p-3 bg-gray-50 text-center">
            <div className="font-medium text-sm text-gray-900">{day.short}</div>
            <div className="text-xs text-gray-600">{day.name}</div>
          </div>
        ))}
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
              
              return (
                <div
                  key={`${day.value}-${timeIndex}`}
                  className={`p-2 text-center cursor-pointer transition-colors duration-200 border-r border-gray-100 ${
                    selected
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'hover:bg-primary-50'
                  }`}
                  onClick={() => toggleSlot(day.value, timeSlot.startTime, timeSlot.endTime)}
                >
                  <div className={`w-full h-8 rounded flex items-center justify-center text-xs ${
                    selected
                      ? 'bg-primary-700 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-primary-200'
                  }`}>
                    {selected ? '✓' : '+'}
                  </div>
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
              <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded mr-2"></div>
              <span>Available</span>
            </div>
          </div>
          <div>
            Click time slots to select your availability
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyCalendar; 