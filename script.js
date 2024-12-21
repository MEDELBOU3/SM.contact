 let screenStream = null;
        let audioStream = null;
        let peerConnection = null;
        let dataChannel = null;
        let isAudioEnabled = false;
        let currentQuality = 'medium';

        const startShareBtn = document.getElementById('startShare');
        const toggleAudioBtn = document.getElementById('toggleAudio');
        const settingsBtn = document.getElementById('settings');
        const endSessionBtn = document.getElementById('endSession');
        const screenVideo = document.getElementById('screenShare');
        const messageInput = document.getElementById('messageInput');
        const sendMessageBtn = document.getElementById('sendMessage');
        const chatMessages = document.getElementById('chatMessages');
        const settingsPanel = document.getElementById('settingsPanel');
        const closeSettingsBtn = document.getElementById('closeSettings');
        const qualityOptions = document.querySelectorAll('.quality-option');
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const loadingOverlay = document.getElementById('loadingOverlay');
        const connectionStatus = document.getElementById('connectionStatus');
        const statusText = document.getElementById('statusText');

        // إعداد WebRTC
        function initializePeerConnection() {
            peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            // إعداد قناة البيانات
            dataChannel = peerConnection.createDataChannel('messageChannel');
            setupDataChannel();

            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    // إرسال المرشح إلى الطرف الآخر
                    console.log('New ICE candidate:', event.candidate);
                }
            };

            peerConnection.onconnectionstatechange = () => {
                updateConnectionStatus(peerConnection.connectionState);
            };
        }

        function updateConnectionStatus(state) {
            connectionStatus.className = 'status-dot' + (state === 'connected' ? ' connected' : '');
            statusText.textContent = state === 'connected' ? 'متصل' : 'غير متصل';
        }

        // إعداد مشاركة الشاشة
        startShareBtn.addEventListener('click', async () => {
            try {
                showLoading();
                screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        frameRate: { max: 30 }
                    },
                    audio: true
                });
                
                hideLoading();
                screenVideo.srcObject = screenStream;
                startShareBtn.disabled = true;
                endSessionBtn.disabled = false;

                screenStream.getVideoTracks()[0].onended = () => {
                    stopSharing();
                };

                if (peerConnection) {
                    screenStream.getTracks().forEach(track => {
                        peerConnection.addTrack(track, screenStream);
                    });
                }
            } catch (err) {
                hideLoading();
                console.error("خطأ في مشاركة الشاشة:", err);
                alert("حدث خطأ في مشاركة الشاشة");
            }
        });

        // التحكم في الصوت
        toggleAudioBtn.addEventListener('click', async () => {
            if (!audioStream) {
                try {
                    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    isAudioEnabled = true;
                    toggleAudioBtn.innerHTML = '<i class="fas fa-microphone"></i> كتم الصوت';
                    
                    if (peerConnection) {
                        audioStream.getTracks().forEach(track => {
                            peerConnection.addTrack(track, audioStream);
                        });
                    }
                } catch (err) {
                    console.error("خطأ في الوصول إلى الميكروفون:", err);
                    alert("لا يمكن الوصول إلى الميكروفون");
                }
            } else {
                isAudioEnabled = !isAudioEnabled;
                audioStream.getAudioTracks().forEach(track => {
                    track.enabled = isAudioEnabled;
                });
                toggleAudioBtn.innerHTML = isAudioEnabled ? 
                    '<i class="fas fa-microphone"></i> كتم الصوت' :
                    '<i class="fas fa-microphone-slash"></i> تشغيل الصوت';
            }
        });

        // إدارة الدردشة
        function setupDataChannel() {
            dataChannel.onmessage = (event) => {
                const message = JSON.parse(event.data);
                addMessageToChat(message, false);
            };
        }

        function addMessageToChat(message, sent = true) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${sent ? 'sent' : 'received'}`;
            messageDiv.textContent = message.text;
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        sendMessageBtn.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        function sendMessage() {
            const message = messageInput.value.trim();
            if (message && dataChannel) {
                const messageObj = {
                    type: 'message',
                    text: message
                };
                dataChannel.send(JSON.stringify(messageObj));
                addMessageToChat(messageObj, true);
                messageInput.value = '';
            }
        }

        // إدارة الملفات
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            handleFiles(files);
        });

        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
        });

        function handleFiles(files) {
            Array.from(files).forEach(file => {
                // هنا يمكن إضافة منطق إرسال الملفات
                console.log('File to send:', file);
            });
        }

        // الإعدادات
        settingsBtn.addEventListener('click', () => {
            settingsPanel.style.display = 'flex';
        });

        closeSettingsBtn.addEventListener('click', () => {
            settingsPanel.style.display = 'none';
        });

        qualityOptions.forEach(option => {
            option.addEventListener('click', () => {
                qualityOptions.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                currentQuality = option.dataset.quality;
                updateStreamQuality();
            });
        });

        function updateStreamQuality() {
            if (screenStream) {
                const videoTrack = screenStream.getVideoTracks()[0];
                const constraints = {
                    high: { width: 1920, height: 1080, frameRate: 30 },
                    medium: { width: 1280, height: 720, frameRate: 24 },
                    low: { width: 854, height: 480, frameRate: 15 }
                };
                
                videoTrack.applyConstraints({
                    width: { ideal: constraints[currentQuality].width },
                    height: { ideal: constraints[currentQuality].height },
                    frameRate: { max: constraints[currentQuality].frameRate }
                });
            }
        }

        function showLoading() {
            loadingOverlay.style.display = 'flex';
        }

        function hideLoading() {
            loadingOverlay.style.display = 'none';
        }

        function stopSharing() {
            if (screenStream) {
                screenStream.getTracks().forEach(track => track.stop());
                screenVideo.srcObject = null;
                startShareBtn.disabled = false;
                endSessionBtn.disabled = true;
            }
        }

        // تنظيف عند إغلاق الصفحة
        window.addEventListener('beforeunload', () => {
            if (screenStream) {
                screenStream.getTracks().forEach(track => track.stop());
            }
            if (audioStream) {
                audioStream.getTracks().forEach(track => track.stop());
            }
            if (peerConnection) {
                peerConnection.close();
            }
        });

        // بدء الاتصال
        initializePeerConnection();
