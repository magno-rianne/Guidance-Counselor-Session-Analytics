// GCSA Tool - Main JavaScript Logic

// Global variables
let pose, faceMesh, camera;
let sessionData = [];
let isSessionActive = false;
let isCameraActive = false;
let currentPanel = 'setup';
let stressChart = null;
let dataLoggingInterval = null;
let timerInterval = null;
let sessionStartTime = null;
let sessionDuration = 0;

let stressHistory = [];
const SMOOTHING_WINDOW = 30; // Average over 30 frames (about 1 second)
let lastStatusUpdate = 0;
const STATUS_UPDATE_INTERVAL = 1000; // Update status every 1.5 seconds

// Metrics tracking variables
let previousLandmarks = null;
let previousTimestamp = null;
let handToFaceCount = 0;
let armCrossingState = false;
let legCrossingState = false;
let headYawAngle = 0;

// Weights for stress score calculation - more balanced
const WEIGHTS = {
    KINETIC: 0.6,      // Increased from 0.3 to 0.7
    POSTURAL: 0.2,    // Reduced from 0.3 to 0.15
    ENGAGEMENT: 0.2   // Reduced from 0.4 to 0.15
};

const MOVEMENT_THRESHOLDS = {
    CALM: 30,          // Minimal movement threshold
    VIGILANCE: 60,     // Moderate movement threshold
    TENSE: 80          // High movement threshold
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    initializeMediaPipe();
});

// Initialize event listeners
function initializeEventListeners() {
    // Panel switching
    document.querySelectorAll('.panel-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchPanel(this.dataset.panel);
        });
    });

    // Setup panel controls
    document.getElementById('start-camera-btn').addEventListener('click', startCamera);

    // Session panel controls
    document.getElementById('start-session-btn').addEventListener('click', startSession);
    document.getElementById('stop-session-btn').addEventListener('click', stopSession);
}

// Switch between panels
function switchPanel(panelName) {
    // Update button states
    document.querySelectorAll('.panel-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-panel="${panelName}"]`).classList.add('active');

    // Update panel visibility
    document.querySelectorAll('.panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.getElementById(`${panelName}-panel`).classList.add('active');

    currentPanel = panelName;

    // Initialize chart when analytics panel is shown
    if (panelName === 'analytics' && sessionData.length > 0) {
        initializeChart();
    }
}

// Initialize MediaPipe
function initializeMediaPipe() {
    // Initialize Pose
    pose = new Pose({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
    });

    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    pose.onResults(onPoseResults);

    // Initialize Face Mesh
    faceMesh = new FaceMesh({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    faceMesh.onResults(onFaceMeshResults);
}

// Start camera
async function startCamera() {
    try {
        const videoElement = document.getElementById('video-input');
        const canvasElement = document.getElementById('output-canvas');
        
        // Set canvas size to match video
        canvasElement.width = 640;
        canvasElement.height = 480;
        
        // Initialize camera with proper constraints
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 640,
                height: 480,
                facingMode: 'user'
            }
        });
        
        videoElement.srcObject = stream;
        
        // Wait for video to be ready
        videoElement.onloadedmetadata = () => {
            videoElement.play();
            
            // Initialize MediaPipe camera
            camera = new Camera(videoElement, {
                onFrame: async () => {
                    if (pose && faceMesh) {
                        await pose.send({image: videoElement});
                        await faceMesh.send({image: videoElement});
                    }
                },
                width: 640,
                height: 480
            });
            
            camera.start();
        };
        
        isCameraActive = true;
        
        // Switch to session panel
        switchPanel('session');
        
        // Update button text
        document.getElementById('start-camera-btn').textContent = 'Camera Active';
        document.getElementById('start-camera-btn').disabled = true;
        
    } catch (error) {
        console.error('Error starting camera:', error);
        alert('Error accessing camera. Please ensure camera permissions are granted and try again.');
    }
}

// Handle pose results
function onPoseResults(results) {
    const canvasElement = document.getElementById('output-canvas');
    const canvasCtx = canvasElement.getContext('2d');

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        // Draw pose landmarks
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
        drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#FF0000', lineWidth: 1});

        // Calculate metrics if session is active
        if (isSessionActive) {
            calculateMetrics(results.poseLandmarks);
        }
    }

    canvasCtx.restore();
}

// Handle face mesh results
function onFaceMeshResults(results) {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const faceLandmarks = results.multiFaceLandmarks[0];
        calculateHeadOrientation(faceLandmarks);
    }
}

