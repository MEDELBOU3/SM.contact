const APP_ID = "5f7a328ba1e64658a9fcecc620c789b0"
const TOKEN = "007eJxTYDj0f46owrbknFkP9pfNd+O72af/3bcr2DbV8N3ujp9CW54pMJimmScaG1kkJRqmmpmYmVokWqYlpyYnmxkZJJtbWCYZ7H6ant4QyMjgaVLGwsgAgSA+B0NxrkluaXFmMgMDAFx0Ip0="
const CHANNEL = "sm4music"

const client = AgoraRTC.createClient({mode:'rtc', codec:'vp8'})

let localTracks = []
let remoteUsers = {}
let screenTrack = null
let isScreenSharing = false
let screenSharingUid = null
let currentUser = null
const userProfiles = new Map()

// تحسين التحقق من المصادقة
const checkAuth = () => {
    const userData = localStorage.getItem('userData')
    if (userData) {
        currentUser = JSON.parse(userData)
        document.getElementById('auth-container').style.display = 'none'
        document.getElementById('stream-wrapper').style.display = 'block'
        return true
    }
    document.getElementById('auth-container').style.display = 'block'
    document.getElementById('stream-wrapper').style.display = 'none'
    return false
}

// تحسين إنشاء وعرض الفيديو المحلي
const joinAndDisplayLocalStream = async () => {
    try {
        client.on('user-published', handleUserJoined)
        client.on('user-left', handleUserLeft)
        
        const UID = await client.join(APP_ID, CHANNEL, TOKEN, null)
        currentUser.uid = UID
        
        localTracks = await AgoraRTC.createMicrophoneAndCameraTracks()
        
        const player = createVideoPlayer(UID, currentUser.username, currentUser.profilePic)
        document.getElementById('video-streams').insertAdjacentHTML('beforeend', player)
        
        localTracks[1].play(`user-${UID}`)
        await client.publish(localTracks)
        
        // تحديث معلومات المستخدم للآخرين
        userProfiles.set(UID, {
            username: currentUser.username,
            profilePic: currentUser.profilePic
        })
        
    } catch (error) {
        console.error('Error joining stream:', error)
        alert('Failed to join stream. Please try again.')
    }
}

// تحسين معالجة انضمام المستخدمين
const handleUserJoined = async (user, mediaType) => {
    remoteUsers[user.uid] = user
    await client.subscribe(user, mediaType)

    if (mediaType === 'video') {
        let playerContainer = document.getElementById(`user-container-${user.uid}`)
        if (playerContainer) playerContainer.remove()

        const userProfile = userProfiles.get(user.uid) || { 
            username: 'User', 
            profilePic: 'default-avatar.png'
        }
        
        const player = createVideoPlayer(user.uid, userProfile.username, userProfile.profilePic)
        document.getElementById('video-streams').insertAdjacentHTML('beforeend', player)

        if (user.videoTrack.trackMediaType === 'screen-video') {
            addExpandButton(`user-container-${user.uid}`)
            screenSharingUid = user.uid
            document.getElementById('screen-btn').disabled = true
        }

        user.videoTrack.play(`user-${user.uid}`)
    }

    if (mediaType === 'audio') {
        user.audioTrack.play()
    }
}

// تحسين مشاركة الشاشة
const toggleScreenShare = async (e) => {
    if (!isScreenSharing) {
        try {
            screenTrack = await AgoraRTC.createScreenVideoTrack({
                encoderConfig: "1080p_2",
                optimizationMode: "detail",
            })

            // حفظ الفيديو الحالي كنافذة صغيرة
            const miniPlayer = createMiniVideoPlayer()
            document.getElementById('video-streams').insertAdjacentHTML('beforeend', miniPlayer)
            localTracks[1].play('mini-video')

            await client.unpublish(localTracks[1])
            await client.publish(screenTrack)

            const screenContainer = document.getElementById(`user-container-${currentUser.uid}`)
            addExpandButton(screenContainer.id)

            screenTrack.on('track-ended', () => stopScreenSharing(e))
            
            isScreenSharing = true
            updateScreenShareButton(e, true)

        } catch (error) {
            console.error('Screen sharing error:', error)
            alert('Failed to share screen. Please try again.')
        }
    } else {
        await stopScreenSharing(e)
    }
}

// وظائف مساعدة
const createVideoPlayer = (uid, username, profilePic) => {
    return `
        <div class="video-container" id="user-container-${uid}">
            <div class="video-player" id="user-${uid}"></div>
            <div class="user-info">
                <img src="${profilePic}" alt="${username}">
                <span>${username}</span>
            </div>
        </div>
    `
}

const createMiniVideoPlayer = () => {
    return `
        <div class="video-container small-video" id="mini-video-container">
            <div class="video-player" id="mini-video"></div>
            <div class="user-info">
                <img src="${currentUser.profilePic}" alt="${currentUser.username}">
                <span>${currentUser.username}</span>
            </div>
        </div>
    `
}

const addExpandButton = (containerId) => {
    const container = document.getElementById(containerId)
    const expandBtn = document.createElement('button')
    expandBtn.className = 'expand-btn'
    expandBtn.innerHTML = '<i class="fas fa-expand"></i>'
    expandBtn.onclick = () => toggleFullScreen(container)
    container.appendChild(expandBtn)
}

const updateScreenShareButton = (button, isSharing) => {
    button.innerHTML = isSharing ? 
        '<i class="fas fa-desktop"></i> Stop Sharing' :
        '<i class="fas fa-desktop"></i> Share Screen'
    button.style.backgroundColor = isSharing ? '#EE4B2B' : 'cadetblue'
}

const toggleFullScreen = (element) => {
    if (!document.fullscreenElement) {
        element.requestFullscreen()
            .catch(err => console.error('Fullscreen error:', err))
    } else {
        document.exitFullscreen()
    }
}

// تحسين إيقاف مشاركة الشاشة
const stopScreenSharing = async (e) => {
    try {
        await client.unpublish(screenTrack)
        screenTrack.stop()
        screenTrack.close()
        screenTrack = null
        
        await client.publish([localTracks[1]])
        
        const miniVideo = document.getElementById('mini-video-container')
        if (miniVideo) miniVideo.remove()
        
        isScreenSharing = false
        updateScreenShareButton(e, false)
        
    } catch (error) {
        console.error('Error stopping screen share:', error)
    }
}

// إضافة المستمعين للأحداث
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('join-btn').addEventListener('click', joinStream)
    document.getElementById('leave-btn').addEventListener('click', leaveAndRemoveLocalStream)
    document.getElementById('mic-btn').addEventListener('click', toggleMic)
    document.getElementById('camera-btn').addEventListener('click', toggleCamera)
    document.getElementById('screen-btn').addEventListener('click', toggleScreenShare)
    document.getElementById('register-btn').addEventListener('click', registerUser)
    
    checkAuth()
}) 
