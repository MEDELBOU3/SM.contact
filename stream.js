const APP_ID = "5f7a328ba1e64658a9fcecc620c789b0"
const TOKEN = "007eJxTYDj0f46owrbknFkP9pfNd+O72af/3bcr2DbV8N3ujp9CW54pMJimmScaG1kkJRqmmpmYmVokWqYlpyYnmxkZJJtbWCYZ7H6ant4QyMjgaVLGwsgAgSA+B0NxrkluaXFmMgMDAFx0Ip0="
const CHANNEL = "sm4music"

const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
let localTracks = {
    audioTrack: null,
    videoTrack: null
};
let remoteUsers = {};
let isAudioEnabled = true;
let isVideoEnabled = true;
let isScreenSharing = false;
let screenTrack = null;

// Initialize stats variables
let streamStartTime;
let statsInterval;

async function joinAndDisplayLocalStream() {
    try {
        // Join the channel
        await client.join(APP_ID, CHANNEL, TOKEN || null);
        
        // Create local tracks
        localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: {
                width: { min: 640, ideal: 1920, max: 1920 },
                height: { min: 480, ideal: 1080, max: 1080 }
            }
        });

        // Play local video track
        localTracks.videoTrack.play('local-player');

        // Publish local tracks
        await client.publish(Object.values(localTracks));
        
        // Start stream timer
        streamStartTime = new Date();
        updateStreamStats();
        
        console.log("Successfully joined channel and published local tracks");
    } catch (error) {
        console.error("Error joining channel:", error);
        showError("Failed to join channel. Please try again.");
    }
}

// Handle remote user events
client.on('user-published', async (user, mediaType) => {
    await client.subscribe(user, mediaType);

    if (mediaType === 'video') {
        remoteUsers[user.uid] = user;
        const playerContainer = createRemotePlayerContainer(user.uid);
        user.videoTrack.play(playerContainer);
        updateViewerCount();
    }

    if (mediaType === 'audio') {
        user.audioTrack.play();
    }
});

client.on('user-unpublished', (user, mediaType) => {
    if (mediaType === 'video') {
        removeRemotePlayerContainer(user.uid);
        delete remoteUsers[user.uid];
        updateViewerCount();
    }
});

// UI Control Functions
document.getElementById('mic-btn').onclick = async () => {
    if (isAudioEnabled) {
        await localTracks.audioTrack.setEnabled(false);
        isAudioEnabled = false;
        document.getElementById('mic-btn').classList.remove('active');
    } else {
        await localTracks.audioTrack.setEnabled(true);
        isAudioEnabled = true;
        document.getElementById('mic-btn').classList.add('active');
    }
};

document.getElementById('camera-btn').onclick = async () => {
    if (isVideoEnabled) {
        await localTracks.videoTrack.setEnabled(false);
        isVideoEnabled = false;
        document.getElementById('camera-btn').classList.remove('active');
    } else {
        await localTracks.videoTrack.setEnabled(true);
        isVideoEnabled = true;
        document.getElementById('camera-btn').classList.add('active');
    }
};

document.getElementById('screen-btn').onclick = async () => {
    if (!isScreenSharing) {
        try {
            screenTrack = await AgoraRTC.createScreenVideoTrack();
            await client.unpublish(localTracks.videoTrack);
            await client.publish(screenTrack);
            isScreenSharing = true;
            document.getElementById('screen-btn').classList.add('active');
            
            screenTrack.on('track-ended', async () => {
                await stopScreenSharing();
            });
        } catch (error) {
            console.error("Error sharing screen:", error);
            showError("Failed to start screen sharing");
        }
    } else {
        await stopScreenSharing();
    }
};

async function stopScreenSharing() {
    try {
        await client.unpublish(screenTrack);
        screenTrack.close();
        await client.publish(localTracks.videoTrack);
        isScreenSharing = false;
        document.getElementById('screen-btn').classList.remove('active');
    } catch (error) {
        console.error("Error stopping screen share:", error);
    }
}

document.getElementById('leave-btn').onclick = async () => {
    try {
        // Stop all local tracks
        for (let track of Object.values(localTracks)) {
            track.stop();
            track.close();
        }
        
        // Leave the channel
        await client.leave();
        
        // Clear remote users and containers
        remoteUsers = {};
        document.getElementById('remote-playerlist').innerHTML = '';
        
        // Stop stats interval
        clearInterval(statsInterval);
        
        // Redirect or show exit message
        Swal.fire({
            title: 'Stream Ended',
            text: 'You have successfully left the stream.',
            icon: 'success',
            confirmButtonText: 'OK'
        }).then(() => {
            window.location.reload();
        });
    } catch (error) {
        console.error("Error leaving channel:", error);
    }
};

// Utility Functions
function createRemotePlayerContainer(uid) {
    const container = document.createElement('div');
    container.id = `player-${uid}`;
    container.className = 'participant-video';
    document.getElementById('remote-playerlist').append(container);
    return container;
}

function removeRemotePlayerContainer(uid) {
    const container = document.getElementById(`player-${uid}`);
    if (container) container.remove();
}

function updateViewerCount() {
    const count = Object.keys(remoteUsers).length;
    document.getElementById('viewer-count').innerText = count;
}

function updateStreamStats() {
    statsInterval = setInterval(() => {
        // Update stream duration
        const duration = Math.floor((new Date() - streamStartTime) / 1000);
        const hours = Math.floor(duration / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        const seconds = duration % 60;
        document.getElementById('stream-duration').innerText = 
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        // Get and update stream quality
        client.getLocalVideoStats().then(stats => {
            document.getElementById('bitrate').innerText = `${Math.round(stats.sendBitrate)} Kbps`;
            updateStreamQuality(stats.sendBitrate);
        });
    }, 1000);
}

function updateStreamQuality(bitrate) {
    let quality = 'Poor';
    if (bitrate > 1000) quality = 'Good';
    if (bitrate > 2000) quality = 'Excellent';
    document.getElementById('stream-quality').innerText = quality;
}

function showError(message) {
    Swal.fire({
        title: 'Error',
        text: message,
        icon: 'error',
        confirmButtonText: 'OK'
    });
}

// Initialize the application
joinAndDisplayLocalStream();
