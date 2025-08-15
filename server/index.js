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

// Timezone constants and utilities
const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

// Utility function to get current date/time in Brazil timezone
function getBrazilDate(date = null) {
  const targetDate = date || new Date();
  return new Date(targetDate.toLocaleString("en-US", {timeZone: BRAZIL_TIMEZONE}));
}

// Utility function to format date in Brazil timezone for ISO string with timezone
function formatBrazilDateTime(date, timeString) {
  // Create date in Brazil timezone
  const brazilDate = getBrazilDate(date);
  const [hours, minutes] = timeString.split(':').map(Number);
  
  // Set the time
  brazilDate.setHours(hours, minutes, 0, 0);
  
  // Return ISO string but for Brazil timezone calculation
  return brazilDate;
}

// Utility function to get date string in YYYY-MM-DD format for Brazil timezone
function getBrazilDateString(date = null) {
  const brazilDate = getBrazilDate(date);
  return brazilDate.toISOString().split('T')[0];
}

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

  db.run(`CREATE TABLE IF NOT EXISTS abilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    ability TEXT NOT NULL,
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

// Helper function to get current week key (using Brazil timezone)
function getCurrentWeekKey() {
  const now = getBrazilDate(); // Get current date in Brazil timezone
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  return getBrazilDateString(startOfWeek);
}

// Helper function to clean old data (older than current week)
function cleanOldData() {
  const currentWeekKey = getCurrentWeekKey();
  
  // Clean old availability and abilities
  db.run(`DELETE FROM availability WHERE week_key < ?`, [currentWeekKey]);
  db.run(`DELETE FROM abilities WHERE week_key < ?`, [currentWeekKey]);
  
  // Only delete users if they have no availability in current or future weeks
  db.run(`
    DELETE FROM users 
    WHERE id NOT IN (
      SELECT DISTINCT user_id 
      FROM availability 
      WHERE week_key >= ?
    )
  `, [currentWeekKey]);
  
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
    
    // Create datetime objects in Brazil timezone
    const startDateTime = new Date(`${eventDate}T${convertTo24Hour(startTimeStr)}:00-03:00`); // Brazil timezone offset
    const endDateTime = new Date(`${eventDate}T${convertTo24Hour(endTimeStr)}:00-03:00`);

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

// Helper function to get next occurrence of a weekday (using Brazil timezone)
function getNextWeekdayDate(dayOfWeek) {
  const today = getBrazilDate(); // Get current date in Brazil timezone
  
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
  
  return getBrazilDateString(targetDate); // Return YYYY-MM-DD format in Brazil timezone
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
  // Create datetime objects in Brazil timezone
  const startDateTime = new Date(`${eventDate}T${convertTo24Hour(startTimeStr)}:00-03:00`);
  const endDateTime = new Date(`${eventDate}T${convertTo24Hour(endTimeStr)}:00-03:00`);

  const formatDateForGoogle = (date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const startTime = formatDateForGoogle(startDateTime);
  const endTime = formatDateForGoogle(endDateTime);
  
  const eventTitle = encodeURIComponent('Mentor Match - Mentoring Session');
  const eventDetails = encodeURIComponent(`Mentoring session\nMentor: ${mentorEmail}\nMentee: ${menteeEmail}\n\nPlease coordinate with your partner to confirm meeting details.`);
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${startTime}/${endTime}&details=${eventDetails}&location=Google%20Meet&ctz=${BRAZIL_TIMEZONE}`;
}

// API Routes

