const { google } = require('googleapis');
require('dotenv').config();

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

async function testCalendarEventCreation() {
  try {
    console.log('🧪 Testing fixed calendar event creation...');
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    // Test data
    const testMentorEmail = 'mentor@test.com';
    const testMenteeEmail = 'mentee@test.com';
    const testDayOfWeek = 'Monday';
    const testScheduledTime = '2:00 PM - 2:30 PM';
    
    console.log('📋 Test data:');
    console.log(`  Mentor: ${testMentorEmail}`);
    console.log(`  Mentee: ${testMenteeEmail}`);
    console.log(`  Day: ${testDayOfWeek}`);
    console.log(`  Time: ${testScheduledTime}`);
    
    // Parse the scheduled time
    const [startTimeStr, endTimeStr] = testScheduledTime.split(' - ');
    const eventDate = getNextWeekdayDate(testDayOfWeek);
    const startDateTime = new Date(`${eventDate}T${convertTo24Hour(startTimeStr)}:00`);
    const endDateTime = new Date(`${eventDate}T${convertTo24Hour(endTimeStr)}:00`);

    console.log('\n🔧 Converted data:');
    console.log(`  Event date: ${eventDate}`);
    console.log(`  Start time: ${convertTo24Hour(startTimeStr)} (from ${startTimeStr})`);
    console.log(`  End time: ${convertTo24Hour(endTimeStr)} (from ${endTimeStr})`);
    console.log(`  Start DateTime: ${startDateTime.toISOString()}`);
    console.log(`  End DateTime: ${endDateTime.toISOString()}`);

    const event = {
      summary: 'Mentor Match - Test Event',
      description: `TEST: Mentoring session\nMentor: ${testMentorEmail}\nMentee: ${testMenteeEmail}`,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      // NO attendees field - this was causing the 403 error
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 15 }
        ]
      },
      conferenceData: {
        createRequest: {
          requestId: Date.now().toString(),
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    };

    console.log('\n📅 Creating calendar event...');
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1
      // NO sendUpdates parameter
    });

    console.log('✅ SUCCESS! Event created:');
    console.log(`  Event ID: ${response.data.id}`);
    console.log(`  Event Link: ${response.data.htmlLink}`);
    console.log(`  Meet Link: ${response.data.conferenceData?.entryPoints?.[0]?.uri || 'No meet link'}`);
    
    return true;
  } catch (error) {
    console.error('❌ FAILED! Error creating calendar event:', error.message);
    return false;
  }
}

testCalendarEventCreation(); 