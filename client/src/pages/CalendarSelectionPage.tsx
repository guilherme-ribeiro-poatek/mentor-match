import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import WeeklyCalendar from '../components/WeeklyCalendar';
import WeekSelector from '../components/WeekSelector';
import { UserType, TimeSlot, AbilityType, ABILITIES, WeekOption } from '../types';
import { getCurrentWeekKey, generateAvailableWeeks } from '../utils/weekUtils';

const CalendarSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [userType, setUserType] = useState<UserType>('mentor');
  const [email, setEmail] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [selectedAbilities, setSelectedAbilities] = useState<AbilityType[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasExistingData, setHasExistingData] = useState(false);
  const [selectedWeekKey, setSelectedWeekKey] = useState(getCurrentWeekKey());
  const [availableWeeks] = useState<WeekOption[]>(generateAvailableWeeks());

  useEffect(() => {
    // Get email and user type from sessionStorage
    const storedEmail = sessionStorage.getItem('userEmail');
    const storedUserType = sessionStorage.getItem('userType') as UserType;

    if (!storedEmail || !storedUserType) {
      // Redirect to email input page if no data found
      navigate('/');
      return;
    }

    setEmail(storedEmail);
    setUserType(storedUserType);

    // Load persisted abilities for mentors
    if (storedUserType === 'mentor') {
      loadStoredAbilities(storedEmail);
    }

    // Check if user already has availability data
    checkExistingAvailability(storedEmail);
  }, [navigate]);

  const loadStoredAbilities = (email: string) => {
    const key = `abilities_${email}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const abilities = JSON.parse(stored) as AbilityType[];
        setSelectedAbilities(abilities);
      } catch (err) {
        console.error('Error parsing stored abilities:', err);
      }
    }
  };

  const saveAbilities = (email: string, abilities: AbilityType[]) => {
    const key = `abilities_${email}`;
    localStorage.setItem(key, JSON.stringify(abilities));
  };

  const checkExistingAvailability = async (email: string) => {
    try {
      const response = await fetch('/api/check-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.exists && data.availability && data.availability.length > 0) {
        // Load all availability slots (from all weeks)
        setSelectedSlots(data.availability);
        setHasExistingData(true);
      } else {
        setSelectedSlots([]);
        setHasExistingData(false);
      }
    } catch (err) {
      console.error('Error checking existing availability:', err);
      // Continue with empty slots if API call fails
      setSelectedSlots([]);
      setHasExistingData(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAbilityToggle = (ability: AbilityType) => {
    const newAbilities = selectedAbilities.includes(ability)
      ? selectedAbilities.filter(a => a !== ability)
      : [...selectedAbilities, ability];
    
    setSelectedAbilities(newAbilities);
    saveAbilities(email, newAbilities);
  };

  const handleSubmit = async () => {
    setError('');

    if (totalSlotsAcrossAllWeeks === 0) {
      setError('Please select at least one time slot from any week');
      return;
    }

    if (userType === 'mentor' && selectedAbilities.length === 0) {
      setError('Please select at least one ability you can mentor in');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          userType,
          availability: selectedSlots.map(slot => ({
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            weekKey: slot.weekKey,
          })),
          abilities: userType === 'mentor' ? selectedAbilities : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Store user data in sessionStorage for the next page
        sessionStorage.setItem('userData', JSON.stringify({
          userId: data.userId,
          email,
          userType,
          selectedSlots,
          abilities: userType === 'mentor' ? selectedAbilities : undefined,
        }));
        
        navigate('/loading');
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoBack = () => {
    navigate('/');
  };

  const handleStartOver = () => {
    setSelectedSlots([]);
    setHasExistingData(false);
    setSelectedWeekKey(getCurrentWeekKey());
  };

  const handleWeekChange = (weekKey: string) => {
    setSelectedWeekKey(weekKey);
  };

  // Get slots for the currently selected week
  const currentWeekSlots = selectedSlots.filter(slot => 
    slot.weekKey === selectedWeekKey || (!slot.weekKey && selectedWeekKey === getCurrentWeekKey())
  );

  const totalSlotsAcrossAllWeeks = selectedSlots.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-gray-600">Loading your availability...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with user info */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
                      <h2 className="text-2xl font-bold text-gray-900">
            Select Your Weekly Availability
          </h2>
            <p className="text-gray-600 mt-1">
              {userType === 'mentor' ? '👨‍🏫 Mentor' : '🎓 Mentee'} • {email}
            </p>
          </div>
          <button
            onClick={handleGoBack}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            ← Change Email
          </button>
        </div>

        {hasExistingData && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">📅 We found your previous availability</p>
                <p className="text-sm">You have {totalSlotsAcrossAllWeeks} time slot{totalSlotsAcrossAllWeeks !== 1 ? 's' : ''} across different weeks. You can edit them below or start over.</p>
              </div>
              <button
                onClick={handleStartOver}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium underline"
              >
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ability Selection for Mentors */}
      {userType === 'mentor' && (
        <div className="card">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Select Your Mentoring Abilities
          </h3>
          <p className="text-gray-600 mb-6">
            Choose the abilities you feel comfortable providing mentorship in. You can select multiple areas.
          </p>
          
          <div className="flex flex-wrap gap-2">
            {ABILITIES.map((ability) => (
              <button
                key={ability}
                onClick={() => handleAbilityToggle(ability)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                  selectedAbilities.includes(ability)
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {ability}
              </button>
            ))}
          </div>
          
          <div className="mt-4 text-sm text-gray-500">
            Selected: {selectedAbilities.length} abilit{selectedAbilities.length !== 1 ? 'ies' : 'y'}
          </div>
        </div>
      )}

      {/* Weekly Calendar */}
      <div className="card">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          {hasExistingData ? 'Update Your Weekly Availability' : 'Select Your Weekly Availability'}
        </h3>
        <p className="text-gray-600 mb-6">
          Choose which week to schedule, then click on time slots to mark when you're available. You can schedule for multiple weeks.
        </p>
        
        <WeekSelector
          selectedWeek={selectedWeekKey}
          onWeekChange={handleWeekChange}
          availableWeeks={availableWeeks}
        />
        
        <WeeklyCalendar
          selectedSlots={selectedSlots}
          onSlotsChange={setSelectedSlots}
          selectedWeekKey={selectedWeekKey}
        />
        
        <div className="mt-4 text-sm text-gray-500 space-y-1">
          <div>This week: {currentWeekSlots.length} time slot{currentWeekSlots.length !== 1 ? 's' : ''}</div>
          <div>Total across all weeks: {totalSlotsAcrossAllWeeks} time slot{totalSlotsAcrossAllWeeks !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="card">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="card">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="btn-primary w-full"
        >
          {isSubmitting ? 'Saving...' : 'Find My Matches'}
        </button>
        <p className="text-sm text-gray-500 mt-2 text-center">
          We'll find others with overlapping availability and match you up!
        </p>
      </div>
    </div>
  );
};

export default CalendarSelectionPage; 