// Add accumulators for better data logging
let accumulatedKineticStress = 0;
let kineticStressSampleCount = 0;

// Modified calculateMetrics to accumulate data
function calculateMetrics(landmarks) {
    const currentTime = Date.now();
    
    // Initialize previous landmarks if not exists
    if (!previousLandmarks) {
        previousLandmarks = landmarks;
        previousTimestamp = currentTime;
        return;
    }

    // Calculate time difference
    const timeDiff = (currentTime - previousTimestamp) / 1000; // Convert to seconds

    // Calculate metrics
    const kineticStress = calculateKineticStress(landmarks, timeDiff);
    const posturalTension = calculatePosturalTension(landmarks);
    const engagementScore = calculateEngagementScore();
    const masterStressScore = calculateMasterStressScore(kineticStress, posturalTension, engagementScore);

    // Accumulate kinetic stress for logging
    accumulatedKineticStress += kineticStress;
    kineticStressSampleCount++;

    // Add to history for smoothing
    stressHistory.push(masterStressScore);
    if (stressHistory.length > SMOOTHING_WINDOW) {
        stressHistory.shift();
    }

    // Calculate smoothed stress score
    const smoothedStress = stressHistory.reduce((a, b) => a + b, 0) / stressHistory.length;

    // Only update status at specified intervals
    if (currentTime - lastStatusUpdate > STATUS_UPDATE_INTERVAL) {
        updateStatusIndicator(smoothedStress);
        updateRealTimePrompt(smoothedStress, kineticStress, posturalTension, engagementScore);
        lastStatusUpdate = currentTime;
    }

    // Store previous landmarks and timestamp
    previousLandmarks = landmarks;
    previousTimestamp = currentTime;
}


// Calculate kinetic stress
function calculateKineticStress(landmarks, timeDiff) {
    let totalVelocity = 0;
    let velocityCount = 0;
    let legMovementVelocity = 0;
    let handMovementVelocity = 0;
    let handToFaceScore = 0;

    // Focus on legs, ankles, and hands
    const legIndices = [25, 26, 27, 28]; // Knees and ankles
    const handIndices = [15, 16];         // Wrists
    const faceIndices = [0, 2, 5];        // Nose and cheeks

    // Calculate leg movement velocity
    legIndices.forEach(index => {
        if (previousLandmarks[index] && landmarks[index]) {
            const prev = previousLandmarks[index];
            const curr = landmarks[index];
            
            const distance = Math.sqrt(
                Math.pow(curr.x - prev.x, 2) + 
                Math.pow(curr.y - prev.y, 2)
            );
            
            const velocity = distance / timeDiff;
            totalVelocity += velocity;
            velocityCount++;
            
            // Track leg movement separately for extra weight
            if (index >= 27) { // Ankle indices
                legMovementVelocity += velocity;
            }
        }
    });

    // Calculate hand movement velocity
    handIndices.forEach(index => {
        if (previousLandmarks[index] && landmarks[index]) {
            const prev = previousLandmarks[index];
            const curr = landmarks[index];
            
            const distance = Math.sqrt(
                Math.pow(curr.x - prev.x, 2) + 
                Math.pow(curr.y - prev.y, 2)
            );
            
            const velocity = distance / timeDiff;
            totalVelocity += velocity;
            velocityCount++;
            handMovementVelocity += velocity;
        }
    });

    // Check hand-to-face proximity with continuous scoring
    handIndices.forEach(handIndex => {
        faceIndices.forEach(faceIndex => {
            if (landmarks[handIndex] && landmarks[faceIndex]) {
                const hand = landmarks[handIndex];
                const face = landmarks[faceIndex];
                
                const distance = Math.sqrt(
                    Math.pow(hand.x - face.x, 2) + 
                    Math.pow(hand.y - face.y, 2)
                );
                
                // Convert distance to a continuous score (0-20)
                // Closer distance = higher score
                if (distance < 0.15) {
                    handToFaceScore = Math.max(handToFaceScore, (0.15 - distance) * 133.33);
                }
            }
        });
    });

    // Calculate average velocity
    const avgVelocity = velocityCount > 0 ? totalVelocity / velocityCount : 0;
    
    // Apply scaling to get a base score (0-100)
    let baseScore = Math.min(avgVelocity * 400, 100); // Adjusted multiplier
    
    // Add continuous leg movement bonus (0-30)
    const legBonus = Math.min(legMovementVelocity * 200, 30);
    
    // Combine scores
    let kineticStress = baseScore + legBonus + handToFaceScore;
    
    // Cap at 100
    kineticStress = Math.min(kineticStress, 100);
    
    return kineticStress;
}

