import React, { useState, useEffect } from 'react';

interface MetricsData {
  users: {
    total: number;
    mentors: number;
    mentees: number;
    thisWeek: number;
  };
  sessions: {
    total: number;
    pending: number;
    completed: number;
  };
}

interface Session {
  id: number;
  mentor_email: string;
  mentee_email: string;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  invitation_sent_at: string;
}

interface DailyStats {
  date: string;
  sessions_count: number;
}

const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      // Fetch main metrics
      const metricsResponse = await fetch('/api/metrics');
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setMetrics(metricsData.metrics);
      }

      // Fetch recent sessions
      const sessionsResponse = await fetch('/api/metrics/sessions');
      if (sessionsResponse.ok) {
        const sessionsData = await sessionsResponse.json();
        setSessions(sessionsData.sessions || []);
      }

      // Fetch weekly stats
      const weeklyResponse = await fetch('/api/metrics/weekly');
      if (weeklyResponse.ok) {
        const weeklyData = await weeklyResponse.json();
        setDailyStats(weeklyData.dailyStats || []);
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const StatCard: React.FC<{ title: string; value: number; subtitle?: string; trend?: string; color?: string }> = ({
    title,
    value,
    subtitle,
    trend,
    color = 'primary'
  }) => (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-3xl font-bold text-${color}-600`}>{value.toLocaleString()}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {trend && (
          <div className={`px-3 py-1 rounded-full text-sm font-medium bg-${color}-100 text-${color}-800`}>
            {trend}
          </div>
        )}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Platform Dashboard</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Platform Dashboard</h1>
          <p className="text-gray-600 mt-1">Last updated: {lastRefresh.toLocaleString()}</p>
        </div>
        <button
          onClick={fetchMetrics}
          className="btn-primary"
          disabled={isLoading}
        >
          🔄 Refresh
        </button>
      </div>

      {metrics && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Users"
              value={metrics.users.total}
              subtitle="All time registrations"
              color="primary"
            />
            <StatCard
              title="Mentoring Sessions"
              value={metrics.sessions.total}
              subtitle="Invitations sent"
              color="green"
            />
            <StatCard
              title="Active This Week"
              value={metrics.users.thisWeek}
              subtitle="New registrations"
              color="blue"
            />
            <StatCard
              title="Pending Sessions"
              value={metrics.sessions.pending}
              subtitle="Awaiting confirmation"
              color="yellow"
            />
          </div>

          {/* User Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">User Distribution</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">👨‍🏫 Mentors</span>
                  <div className="flex items-center space-x-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary-600 h-2 rounded-full" 
                        style={{ width: `${(metrics.users.mentors / metrics.users.total * 100)}%` }}
                      ></div>
                    </div>
                    <span className="font-semibold text-primary-600 w-8 text-right">
                      {metrics.users.mentors}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">🎓 Mentees</span>
                  <div className="flex items-center space-x-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ width: `${(metrics.users.mentees / metrics.users.total * 100)}%` }}
                      ></div>
                    </div>
                    <span className="font-semibold text-green-600 w-8 text-right">
                      {metrics.users.mentees}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Status</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">📤 Sent</span>
                  <div className="flex items-center space-x-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${(metrics.sessions.pending / metrics.sessions.total * 100)}%` }}
                      ></div>
                    </div>
                    <span className="font-semibold text-blue-600 w-8 text-right">
                      {metrics.sessions.pending}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">✅ Completed</span>
                  <div className="flex items-center space-x-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ width: `${(metrics.sessions.completed / metrics.sessions.total * 100)}%` }}
                      ></div>
                    </div>
                    <span className="font-semibold text-green-600 w-8 text-right">
                      {metrics.sessions.completed}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Daily Activity Chart */}
      {dailyStats.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Session Activity (Last 30 Days)</h3>
          <div className="flex items-end space-x-2 h-32">
            {dailyStats.slice(0, 14).reverse().map((stat, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className="bg-primary-600 rounded-t w-full min-h-[4px]"
                  style={{ 
                    height: `${Math.max((stat.sessions_count / Math.max(...dailyStats.map(s => s.sessions_count))) * 100, 4)}%` 
                  }}
                  title={`${stat.date}: ${stat.sessions_count} sessions`}
                ></div>
                <span className="text-xs text-gray-500 mt-1 transform rotate-45 origin-left">
                  {new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Sessions</h3>
        {sessions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">📅</div>
            <p className="text-gray-500">No mentoring sessions yet</p>
            <p className="text-sm text-gray-400 mt-2">Sessions will appear here when users send invitations</p>
          </div>
        ) : (
          <div className="overflow-hidden">
            <div className="space-y-3">
              {sessions.slice(0, 10).map((session) => (
                <div key={session.id} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium text-gray-900">
                        👨‍🏫 {session.mentor_email.split('@')[0]}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="font-medium text-gray-900">
                        🎓 {session.mentee_email.split('@')[0]}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {session.scheduled_date} • {session.scheduled_time}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                      {session.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(session.invitation_sent_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {sessions.length > 10 && (
              <div className="text-center mt-4">
                <span className="text-sm text-gray-500">
                  Showing 10 of {sessions.length} sessions
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage; 