const express = require('express');
const { Server } = require('socket.io');
const { addAirdropsForAllUsers } = require('./airdropController'); // Import the airdrop function
const router = express.Router();

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// In-memory progress tracking
let universalProgress = 0;

const numberMinutes = 60;
const airdropRound = 60 * numberMinutes;

// Function to broadcast progress to all clients
function broadcastProgress(io) {
    io.emit('progressUpdate', universalProgress);
}

// Function to start the progress update intervals
function startProgressUpdates(io) {
    // Periodically update progress
    setInterval(async () => {
        if (universalProgress < airdropRound) {
            universalProgress += 1;
        } else {
            // Trigger airdrop addition when progress reaches the threshold
            await addAirdropsForAllUsers();
            universalProgress = 0; // Reset progress after airdrop
        }
        broadcastProgress(io);
    }, 1000); // Update every second

    // Persist progress in Supabase every 60 seconds
    setInterval(async () => {
        const { error } = await supabase
            .from('progress_tracker')
            .upsert({ id: 1, progress: universalProgress, lastUpdatedAt: new Date() });

        if (error) {
            console.error('Failed to save progress to database:', error);
        }
    }, 50 * 1000); // Save to the database every 50 seconds
}

// Set up the Socket.IO connection in the controller
const setupSocketIO = (server) => {
    const io = new Server(server, {
        cors: {
            origin: ['https://bamboo-1.vercel.app', 'http://localhost:5173', 'https://helios-bot-bzlj.onrender.com'],
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        // Send the current progress to the newly connected client
        socket.emit('progressUpdate', universalProgress);

        // Handle custom messages
        socket.on('message', (msg) => {
            console.log('Received message:', msg);
            io.emit('message', msg); // Broadcast message to all clients
        });

        // Handle disconnections
        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    // Start progress updates once the socket is set up
    startProgressUpdates(io);

    return io;
};

// Export the router and the Socket.IO setup function
module.exports = { router, setupSocketIO };