// Check hand-to-face proximity
function checkHandToFaceProximity(landmarks) {
    const wristIndices = [15, 16];
    const faceIndices = [0, 2, 5]; // Nose, left cheek, right cheek

    wristIndices.forEach(wristIndex => {
        faceIndices.forEach(faceIndex => {
            if (landmarks[wristIndex] && landmarks[faceIndex]) {
                const wrist = landmarks[wristIndex];
                const face = landmarks[faceIndex];
                
                const distance = Math.sqrt(
                    Math.pow(wrist.x - face.x, 2) + 
                    Math.pow(wrist.y - face.y, 2)
                );
                
                if (distance < 0.1) { // Threshold for proximity
                    handToFaceCount++;
                }
            }
        });
    });
}

// Calculate postural tension
function calculatePosturalTension(landmarks) {
    let shoulderElevationScore = 0;
    let crossingScore = 0;

    // Calculate shoulder elevation - improved calculation
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    if (leftShoulder && rightShoulder && leftEar && rightEar && leftHip && rightHip) {
        // Calculate shoulder elevation based on vertical distance from ear to shoulder
        // Normal posture: shoulder should be comfortably below ear
        const leftShoulderElevation = Math.abs(leftEar.y - leftShoulder.y);
        const rightShoulderElevation = Math.abs(rightEar.y - rightShoulder.y);
        
        // Normalize by body height (ear to hip distance)
        const leftBodyHeight = Math.abs(leftEar.y - leftHip.y);
        const rightBodyHeight = Math.abs(rightEar.y - rightHip.y);
        
        // Calculate elevation ratio - should be low for normal posture
        const leftRatio = leftShoulderElevation / leftBodyHeight;
        const rightRatio = rightShoulderElevation / rightBodyHeight;
        
        // Average ratio - normal posture should be around 0.3-0.4
        const avgRatio = (leftRatio + rightRatio) / 2;
        
        // Convert to score - higher ratio = more tension
        // Normal range (0.3-0.5) should give low scores
        if (avgRatio < 0.3) {
            shoulderElevationScore = 20; // Very relaxed
        } else if (avgRatio < 0.5) {
            shoulderElevationScore = 30; // Normal posture
        } else if (avgRatio < 0.7) {
            shoulderElevationScore = 60; // Some tension
        } else {
            shoulderElevationScore = 90; // High tension
        }
    }

    // Check for arm and leg crossing
    crossingScore = checkLimbCrossing(landmarks);

    // Combine scores with more weight on shoulder elevation
    return (shoulderElevationScore * 0.7 + crossingScore * 0.3);
}

// Check limb crossing
function checkLimbCrossing(landmarks) {
    let crossingScore = 0;

    // Check arm crossing
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftElbow = landmarks[13];
    const rightElbow = landmarks[14];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    if (leftShoulder && rightShoulder && leftElbow && rightElbow && leftWrist && rightWrist) {
        const armsCrossed = (leftWrist.x > rightShoulder.x && rightWrist.x < leftShoulder.x);
        if (armsCrossed) {
            crossingScore += 50;
        }
    }

    // Check leg crossing
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];

    if (leftHip && rightHip && leftKnee && rightKnee && leftAnkle && rightAnkle) {
        const legsCrossed = (leftAnkle.x > rightHip.x && rightAnkle.x < leftHip.x);
        if (legsCrossed) {
            crossingScore += 50;
        }
    }

    return Math.min(crossingScore, 100);
}

// Calculate engagement score
function calculateEngagementScore() {
    // Use head yaw angle from face mesh - but be much more conservative
    // Small head movements are normal, only significant turns indicate disengagement
    const normalizedYaw = Math.abs(headYawAngle) / 180; // Normalize to 0-1
    
    // Much more conservative scoring - normal head movement should be low
    if (normalizedYaw < 0.1) {
        return 10; // Very engaged - looking straight at camera
    } else if (normalizedYaw < 0.3) {
        return 25; // Good engagement - slight head movement
    } else if (normalizedYaw < 0.5) {
        return 50; // Moderate engagement - noticeable head turn
    } else if (normalizedYaw < 0.7) {
        return 75; // Low engagement - significant head turn
    } else {
        return 95; // Very disengaged - head turned far away
    }
}

