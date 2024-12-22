const APP_ID = "5f7a328ba1e64658a9fcecc620c789b0"
const TOKEN = "007eJxTYDj0f46owrbknFkP9pfNd+O72af/3bcr2DbV8N3ujp9CW54pMJimmScaG1kkJRqmmpmYmVokWqYlpyYnmxkZJJtbWCYZ7H6ant4QyMjgaVLGwsgAgSA+B0NxrkluaXFmMgMDAFx0Ip0="
const CHANNEL = "sm4music"

const client = AgoraRTC.createClient({mode:'rtc', codec:'vp8'})

let localTracks = []
let remoteUsers = {}
let screenTrack = null
let isScreenSharing = false
let screenSharingUid = null
// إضافة متغيرات جديدة
let currentUser = null;
const userProfiles = {};

// التحقق من وجود مستخدم مسجل
const checkAuth = () => {
const userData = localStorage.getItem('userData');
if (userData) {
currentUser = JSON.parse(userData);
document.getElementById('auth-container').style.display = 'none';
document.getElementById('stream-wrapper').style.display = 'block';
} else {
document.getElementById('auth-container').style.display = 'block';
document.getElementById('stream-wrapper').style.display = 'none';
}
};

let joinAndDisplayLocalStream = async () => {
client.on('user-published', handleUserJoined)
client.on('user-left', handleUserLeft)

let UID = await client.join(APP_ID, CHANNEL, TOKEN, null)

localTracks = await AgoraRTC.createMicrophoneAndCameraTracks() 

let player = `<div class="video-container" id="user-container-${UID}">
                    <div class="video-player" id="user-${UID}"></div>
              </div>`
document.getElementById('video-streams').insertAdjacentHTML('beforeend', player)

localTracks[1].play(`user-${UID}`)

await client.publish([localTracks[0], localTracks[1]])
}

let joinStream = async () => {
await joinAndDisplayLocalStream()
document.getElementById('join-btn').style.display = 'none'
document.getElementById('stream-controls').style.display = 'flex'
}

let handleUserJoined = async (user, mediaType) => {
remoteUsers[user.uid] = user;
await client.subscribe(user, mediaType);


if (mediaType === 'video') {
    let player = document.getElementById(`user-container-${user.uid}`);
    if (player != null) {
        player.remove();
    }

    let playerContainer = `
        <div class="video-container" id="user-container-${user.uid}">
            <div class="video-player" id="user-${user.uid}"></div>
            <div class="user-info">
                <img src="${userProfiles[user.uid]?.profilePic || 'default-avatar.png'}" alt="Profile">
                <span>${userProfiles[user.uid]?.username || 'User'}</span>
            </div>
    `;

    // إضافة زر التوسيع إذا كان المستخدم يشارك الشاشة
    if (user.videoTrack.trackMediaType === 'screen-video') {
        playerContainer += `
            <button class="expand-btn" onclick="toggleFullScreen(document.getElementById('user-container-${user.uid}'))">
                <i class="fas fa-expand"></i>
            </button>
        `;
        screenSharingUid = user.uid;
        document.getElementById('screen-btn').disabled = true;
    }

    playerContainer += `</div>`;

    document.getElementById('video-streams').insertAdjacentHTML('beforeend', playerContainer);
    user.videoTrack.play(`user-${user.uid}`);
}

if (mediaType === 'audio') {
    user.audioTrack.play();
}
};

let handleUserLeft = async (user) => {
delete remoteUsers[user.uid]
document.getElementById(user-container-${user.uid}).remove()


Copier
// Re-enable screen share button if the user who was sharing left
if(user.uid === screenSharingUid) {
    screenSharingUid = null
    document.getElementById('screen-btn').disabled = false
}
}

let leaveAndRemoveLocalStream = async () => {
for(let i = 0; localTracks.length > i; i++){
localTracks[i].stop()
localTracks[i].close()
}

if(screenTrack) {
    screenTrack.stop()
    screenTrack.close()
}

await client.leave()
document.getElementById('join-btn').style.display = 'block'
document.getElementById('stream-controls').style.display = 'none'
document.getElementById('video-streams').innerHTML = ''
}

let toggleMic = async (e) => {
if (localTracks[0].muted){
await localTracks[0].setMuted(false)
e.target.innerText = 'Mic on'
e.target.style.backgroundColor = 'cadetblue'
}else{
await localTracks[0].setMuted(true)
e.target.innerText = 'Mic off'
e.target.style.backgroundColor = '#EE4B2B'
}
}

let toggleCamera = async (e) => {
if(localTracks[1].muted){
await localTracks[1].setMuted(false)
e.target.innerText = 'Camera on'
e.target.style.backgroundColor = 'cadetblue'
}else{
await localTracks[1].setMuted(true)
e.target.innerText = 'Camera off'
e.target.style.backgroundColor = '#EE4B2B'
}
}

