   let peerConnections = {};
        let localStream = null;
        let screenStream = null;
        let ws = null;
        let roomId = new URLSearchParams(window.location.search).get('room') || Math.random().toString(36).substring(7);
        let clientId = null;

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
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
                
                addVideoStream('local', localStream, true);
                connectWebSocket();
                setupEventListeners();
            } catch (error) {
                console.error('Media device error:', error);
                alert('فشل في الوصول إلى الكاميرا والميكروفون');
            }
        }

        function connectWebSocket() {
            ws = new WebSocket(`wss://${window.location.hostname}:3000`);

            ws.onopen = () => {
                console.log('WebSocket Connected');
                ws.send(JSON.stringify({
                    type: 'join_room',
                    roomId: roomId
                }));
            };

            ws.onmessage = async (event) => {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            };

            ws.onclose = () => {
                console.log('WebSocket Disconnected');
                setTimeout(connectWebSocket, 1000);
            };
        }

        function addVideoStream(userId, stream, isLocal = false) {
            const videoGrid = document.getElementById('videoGrid');
            const videoContainer = document.createElement('div');
            videoContainer.className = 'video-container';
            videoContainer.id = `video-${userId}`;

            const video = document.createElement('video');
            video.srcObject = stream;
            video.autoplay = true;
            video.playsInline = true;
            if (isLocal) video.muted = true;

            const label = document.createElement('div');
            label.className = 'video-label';
            label.textContent = isLocal ? 'أنت' : `مستخدم ${userId}`;

            videoContainer.appendChild(video);
            videoContainer.appendChild(label);
            videoGrid.appendChild(videoContainer);
        }

        async function createPeerConnection(userId) {
            const pc = new RTCPeerConnection(configuration);
            peerConnections[userId] = pc;

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    ws.send(JSON.stringify({
                        type: 'ice-candidate',
                        candidate: event.candidate,
                        targetUserId: userId
                    }));
                }
            };

            pc.ontrack = (event) => {
                if (!document.getElementById(`video-${userId}`)) {
                    addVideoStream(userId, event.streams[0]);
                }
            };

            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });

            return pc;
        }

        async function handleWebSocketMessage(data) {
            switch(data.type) {
                case 'connected':
                    clientId = data.clientId;
                    break;

                case 'user_joined':
                    const pc = await createPeerConnection(data.clientId);
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    ws.send(JSON.stringify({
                        type: 'offer',
                        offer: offer,
                        targetUserId: data.clientId
                    }));
                    break;

                case 'offer':
                    const peerConnection = await createPeerConnection(data.clientId);
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    ws.send(JSON.stringify({
                        type: 'answer',
                        answer: answer,
                        targetUserId: data.clientId
                    }));
                    break;

                case 'answer':
                    await peerConnections[data.clientId].setRemoteDescription(
                        new RTCSessionDescription(data.answer)
                    );
                    break;

                case 'ice-candidate':
                    if (peerConnections[data.clientId]) {
                        await peerConnections[data.clientId].addIceCandidate(
                            new RTCIceCandidate(data.candidate)
                        );
                    }
                    break;

                case 'user_left':
                    removeVideoStream(data.clientId);
                    break;

                case 'chat':
                    addChatMessage(data);
                    break;
            }
        }

        function setupEventListeners() {
            document.getElementById('toggleVideo').addEventListener('click', toggleVideo);
            document.getElementById('toggleAudio').addEventListener('click', toggleAudio);
            document.getElementById('shareScreen').addEventListener('click', toggleScreenShare);
            document.getElementById('endCall').addEventListener('click', endCall);
            document.getElementById('sendMessage').addEventListener('click', sendChatMessage);
            document.getElementById('shareFile').addEventListener('click', () => {
                document.getElementById('fileInput').click();
            });
            document.getElementById('fileInput').addEventListener('change', handleFileShare);
        }

        function toggleVideo() {
            const videoTrack = localStream.getVideoTracks()[0];
            videoTrack.enabled = !videoTrack.enabled;
            document.getElementById('toggleVideo').classList.toggle('active');
        }

        function toggleAudio() {
            const audioTrack = localStream.getAudioTracks()[0];
            audioTrack.enabled = !audioTrack.enabled;
            document.getElementById('toggleAudio').classList.toggle('active');
        }

        async function toggleScreenShare() {
            try {
                if (screenStream) {
                    stopScreenShare();
                } else {
                    screenStream = await navigator.mediaDevices.getDisplayMedia({
                        video: true
                    });
                    
                    const videoTrack = screenStream.getVideoTracks()[0];
                    
                    Object.values(peerConnections).forEach(pc => {
                        const sender = pc.getSenders().find(s => s.track.kind === 'video');
                        sender.replaceTrack(videoTrack);
                    });

                    document.getElementById('shareScreen').classList.add('active');
                    
                    videoTrack.onended = stopScreenShare;
                }
            } catch (error) {
                console.error('Screen share error:', error);
                alert('فشل في مشاركة الشاشة');
            }
        }

        function stopScreenShare() {
            const videoTrack = localStream.getVideoTracks()[0];
            Object.values(peerConnections).forEach(pc => {
                const sender = pc.getSenders().find(s => s.track.kind === 'video');
                sender.replaceTrack(videoTrack);
            });
            
            if (screenStream) {
                screenStream.getTracks().forEach(track => track.stop());
                screenStream = null;
            }
            
            document.getElementById('shareScreen').classList.remove('active');
        }

        function sendChatMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            
            if (message) {
                ws.send(JSON.stringify({
                    type: 'chat',
                    message: message
                }));
                
                addChatMessage({
                    clientId: 'أنت',
                    message: message,
                    isSelf: true
                });
                
                input.value = '';
            }
        }

        function addChatMessage(data) {
            const messagesDiv = document.getElementById('chatMessages');
            const messageElement = document.createElement('div');
            messageElement.className = `message ${data.isSelf ? 'sent' : 'received'}`;
            messageElement.textContent = `${data.clientId}: ${data.message}`;
            messagesDiv.appendChild(messageElement);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        async function handleFileShare(event) {
            const file = event.target.files[0];
            if (!file) return;

            const chunkSize = 16384; // 16KB chunks
            const fileReader = new FileReader();
            let offset = 0;

            fileReader.onload = function(e) {
                const chunk = e.target.result;
                ws.send(JSON.stringify({
                    type: 'file',
                    name: file.name,
                    size: file.size,
                    chunk: chunk,
                    offset: offset
                }));

                offset += chunk.length;
                const progress = (offset / file.size) * 100;
                document.getElementById('fileProgress').style.width = `${progress}%`;

                if (offset < file.size) {
                    readNextChunk();
                }
            };

            function readNextChunk() {
                const slice = file.slice(offset, offset + chunkSize);
                fileReader.readAsArrayBuffer(slice);
            }

            readNextChunk();
        }

        function endCall() {
            Object.values(peerConnections).forEach(pc => pc.close());
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            if (screenStream) {
                screenStream.getTracks().forEach(track => track.stop());
            }
            ws.close();
            window.location.href = '/';
        }

        // Initialize the application
        init();