// Calculate head orientation
function calculateHeadOrientation(faceLandmarks) {
    // Simple head orientation calculation using face landmarks
    // This is a simplified version - in practice, you'd use more sophisticated calculations
    const leftEye = faceLandmarks[33];
    const rightEye = faceLandmarks[263];
    const nose = faceLandmarks[1];

    if (leftEye && rightEye && nose) {
        const eyeCenterX = (leftEye.x + rightEye.x) / 2;
        const headOffset = nose.x - eyeCenterX;
        headYawAngle = headOffset * 180; // Convert to degrees
    }
}

// Calculate master stress score
function calculateMasterStressScore(kineticStress, posturalTension, engagementScore) {
    // More aggressive weighting for kinetic stress since it's our primary indicator
    const weightedScore = 
        (WEIGHTS.KINETIC * kineticStress) + 
        (WEIGHTS.POSTURAL * posturalTension) + 
        (WEIGHTS.ENGAGEMENT * engagementScore);
    
    // Apply a non-linear scaling to amplify higher stress values
    let amplifiedScore;
    if (weightedScore < 30) {
        amplifiedScore = weightedScore * 0.8; // Slightly reduce low scores
    } else if (weightedScore < 60) {
        amplifiedScore = weightedScore * 1.2; // Amplify mid-range scores
    } else {
        amplifiedScore = weightedScore * 1.5; // Significantly amplify high scores
    }
    
    return Math.min(Math.round(amplifiedScore), 100);
}

// Update status indicator - more reasonable thresholds
function updateStatusIndicator(stressScore) {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    // Add hysteresis to prevent flickering
    const currentStatus = statusText.textContent.toLowerCase();
    
    if (stressScore < MOVEMENT_THRESHOLDS.CALM) {
        if (currentStatus !== 'calm') {
            statusDot.className = 'status-dot calm';
            statusText.textContent = 'CALM';
        }
    } else if (stressScore < MOVEMENT_THRESHOLDS.VIGILANCE) {
        if (currentStatus !== 'vigilance') {
            statusDot.className = 'status-dot vigilance';
            statusText.textContent = 'VIGILANCE';
        }
    } else {
        if (currentStatus !== 'tense') {
            statusDot.className = 'status-dot tense';
            statusText.textContent = 'TENSE';
        }
    }
}

// Update real-time prompt - adjusted thresholds
function updateRealTimePrompt(stressScore, kineticStress, posturalTension, engagementScore) {
    const promptText = document.getElementById('prompt-text');
    const currentPrompt = promptText.textContent;
    let newPrompt = '';

    if (stressScore < MOVEMENT_THRESHOLDS.CALM) {
        newPrompt = 'Excellent stillness maintained. Minimal movement detected.';
    } else if (stressScore < MOVEMENT_THRESHOLDS.VIGILANCE) {
        if (kineticStress > 40) {
            newPrompt = 'Suggestion: Noticeable leg/hand movement detected. Consider grounding techniques.';
        } else {
            newPrompt = 'Suggestion: Slight uneasiness detected. Monitor movement patterns.';
        }
    } else {
        if (kineticStress > 60) {
            newPrompt = 'Suggestion: High movement and hand-to-face contact detected. Consider pause.';
        } else {
            newPrompt = 'Suggestion: Significant tension detected. Recommend relaxation break.';
        }
    }

    // Only update if prompt actually changed
    if (newPrompt !== currentPrompt) {
        promptText.textContent = newPrompt;
    }
}

// Reset accumulators when starting session
function startSession() {
    if (!isCameraActive) {
        alert('Please start the camera first.');
        return;
    }

    isSessionActive = true;
    sessionData = [];
    handToFaceCount = 0;
    previousLandmarks = null;
    previousTimestamp = null;
    
    // Reset smoothing variables
    stressHistory = [];
    lastStatusUpdate = 0;
    
    // Reset accumulators
    accumulatedKineticStress = 0;
    kineticStressSampleCount = 0;
    
    // Reset and start timer
    resetTimer();
    sessionStartTime = Date.now();

    // Start timer
    timerInterval = setInterval(updateTimer, 1000);

    // Start data logging
    dataLoggingInterval = setInterval(logData, 1000); // Log every second

    // Update button states
    document.getElementById('start-session-btn').disabled = true;
    document.getElementById('stop-session-btn').disabled = false;

    // Update prompt
    document.getElementById('prompt-text').textContent = 'Session started. Monitoring in progress...';
}

