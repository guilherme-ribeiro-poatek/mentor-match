const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
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

// Email configuration (placeholder)
const transporter = nodemailer.createTransport({
  // Configure with actual email service
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// API Routes

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

// Send invitation email (placeholder)
app.post('/api/send-invitation', (req, res) => {
  const { mentorEmail, menteeEmail, scheduledTime, scheduledDate } = req.body;
  
  // Placeholder for email sending
  console.log(`Sending invitation:
    Mentor: ${mentorEmail}
    Mentee: ${menteeEmail}
    Date: ${scheduledDate}
    Time: ${scheduledTime}
  `);
  
  // In a real implementation, you would send actual emails here
  res.json({ success: true, message: 'Invitation sent successfully' });
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