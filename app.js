// --- AUTHENTICATION (TALKING TO SERVER) ---
async function attemptLogin() {
    const userIn = document.getElementById('login-user').value.trim();
    const passIn = document.getElementById('login-pass').value;
    const errorDiv = document.getElementById('login-error');
    const btn = document.querySelector('.cyber-btn');

    errorDiv.innerText = ''; // clear previous error

    if (!userIn || !passIn) {
        errorDiv.innerText = "ERROR: USERNAME AND PASSWORD REQUIRED.";
        return;
    }

    try {
        btn.innerText = "CONNECTING...";
        btn.style.background = '#ffaa00';
        btn.style.color = '#000';

        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: userIn, password: passIn })
        });

        const data = await response.json();

        if (data.success) {
            btn.style.background = '#00d2ff';
            btn.style.color = '#000';
            btn.innerText = "ACCESS GRANTED";
            
            setTimeout(() => window.location.href = '/dashboard.html', 800);
        } else {
            errorDiv.innerText = "ERROR: INVALID CREDENTIALS.";
            btn.innerText = "INITIALIZE CONNECTION";
            btn.style.background = '';
            btn.style.color = '';
        }
    } catch (err) {
        console.error("Login error:", err);
        errorDiv.innerText = "ERROR: SERVER CONNECTION FAILED.";
        btn.innerText = "INITIALIZE CONNECTION";
        btn.style.background = '';
        btn.style.color = '';
    }
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
}

// --- DASHBOARD LOGIC ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    const navItems = document.querySelectorAll('.nav-links li');
    navItems.forEach(item => {
        if(item.innerText.toLowerCase().includes(tabId.split('-')[0])) item.classList.add('active');
    });

    if (tabId === 'chat') scrollToBottom();
}

let CURRENT_USER = null;

async function initDashboard() {
    // 1. Verify who we are from the server
    const meRes = await fetch('/api/me');
    if (!meRes.ok) {
        window.location.href = '/login.html'; // Kick out hackers
        return;
    }
    CURRENT_USER = await meRes.json();
    
    document.getElementById('current-user-display').innerText = `ID: ${CURRENT_USER.username.toUpperCase()}`;
    if (CURRENT_USER.role === 'admin') {
        document.getElementById('admin-nav').style.display = 'block';
        document.body.classList.add('is-admin');
        renderUsers();
    }

    renderChat();
    // Start live polling for chat messages every 2 seconds
    setInterval(renderChat, 2000);

    const terminal = document.getElementById('sys-logs');
    const logs = [
        "Cryptographic keys verified via Node Server...",
        "Database shifted to secure server memory...",
        "HTTP-Only Token Active. Bypass attempts blocked.",
        "System fully operational. Ready for input."
    ];
    let i = 0;
    setInterval(() => {
        if(i < logs.length) {
            terminal.innerHTML += `<p>> ${logs[i]}</p>`;
            terminal.scrollTop = terminal.scrollHeight;
            i++;
        }
    }, 1500);
}

// --- ADMIN SYSTEM (TALKING TO SERVER) ---
async function renderUsers() {
    const tableBody = document.getElementById('user-table-body');
    if (!tableBody) return;
    
    const res = await fetch('/api/users');
    if (!res.ok) return;
    const users = await res.json();
    
    tableBody.innerHTML = '';
    users.forEach(user => {
        tableBody.innerHTML += `
            <tr>
                <td>${user.username}</td>
                <td style="color:${user.role === 'admin' ? '#00d2ff' : '#aaa'}">${user.role.toUpperCase()}</td>
                <td>
                    <button class="action-btn edit" onclick="editUser('${user.username}')">EDIT</button>
                    ${user.username !== 'auv' ? `<button class="action-btn delete" onclick="deleteUser('${user.username}')">DEL</button>` : ''}
                </td>
            </tr>
        `;
    });
}

async function saveUser() {
    const origUser = document.getElementById('edit-original-username').value;
    const userIn = document.getElementById('new-user').value.trim();
    const passIn = document.getElementById('new-pass').value;
    const roleIn = document.getElementById('new-role').value;

    if (!userIn) { alert("Username required."); return; }

    await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalUsername: origUser, username: userIn, password: passIn, role: roleIn })
    });
    
    document.getElementById('edit-original-username').value = '';
    document.getElementById('new-user').value = '';
    document.getElementById('new-pass').value = '';
    document.getElementById('new-role').value = 'user';
    renderUsers();
}

async function deleteUser(username) {
    if(username === 'auv') return;
    if(confirm(`Eradicate user ${username}?`)) {
        await fetch(`/api/users/${username}`, { method: 'DELETE' });
        renderUsers();
    }
}

function editUser(username) {
    document.getElementById('edit-original-username').value = username;
    document.getElementById('new-user').value = username;
    document.getElementById('new-pass').placeholder = "Enter new or existing password";
    window.scrollTo(0, 0);
}

// --- CHAT SYSTEM (TALKING TO SERVER) ---
let replyingToId = null;

function handleChatKey(e) { if (e.key === 'Enter') sendMessage(); }

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, replyTo: replyingToId })
    });
    
    input.value = '';
    cancelReply();
    renderChat();
}

async function renderChat() {
    const chatContainer = document.getElementById('chat-messages');
    if (!chatContainer || !CURRENT_USER) return;

    const res = await fetch('/api/chat');
    if (!res.ok) return;
    const messages = await res.json();
    
    let html = '';
    messages.forEach(msg => {
        const isMine = msg.sender === CURRENT_USER.username;
        let replyHtml = '';
        
        if (msg.replyTo) {
            const repliedMsg = messages.find(m => m.id === msg.replyTo);
            if (repliedMsg) {
                const shortText = repliedMsg.text.length > 30 ? repliedMsg.text.substring(0,30) + '...' : repliedMsg.text;
                replyHtml = `<div class="reply-quote">${repliedMsg.sender}: ${shortText}</div>`;
            }
        }

        html += `
            <div class="message-wrapper ${isMine ? 'mine' : ''}" id="msg-${msg.id}">
                <div class="message">
                    <span class="msg-sender">${msg.sender}</span>
                    ${replyHtml}
                    <span class="msg-text">${msg.text}</span>
                    
                    <div class="msg-options">
                        <span class="msg-time">${msg.timestamp}</span>
                        <button class="msg-btn" onclick="prepReply(${msg.id}, '${msg.sender}', '${msg.text.replace(/'/g, "\\'")}')">REPLY</button>
                        ${CURRENT_USER.role === 'admin' ? `<button class="msg-btn del" onclick="deleteMessage(${msg.id})">DEL</button>` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    const isScrolledToBottom = chatContainer.scrollHeight - chatContainer.clientHeight <= chatContainer.scrollTop + 50;
    chatContainer.innerHTML = html || `<div class="message-wrapper system"><span>// No messages in universal history //</span></div>`;
    if (isScrolledToBottom) scrollToBottom();
}

function prepReply(id, sender, text) {
    replyingToId = id;
    document.getElementById('reply-banner-container').style.display = 'block';
    const shortText = text.length > 40 ? text.substring(0,40) + '...' : text;
    document.getElementById('reply-to-text').innerText = `${sender}: ${shortText}`;
    document.getElementById('chat-input').focus();
}

function cancelReply() {
    replyingToId = null;
    document.getElementById('reply-banner-container').style.display = 'none';
}

async function deleteMessage(id) {
    await fetch(`/api/chat/${id}`, { method: 'DELETE' });
    renderChat();
}

function scrollToBottom() {
    const chatContainer = document.getElementById('chat-messages');
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
}