// Update timer
function updateTimer() {
    if (!isSessionActive || !sessionStartTime) return;
    
    sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000);
    const minutes = Math.floor(sessionDuration / 60);
    const seconds = sessionDuration % 60;
    
    const timerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('timer-text').textContent = timerText;
}

// Reset timer
function resetTimer() {
    sessionDuration = 0;
    sessionStartTime = null;
    document.getElementById('timer-text').textContent = '00:00';
}

// Stop session
function stopSession() {
    isSessionActive = false;

    // Stop timer
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    // Stop data logging
    if (dataLoggingInterval) {
        clearInterval(dataLoggingInterval);
        dataLoggingInterval = null;
    }

    // Update button states
    document.getElementById('start-session-btn').disabled = false;
    document.getElementById('stop-session-btn').disabled = true;

    // Update prompt
    document.getElementById('prompt-text').textContent = 'Session stopped. Switch to Analytics to view results.';

    // Switch to analytics panel
    setTimeout(() => {
        switchPanel('analytics');
    }, 1000);
}

// Modified logData to use accumulated values
function logData() {
    if (!isSessionActive) return;

    const currentTime = Date.now();
    
    // Calculate average kinetic stress over the logging interval
    const avgKineticStress = kineticStressSampleCount > 0 ? 
        accumulatedKineticStress / kineticStressSampleCount : 0;
    
    // Reset accumulators
    accumulatedKineticStress = 0;
    kineticStressSampleCount = 0;

    // Calculate other metrics
    const posturalTension = calculatePosturalTension(previousLandmarks);
    const engagementScore = calculateEngagementScore();
    const masterStressScore = calculateMasterStressScore(avgKineticStress, posturalTension, engagementScore);

    const dataPoint = {
        timestamp: currentTime,
        kineticStress: avgKineticStress,
        posturalTension: posturalTension,
        engagementScore: engagementScore,
        masterStressScore: masterStressScore,
        handToFaceCount: handToFaceCount,
        hasLegMovement: avgKineticStress > 30,
        hasHandMovement: avgKineticStress > 20,
        hasHandToFace: handToFaceCount > 0
    };

    sessionData.push(dataPoint);

    // Keep only last 5 minutes of data (300 seconds)
    if (sessionData.length > 300) {
        sessionData.shift();
    }
    
    // Update the current metrics for real-time display
    updateCurrentMetrics(masterStressScore, avgKineticStress, posturalTension, engagementScore);
}

function updateCurrentMetrics(masterStress, kinetic, postural, engagement) {
    // Update status indicator
    if (currentTime - lastStatusUpdate > STATUS_UPDATE_INTERVAL) {
        updateStatusIndicator(masterStress);
    }
    
    // Update real-time prompt
    updateRealTimePrompt(masterStress, kinetic, postural, engagement);
    
    // Update current metrics display if it exists
    const currentMetricsElement = document.getElementById('current-metrics');
    if (currentMetricsElement) {
        currentMetricsElement.innerHTML = `
            <div>Kinetic: ${Math.round(kinetic)}</div>
            <div>Postural: ${Math.round(postural)}</div>
            <div>Engagement: ${Math.round(engagement)}</div>
            <div>Master: ${Math.round(masterStress)}</div>
        `;
    }
}

// Initialize chart
function initializeChart() {
    const ctx = document.getElementById('stress-chart').getContext('2d');
    
    if (stressChart) {
        stressChart.destroy();
    }

    const labels = sessionData.map((_, index) => `${index}s`);
    const stressScores = sessionData.map(data => data.masterStressScore);
    const kineticScores = sessionData.map(data => data.kineticStress);
    const posturalScores = sessionData.map(data => data.posturalTension);

    stressChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Master Stress Score',
                    data: stressScores,
                    borderColor: '#FF6384',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'Kinetic Stress',
                    data: kineticScores,
                    borderColor: '#36A2EB',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    borderWidth: 1,
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'Postural Tension',
                    data: posturalScores,
                    borderColor: '#FFCE56',
                    backgroundColor: 'rgba(255, 206, 86, 0.1)',
                    borderWidth: 1,
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Stress Metrics Over Time'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Stress Score'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Time (seconds)'
                    }
                }
            }
        }
    });

    updateAnalyticsSummary();
}

