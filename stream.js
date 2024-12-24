const APP_ID = "5f7a328ba1e64658a9fcecc620c789b0"
const TOKEN = "007eJxTYDj0f46owrbknFkP9pfNd+O72af/3bcr2DbV8N3ujp9CW54pMJimmScaG1kkJRqmmpmYmVokWqYlpyYnmxkZJJtbWCYZ7H6ant4QyMjgaVLGwsgAgSA+B0NxrkluaXFmMgMDAFx0Ip0="
const CHANNEL = "sm studio"

const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

let localTracks = {
    audioTrack: null,
    videoTrack: null
};
let remoteUsers = {};
let isAudioEnabled = true;
let isVideoEnabled = true;
let isScreenSharing = false;

// DOM elements
const modal = document.getElementById('join-modal');
const joinBtn = document.getElementById('join-btn');
const usernameInput = document.getElementById('username');
const participantsCount = document.getElementById('participants-count');
const streamTime = document.getElementById('stream-time');
let streamStartTime;

// Show join modal on load
modal.classList.add('active');

joinBtn.onclick = async () => {
    if (usernameInput.value.trim() === '') {
        alert('Please enter a username');
        return;
    }
    modal.classList.remove('active');
    await joinStream();
};

async function joinStream() {
    try {
        // Join the channel
        await client.join(APP_ID, CHANNEL, TOKEN, null);
        
        // Create local tracks
        localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack();
        
        // Play local video
        localTracks.videoTrack.play('local-stream');
        
        // Publish local tracks
        await client.publish(Object.values(localTracks));
        
        // Start stream timer
        streamStartTime = new Date();
        updateStreamTime();
        
        updateParticipantsCount();
        console.log('Successfully joined the channel');
    } catch (error) {
        console.error('Error joining stream:', error);
    }
}

// Handle remote users
client.on('user-published', async (user, mediaType) => {
    await client.subscribe(user, mediaType);
    
    if (mediaType === 'video') {
        remoteUsers[user.uid] = user;
        const playerContainer = createRemotePlayer(user.uid);
        user.videoTrack.play(playerContainer);
        updateParticipantsCount();
    }
    
    if (mediaType === 'audio') {
        user.audioTrack.play();
    }
});

client.on('user-unpublished', (user) => {
    const playerContainer = document.getElementById(`player-${user.uid}`);
    if (playerContainer) {
        playerContainer.remove();
    }
    delete remoteUsers[user.uid];
    updateParticipantsCount();
});

// Control buttons
document.getElementById('mic-btn').onclick = async () => {
    if (isAudioEnabled) {
        await localTracks.audioTrack.setEnabled(false);
        document.getElementById('mic-btn').classList.remove('active');
    } else {
        await localTracks.audioTrack.setEnabled(true);
        document.getElementById('mic-btn').classList.add('active');
    }
    isAudioEnabled = !isAudioEnabled;
};

document.getElementById('camera-btn').onclick = async () => {
    if (isVideoEnabled) {
        await localTracks.videoTrack.setEnabled(false);
        document.getElementById('camera-btn').classList.remove('active');
    } else {
        await localTracks.videoTrack.setEnabled(true);
        document.getElementById('camera-btn').classList.add('active');
    }
    isVideoEnabled = !isVideoEnabled;
};

document.getElementById('screen-share-btn').onclick = async () => {
    if (!isScreenSharing) {
        try {
            const screenTrack = await AgoraRTC.createScreenVideoTrack();
            await client.unpublish(localTracks.videoTrack);
            await client.publish(screenTrack);
            localTracks.videoTrack = screenTrack;
            document.getElementById('screen-share-btn').classList.add('active');
            isScreenSharing = true;
            
            // Handle screen share stop
            screenTrack.on('track-ended', async () => {
                await stopScreenSharing();
            });
        } catch (error) {
            console.error('Error sharing screen:', error);
        }
    } else {
        await stopScreenSharing();
    }
};

document.getElementById('leave-btn').onclick = async () => {
    // Close local tracks
    Object.values(localTracks).forEach(track => track.close());
    
    // Leave the channel
    await client.leave();
    
    // Clear remote users
    document.getElementById('remote-streams').innerHTML = '';
    remoteUsers = {};
    
    // Show join modal
    modal.classList.add('active');
};

// Utility functions
function createRemotePlayer(uid) {
    const container = document.createElement('div');
    container.id = `player-${uid}`;
    container.className = 'video-player';
    
    const controls = document.createElement('div');
    controls.className = 'player-controls';
    controls.innerHTML = `<span class="user-name">User ${uid}</span>`;
    
    container.appendChild(controls);
    document.getElementById('remote-streams').appendChild(container);
    return container;
}

async function stopScreenSharing() {
    try {
        await client.unpublish(localTracks.videoTrack);
        localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack();
        await client.publish(localTracks.videoTrack);
        localTracks.videoTrack.play('local-stream');
        document.getElementById('screen-share-btn').classList.remove('active');
        isScreenSharing = false;
    } catch (error) {
        console.error('Error stopping screen share:', error);
    }
}

function updateParticipantsCount() {
    const count = Object.keys(remoteUsers).length + 1;
    participantsCount.textContent = `${count} Participant${count !== 1 ? 's' : ''}`;
}

function updateStreamTime() {
    setInterval(() => {
        const duration = Math.floor((new Date() - streamStartTime) / 1000);
        const hours = Math.floor(duration / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        const seconds = duration % 60;
        streamTime.textContent = 
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
}
