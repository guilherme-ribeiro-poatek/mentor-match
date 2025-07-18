const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, '../client/build')));

// Database initialization
const db = new sqlite3.Database('./mentor_match.db');

// Initialize database tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    user_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    week_key TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    week_key TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mentor_id TEXT NOT NULL,
    mentee_id TEXT NOT NULL,
    scheduled_date TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mentor_id) REFERENCES users (id),
    FOREIGN KEY (mentee_id) REFERENCES users (id)
  )`);
});

// Helper function to get current week key
function getCurrentWeekKey() {
  const now = new Date();
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  return startOfWeek.toISOString().split('T')[0];
}

// Helper function to clean old data (older than current week)
function cleanOldData() {
  const currentWeekKey = getCurrentWeekKey();
  
  db.run(`DELETE FROM availability WHERE week_key < ?`, [currentWeekKey]);
  db.run(`DELETE FROM users WHERE week_key < ?`, [currentWeekKey]);
  
  console.log(`Cleaned data older than week: ${currentWeekKey}`);
}

// Run cleanup on server start and schedule weekly cleanup
cleanOldData();
setInterval(cleanOldData, 24 * 60 * 60 * 1000); // Daily cleanup

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify email configuration
transporter.verify((error, success) => {
  if (error) {
    console.log('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Google Calendar configuration
const calendar = google.calendar('v3');
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

// Helper function to create Google Calendar event
async function createCalendarEvent(mentorEmail, menteeEmail, dayOfWeek, scheduledTime, scheduledDate) {
  try {
    const authClient = await auth.getClient();
    google.options({ auth: authClient });

    // Parse the scheduled time to get start and end times
    const [startTimeStr, endTimeStr] = scheduledTime.split(' - ');
    
    // Calculate the actual date for the event (this week's occurrence of the dayOfWeek)
    const eventDate = getNextWeekdayDate(dayOfWeek);
    
    // Convert time strings to proper datetime
    const startDateTime = new Date(`${eventDate}T${convertTo24Hour(startTimeStr)}:00`);
    const endDateTime = new Date(`${eventDate}T${convertTo24Hour(endTimeStr)}:00`);

    const event = {
      summary: 'Mentor Match - Mentoring Session',
      description: `Mentoring session organized through Mentor Match platform.\n\nMentor: ${mentorEmail}\nMentee: ${menteeEmail}\n\nPlease reach out to each other to confirm the meeting details and share the Google Meet link.`,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 15 }
        ]
      },
      conferenceData: {
        createRequest: {
          requestId: uuidv4(),
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1
    });

    console.log('Calendar event created:', response.data.htmlLink);
    return {
      success: true,
      eventId: response.data.id,
      eventLink: response.data.htmlLink,
      meetLink: response.data.conferenceData?.entryPoints?.[0]?.uri || null
    };
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Helper function to get next occurrence of a weekday
function getNextWeekdayDate(dayOfWeek) {
  const today = new Date();
  
  // Convert day name to day number (0=Sunday, 1=Monday, etc.)
  const dayNameToNumber = {
    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
    'Thursday': 4, 'Friday': 5, 'Saturday': 6
  };
  
  const targetDay = dayNameToNumber[dayOfWeek] !== undefined ? 
    dayNameToNumber[dayOfWeek] : parseInt(dayOfWeek);
  const currentDay = today.getDay();
  
  let daysToAdd = targetDay - currentDay;
  if (daysToAdd <= 0) {
    daysToAdd += 7; // Next week if same day or past
  }
  
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysToAdd);
  
  return targetDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
}

// Helper function to convert 12-hour time to 24-hour format
function convertTo24Hour(time12h) {
  try {
    const [time, modifier] = time12h.trim().split(' ');
    let [hours, minutes] = time.split(':');
    
    hours = parseInt(hours, 10);
    
    if (modifier === 'AM') {
      if (hours === 12) {
        hours = 0; // 12 AM = 00:00
      }
    } else if (modifier === 'PM') {
      if (hours !== 12) {
        hours += 12; // 1 PM = 13:00, 2 PM = 14:00, etc.
      }
      // 12 PM = 12:00 (stays the same)
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  } catch (error) {
    console.error('Error converting time:', time12h, error);
    return '09:00'; // fallback time
  }
}

// Helper function to generate Google Calendar "Add to Calendar" links
function generateGoogleCalendarLink(mentorEmail, menteeEmail, dayOfWeek, scheduledTime) {
  const eventDate = getNextWeekdayDate(dayOfWeek);
  const [startTimeStr, endTimeStr] = scheduledTime.split(' - ');
  const startDateTime = new Date(`${eventDate}T${convertTo24Hour(startTimeStr)}:00`);
  const endDateTime = new Date(`${eventDate}T${convertTo24Hour(endTimeStr)}:00`);

  const formatDateForGoogle = (date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const startTime = formatDateForGoogle(startDateTime);
  const endTime = formatDateForGoogle(endDateTime);
  
  const eventTitle = encodeURIComponent('Mentor Match - Mentoring Session');
  const eventDetails = encodeURIComponent(`Mentoring session\nMentor: ${mentorEmail}\nMentee: ${menteeEmail}\n\nPlease coordinate with your partner to confirm meeting details.`);
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${startTime}/${endTime}&details=${eventDetails}&location=Google%20Meet`;
}

