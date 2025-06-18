# Mentor Match

A modern web application that connects mentors with mentees based on their availability. Built with React, Node.js, Express, and SQLite.

## Features

- **User Type Selection**: Choose to be a mentor or mentee
- **Email Registration**: Simple email-based registration
- **Weekly Calendar**: Interactive calendar for selecting availability (30-minute time blocks)
- **Smart Matching**: Automatic matching based on overlapping availability
- **Real-time Results**: Up to 5 suggested meeting times
- **Responsive Design**: Works perfectly on desktop and mobile devices
- **Data Management**: Automatic weekly data renewal
- **Email Integration**: Placeholder for future email invitations

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Backend**: Node.js with Express
- **Database**: SQLite (easily upgradeable to PostgreSQL)
- **Styling**: Tailwind CSS
- **State Management**: React Hooks

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mentor-match
   ```

2. **Install all dependencies**
   ```bash
   npm run install-all
   ```

3. **Create environment file** (optional for email functionality)
   ```bash
   cd server
   cp .env.example .env
   # Edit .env with your email configuration
   ```

## Usage

1. **Start the development servers**
   ```bash
   npm run dev
   ```
   This will start both the backend server (port 5000) and frontend development server (port 3000).

2. **Access the application**
   Open your browser and go to `http://localhost:3000`

## How It Works

### Page 1: User Input
- Select whether you want to be a mentor or mentee
- Enter your email address
- Use the interactive weekly calendar to select your availability
- Each time slot represents 30 minutes
- Submit your information to find matches

### Page 2: Loading
- Shows a loading animation while searching for matches
- Backend processes your availability and compares with opposite user types
- Finds overlapping time slots of at least 30 minutes

### Page 3: Results
- **If matches found**: Displays up to 5 suggested meeting times
- **If no matches**: Shows helpful message and suggestions
- Option to send invitations to matched users
- "Start Over" button to register again

## API Endpoints

- `POST /api/register` - Register user with availability
- `POST /api/find-matches` - Find matching users
- `POST /api/send-invitation` - Send meeting invitation (placeholder)
- `GET /api/health` - Health check

## Database Schema

### Users Table
- `id`: Unique user identifier
- `email`: User email address
- `user_type`: 'mentor' or 'mentee'
- `week_key`: Week identifier for data cleanup
- `created_at`: Registration timestamp

### Availability Table
- `user_id`: Reference to user
- `day_of_week`: 0-6 (Sunday to Saturday)
- `start_time`: Time in HH:MM format
- `end_time`: Time in HH:MM format
- `week_key`: Week identifier

### Matches Table
- `mentor_id`: Reference to mentor user
- `mentee_id`: Reference to mentee user
- `scheduled_date`: Meeting date
- `scheduled_time`: Meeting time
- `status`: Meeting status

## Security Features

- Rate limiting (100 requests per 15 minutes)
- Helmet.js for security headers
- Input validation and sanitization
- CORS protection
- SQL injection prevention

## Data Management

- **Weekly Reset**: Data older than the current week is automatically cleaned up
- **Session Storage**: Frontend uses session storage for navigation state
- **Error Handling**: Comprehensive error handling throughout the application

## Customization

### Time Slots
To modify available time slots, edit the `generateTimeSlots()` function in `client/src/components/WeeklyCalendar.tsx`.

### Email Integration
Configure email settings in the server environment file and implement the email sending logic in `server/index.js`.

### Styling
The application uses Tailwind CSS. Modify styles in:
- `client/src/index.css` for global styles
- Individual component files for component-specific styles

## Future Enhancements

- [ ] Real email integration with templates
- [ ] Calendar integration (Google Calendar, Outlook)
- [ ] Video conferencing integration
- [ ] User profiles and preferences
- [ ] Meeting history and feedback
- [ ] Advanced matching algorithms
- [ ] Mobile app version
- [ ] Multi-week availability

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email support@mentormatch.com or create an issue in the repository. 