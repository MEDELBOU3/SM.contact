 let peerConnections = {};
        let localStream = null;
        let screenStream = null;
        let ws = null;
        let currentRoom = null;
        let selectedUser = null;
        let localUserId = null;
        let onlineUsers = new Map();
        let currentCall = null;

        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                {
                    urls: 'turn:numb.viagenie.ca',
                    username: 'webrtc@live.com',
                    credential: 'muazkh'
                }
            ]
        };

        async function init() {
            try {
                await setupWebSocket();
                await setupLocalMedia();
                setupEventListeners();
                updateParticipantsList();
            } catch (error) {
                console.error('Initialization error:', error);
                alert('حدث خطأ أثناء تهيئة التطبيق');
            }
        }

        async function setupWebSocket() {
            return new Promise((resolve, reject) => {
                ws = new WebSocket(`wss://${window.location.hostname}:3000`);

                ws.onopen = () => {
                    console.log('WebSocket Connected');
                    resolve();
                };

                ws.onmessage = handleWebSocketMessage;
                ws.onerror = reject;
                ws.onclose = handleWebSocketClose;
            });
        }

        async function setupLocalMedia() {
            try {
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
                document.getElementById('localVideo').srcObject = localStream;
            } catch (error) {
                console.error('Media access error:', error);
                throw new Error('فشل في الوصول إلى الكاميرا والميكروفون');
            }
        }

        async function handleWebSocketMessage(event) {
            const data = JSON.parse(event.data);
            console.log('Received message:', data);

            switch(data.type) {
                case 'user_list':
                    updateOnlineUsers(data.users);
                    break;

                case 'user_joined':
                    handleUserJoined(data);
                    break;

                case 'user_left':
                    handleUserLeft(data);
                    break;

                case 'call_request':
                    handleCallRequest(data);
                    break;

                case 'call_accepted':
                    handleCallAccepted(data);
                    break;

                case 'call_rejected':
                    handleCallRejected(data);
                    break;

                case 'offer':
                    handleOffer(data);
                    break;

                case 'answer':
                    handleAnswer(data);
                    break;

                case 'ice-candidate':
                    handleIceCandidate(data);
                    break;

                case 'chat_message':
                    handleChatMessage(data);
                    break;

                case 'screen_share_started':
                    handleScreenShareStarted(data);
                    break;

                case 'screen_share_stopped':
                    handleScreenShareStopped(data);
                    break;
            }
        }

        function updateOnlineUsers(users) {
            onlineUsers.clear();
            users.forEach(user => {
                if (user.id !== localUserId) {
                    onlineUsers.set(user.id, user);
                }
            });
            updateParticipantsList();
        }

        function updateParticipantsList() {
            const participantsList = document.getElementById('participantsList');
            participantsList.innerHTML = '';

            onlineUsers.forEach(user => {
                const participantDiv = document.createElement('div');
                participantDiv.className = `participant ${user.online ? 'online' : 'offline'}`;
                participantDiv.innerHTML = `
                    <span class="status-indicator ${user.online ? 'status-online' : 'status-offline'}"></span>
                    <span>${user.name || user.id}</span>
                    <div class="participant-actions">
                        <button class="action-btn call-btn" data-userid="${user.id}">اتصال</button>
                        <button class="action-btn chat-btn" data-userid="${user.id}">دردشة</button>
                    </div>
                `;

                participantDiv.querySelector('.call-btn').addEventListener('click', () => {
                    initiateCall(user.id);
                });

                participantDiv.querySelector('.chat-btn').addEventListener('click', () => {
                    openChat(user.id);
                });

                participantsList.appendChild(participantDiv);
            });
        }

        async function initiateCall(userId) {
            try {
                if (currentCall) {
                    alert('أنت بالفعل في مكالمة');
                    return;
                }

                currentCall = {
                    userId: userId,
                    type: 'video'
                };

                ws.send(JSON.stringify({
                    type: 'call_request',
                    targetUserId: userId
                }));

                // Show calling status
                showCallStatus(`جاري الاتصال بـ ${onlineUsers.get(userId).name || userId}...`);
            } catch (error) {
                console.error('Call initiation error:', error);
                alert('فشل في بدء المكالمة');
            }
        }

        async function handleCallRequest(data) {
            const caller = onlineUsers.get(data.callerId);
            showCallNotification(`${caller.name || data.callerId} يريد الاتصال بك`, data.callerId);
        }

        function showCallNotification(message, callerId) {
            const notification = document.getElementById('callNotification');
            document.getElementById('callMessage').textContent = message;
            
            document.getElementById('acceptCall').onclick = () => acceptCall(callerId);
            document.getElementById('rejectCall').onclick = () => rejectCall(callerId);
            
            notification.style.display = 'block';
        }

        async function acceptCall(callerId) {
            try {
                document.getElementById('callNotification').style.display = 'none';
                currentCall = {
                    userId: callerId,
                    type: 'video'
                };

                const pc = await createPeerConnection(callerId);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                ws.send(JSON.stringify({
                    type: 'call_accepted',
                    targetUserId: callerId,
                    offer: offer
                }));
            } catch (error) {
                console.error('Accept call error:', error);
                alert('فشل في قبول المكالمة');
            }
        }

        function rejectCall(callerId) {
            document.getElementById('callNotification').style.display = 'none';
            ws.send(JSON.stringify({
                type: 'call_rejected',
                targetUserId: callerId
            }));
        }

        async function shareScreen() {
            try {
                if (!currentCall) {
                    alert('يجب أن تكون في مكالمة لمشاركة الشاشة');
                    return;
                }

                screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true
                });

                const videoTrack = screenStream.getVideoTracks()[0];
                
                Object.values(peerConnections).forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track.kind === 'video');
                    sender.replaceTrack(videoTrack);
                });

                videoTrack.onended = stopScreenShare;

                ws.send(JSON.stringify({
                    type: 'screen_share_started',
                    targetUserId: currentCall.userId
                }));

                document.getElementById('shareScreen').classList.add('active');
            } catch (error) {
                console.error('Screen share error:', error);
                alert('فشل في مشاركة الشاشة');
            }
        }

        function stopScreenShare() {
            if (screenStream) {
                screenStream.getTracks().forEach(track => track.stop());
                
                if (localStream) {
                    const videoTrack = localStream.getVideoTracks()[0];
                    Object.values(peerConnections).forEach(pc => {
                        const sender = pc.getSenders().find(s => s.track.kind === 'video');
                        sender.replaceTrack(videoTrack);
                    });
                }

                ws.send(JSON.stringify({
                    type: 'screen_share_stopped',
                    targetUserId: currentCall.userId
                }));

                document.getElementById('shareScreen').classList.remove('active');
                screenStream = null;
            }
        }

        function sendChatMessage() {
            if (!selectedUser) {
                alert('الرجاء اختيار مستخدم للدردشة معه');
                return;
            }

            const messageInput = document.getElementById('messageInput');
            const message = messageInput.value.trim();
            
            if (message) {
                ws.send(JSON.stringify({
                    type: 'chat_message',
                    targetUserId: selectedUser,
                    message: message
                }));

                addMessageToChat({
                    senderId: localUserId,
                    message: message,
                    timestamp: Date.now()
                });

                messageInput.value = '';
            }
        }

        function addMessageToChat(messageData) {
            const chatMessages = document.getElementById('chatMessages');
            const messageElement = document.createElement('div');
            messageElement.className = `message ${messageData.senderId === localUserId ? 'sent' : 'received'}`;
            
            const time = new Date(messageData.timestamp).toLocaleTimeString();
            messageElement.innerHTML = `
                <div class="message-content">${messageData.message}</div>
                <div class="message-time">${time}</div>
            `;

            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        // Initialize the application
        init();
