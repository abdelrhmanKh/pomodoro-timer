# Pomodoro Timer 🍅

A feature-rich Pomodoro timer web application built with vanilla JavaScript, HTML5, and CSS3. Track your work sessions by activity type, set custom time intervals, and maintain productivity with focused work intervals and structured breaks.

## Features

### ⏱️ Core Timer Functionality

- **Work/Break Cycles**: Alternate between focused work sessions and rest periods
- **Multiple Presets**: Choose from preset combinations:
  - 25 minutes work / 5 minutes break (Classic)
  - 50 minutes work / 10 minutes break (Extended)
  - 75 minutes work / 15 minutes break (Marathon)
  - Custom time configuration with pencil icon editor
- **Start/Pause/Reset Controls**: Full control over your timer
- **Responsive Timer Display**: Large, easy-to-read time display with mode indicator

### 📊 Activity Tracking & Statistics

- **Activity Type Selection**: Choose from 6 activity categories:
  - Work
  - Study
  - Exercise
  - Reading
  - Coding
  - Other
- **Per-Activity Statistics**: Track cycles and total work time for each activity type
- **Summary Panel**: View your progress in real-time (top-left of screen)
  - Cycles breakdown by activity
  - Total work time per activity (breaks excluded)
- **Smart Time Accounting**: Only counts sessions ≥ 5 minutes to avoid inflating stats

### 🔊 Notifications

- **Distinct Sound Alerts**:
  - Ring tone (1200Hz) when work session ends
  - Double beep (800Hz) when break ends
- **Visual & Audio Feedback**: Know exactly when to switch modes

### 💾 Data Persistence

- **Local Storage**: All data stored locally in your browser
- **Session Persistence**: Timer continues running even when you navigate away
- **Automatic Saving**: Progress saved every 10 seconds and on page visibility changes
- **Session Restoration**: Automatically restores active timer with accurate elapsed time calculation

### 🎓 User Onboarding

- **Interactive Introduction**: 8-step guided tutorial for first-time users
  1. Welcome to Pomodoro Timer
  2. Track Your Progress (summary panel explanation)
  3. Choose Your Activity (activity selector)
  4. Pick Your Time (presets and custom options)
  5. Start Your Session (start button)
  6. Useful Tools (help and clear data buttons)
  7. Pro Tips (5-minute threshold, background timer)
  8. You're Ready (final encouragement)
- **Reintroduce Button**: View the tutorial anytime by clicking the "?" button
- **Skip Option**: Skip introduction to start immediately

### 🛠️ Additional Features

- **Custom Time Configuration Modal**: Set your own work/break intervals
- **Clear Data Function**: Reset all statistics with confirmation modal
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Dark Theme**: Eye-friendly dark interface with red and green accents
- **Smooth Animations**: Polished UI transitions and visual feedback

## How to Use

### Getting Started

1. Open `index.html` in your web browser
2. On first visit, you'll see an interactive introduction (8 steps)
3. Skip the introduction or follow it to learn all features

### Basic Usage

1. **Select Activity Type**: Choose what you're working on from the dropdown
2. **Pick Time Preset**: Select your preferred work/break duration
   - Use the pencil icon (✏️) to customize time intervals
3. **Start Timer**: Click the "Start" button to begin
4. **Work During Session**: Focus on your task for the set duration
5. **Break Time**: Timer automatically switches to break mode with a notification
6. **Review Progress**: Check your statistics in the summary panel (top-left)

### Custom Time Configuration

- Click the pencil icon (✏️) next to "Custom" button
- Enter desired work and break durations in minutes
- Save your custom preset
- Your custom times are remembered for future sessions

### Managing Data

- **View Statistics**: Check the summary panel showing cycles and work time per activity
- **Clear All Data**: Click the trash icon (🗑️) in the top-right corner
  - Confirm deletion when prompted
  - This will reset all statistics and activity tracking
- **Replay Introduction**: Click the "?" button to see the tutorial again

## Technical Details

### Technologies Used

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Storage**: Browser localStorage API
- **Audio**: Web Audio API for custom notification sounds
- **Styling**: CSS3 Flexbox, Grid, Gradients, Glassmorphism effects
- **No Dependencies**: Pure vanilla implementation, no frameworks or libraries required

### File Structure

```
pomodoro-timer/
├── assets/images       #Images that appear in the inrtoduction window
├── index.html          # Page structure and modals
├── main.css            # Complete styling and responsive design
├── main.js             # Application logic and state management
└── README.md          # This file
```

### How It Works

**Timer System**

- Main timer runs on a 1-second interval using `setInterval()`
- Timestamps used for background timing accuracy
- Elapsed time calculated as: `currentTime - sessionStartTime`

**Storage Architecture**

- **pomodoroData**: Main statistics object containing per-activity data
- **pomodoroSession**: Active timer state with remaining time and timestamps
- **pomodoroFirstTime**: Boolean flag for first-time user detection

**Activity Statistics**

```javascript
{
  work: { cycles: 5, totalWorkTime: 125 },
  study: { cycles: 3, totalWorkTime: 75 },
  exercise: { cycles: 1, totalWorkTime: 25 },
  // ... other activities
}
```

**Key Functions**

- `tick()`: Main timer callback, runs every second
- `saveToStorage()` / `loadFromStorage()`: Persistence layer
- `saveTimerSession()` / `restoreTimerSession()`: Background timer support
- `playWorkEndSound()` / `playBreakEndSound()`: Audio notifications
- `updateIntroStep()`: Tutorial navigation

## Data Persistence Details

### Automatic Saving

- Every 10 seconds during active timer
- On page visibility changes (tab switch, minimize)
- On activity type change
- On preset selection

### Background Timer

- Timer continues running when you navigate away
- Closing the tab and reopening restores your session
- Elapsed time calculated from system clock, not just saved remaining time
- Accurate to the second even after browser/device restarts

### Time Accounting

- Only counts work sessions ≥ 5 minutes
- Prevents inflating statistics from brief interruptions
- Rest/break time is not counted toward work time totals
- Automatic on session reset

## Browser Compatibility

- **Chrome/Edge**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Full support
- **Mobile Browsers**: Fully responsive and functional
- **Requirements**: JavaScript enabled, localStorage support

## Activity Types

The timer supports tracking six different activity types:

| Activity     | Use Case                                      |
| ------------ | --------------------------------------------- |
| **Work**     | Professional tasks, office work               |
| **Study**    | Academic learning, courses, reading materials |
| **Exercise** | Fitness, workouts, physical activities        |
| **Reading**  | Books, articles, documentation                |
| **Coding**   | Programming, development, debugging           |
| **Other**    | Miscellaneous tasks                           |

Each activity tracks:

- Number of completed cycles
- Total work time (excluding breaks)

## Tips for Maximum Productivity

1. **Stick to the Technique**: Follow the Pomodoro principle strictly
2. **Minimize Distractions**: Silence notifications during work sessions
3. **Track Patterns**: Monitor which activities take the longest
4. **Vary Durations**: Experiment with 25/5, 50/10, and 75/15 presets
5. **Use Activity Categories**: Helps you understand where your time goes
6. **Take Real Breaks**: Don't skip break time—it's essential for focus
7. **Daily Reset**: Clear data weekly to start fresh and track weekly progress

## Known Limitations

- Storage limited to browser's localStorage (typically 5-10MB)
- Data is device/browser specific—not synchronized across devices
- Clearing browser data will erase all statistics
- Background timer accuracy depends on system clock

## Future Enhancement Ideas

- Export statistics to CSV/PDF
- Cloud synchronization across devices
- Weekly/monthly reports and charts
- Recurring tasks and templates
- Desktop notifications (Notification API)
- Keyboard shortcuts for controls
- Multiple timer sessions simultaneously
- Customizable notification sounds

## Privacy & Data

- **No Server Required**: Everything runs locally in your browser
- **No Data Collection**: No data is sent to external servers
- **No Tracking**: No analytics or tracking scripts
- **Your Data**: Completely under your control in localStorage

## Getting Started Locally

### Method 1: Direct Open

1. Download all files
2. Open `index.html` in your browser
3. Start using immediately—no installation needed

### Method 2: Local Server (Recommended)

1. Use VS Code Live Server extension

### Method 3: Deployment

- Upload files to any web hosting service
- GitHub Pages (free)
- Netlify
- Vercel
- Any static file hosting

## License

Free to use, modify, and distribute. No restrictions.

## Author

Created as a productivity tool for the Pomodoro Technique enthusiasts.

---

**Ready to boost your productivity? Start using Pomodoro Timer today!** 🚀

For questions or suggestions, feel free to reach out or create an issue on GitHub.
