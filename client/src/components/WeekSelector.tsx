import React from 'react';
import { WeekOption } from '../types';

interface WeekSelectorProps {
  selectedWeek: string;
  onWeekChange: (weekKey: string) => void;
  availableWeeks: WeekOption[];
}

const WeekSelector: React.FC<WeekSelectorProps> = ({
  selectedWeek,
  onWeekChange,
  availableWeeks
}) => {
  const currentWeekIndex = availableWeeks.findIndex(week => week.weekKey === selectedWeek);
  const currentWeek = availableWeeks[currentWeekIndex];
  
  const canGoPrevious = currentWeekIndex > 0;
  const canGoNext = currentWeekIndex < availableWeeks.length - 1;
  
  const handlePrevious = () => {
    if (canGoPrevious) {
      onWeekChange(availableWeeks[currentWeekIndex - 1].weekKey);
    }
  };
  
  const handleNext = () => {
    if (canGoNext) {
      onWeekChange(availableWeeks[currentWeekIndex + 1].weekKey);
    }
  };

  if (!currentWeek) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
        <button
          onClick={handlePrevious}
          disabled={!canGoPrevious}
          className={`p-2 rounded-full transition-colors duration-200 ${
            canGoPrevious 
              ? 'text-gray-600 hover:text-primary-600 hover:bg-primary-50' 
              : 'text-gray-300 cursor-not-allowed'
          }`}
          title={canGoPrevious ? 'Previous week' : 'No previous weeks available'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center">
          <div className="text-lg font-semibold text-gray-900">
            {currentWeek.label}
          </div>
          <div className="text-sm text-gray-600">
            {currentWeek.startDate.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            })} - {currentWeek.endDate.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            })}
          </div>
        </div>

        <button
          onClick={handleNext}
          disabled={!canGoNext}
          className={`p-2 rounded-full transition-colors duration-200 ${
            canGoNext 
              ? 'text-gray-600 hover:text-primary-600 hover:bg-primary-50' 
              : 'text-gray-300 cursor-not-allowed'
          }`}
          title={canGoNext ? 'Next week' : 'No more weeks available'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      
      <p className="text-sm text-gray-600 mt-2 text-center">
        Use the arrows to navigate between weeks. You can schedule for the current week and upcoming weeks.
      </p>
    </div>
  );
};

export default WeekSelector;