let toggleScreenShare = async (e) => {
if (!isScreenSharing) {
try {
// إنشاء track للشاشة مع الصوت
screenTrack = await AgoraRTC.createScreenVideoTrack({
encoderConfig: "1080p_1",
optimizationMode: "detail",
screenAudioTrack: true,
}, {
encoderConfig: {
sampleRate: 44100,
stereo: true,
bitrate: 128
}
});


        // إذا كان هناك track صوتي منفصل
        const [videoTrack, audioTrack] = Array.isArray(screenTrack) ? screenTrack : [screenTrack];

        // حفظ الفيديو الحالي في نافذة صغيرة
        const miniVideoContainer = `
            <div class="video-container small-video" id="user-mini-${currentUser?.uid || 'local'}">
                <div class="video-player" id="mini-video"></div>
                <div class="user-info">
                    <img src="${currentUser?.profilePic || 'default-avatar.png'}" alt="Profile">
                    <span>${currentUser?.username || 'You'}</span>
                </div>
            </div>
        `;
        document.getElementById('video-streams').insertAdjacentHTML('beforeend', miniVideoContainer);

        // إلغاء نشر الكاميرا الحالية
        await client.unpublish([localTracks[1]]);
        
        // نشر مشاركة الشاشة والصوت
        if (audioTrack) {
            await client.publish([videoTrack, audioTrack]);
        } else {
            await client.publish([videoTrack]);
        }

        // تشغيل الفيديو المصغر
        localTracks[1].play('mini-video');

        // إضافة زر التوسيع
        const screenContainer = document.getElementById(`user-container-${currentUser?.uid || 'local'}`);
        const expandBtn = document.createElement('button');
        expandBtn.className = 'expand-btn';
        expandBtn.innerHTML = '<i class="fas fa-expand"></i>';
        expandBtn.onclick = () => toggleFullScreen(screenContainer);
        screenContainer.appendChild(expandBtn);

        // تحديث الحالة والزر
        isScreenSharing = true;
        e.target.innerHTML = '<i class="fas fa-desktop"></i> Stop Sharing';
        e.target.style.backgroundColor = '#EE4B2B';

        // إضافة مستمع لإنهاء المشاركة
        videoTrack.on('track-ended', async () => {
            await stopScreenSharing(e);
        });

    } catch (error) {
        console.error('Error sharing screen:', error);
        alert('Failed to share screen. Please try again.');
    }
} else {
    await stopScreenSharing(e);
}
};

async function stopScreenSharing(e) {
try {
await client.unpublish(Array.isArray(screenTrack) ? screenTrack : [screenTrack]);

    if (Array.isArray(screenTrack)) {
        screenTrack.forEach(track => {
            track.stop();
            track.close();
        });
    } else {
        screenTrack.stop();
        screenTrack.close();
    }
    
    screenTrack = null;
    
    // إعادة نشر الكاميرا
    await client.publish([localTracks[1]]);
    
    // إزالة الفيديو المصغر
    const miniVideo = document.getElementById(`user-mini-${currentUser?.uid || 'local'}`);
    if (miniVideo) miniVideo.remove();

    isScreenSharing = false;
    e.target.innerHTML = '<i class="fas fa-desktop"></i> Share Screen';
    e.target.style.backgroundColor = 'cadetblue';
    
} catch (error) {
    console.error('Error stopping screen share:', error);
}
}

// دالة التوسيع
const toggleFullScreen = (element) => {
if (!document.fullscreenElement) {
element.requestFullscreen();
} else {
document.exitFullscreen();
}
};

// تسجيل المستخدم الجديد
const registerUser = async () => {
const username = document.getElementById('username').value;
const email = document.getElementById('email').value;
const password = document.getElementById('password').value;
const profilePic = document.getElementById('profile-pic').files[0];


// تحويل الصورة إلى Base64
const base64Image = await convertToBase64(profilePic);

const userData = {
    username,
    email,
    password, // في التطبيق الحقيقي يجب تشفير كلمة المرور
    profilePic: base64Image
};

localStorage.setItem('userData', JSON.stringify(userData));
currentUser = userData;
checkAuth();
};

// تحويل الصورة إلى Base64
const convertToBase64 = (file) => {
return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.onload = () => resolve(reader.result);
reader.onerror = reject;
reader.readAsDataURL(file);
});
};

document.getElementById('join-btn').addEventListener('click', joinStream)
document.getElementById('leave-btn').addEventListener('click', leaveAndRemoveLocalStream)
document.getElementById('mic-btn').addEventListener('click', toggleMic)
document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('screen-btn').addEventListener('click', toggleScreenShare)
document.getElementById('register-btn').addEventListener('click', registerUser);
document.getElementById('show-login').addEventListener('click', () => {
document.getElementById('register-form').style.display = 'none';
document.getElementById('login-form').style.display = 'block';
});
document.getElementById('show-register').addEventListener('click', () => {
document.getElementById('login-form').style.display = 'none';
document.getElementById('register-form').style.display = 'block';
});

// تحقق من حالة المصادقة عند تحميل الصفحة
window.addEventListener('load', checkAuth); <!DOCTYPE html>
