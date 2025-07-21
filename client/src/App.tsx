import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EmailInputPage from './pages/EmailInputPage';
import CalendarSelectionPage from './pages/CalendarSelectionPage';
import LoadingPage from './pages/LoadingPage';
import ResultsPage from './pages/ResultsPage';
import DashboardPage from './pages/DashboardPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-4xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-primary-900">
              Designtek Mentor Match
            </h1>
            <p className="text-gray-600 mt-1">
              Connect with mentors and mentees based on your availability
            </p>
          </div>
        </header>

        <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<EmailInputPage />} />
            <Route path="/calendar-selection" element={<CalendarSelectionPage />} />
            <Route path="/loading" element={<LoadingPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App; 