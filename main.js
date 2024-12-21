const APP_ID = "560b78f73de54cbb8be941304218b140"
const TOKEN = "007eJxTYIi6/VJVo77bK2HuFXnu9jm6c9ZyVkZ/S5h57hpHtO3BG7kKDKZmBknmFmnmximppibJSUkWSamWJobGBiZGhhZJhiYGktrp6Q2BjAz+Uz8yMjJAIIjPxRCcq5Ccn1eSmFzCwAAA0Ykgaw=="
const CHANNEL = "Sm contact"

const client = AgoraRTC.createClient({mode:'rtc', codec:'vp8'})

let localTracks = []
let remoteUsers = {}
let screenTrack = null
let isScreenSharing = false
let screenSharingUid = null
let isExpanded = false
let currentStreamQuality = 'high'

const streamQualities = {
    high: { width: 1920, height: 1080, frameRate: 30 },
    medium: { width: 1280, height: 720, frameRate: 24 },
    low: { width: 640, height: 360, frameRate: 15 }
}

// Chat functionality
let messages = []
let isChatOpen = false

async function joinAndDisplayLocalStream() {
    client.on('user-published', handleUserJoined)
    client.on('user-left', handleUserLeft)
    client.on('user-info-updated', handleUserInfoUpdate)
    
    let UID = await client.join(APP_ID, CHANNEL, TOKEN, null)

    localTracks = await AgoraRTC.createMicrophoneAndCameraTracks({
        encoderConfig: streamQualities[currentStreamQuality]
    })

    let player = `
        <div class="video-container participant" id="user-container-${UID}">
            <div class="video-player" id="user-${UID}"></div>
            <div class="user-name">You</div>
            <div class="controls-overlay">
                <div class="stats-overlay"></div>
                <button class="expand-btn" onclick="toggleExpand('${UID}')">⤢</button>
            </div>
        </div>`

    document.getElementById('video-streams').insertAdjacentHTML('beforeend', player)
    localTracks[1].play(`user-${UID}`)
    await client.publish([localTracks[0], localTracks[1]])

    // Start statistics monitoring
    startStatsMonitoring(UID)
}

function startStatsMonitoring(uid) {
    setInterval(async () => {
        const stats = await client.getRemoteVideoStats()
        const localStats = await client.getLocalVideoStats()
        
        const statsOverlay = document.querySelector(`#user-container-${uid} .stats-overlay`)
        if (statsOverlay) {
            statsOverlay.innerHTML = `
                FPS: ${localStats.sendFrameRate}
                Resolution: ${localStats.sendResolutionWidth}x${localStats.sendResolutionHeight}
                Bitrate: ${(localStats.sendBitrate/1024).toFixed(2)} Kbps
            `
        }
    }, 1000)
}

async function toggleScreenShare(e) {
    if(!isScreenSharing) {
        screenTrack = await AgoraRTC.createScreenVideoTrack({
            encoderConfig: streamQualities[currentStreamQuality]
        })
        
        await client.unpublish([localTracks[1]])
        await client.publish([screenTrack])
        
        document.getElementById('video-streams').classList.add('screen-share-active')
        
        screenTrack.on('track-ended', async () => {
            await stopScreenShare()
        })
        
        isScreenSharing = true
        e.target.innerHTML = '🛑'
        e.target.style.backgroundColor = '#EE4B2B'
    } else {
        await stopScreenShare()
    }
}

async function stopScreenShare() {
    await client.unpublish([screenTrack])
    screenTrack.stop()
    screenTrack.close()
    screenTrack = null
    await client.publish([localTracks[1]])
    
    document.getElementById('video-streams').classList.remove('screen-share-active')
    document.getElementById('video-streams').classList.remove('expanded')
    
    isScreenSharing = false
    isExpanded = false
    document.getElementById('screen-btn').innerHTML = '📺'
    document.getElementById('screen-btn').style.backgroundColor = 'cadetblue'
}

function toggleExpand(uid) {
    const videoStreams = document.getElementById('video-streams')
    isExpanded = !isExpanded
    
    if(isExpanded) {
        videoStreams.classList.add('expanded')
    } else {
        videoStreams.classList.remove('expanded')
    }
}

function toggleChat() {
    isChatOpen = !isChatOpen
    document.getElementById('chat-sidebar').classList.toggle('active')
}



function sendMessage() {
    const input = document.getElementById('chat-input')
    const message = input.value.trim()
    
    if(message) {
        const messageObj = {
            text: message,
            sender: 'You',
            timestamp: new Date().toLocaleTimeString()
        }
        
        messages.push(messageObj)
        displayMessage(messageObj)
        input.value = ''
        
        // Send message to other participants (implement your messaging logic here)
    }
}

function displayMessage(message) {
    const chatMessages = document.getElementById('chat-messages')
    const messageElement = document.createElement('div')
    messageElement.classList.add('message', 'fade-in')
    messageElement.innerHTML = `
        <strong>${message.sender}</strong> (${message.timestamp}):
        <br>${message.text}
    `
    chatMessages.appendChild(messageElement)
    chatMessages.scrollTop = chatMessages.scrollHeight
}

function changeStreamQuality(quality) {
    currentStreamQuality = quality
    if(localTracks[1]) {
        localTracks[1].setEncoderConfiguration(streamQualities[quality])
    }
    if(screenTrack) {
        screenTrack.setEncoderConfiguration(streamQualities[quality])
    }
}


// Event Listeners
document.getElementById('join-btn').addEventListener('click', joinAndDisplayLocalStream)
document.getElementById('leave-btn').addEventListener('click', leaveAndRemoveLocalStream)
document.getElementById('mic-btn').addEventListener('click', toggleMic)
document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('screen-btn').addEventListener('click', toggleScreenShare)
document.getElementById('chat-btn').addEventListener('click', toggleChat)
document.getElementById('send-message-btn').addEventListener('click', sendMessage)
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if(e.key === 'Enter') sendMessage()
})
document.getElementById('quality-select').addEventListener('change', (e) => {
    changeStreamQuality(e.target.value)
})

// Initialize tooltips and other UI enhancements
document.querySelectorAll('.control-btn').forEach(btn => {
    btn.addEventListener('mouseenter', (e) => {
        const tooltip = document.createElement('div')
        tooltip.className = 'tooltip'
        tooltip.textContent = e.target.title
        e.target.appendChild(tooltip)
    })
})

