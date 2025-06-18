import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserData } from '../types';

const LoadingPage: React.FC = () => {
  const navigate = useNavigate();
  const [loadingText, setLoadingText] = useState('Looking for a match in the following weeks');
  const [dots, setDots] = useState('');

  useEffect(() => {
    // Get user data from sessionStorage
    const userDataStr = sessionStorage.getItem('userData');
    if (!userDataStr) {
      navigate('/');
      return;
    }

    const userData: UserData = JSON.parse(userDataStr);

    // Animated loading dots
    const dotsInterval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    // Search for matches after a delay to show loading state
    const searchTimeout = setTimeout(async () => {
      try {
        const response = await fetch('/api/find-matches', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userData.userId,
          }),
        });

        const data = await response.json();
        
        // Store results in sessionStorage
        sessionStorage.setItem('matchResults', JSON.stringify({
          matches: data.matches || [],
          userData,
        }));

        // Navigate to results page
        navigate('/results');
      } catch (error) {
        console.error('Error finding matches:', error);
        
        // Store error result
        sessionStorage.setItem('matchResults', JSON.stringify({
          matches: [],
          userData,
          error: 'Network error occurred while searching for matches',
        }));
        
        navigate('/results');
      }
    }, 3000); // 3 second delay to show loading state

    return () => {
      clearInterval(dotsInterval);
      clearTimeout(searchTimeout);
    };
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="card max-w-md w-full text-center">
        <div className="mb-8">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Finding Your Perfect Match
          </h2>
          <p className="text-lg text-gray-700">
            {loadingText}
            <span className="inline-block w-8 text-left">{dots}</span>
          </p>
        </div>

        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex items-center justify-center">
            <div className="w-2 h-2 bg-primary-600 rounded-full mr-2"></div>
            <span>Reviewing your availability</span>
          </div>
          <div className="flex items-center justify-center">
            <div className="w-2 h-2 bg-primary-600 rounded-full mr-2"></div>
            <span>Comparing with potential matches</span>
          </div>
          <div className="flex items-center justify-center">
            <div className="w-2 h-2 bg-primary-600 rounded-full mr-2"></div>
            <span>Finding optimal time slots</span>
          </div>
        </div>

        <div className="mt-8 p-4 bg-primary-50 rounded-lg">
          <p className="text-sm text-primary-700">
            This usually takes just a few seconds...
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoadingPage; 