// Update analytics summary
function updateAnalyticsSummary() {
    if (sessionData.length === 0) return;

    // Calculate percentages with more appropriate thresholds
    const fidgetingTime = sessionData.filter(data => data.kineticStress >= 20).length;
    const tensionTime = sessionData.filter(data => data.masterStressScore >= 60).length;
    const avoidanceTime = sessionData.filter(data => data.engagementScore > 40).length;
    const highStressTime = sessionData.filter(data => data.masterStressScore > 60).length;
    
    // Calculate average stress with more weight on recent data
    const recentData = sessionData.slice(-60); // Last minute
    const avgStress = recentData.reduce((sum, data) => sum + data.masterStressScore, 0) / recentData.length;
    
    // Calculate peak stress
    const peakStress = Math.max(...sessionData.map(data => data.masterStressScore));

    // Update display with more meaningful metrics
    document.getElementById('fidgeting-percentage').textContent = `${Math.round((fidgetingTime / sessionData.length) * 100)}%`;
    document.getElementById('tension-percentage').textContent = `${Math.round((tensionTime / sessionData.length) * 100)}%`;
    document.getElementById('avoidance-percentage').textContent = `${Math.round((avoidanceTime / sessionData.length) * 100)}%`;
    document.getElementById('high-stress-percentage').textContent = `${Math.round((highStressTime / sessionData.length) * 100)}%`;
    document.getElementById('average-stress').textContent = Math.round(avgStress);
    document.getElementById('peak-stress').textContent = Math.round(peakStress);

    // Update session info
    const sessionName = document.getElementById('session-name').value || 'Unnamed Session';
    const sessionDetails = document.getElementById('session-details').value || 'No details provided';
    
    document.getElementById('analytics-session-name').textContent = sessionName;
    document.getElementById('analytics-session-details').textContent = sessionDetails;

    // Generate insights with better context
    generateInsights(fidgetingTime, tensionTime, avoidanceTime, avgStress, peakStress, highStressTime);
}

// Generate insights
function generateInsights(fidgetingTime, tensionTime, avoidanceTime, avgStress, peakStress, highStressTime) {
    const insightsContent = document.getElementById('insights-content');
    let insights = '';

    // Consider both average and peak stress for better assessment
    if (avgStress < 30 && peakStress < 50) {
        insights = '<p><strong>Overall Assessment:</strong> The session showed consistently low stress levels. The participant maintained good posture and engagement throughout.</p>';
        insights += '<p><strong>Recommendations:</strong> Continue with current approach. The participant appears comfortable and engaged in the session.</p>';
    } else if (avgStress < 50 && peakStress < 70) {
        if (fidgetingTime > tensionTime && fidgetingTime > avoidanceTime) {
            insights = '<p><strong>Overall Assessment:</strong> The session showed moderate stress levels with notable fidgeting behavior. This may indicate restlessness or anxiety.</p>';
            insights += '<p><strong>Recommendations:</strong> Consider incorporating movement breaks or interactive activities to channel restless energy constructively.</p>';
        } else if (tensionTime > fidgetingTime && tensionTime > avoidanceTime) {
            insights = '<p><strong>Overall Assessment:</strong> The session showed moderate stress levels with significant postural tension. This may indicate physical discomfort or anxiety.</p>';
            insights += '<p><strong>Recommendations:</strong> Suggest posture adjustments and consider relaxation techniques. Ensure the physical environment is comfortable.</p>';
        } else {
            insights = '<p><strong>Overall Assessment:</strong> The session showed moderate stress levels with engagement challenges. This may indicate difficulty with focus or connection.</p>';
            insights += '<p><strong>Recommendations:</strong> Consider varying the session format and incorporating more interactive elements to improve engagement.</p>';
        }
    } else {
        insights = `<p><strong>Overall Assessment:</strong> The session showed high stress levels (peak: ${Math.round(peakStress)}). `;
        
        if (highStressTime > sessionData.length * 0.5) {
            insights += 'The participant was tense for more than half of the session.</p>';
        } else {
            insights += 'While the average stress was moderate, there were periods of significant tension.</p>';
        }
        
        insights += '<p><strong>Recommendations:</strong> Consider pausing the session and addressing immediate concerns. A different approach or referral to additional support services may be warranted.</p>';
    }

    insightsContent.innerHTML = insights;
}