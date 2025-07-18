import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import WeeklyCalendar from '../components/WeeklyCalendar';
import { UserType, TimeSlot } from '../types';

const CalendarSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [userType, setUserType] = useState<UserType>('mentor');
  const [email, setEmail] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasExistingData, setHasExistingData] = useState(false);

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

    // Check if user already has availability data
    checkExistingAvailability(storedEmail);
  }, [navigate]);

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

      if (data.exists && data.availability.length > 0) {
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

  const handleSubmit = async () => {
    setError('');

    if (selectedSlots.length === 0) {
      setError('Please select at least one time slot');
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
          })),
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
  };

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
              Select Your Availability
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
                <p className="text-sm">You can edit your time slots below or start over with a fresh selection.</p>
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

      {/* Weekly Calendar */}
      <div className="card">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          {hasExistingData ? 'Update Your Availability This Week' : 'Select Your Availability This Week'}
        </h3>
        <p className="text-gray-600 mb-6">
          Click on time slots to mark when you're available. Minimum session length is 30 minutes.
        </p>
        
        <WeeklyCalendar
          selectedSlots={selectedSlots}
          onSlotsChange={setSelectedSlots}
        />
        
        <div className="mt-4 text-sm text-gray-500">
          Selected: {selectedSlots.length} time slot{selectedSlots.length !== 1 ? 's' : ''}
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