// API Routes

// Check if email exists and get availability
app.post('/api/check-email', (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const currentWeekKey = getCurrentWeekKey();

  // Check if user exists for current week
  db.get(`SELECT * FROM users WHERE email = ? AND week_key = ?`, [email, currentWeekKey], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      // User doesn't exist, return empty availability
      return res.json({ 
        exists: false, 
        availability: [], 
        userType: null 
      });
    }

    // Get user's availability
    db.all(`SELECT * FROM availability WHERE user_id = ? AND week_key = ?`, [user.id, currentWeekKey], (err, availability) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Transform availability to match frontend format
      const transformedAvailability = availability.map(slot => ({
        dayOfWeek: slot.day_of_week,
        startTime: slot.start_time,
        endTime: slot.end_time
      }));

      res.json({ 
        exists: true, 
        availability: transformedAvailability,
        userType: user.user_type
      });
    });
  });
});

// Register user and availability
app.post('/api/register', (req, res) => {
  const { email, userType, availability } = req.body;
  
  if (!email || !userType || !availability) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const userId = uuidv4();
  const weekKey = getCurrentWeekKey();

  // Insert user
  db.run(
    `INSERT OR REPLACE INTO users (id, email, user_type, week_key) VALUES (?, ?, ?, ?)`,
    [userId, email, userType, weekKey],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Delete existing availability for this user
      db.run(`DELETE FROM availability WHERE user_id = ?`, [userId], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        // Insert availability slots
        const stmt = db.prepare(`INSERT INTO availability (user_id, day_of_week, start_time, end_time, week_key) VALUES (?, ?, ?, ?, ?)`);
        
        availability.forEach(slot => {
          stmt.run([userId, slot.dayOfWeek, slot.startTime, slot.endTime, weekKey]);
        });
        
        stmt.finalize();
        
        res.json({ success: true, userId });
      });
    }
  );
});

