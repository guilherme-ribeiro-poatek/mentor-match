import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserType } from '../types';

const EmailInputPage: React.FC = () => {
  const navigate = useNavigate();
  const [userType, setUserType] = useState<UserType>('mentor');
  const [email, setEmail] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async () => {
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!validateEmail(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setIsValidating(true);

    try {
      // Store email and user type in sessionStorage for the next step
      sessionStorage.setItem('userEmail', email.trim());
      sessionStorage.setItem('userType', userType);
      
      // Navigate to calendar selection page
      navigate('/calendar-selection');
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
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
              onKeyPress={handleKeyPress}
              className="input-field"
              placeholder="your.email@example.com"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              We'll use this to match you with others and send session invitations.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Next Button */}
      <div className="card">
        <button
          onClick={handleSubmit}
          disabled={isValidating}
          className="btn-primary w-full"
        >
          {isValidating ? 'Validating...' : 'Next: Select Your Availability'}
        </button>
        <p className="text-sm text-gray-500 mt-2 text-center">
          Next, you'll select your available time slots for this week.
        </p>
      </div>
    </div>
  );
};

export default EmailInputPage; 