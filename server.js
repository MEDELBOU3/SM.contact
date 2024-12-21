const WebSocket = require('ws');
const http = require('http');
const express = require('express');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const users = new Map();
const rooms = new Map();

wss.on('connection', (ws) => {
    const userId = generateUserId();
    users.set(userId, {
        ws: ws,
        id: userId,
        name: `User-${userId}`,
        online: true
    });

    // Send user their ID
    ws.send(JSON.stringify({
        type: 'connected',
        userId: userId
    }));

    // Broadcast updated user list
    broadcastUserList();

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(userId, data);
        } catch (error) {
            console.error('Message handling error:', error);
        }
    });

    ws.on('close', () => {
        handleUserDisconnect(userId);
    });
});

function handleMessage(userId, data) {
    const user = users.get(userId);
    if (!user) return;

    switch(data.type) {
        case 'call_request':
            handleCallRequest(userId, data);
            break;
        case 'call_accepted':
            handleCallAccepted(userId, data);
            break;
        case 'call_rejected':
            handleCallRejected(userId, data);
            break;
        case 'offer':
        case 'answer':
        case 'ice-candidate':
            relayWebRTCMessage(userId, data);
            break;
        case 'chat_message':
            handleChatMessage(userId, data);
            break;
        case 'screen_share_started':
        case 'screen_share_stopped':
            relayScreenShareStatus(userId, data);
            break;
    }
}

function handleCallRequest(callerId, data) {
    const targetUser = users.get(data.targetUserId);
    if (targetUser && targetUser.ws.readyState === WebSocket.OPEN) {
        targetUser.ws.send(JSON.stringify({
            type: 'call_request',
            callerId: callerId
        }));
    }
}

function handleCallAccepted(userId, data) {
    const targetUser = users.get(data.targetUserId);
    if (targetUser && targetUser.ws.readyState === WebSocket.OPEN) {
        targetUser.ws.send(JSON.stringify({
            type: 'call_accepted',
            callerId: userId,
            offer: data.offer
        }));
    }
}

function handleCallRejected(userId, data) {
    const targetUser = users.get(data.targetUserId);
    if (targetUser && targetUser.ws.readyState === WebSocket.OPEN) {
        targetUser.ws.send(JSON.stringify({
            type: 'call_rejected',
            callerId: userId
        }));
    }
}

function handleChatMessage(senderId, data) {
    const targetUser = users.get(data.targetUserId);
    if (targetUser && targetUser.ws.readyState === WebSocket.OPEN) {
        targetUser.ws.send(JSON.stringify({
            type: 'chat_message',
            senderId: senderId,
            message: data.message,
            timestamp: Date.now()
        }));
    }
}

function relayWebRTCMessage(senderId, data) {
    const targetUser = users.get(data.targetUserId);
    if (targetUser && targetUser.ws.readyState === WebSocket.OPEN) {
        targetUser.ws.send(JSON.stringify({
            ...data,
            senderId: senderId
        }));
    }
}

function relayScreenShareStatus(senderId, data) {
    const targetUser = users.get(data.targetUserId);
    if (targetUser && targetUser.ws.readyState === WebSocket.OPEN) {
        targetUser.ws.send(JSON.stringify({
            type: data.type,
            senderId: senderId
        }));
    }
}

function handleUserDisconnect(userId) {
    const user = users.get(userId);
    if (user) {
        users.delete(userId);
        broadcastUserList();
    }
}

function broadcastUserList() {
    const userList = Array.from(users.values()).map(user => ({
        id: user.id,
        name: user.name,
        online: user.online
    }));

    const message = JSON.stringify({
        type: 'user_list',
        users: userList
    });

    users.forEach(user => {
        if (user.ws.readyState === WebSocket.OPEN) {
            user.ws.send(message);
        }
    });
}

function generateUserId() {
    return Math.random().toString(36).substr(2, 9);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
