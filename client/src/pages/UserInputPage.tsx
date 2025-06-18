import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WeeklyCalendar from '../components/WeeklyCalendar';
import { UserType, TimeSlot } from '../types';

const UserInputPage: React.FC = () => {
  const navigate = useNavigate();
  const [userType, setUserType] = useState<UserType>('mentor');
  const [email, setEmail] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

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

  return (
    <div className="space-y-8">
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Join Mentor Match
        </h2>
        
        <div className="space-y-6">
          {/* User Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              I want to be a:
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setUserType('mentor')}
                className={`p-4 border-2 rounded-lg text-center transition-colors duration-200 ${
                  userType === 'mentor'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="text-2xl mb-2">👨‍🏫</div>
                <div className="font-semibold">Mentor</div>
                <div className="text-sm text-gray-600">Share your knowledge</div>
              </button>
              
              <button
                type="button"
                onClick={() => setUserType('mentee')}
                className={`p-4 border-2 rounded-lg text-center transition-colors duration-200 ${
                  userType === 'mentee'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="text-2xl mb-2">🎓</div>
                <div className="font-semibold">Mentee</div>
                <div className="text-sm text-gray-600">Learn from others</div>
              </button>
            </div>
          </div>

          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="your.email@example.com"
              required
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Weekly Calendar */}
      <div className="card">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          Select Your Availability This Week
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

      {/* Submit Button at Bottom */}
      <div className="card">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="btn-primary w-full"
        >
          {isSubmitting ? 'Registering...' : 'Find My Matches'}
        </button>
      </div>
    </div>
  );
};

export default UserInputPage; 