// Find matches for a user
app.post('/api/find-matches', (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID required' });
  }

  // Get user info
  db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const oppositeType = user.user_type === 'mentor' ? 'mentee' : 'mentor';
    const currentWeekKey = getCurrentWeekKey();

    // Get user's availability
    db.all(`SELECT * FROM availability WHERE user_id = ? AND week_key = ?`, [userId, currentWeekKey], (err, userAvailability) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Get opposite type users' availability
      db.all(`
        SELECT a.*, u.email, u.user_type, u.id as user_id 
        FROM availability a 
        JOIN users u ON a.user_id = u.id 
        WHERE u.user_type = ? AND a.week_key = ?
      `, [oppositeType, currentWeekKey], (err, otherAvailability) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        // Find overlapping time slots
        const matches = [];
        
        userAvailability.forEach(userSlot => {
          otherAvailability.forEach(otherSlot => {
            if (userSlot.day_of_week === otherSlot.day_of_week) {
              const overlap = findTimeOverlap(userSlot, otherSlot);
              if (overlap && overlap.duration >= 30) { // Minimum 30 minutes
                matches.push({
                  partnerId: otherSlot.user_id,
                  partnerEmail: otherSlot.email,
                  dayOfWeek: userSlot.day_of_week,
                  startTime: overlap.startTime,
                  endTime: overlap.endTime,
                  duration: overlap.duration
                });
              }
            }
          });
        });

        // Limit to 5 matches and distribute evenly
        const limitedMatches = distributeMatches(matches, 5);
        
        res.json({ matches: limitedMatches });
      });
    });
  });
});

// Helper function to find time overlap between two slots
function findTimeOverlap(slot1, slot2) {
  const start1 = timeToMinutes(slot1.start_time);
  const end1 = timeToMinutes(slot1.end_time);
  const start2 = timeToMinutes(slot2.start_time);
  const end2 = timeToMinutes(slot2.end_time);

  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);

  if (overlapStart < overlapEnd) {
    return {
      startTime: minutesToTime(overlapStart),
      endTime: minutesToTime(overlapEnd),
      duration: overlapEnd - overlapStart
    };
  }

  return null;
}

