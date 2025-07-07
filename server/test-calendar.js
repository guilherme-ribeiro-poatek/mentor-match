const { google } = require('googleapis');
require('dotenv').config();

async function testCalendarAPI() {
  try {
    console.log('Testing Google Calendar API configuration...');
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    // Test by listing calendars
    const response = await calendar.calendarList.list();
    console.log('✅ Google Calendar API is working!');
    console.log('📅 Available calendars:');
    response.data.items.forEach((cal, index) => {
      console.log(`${index + 1}. ${cal.summary} (${cal.id})`);
    });
    
  } catch (error) {
    console.error('❌ Error testing Google Calendar API:', error.message);
    
    if (error.message.includes('private_key')) {
      console.log('💡 Make sure your GOOGLE_PRIVATE_KEY is properly formatted in the .env file');
    } else if (error.message.includes('client_email')) {
      console.log('💡 Make sure your GOOGLE_CLIENT_EMAIL is correct in the .env file');
    }
  }
}

testCalendarAPI(); 