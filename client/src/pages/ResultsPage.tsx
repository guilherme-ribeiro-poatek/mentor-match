import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Match, UserData } from '../types';
import { getDateForWeekDay, formatDateLong, getDayNameFromDate, getCurrentWeekKey } from '../utils/weekUtils';

interface MatchResults {
  matches: Match[];
  userData: UserData;
  error?: string;
}

const ResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState<MatchResults | null>(null);

  useEffect(() => {
    const resultsStr = sessionStorage.getItem('matchResults');
    if (!resultsStr) {
      navigate('/');
      return;
    }

    const matchResults: MatchResults = JSON.parse(resultsStr);
    setResults(matchResults);
  }, [navigate]);

  const getDayName = (dayOfWeek: number): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek];
  };

  const getFormattedMatchDate = (match: Match): { fullDate: string; dayName: string } => {
    if (match.weekKey) {
      const actualDate = getDateForWeekDay(match.weekKey, match.dayOfWeek);
      return {
        fullDate: formatDateLong(actualDate),
        dayName: getDayNameFromDate(actualDate)
      };
    } else {
      // Fallback for matches without weekKey (legacy data)
      return {
        fullDate: 'This week',
        dayName: getDayName(match.dayOfWeek)
      };
    }
  };

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const sendInvitation = async (match: Match) => {
    try {
      const response = await fetch('/api/send-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mentorEmail: results!.userData.userType === 'mentor' ? results!.userData.email : match.partnerEmail,
          menteeEmail: results!.userData.userType === 'mentee' ? results!.userData.email : match.partnerEmail,
          scheduledTime: `${formatTime(match.startTime)} - ${formatTime(match.endTime)}`,
          scheduledDate: getFormattedMatchDate(match).fullDate,
          dayOfWeek: getFormattedMatchDate(match).dayName,
          weekKey: match.weekKey || getCurrentWeekKey()
        }),
      });

      const data = await response.json();

      if (data.success) {
        let message = `✅ Invitation sent successfully to ${match.partnerEmail}!`;
        
        if (data.calendarEvent) {
          message += `\n\n📅 Calendar event created with Google Meet link!`;
          message += `\n🔗 Event: ${data.calendarEvent.eventLink}`;
          
          if (data.calendarEvent.meetLink) {
            message += `\n🎥 Meet: ${data.calendarEvent.meetLink}`;
          }
        } else {
          message += `\n\n⚠️ Calendar event could not be created automatically. Please add the meeting to your calendar manually.`;
        }
        
        alert(message);
      } else {
        alert(`❌ Failed to send invitation: ${data.error}`);
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      alert('❌ Network error. Please try again.');
    }
  };

  const handleStartOver = () => {
    sessionStorage.clear();
    navigate('/');
  };

  if (!results) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const { matches, userData, error } = results;
  const hasMatches = matches && matches.length > 0;

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {hasMatches ? '🎉 Great News!' : '😔 No Matches Found'}
          </h2>
          <p className="text-gray-600">
            {hasMatches 
              ? `We found ${matches.length} potential mentoring session${matches.length !== 1 ? 's' : ''} for you!`
              : 'We couldn\'t find any overlapping availability this week.'
            }
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {hasMatches ? (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Suggested Time Slots:
            </h3>
            
            {matches.map((match, index) => {
              const matchDate = getFormattedMatchDate(match);
              
              return (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <div className="text-2xl mr-3">
                          {userData.userType === 'mentor' ? '🎓' : '👨‍🏫'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {matchDate.fullDate}
                          </p>
                          <p className="text-sm font-medium text-primary-600">
                            {matchDate.dayName}
                          </p>
                          <p className="text-sm text-gray-600">
                            {formatTime(match.startTime)} - {formatTime(match.endTime)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        <p>Duration: {match.duration} minutes</p>
                        <p>
                          {userData.userType === 'mentor' ? 'Mentee' : 'Mentor'}: {match.partnerEmail}
                        </p>
                        {userData.userType === 'mentee' && match.abilities && match.abilities.length > 0 && (
                          <div className="mt-2">
                            <p className="font-medium text-gray-700 mb-1">Mentoring Abilities:</p>
                            <div className="flex flex-wrap gap-1">
                              {match.abilities.map((ability, index) => (
                                <span 
                                  key={index}
                                  className="px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded-full"
                                >
                                  {ability}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="ml-4">
                      <button
                        onClick={() => sendInvitation(match)}
                        className="btn-primary text-sm px-4 py-2"
                      >
                        Send Invite
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start">
                <div className="text-green-600 text-xl mr-3">✅</div>
                <div>
                  <h4 className="font-semibold text-green-800 mb-1">Next Steps</h4>
                  <p className="text-green-700 text-sm">
                    Click "Send Invite" on any time slot to connect with your match. 
                    They'll receive an email invitation to confirm the mentoring session.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">📅</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              No overlapping availability found
            </h3>
            <div className="space-y-3 text-gray-600 mb-6">
              <p>This could happen because:</p>
              <ul className="text-left max-w-md mx-auto space-y-2">
                <li>• No {userData.userType === 'mentor' ? 'mentees' : 'mentors'} are available during your selected times</li>
                <li>• Available time slots are less than 30 minutes</li>
                <li>• Other users haven't registered yet this week</li>
              </ul>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <div className="text-blue-600 text-xl mr-3">💡</div>
                <div className="text-left">
                  <h4 className="font-semibold text-blue-800 mb-1">Suggestion</h4>
                  <p className="text-blue-700 text-sm">
                    Try again next week or consider adjusting your availability times to increase your chances of finding a match.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-center pt-6 border-t border-gray-200">
          <button
            onClick={handleStartOver}
            className="btn-secondary"
          >
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultsPage;