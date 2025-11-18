# Guidance Counselor Session Analytics (GCSA) Tool

A comprehensive web application built with vanilla JavaScript, MediaPipe, and Node.js that analyzes student behavior during counseling sessions through real-time pose detection and stress analysis.

## Features

### 🎯 Core Functionality
- **Real-time Pose Detection**: Uses MediaPipe to track body landmarks and analyze posture
- **Stress Analysis**: Calculates stress scores based on kinetic, postural, and engagement metrics
- **Session Management**: Start, monitor, and stop counseling sessions with detailed analytics
- **Visual Feedback**: Live status indicators and real-time prompts during sessions
- **Comprehensive Analytics**: Detailed charts and insights after session completion

### 📊 Metrics Tracked
- **Kinetic Stress**: Wrist/ankle velocity and hand-to-face proximity
- **Postural Tension**: Shoulder elevation and arm/leg crossing detection
- **Engagement Score**: Head orientation and tracking analysis
- **Master Stress Score**: Weighted average of all metrics (0-100 scale)

### 🎨 User Interface
- **Light Background Design**: Clean, non-distracting interface with soft blue accents
- **Rounded Elements**: Modern, eye-pleasing design with smooth animations
- **Three-Panel Layout**: Setup, Session, and Analytics views
- **Responsive Design**: Works on desktop and mobile devices

## Installation

### Prerequisites
- Node.js (version 16.0.0 or higher)
- npm or yarn package manager
- Modern web browser with camera access
- Internet connection (for MediaPipe CDN)

### Setup Instructions

1. **Clone or download the project files**
   ```bash
   # If using git
   git clone <repository-url>
   cd gcsa-tool
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the application**
   ```bash
   # For development (with auto-restart)
   npm run dev
   
   # For production
   npm start
   ```

4. **Access the application**
   - Open your web browser
   - Navigate to `http://localhost:3000`
   - Allow camera permissions when prompted

## Usage Guide

### 1. Setup Panel
- Enter session name (required)
- Add session details (optional)
- Click "Start Camera" to initialize the webcam

### 2. Session Panel
- **Start Session**: Begin monitoring and data collection
- **Real-time Feedback**: 
  - Status indicator (CALM/VIGILANCE/TENSE)
  - Live prompts based on detected stress levels
  - Visual pose overlay on video feed
- **Stop Session**: End monitoring and view analytics

### 3. Analytics Panel
- **Stress Score Chart**: Line graph showing stress levels over time
- **Key Metrics**: Percentage of time in different stress states
- **Actionable Insights**: AI-generated analysis and recommendations
- **Resource Recommendations**: Curated links for further support

## Technical Architecture

### Frontend
- **HTML5**: Semantic structure with three main panels
- **CSS3**: Modern styling with animations and responsive design
- **Vanilla JavaScript**: No framework dependencies
- **MediaPipe**: Pose and Face Mesh detection
- **Chart.js**: Data visualization

### Backend
- **Node.js**: Runtime environment
- **Express.js**: Web server framework
- **Static File Serving**: Serves HTML, CSS, and JavaScript files
- **REST API**: Simple endpoint for resource management

### Data Flow
1. Camera feed → MediaPipe → Pose/Face detection
2. Landmark data → Metrics calculation → Stress scoring
3. Real-time display → Session data storage
4. Analytics generation → Resource recommendations

## Configuration

### Environment Variables
Create a `.env` file for custom configuration:
```env
PORT=3000
NODE_ENV=development
```

### Customization Options
- **Weights**: Adjust stress calculation weights in `script.js`
- **Thresholds**: Modify stress level thresholds in the metrics functions
- **Resources**: Update `resources.json` with custom recommendations
- **Styling**: Modify `style.css` for different color schemes

## Browser Compatibility

- **Chrome**: Recommended (full MediaPipe support)
- **Firefox**: Good support
- **Safari**: Good support (may require HTTPS)
- **Edge**: Good support

**Note**: Camera access requires HTTPS in production environments.

## Privacy and Security

- **Local Processing**: All pose detection happens client-side
- **No Data Storage**: Session data is temporary and cleared on refresh
- **Camera Access**: Only active during sessions
- **No External APIs**: Except for MediaPipe CDN and resource links

## Troubleshooting

### Common Issues

**Camera Not Working**
- Check browser permissions
- Ensure no other applications are using the camera
- Try a different browser
- Verify HTTPS connection in production

**MediaPipe Loading Issues**
- Check internet connection
- Verify CDN links in HTML
- Clear browser cache

**Server Not Starting**
- Check Node.js version (16.0.0+)
- Verify port availability
- Check for syntax errors in server.js

### Performance Tips
- Use a modern browser for best performance
- Ensure good lighting for pose detection
- Position camera at eye level for best results
- Close unnecessary browser tabs during sessions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For technical support or feature requests:
- Create an issue in the repository
- Contact the development team
- Check the troubleshooting section above

## Acknowledgments

- **MediaPipe**: Google's pose and face detection technology
- **Chart.js**: Data visualization library
- **Express.js**: Web application framework
- **School counseling professionals** who provided requirements and feedback

---

**Note**: This tool is designed to assist guidance counselors in understanding student behavior patterns. It should be used as a supplementary tool alongside professional judgment and established counseling practices.