// Helper function to convert time string to minutes
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Helper function to convert minutes to time string
function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Helper function to distribute matches evenly
function distributeMatches(matches, limit) {
  if (matches.length <= limit) return matches;
  
  // Group by day and time to avoid duplicates
  const uniqueMatches = [];
  const seen = new Set();
  
  matches.forEach(match => {
    const key = `${match.dayOfWeek}-${match.startTime}-${match.endTime}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueMatches.push(match);
    }
  });
  
  // Take up to limit matches, distributed across different days if possible
  const result = [];
  const dayGroups = {};
  
  uniqueMatches.forEach(match => {
    if (!dayGroups[match.dayOfWeek]) {
      dayGroups[match.dayOfWeek] = [];
    }
    dayGroups[match.dayOfWeek].push(match);
  });
  
  // Take one from each day first, then cycle through
  const days = Object.keys(dayGroups);
  let dayIndex = 0;
  
  while (result.length < limit && result.length < uniqueMatches.length) {
    const currentDay = days[dayIndex % days.length];
    if (dayGroups[currentDay].length > 0) {
      result.push(dayGroups[currentDay].shift());
    }
    dayIndex++;
    
    // If we've exhausted all days, break
    if (days.every(day => dayGroups[day].length === 0)) {
      break;
    }
  }
  
  return result;
}

// Send invitation email
app.post('/api/send-invitation', async (req, res) => {
  const { mentorEmail, menteeEmail, scheduledTime, scheduledDate, dayOfWeek } = req.body;
  
  if (!mentorEmail || !menteeEmail || !scheduledTime || !scheduledDate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Create Google Calendar event first
    const calendarResult = await createCalendarEvent(mentorEmail, menteeEmail, dayOfWeek, scheduledTime, scheduledDate);
    
    // Generate individual Google Calendar links for each user
    const calendarLink = generateGoogleCalendarLink(mentorEmail, menteeEmail, dayOfWeek, scheduledTime);
    
    let calendarSection = '';
    if (calendarResult.success) {
      calendarSection = `
        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>📅 Calendar Event</h3>
          <p>A calendar event template has been created. Choose how to add it to your calendar:</p>
          <p><strong>📅 <a href="${calendarLink}" style="color: #3b82f6; text-decoration: none; background: #3b82f6; color: white; padding: 8px 16px; border-radius: 4px; display: inline-block; margin: 5px;">➕ Add to Google Calendar</a></strong></p>
          ${calendarResult.meetLink ? `<p><strong>🎥 <a href="${calendarResult.meetLink}" style="color: #10b981; text-decoration: none; background: #10b981; color: white; padding: 8px 16px; border-radius: 4px; display: inline-block; margin: 5px;">📹 Join Google Meet</a></strong></p>` : ''}
          <p style="font-size: 12px; color: #666; margin-top: 10px;">
            Both mentor and mentee will need to add this event to their own calendars and coordinate meeting details.
          </p>
        </div>
      `;
    } else {
      calendarSection = `
        <div style="background-color: #fef3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>📅 Add to Calendar</h3>
          <p><strong>📅 <a href="${calendarLink}" style="color: #3b82f6; text-decoration: none; background: #3b82f6; color: white; padding: 8px 16px; border-radius: 4px; display: inline-block;">➕ Add to Google Calendar</a></strong></p>
          <p style="font-size: 12px; color: #666; margin-top: 10px;">
            Please manually add this meeting to your calendar: ${dayOfWeek}, ${scheduledTime}
          </p>
        </div>
      `;
    }

    // Email template for mentor
    const mentorMailOptions = {
      from: process.env.EMAIL_USER,
      to: mentorEmail,
      subject: 'Mentor Match - New Mentoring Session Scheduled',
      html: `
        <h2>🎯 New Mentoring Session Scheduled</h2>
        <p>Hello,</p>
        <p>Great news! You've been matched with a mentee for a mentoring session.</p>
        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>📅 Session Details:</h3>
          <p><strong>Date:</strong> ${dayOfWeek}, ${scheduledDate}</p>
          <p><strong>Time:</strong> ${scheduledTime}</p>
          <p><strong>Mentee:</strong> ${menteeEmail}</p>
        </div>
        ${calendarSection}
        <p>Please reach out to your mentee to confirm the session and discuss any additional meeting details.</p>
        <p>Best regards,<br>Mentor Match Team</p>
      `
    };

    // Email template for mentee
    const menteeMailOptions = {
      from: process.env.EMAIL_USER,
      to: menteeEmail,
      subject: 'Mentor Match - New Mentoring Session Scheduled',
      html: `
        <h2>🎓 New Mentoring Session Scheduled</h2>
        <p>Hello,</p>
        <p>Excellent! You've been matched with a mentor for a mentoring session.</p>
        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>📅 Session Details:</h3>
          <p><strong>Date:</strong> ${dayOfWeek}, ${scheduledDate}</p>
          <p><strong>Time:</strong> ${scheduledTime}</p>
          <p><strong>Mentor:</strong> ${mentorEmail}</p>
        </div>
        ${calendarSection}
        <p>Your mentor will reach out to you soon to confirm the session and discuss any additional meeting details.</p>
        <p>Best regards,<br>Mentor Match Team</p>
      `
    };

    // Send emails to both parties
    await Promise.all([
      transporter.sendMail(mentorMailOptions),
      transporter.sendMail(menteeMailOptions)
    ]);

    console.log(`Invitation emails sent successfully:
      Mentor: ${mentorEmail}
      Mentee: ${menteeEmail}
      Date: ${scheduledDate}
      Time: ${scheduledTime}
      Calendar Event: ${calendarResult.success ? calendarResult.eventLink : 'Failed to create'}
    `);

    res.json({ 
      success: true, 
      message: 'Invitation emails sent successfully',
      calendarEvent: calendarResult.success ? {
        eventLink: calendarResult.eventLink,
        meetLink: calendarResult.meetLink
      } : null
    });
  } catch (error) {
    console.error('Error sending invitation emails:', error);
    res.status(500).json({ error: 'Failed to send invitation emails' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 