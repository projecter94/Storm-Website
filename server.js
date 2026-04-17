require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());
app.use(cookieParser());

const SECRET_KEY = "STORM_ULTRA_SECRET_ENCRYPTION_KEY_CHANGE_ME";

// --- CONNECT TO MONGODB ---
mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log('DATABASE LINK ESTABLISHED');
    
    // Ensure Super Admin exists on first boot
    const adminExists = await User.findOne({ username: 'auv' });
    if (!adminExists) {
        await User.create({ username: 'auv', password: 'auvst0rm', role: 'admin' });
        console.log('Super Admin initialized in database.');
    }
}).catch(err => console.log('DATABASE CONNECTION ERROR:', err));

// --- DATABASE SCHEMAS ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' }
});
const User = mongoose.model('User', UserSchema);

const ChatSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    sender: String,
    text: String,
    timestamp: String,
    replyTo: Number
});
const Chat = mongoose.model('Chat', ChatSchema);

// --- THE GATEKEEPER ---
function authenticateToken(req, res, next) {
    const token = req.cookies.storm_auth;
    if (!token) return res.status(401).json({ error: "Access Denied" });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid Token" });
        req.user = user;
        next();
    });
}

// --- FILE ROUTING ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/app.js', (req, res) => res.sendFile(path.join(__dirname, 'app.js')));
app.get('/input_file_0.png', (req, res) => res.sendFile(path.join(__dirname, 'input_file_0.png')));

app.get('/dashboard.html', (req, res) => {
    const token = req.cookies.storm_auth;
    if (!token) return res.redirect('/login.html');
    jwt.verify(token, SECRET_KEY, (err) => {
        if (err) return res.redirect('/login.html');
        res.sendFile(path.join(__dirname, 'dashboard.html'));
    });
});

// --- SECURE APIs ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    
    if (user) {
        const token = jwt.sign({ username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '12h' });
        res.cookie('storm_auth', token, { httpOnly: true, secure: false }); 
        res.json({ success: true, user: { username: user.username, role: user.role } });
    } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('storm_auth');
    res.json({ success: true });
});

app.get('/api/me', authenticateToken, (req, res) => {
    res.json(req.user);
});

// CHAT APIs (Connected to MongoDB)
app.get('/api/chat', authenticateToken, async (req, res) => {
    // Get last 100 messages
    const messages = await Chat.find().sort({ id: 1 }).limit(100);
    res.json(messages);
});

app.post('/api/chat', authenticateToken, async (req, res) => {
    await Chat.create({
        id: Date.now(),
        sender: req.user.username,
        text: req.body.text,
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        replyTo: req.body.replyTo
    });
    res.json({ success: true });
});

app.delete('/api/chat/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });
    await Chat.deleteOne({ id: parseInt(req.params.id) });
    res.json({ success: true });
});

// ADMIN APIs (Connected to MongoDB)
app.get('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });
    const users = await User.find({}, 'username role'); // Hide passwords
    res.json(users);
});

app.post('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });
    const { originalUsername, username, password, role } = req.body;
    
    try {
        if (originalUsername) {
            const updateData = { username, role };
            if (password) updateData.password = password; // Only change pass if typed
            await User.findOneAndUpdate({ username: originalUsername }, updateData);
        } else {
            await User.create({ username, password, role });
        }
        res.json({ success: true });
    } catch(e) {
        res.status(400).json({ error: "Username taken." });
    }
});

app.delete('/api/users/:username', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' || req.params.username === 'auv') return res.status(403).json({ error: "Unauthorized" });
    await User.deleteOne({ username: req.params.username });
    res.json({ success: true });
});

// For Vercel Serverless compatibility
if (process.env.NODE_ENV !== 'production') {
    app.listen(8080, () => console.log('STORM SECURE MAINFRAME ONLINE ON PORT 8080'));
}
module.exports = app;