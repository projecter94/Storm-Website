const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cookieParser());

const SECRET_KEY = "STORM_ULTRA_SECRET_ENCRYPTION_KEY_CHANGE_ME";

// --- IN-MEMORY DATABASE (Safe on Server) ---
let usersDB = [{ username: 'auv', password: 'auvst0rm', role: 'admin' }];
let chatDB = [];

// --- MIDDLEWARE: THE GATEKEEPER ---
// This checks if the user has a valid, untampered server cookie
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
// Serve public files to anyone
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/app.js', (req, res) => res.sendFile(path.join(__dirname, 'app.js')));
app.get('/input_file_0.png', (req, res) => res.sendFile(path.join(__dirname, 'input_file_0.png')));

// SECURE FILE: The browser cannot download dashboard.html without a valid token!
app.get('/dashboard.html', (req, res) => {
    const token = req.cookies.storm_auth;
    if (!token) return res.redirect('/login.html'); // Bounce hackers back to login
    
    jwt.verify(token, SECRET_KEY, (err) => {
        if (err) return res.redirect('/login.html');
        // Only send the file if they pass the check
        res.sendFile(path.join(__dirname, 'dashboard.html'));
    });
});

// --- SECURE APIs ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = usersDB.find(u => u.username === username && u.password === password);
    
    if (user) {
        // Create an un-forgeable token
        const token = jwt.sign({ username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '2h' });
        
        // httpOnly means JavaScript (Inspect Element) CANNOT see or edit this cookie!
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

// CHAT APIs
app.get('/api/chat', authenticateToken, (req, res) => res.json(chatDB));
app.post('/api/chat', authenticateToken, (req, res) => {
    const newMsg = {
        id: Date.now(),
        sender: req.user.username,
        text: req.body.text,
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        replyTo: req.body.replyTo
    };
    chatDB.push(newMsg);
    if (chatDB.length > 100) chatDB.shift();
    res.json({ success: true });
});
app.delete('/api/chat/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });
    chatDB = chatDB.filter(m => m.id !== parseInt(req.params.id));
    res.json({ success: true });
});

// ADMIN APIs
app.get('/api/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });
    // Don't send passwords back to the client!
    const safeUsers = usersDB.map(u => ({ username: u.username, role: u.role }));
    res.json(safeUsers);
});
app.post('/api/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });
    const { originalUsername, username, password, role } = req.body;
    
    if (originalUsername) {
        const index = usersDB.findIndex(u => u.username === originalUsername);
        if (index !== -1) usersDB[index] = { username, password, role };
    } else {
        usersDB.push({ username, password, role });
    }
    res.json({ success: true });
});
app.delete('/api/users/:username', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin' || req.params.username === 'auv') return res.status(403).json({ error: "Unauthorized" });
    usersDB = usersDB.filter(u => u.username !== req.params.username);
    res.json({ success: true });
});

app.listen(8080, () => console.log('STORM SECURE MAINFRAME ONLINE ON PORT 8080'));