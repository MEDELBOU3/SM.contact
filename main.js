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

// التحقق من المصادقة
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

// تسجيل مستخدم جديد
const registerUser = async (e) => {
    e.preventDefault()
    
    const username = document.getElementById('username').value
    const email = document.getElementById('email').value
    const password = document.getElementById('password').value
    const profilePicInput = document.getElementById('profile-pic')
    
    if (!username || !email || !password) {
        alert('Please fill in all fields')
        return
    }

    let profilePicBase64 = 'default-avatar.png'
    if (profilePicInput.files.length > 0) {
        try {
            profilePicBase64 = await convertToBase64(profilePicInput.files[0])
        } catch (error) {
            console.error('Error converting image:', error)
            alert('Error uploading profile picture')
            return
        }
    }

    const userData = {
        username,
        email,
        password: await hashPassword(password),
        profilePic: profilePicBase64
    }

    try {
        localStorage.setItem('userData', JSON.stringify(userData))
        currentUser = userData
        checkAuth()
    } catch (error) {
        console.error('Error saving user data:', error)
        alert('Registration failed. Please try again.')
    }
}

// تسجيل الدخول
const loginUser = async (e) => {
    e.preventDefault()
    
    const email = document.getElementById('login-email').value
    const password = document.getElementById('login-password').value
    
    if (!email || !password) {
        alert('Please fill in all fields')
        return
    }

    const userData = localStorage.getItem('userData')
    if (userData) {
        const user = JSON.parse(userData)
        const hashedPassword = await hashPassword(password)
        
        if (user.email === email && user.password === hashedPassword) {
            currentUser = user
            checkAuth()
        } else {
            alert('Invalid email or password')
        }
    } else {
        alert('User not found')
    }
}

// تحويل الصورة إلى Base64
const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => resolve(reader.result)
        reader.onerror = (error) => reject(error)
    })
}

// تشفير كلمة المرور (استخدام بسيط - في التطبيق الحقيقي يجب استخدام طريقة أكثر أماناً)
const hashPassword = async (password) => {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}

// انضمام للبث
const joinStream = async () => {
    if (!checkAuth()) {
        alert('Please login first')
        return
    }
    await joinAndDisplayLocalStream()
    document.getElementById('join-btn').style.display = 'none'
    document.getElementById('stream-controls').style.display = 'flex'
}

// إنشاء وعرض البث المحلي
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
        
        userProfiles.set(UID, {
            username: currentUser.username,
            profilePic: currentUser.profilePic
        })
        
    } catch (error) {
        console.error('Error joining stream:', error)
        alert('Failed to join stream. Please try again.')
    }
}

// معالجة انضمام المستخدمين
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

// معالجة مغادرة المستخدمين
const handleUserLeft = async (user) => {
    delete remoteUsers[user.uid]
    const playerContainer = document.getElementById(`user-container-${user.uid}`)
    if (playerContainer) playerContainer.remove()
    
    if (user.uid === screenSharingUid) {
        screenSharingUid = null
        document.getElementById('screen-btn').disabled = false
    }
}

// مغادرة البث
const leaveAndRemoveLocalStream = async () => {
    try {
        for (let track of localTracks) {
            track.stop()
            track.close()
        }
        
        if (screenTrack) {
            screenTrack.stop()
            screenTrack.close()
        }

        await client.leave()
        document.getElementById('join-btn').style.display = 'block'
        document.getElementById('stream-controls').style.display = 'none'
        document.getElementById('video-streams').innerHTML = ''
        
    } catch (error) {
        console.error('Error leaving stream:', error)
    }
}

// التحكم بالميكروفون
const toggleMic = async (e) => {
    if (localTracks[0].muted) {
        await localTracks[0].setMuted(false)
        e.target.innerHTML = '<i class="fas fa-microphone"></i> Mic on'
        e.target.style.backgroundColor = 'cadetblue'
    } else {
        await localTracks[0].setMuted(true)
        e.target.innerHTML = '<i class="fas fa-microphone-slash"></i> Mic off'
        e.target.style.backgroundColor = '#EE4B2B'
    }
}

// التحكم بالكاميرا
const toggleCamera = async (e) => {
    if (localTracks[1].muted) {
        await localTracks[1].setMuted(false)
        e.target.innerHTML = '<i class="fas fa-video"></i> Camera on'
        e.target.style.backgroundColor = 'cadetblue'
    } else {
        await localTracks[1].setMuted(true)
        e.target.innerHTML = '<i class="fas fa-video-slash"></i> Camera off'
        e.target.style.backgroundColor = '#EE4B2B'
    }
}

// مشاركة الشاشة
const toggleScreenShare = async (e) => {
    if (!isScreenSharing) {
        try {
            screenTrack = await AgoraRTC.createScreenVideoTrack({
                encoderConfig: "1080p_2",
                optimizationMode: "detail",
            })

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

// إيقاف مشاركة الشاشة
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

// تبديل بين نماذج التسجيل وتسجيل الدخول
const toggleForms = (showLogin) => {
    document.getElementById('register-form').style.display = showLogin ? 'none' : 'block'
    document.getElementById('login-form').style.display = showLogin ? 'block' : 'none'
}

// إضافة المستمعين للأحداث
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('join-btn').addEventListener('click', joinStream)
    document.getElementById('leave-btn').addEventListener('click', leaveAndRemoveLocalStream)
    document.getElementById('mic-btn').addEventListener('click', toggleMic)
    document.getElementById('camera-btn').addEventListener('click', toggleCamera)
    document.getElementById('screen-btn').addEventListener('click', toggleScreenShare)
    document.getElementById('register-btn').addEventListener('click', registerUser)
    document.getElementById('login-btn').addEventListener('click', loginUser)
    document.getElementById('show-login').addEventListener('click', () => toggleForms(true))
    document.getElementById('show-register').addEventListener('click', () => toggleForms(false))
    
    checkAuth()
})
