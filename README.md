# Productivity Hub 🚀

A comprehensive productivity suite featuring a Pomodoro timer, task management, habit tracking, notes, analytics, and more. Built with vanilla JavaScript, HTML5, CSS3, and Firebase for cloud synchronization.

https://my-productive-hub-project.web.app/index.html

## 🌟 Features Overview

### ⏱️ Pomodoro Timer

- **Work/Break Cycles**: Automatic switching between focused work and rest periods
- **Multiple Presets**: 25/5, 50/10, 75/15, or custom durations
- **Activity Tracking**: Track time across 6 categories (Work, Study, Exercise, Reading, Coding, Other)
- **Daily Statistics**: Sessions completed, current streak, daily goal progress
- **Background Timer**: Continues running even when tab is inactive (Web Worker powered)
- **Sound Notifications**: Distinct audio alerts for work/break transitions
- **Browser Notifications**: Desktop notifications when sessions complete

### ✅ Task Management

- **Kanban Board**: Organize tasks in To Do, Doing, and Done columns
- **Drag & Drop**: Intuitive task organization
- **Tags & Colors**: Custom tags with color coding
- **Due Dates & Deadlines**: Set dates and times for tasks
- **Media Attachments**: Add images and files to tasks
- **Recurring Tasks**: Daily, weekly, or custom recurrence patterns
- **Custom Trackers**: Create trackers for any tag to monitor task completion
- **Priority Levels**: High, medium, low priority indicators

### 🎯 Habit Tracking

- **Daily Habits**: Create and track daily habits
- **Completion History**: Visual calendar showing habit streaks
- **Multiple Habits**: Track unlimited habits simultaneously
- **Streak Tracking**: Monitor consecutive completion days

### 📝 Notes & Journal

- **Quick Notes**: Capture thoughts and ideas instantly
- **Daily Journal**: Reflect on your day with journal entries
- **Rich Text**: Format your notes as needed
- **Search**: Find notes quickly

### 📊 Analytics Dashboard

- **Focus Time Trends**: Visualize work patterns (week/month/year views)
- **Activity Breakdown**: See time distribution across activities
- **Productivity Score**: Combined metric based on focus, tasks, and habits
- **Task Completion Stats**: Track task completion rates
- **Habit Completion Rate**: Monitor habit adherence
- **Export Data**: Download your data as JSON

### 🎨 Customization

- **Theme Support**: Light and dark modes
- **Custom Tag Colors**: Personalize tag appearances
- **Keyboard Shortcuts**: Quick actions for power users
- **Sound Settings**: Customize notification sounds

### ☁️ Cloud Sync (Firebase)

- **User Authentication**: Sign up/login with email or Google
- **Real-time Sync**: Data synchronized across devices
- **Offline Support**: Works offline with local storage fallback
- **Secure**: Firebase security rules protect your data

## 🚀 Getting Started

### Live Demo

Visit: [Your deployed URL]

### Local Development

1. **Clone the repository**

   ```bash
   git clone https://github.com/abdelrhmanKh/pomodoro-timer.git
   cd pomodoro-timer
   ```

2. **Open in browser**

   - Simply open `index.html` in your browser, or
   - Use VS Code Live Server extension for development

3. **Firebase Setup** (Optional - for cloud sync)
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable Authentication (Email/Password and Google)
   - Enable Firestore Database
   - Update `firebase-config.js` with your credentials

## 📁 Project Structure

```
pomodoro-timer/
├── index.html          # Main app page
├── login.html          # Authentication page
├── main.js             # Core app logic & navigation
├── pomodoro.js         # Timer functionality
├── tasks.js            # Task management
├── habits.js           # Habit tracking
├── notes.js            # Notes & journal
├── analytics.js        # Statistics & charts
├── dashboard.js        # Dashboard widgets
├── auth.js             # Authentication
├── firebase-config.js  # Firebase configuration
├── timer-worker.js     # Web Worker for background timer
├── sw.js               # Service Worker for offline support
├── *.css               # Stylesheets for each module
├── assets/             # Images and static files
├── firebase.json       # Firebase hosting config
├── firestore.rules     # Firestore security rules
└── README.md           # This file
```

## 🔧 Technical Details

### Technologies Used

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Backend**: Firebase (Authentication, Firestore)
- **Storage**: localStorage (offline) + Firestore (cloud sync)
- **Audio**: Web Audio API
- **Background Processing**: Web Workers
- **Offline Support**: Service Workers

### Key Features Implementation

**Reliable Background Timer**

- Web Worker ensures timer accuracy even when tab is inactive
- Timestamp-based calculation handles browser throttling
- Automatic session restoration on page reload

**Data Synchronization**

- Real-time listeners for instant updates
- Debounced writes to reduce Firebase calls
- Conflict resolution favoring valid data over NaN values
- Offline-first with automatic sync when online

**Responsive Design**

- Mobile-first approach
- Adaptive layouts for all screen sizes
- Touch-friendly controls

## 📱 Browser Compatibility

| Browser         | Support         |
| --------------- | --------------- |
| Chrome/Edge     | ✅ Full Support |
| Firefox         | ✅ Full Support |
| Safari          | ✅ Full Support |
| Mobile Browsers | ✅ Responsive   |

**Requirements**: JavaScript enabled, localStorage support

## 🔒 Privacy & Security

- **Local-first**: Works completely offline
- **No tracking**: No analytics or third-party scripts
- **Secure sync**: Firebase security rules protect user data
- **Your data**: Export anytime, delete anytime

## 🎯 Usage Tips

1. **Pomodoro Technique**: Work in focused 25-minute intervals with 5-minute breaks
2. **Track Activities**: Use activity types to understand where your time goes
3. **Set Daily Goals**: Configure a realistic daily focus time goal
4. **Use Tags**: Organize tasks with colored tags for quick identification
5. **Build Habits**: Start small and build consistency with habit tracking
6. **Review Analytics**: Check weekly trends to optimize your productivity

## 🛠️ Development

### Firebase Deployment

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy to hosting
firebase deploy --only hosting
```

### Local Testing with Firebase

```bash
# Start Firebase emulators
firebase emulators:start
```

## 📄 License

Free to use, modify, and distribute. No restrictions.

## 👤 Author

Created by [abdelrhmanKh](https://github.com/abdelrhmanKh)

---

**Ready to boost your productivity? Start using Productivity Hub today!** 🚀

For questions or suggestions, feel free to create an issue on GitHub.
