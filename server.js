// GCSA Tool - Node.js/Express Server

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('./'));

// API endpoint for resources
app.get('/api/resources', (req, res) => {
    try {
        const resourcesPath = path.join(__dirname, 'resources.json');
        const resourcesData = fs.readFileSync(resourcesPath, 'utf8');
        const resources = JSON.parse(resourcesData);
        res.json(resources);
    } catch (error) {
        console.error('Error reading resources file:', error);
        res.status(500).json({ error: 'Failed to load resources' });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`GCSA Tool server running on http://localhost:${PORT}`);
    console.log('Press Ctrl+C to stop the server');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nShutting down server...');
    process.exit(0);
});