// Check if email exists and get availability
app.post('/api/check-email', (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Check if user exists (any week)
  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
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

    // Get user's availability from all weeks (current and future)
    const currentWeekKey = getCurrentWeekKey();
    db.all(`SELECT * FROM availability WHERE user_id = ? AND week_key >= ? ORDER BY week_key ASC`, [user.id, currentWeekKey], (err, availability) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Transform availability to match frontend format
      const transformedAvailability = availability.map(slot => ({
        dayOfWeek: slot.day_of_week,
        startTime: slot.start_time,
        endTime: slot.end_time,
        weekKey: slot.week_key
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
  const { email, userType, availability, abilities } = req.body;
  
  if (!email || !userType || !availability) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validation: prevent scheduling for past dates
  const currentWeekKey = getCurrentWeekKey();
  const pastSlots = availability.filter(slot => slot.weekKey && slot.weekKey < currentWeekKey);
  if (pastSlots.length > 0) {
    return res.status(400).json({ error: 'Cannot schedule availability for past weeks' });
  }

  const userId = uuidv4();

  // Check if user already exists
  db.get(`SELECT id FROM users WHERE email = ?`, [email], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    const userIdToUse = existingUser ? existingUser.id : userId;

    // Insert or update user
    const userQuery = existingUser 
      ? `UPDATE users SET user_type = ?, week_key = ? WHERE id = ?`
      : `INSERT INTO users (id, email, user_type, week_key) VALUES (?, ?, ?, ?)`;
    
    const userParams = existingUser 
      ? [userType, currentWeekKey, userIdToUse]
      : [userIdToUse, email, userType, currentWeekKey];

    db.run(userQuery, userParams, function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Delete existing availability and abilities for this user
      db.run(`DELETE FROM availability WHERE user_id = ?`, [userIdToUse], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        db.run(`DELETE FROM abilities WHERE user_id = ?`, [userIdToUse], (err) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          // Insert availability slots with their respective week keys
          if (availability.length > 0) {
            const availabilityStmt = db.prepare(`INSERT INTO availability (user_id, day_of_week, start_time, end_time, week_key) VALUES (?, ?, ?, ?, ?)`);
            
            availability.forEach(slot => {
              const weekKeyToUse = slot.weekKey || currentWeekKey; // Default to current week if not specified
              availabilityStmt.run([userIdToUse, slot.dayOfWeek, slot.startTime, slot.endTime, weekKeyToUse]);
            });
            
            availabilityStmt.finalize();
          }

          // Insert abilities if user is a mentor (abilities are associated with the user, not week-specific)
          if (userType === 'mentor' && abilities && abilities.length > 0) {
            const abilitiesStmt = db.prepare(`INSERT INTO abilities (user_id, ability, week_key) VALUES (?, ?, ?)`);
            
            abilities.forEach(ability => {
              abilitiesStmt.run([userIdToUse, ability, currentWeekKey]);
            });
            
            abilitiesStmt.finalize();
          }
          
          res.json({ success: true, userId: userIdToUse });
        });
      });
    });
  });
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

    // Get user's availability from current and future weeks
    db.all(`SELECT * FROM availability WHERE user_id = ? AND week_key >= ?`, [userId, currentWeekKey], (err, userAvailability) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Get opposite type users' availability from current and future weeks
      db.all(`
        SELECT a.*, u.email, u.user_type, u.id as user_id 
        FROM availability a 
        JOIN users u ON a.user_id = u.id 
        WHERE u.user_type = ? AND a.week_key >= ?
      `, [oppositeType, currentWeekKey], (err, otherAvailability) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        // Get abilities for mentors (if user is mentee, get mentor abilities)
        const shouldGetAbilities = user.user_type === 'mentee';
        
        if (shouldGetAbilities) {
          // Get abilities for all mentors
          db.all(`
            SELECT ab.user_id, ab.ability 
            FROM abilities ab 
            JOIN users u ON ab.user_id = u.id 
            WHERE u.user_type = 'mentor' AND ab.week_key = ?
          `, [currentWeekKey], (err, mentorAbilities) => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }

            // Group abilities by user ID
            const abilitiesByUser = {};
            mentorAbilities.forEach(ability => {
              if (!abilitiesByUser[ability.user_id]) {
                abilitiesByUser[ability.user_id] = [];
              }
              abilitiesByUser[ability.user_id].push(ability.ability);
            });

            // Find overlapping time slots
            const matches = [];
            
            userAvailability.forEach(userSlot => {
              otherAvailability.forEach(otherSlot => {
                // Match slots from the same week and same day
                if (userSlot.day_of_week === otherSlot.day_of_week && userSlot.week_key === otherSlot.week_key) {
                  const overlap = findTimeOverlap(userSlot, otherSlot);
                  if (overlap && overlap.duration >= 30) { // Minimum 30 minutes
                    matches.push({
                      partnerId: otherSlot.user_id,
                      partnerEmail: otherSlot.email,
                      dayOfWeek: userSlot.day_of_week,
                      startTime: overlap.startTime,
                      endTime: overlap.endTime,
                      duration: overlap.duration,
                      abilities: abilitiesByUser[otherSlot.user_id] || [],
                      weekKey: userSlot.week_key
                    });
                  }
                }
              });
            });

            // Limit to 5 matches and distribute evenly
            const limitedMatches = distributeMatches(matches, 5);
            
            res.json({ matches: limitedMatches });
          });
        } else {
          // For mentors, don't need to get abilities
          // Find overlapping time slots
          const matches = [];
          
          userAvailability.forEach(userSlot => {
            otherAvailability.forEach(otherSlot => {
              // Match slots from the same week and same day
              if (userSlot.day_of_week === otherSlot.day_of_week && userSlot.week_key === otherSlot.week_key) {
                const overlap = findTimeOverlap(userSlot, otherSlot);
                if (overlap && overlap.duration >= 30) { // Minimum 30 minutes
                  matches.push({
                    partnerId: otherSlot.user_id,
                    partnerEmail: otherSlot.email,
                    dayOfWeek: userSlot.day_of_week,
                    startTime: overlap.startTime,
                    endTime: overlap.endTime,
                    duration: overlap.duration,
                    weekKey: userSlot.week_key
                  });
                }
              }
            });
          });

          // Limit to 5 matches and distribute evenly
          const limitedMatches = distributeMatches(matches, 5);
          
          res.json({ matches: limitedMatches });
        }
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
  const { mentorEmail, menteeEmail, scheduledTime, scheduledDate, dayOfWeek, weekKey } = req.body;
  
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
      from: `"${process.env.EMAIL_FROM_NAME || 'Mentor Match'}" <${process.env.EMAIL_USER}>`,
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
      from: `"${process.env.EMAIL_FROM_NAME || 'Mentor Match'}" <${process.env.EMAIL_USER}>`,
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

    // Get user IDs from emails to record the match
    const mentorUser = await new Promise((resolve, reject) => {
      db.get(`SELECT id FROM users WHERE email = ?`, [mentorEmail], (err, user) => {
        if (err) reject(err);
        else resolve(user);
      });
    });

    const menteeUser = await new Promise((resolve, reject) => {
      db.get(`SELECT id FROM users WHERE email = ?`, [menteeEmail], (err, user) => {
        if (err) reject(err);
        else resolve(user);
      });
    });

    // Record the match in the database (even if user IDs aren't found, we still sent the email)
    let matchId = null;
    if (mentorUser && menteeUser) {
      try {
        matchId = await new Promise((resolve, reject) => {
          db.run(`
            INSERT INTO matches (mentor_id, mentee_id, scheduled_date, scheduled_time, status) 
            VALUES (?, ?, ?, ?, 'sent')
          `, [mentorUser.id, menteeUser.id, scheduledDate, scheduledTime], function(err) {
            if (err) {
              console.error('Failed to record match in database:', err);
              resolve(null); // Don't fail the whole operation
            } else {
              console.log('Match recorded with ID:', this.lastID);
              resolve(this.lastID);
            }
          });
        });
      } catch (error) {
        console.error('Error recording match:', error);
      }
    }

    console.log(`Invitation emails sent successfully:
      Mentor: ${mentorEmail}
      Mentee: ${menteeEmail}
      Date: ${scheduledDate}
      Time: ${scheduledTime}
      Match ID: ${matchId || 'Not recorded'}
      Calendar Event: ${calendarResult.success ? calendarResult.eventLink : 'Failed to create'}
    `);

    res.json({ 
      success: true, 
      message: 'Invitation emails sent successfully',
      matchId: matchId,
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

// Get overall platform metrics
app.get('/api/metrics', (req, res) => {
  const queries = {
    totalUsers: 'SELECT COUNT(*) as count FROM users',
    totalMentors: 'SELECT COUNT(*) as count FROM users WHERE user_type = "mentor"',
    totalMentees: 'SELECT COUNT(*) as count FROM users WHERE user_type = "mentee"',
    totalSessions: 'SELECT COUNT(*) as count FROM matches',
    pendingSessions: 'SELECT COUNT(*) as count FROM matches WHERE status = "sent"',
    thisWeekUsers: `SELECT COUNT(*) as count FROM users WHERE week_key = "${getCurrentWeekKey()}"`
  };

  const results = {};
  const queryKeys = Object.keys(queries);
  let completedQueries = 0;

  queryKeys.forEach(key => {
    db.get(queries[key], (err, result) => {
      if (err) {
        console.error(`Error in ${key} query:`, err);
        results[key] = 0;
      } else {
        results[key] = result.count;
      }
      
      completedQueries++;
      if (completedQueries === queryKeys.length) {
        res.json({
          success: true,
          metrics: {
            users: {
              total: results.totalUsers,
              mentors: results.totalMentors,
              mentees: results.totalMentees,
              thisWeek: results.thisWeekUsers
            },
            sessions: {
              total: results.totalSessions,
              pending: results.pendingSessions,
              completed: results.totalSessions - results.pendingSessions
            }
          },
          generatedAt: new Date().toISOString()
        });
      }
    });
  });
});

// Get detailed session history
app.get('/api/metrics/sessions', (req, res) => {
  db.all(`
    SELECT 
      m.*,
      mentor.email as mentor_email,
      mentee.email as mentee_email,
      m.created_at as invitation_sent_at
    FROM matches m
    JOIN users mentor ON m.mentor_id = mentor.id
    JOIN users mentee ON m.mentee_id = mentee.id
    ORDER BY m.created_at DESC
    LIMIT 100
  `, (err, sessions) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({
      success: true,
      sessions: sessions,
      total: sessions.length
    });
  });
});

// Get weekly session stats
app.get('/api/metrics/weekly', (req, res) => {
  db.all(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as sessions_count
    FROM matches 
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `, (err, dailyStats) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({
      success: true,
      dailyStats: dailyStats
    });
  });
});

// Get user registration stats
app.get('/api/metrics/users', (req, res) => {
  db.all(`
    SELECT 
      DATE(created_at) as date,
      user_type,
      COUNT(*) as count
    FROM users 
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY DATE(created_at), user_type
    ORDER BY date DESC
  `, (err, userStats) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({
      success: true,
      userStats: userStats
    });
  });
});

// Get current metrics (works even with existing data)
app.get('/api/metrics/current', (req, res) => {
  const currentWeekKey = getCurrentWeekKey();
  
  Promise.all([
    // Total users ever registered
    new Promise((resolve) => {
      db.get('SELECT COUNT(*) as count FROM users', (err, result) => {
        resolve(err ? 0 : result.count);
      });
    }),
    
    // Users this week
    new Promise((resolve) => {
      db.get(`SELECT COUNT(*) as count FROM users WHERE week_key = ?`, [currentWeekKey], (err, result) => {
        resolve(err ? 0 : result.count);
      });
    }),
    
    // Mentors vs mentees this week
    new Promise((resolve) => {
      db.all(`SELECT user_type, COUNT(*) as count FROM users WHERE week_key = ? GROUP BY user_type`, [currentWeekKey], (err, result) => {
        resolve(err ? [] : result);
      });
    }),

    // Total sessions from matches table
    new Promise((resolve) => {
      db.get('SELECT COUNT(*) as count FROM matches', (err, result) => {
        resolve(err ? 0 : result.count);
      });
    })
  ]).then(([totalUsers, weeklyUsers, userTypes, totalSessions]) => {
    const breakdown = userTypes.reduce((acc, item) => {
      acc[item.user_type] = item.count;
      return acc;
    }, {});

    res.json({
      success: true,
      metrics: {
        totalUsersEver: totalUsers,
        usersThisWeek: weeklyUsers,
        totalSessions: totalSessions,
        breakdown: {
          mentors: breakdown.mentor || 0,
          mentees: breakdown.mentee || 0
        }
      },
      weekKey: currentWeekKey,
      generatedAt: new Date().toISOString()
    });
  });
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