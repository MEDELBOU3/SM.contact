const APP_ID = "560b78f73de54cbb8be941304218b140"
        const TOKEN = "007eJxTYIi6/VJVo77bK2HuFXnu9jm6c9ZyVkZ/S5h57hpHtO3BG7kKDKZmBknmFmnmximppibJSUkWSamWJobGBiZGhhZJhiYGktrp6Q2BjAz+Uz8yMjJAIIjPxRCcq5Ccn1eSmFzCwAAA0Ykgaw=="
        const CHANNEL = "Sm contact"

        const client = AgoraRTC.createClient({mode:'rtc', codec:'vp8'})

        let localTracks = []
        let remoteUsers = {}
        let screenTrack = null
        let isScreenSharing = false
        let screenSharingUid = null

        let joinAndDisplayLocalStream = async () => {
            try {
                showLoading();
                client.on('user-published', handleUserJoined)
                client.on('user-left', handleUserLeft)
                
                let UID = await client.join(APP_ID, CHANNEL, TOKEN, null)

                localTracks = await AgoraRTC.createMicrophoneAndCameraTracks() 

                let player = `<div class="video-container" id="user-container-${UID}">
                                <div class="status-indicator"></div>
                                <div class="video-player" id="user-${UID}"></div>
                                <div class="user-name">You</div>
                            </div>`
                document.getElementById('video-streams').insertAdjacentHTML('beforeend', player)

                localTracks[1].play(`user-${UID}`)
                
                await client.publish([localTracks[0], localTracks[1]])
                updateParticipantCount()
            } catch (error) {
                console.error('Error in joinAndDisplayLocalStream:', error)
                alert('Failed to join stream: ' + error.message)
            } finally {
                hideLoading()
            }
        }

        let handleUserJoined = async (user, mediaType) => {
            remoteUsers[user.uid] = user 
            await client.subscribe(user, mediaType)

            if (mediaType === 'video'){
                let player = document.getElementById(`user-container-${user.uid}`)
                if (player != null){
                    player.remove()
                }

                player = `<div class="video-container" id="user-container-${user.uid}">
                            <div class="status-indicator"></div>
                            <div class="video-player" id="user-${user.uid}"></div>
                            <div class="user-name">User ${user.uid}</div>
                         </div>`
                document.getElementById('video-streams').insertAdjacentHTML('beforeend', player)

                user.videoTrack.play(`user-${user.uid}`)
                
                if(user.videoTrack.trackMediaType === 'screen-video') {
                    screenSharingUid = user.uid
                    document.getElementById('screen-btn').disabled = true
                }
            }

            if (mediaType === 'audio'){
                user.audioTrack.play()
            }
            updateParticipantCount()
        }

        let handleUserLeft = async (user) => {
            delete remoteUsers[user.uid]
            document.getElementById(`user-container-${user.uid}`)?.remove()
            
            if(user.uid === screenSharingUid) {
                screenSharingUid = null
                document.getElementById('screen-btn').disabled = false
            }
            updateParticipantCount()
        }

        let leaveAndRemoveLocalStream = async () => {
            try {
                showLoading()
                for(let i = 0; localTracks.length > i; i++){
                    localTracks[i].stop()
                    localTracks[i].close()
                }
                
                if(screenTrack) {
                    screenTrack.stop()
                    screenTrack.close()
                }

                await client.leave()
                document.querySelector('.join-container').style.display = 'flex'
                document.getElementById('join-btn').style.display = 'block'
                document.getElementById('stream-controls').style.display = 'none'
                document.getElementById('video-streams').innerHTML = ''
                updateParticipantCount()
            } catch (error) {
                console.error('Error in leaveAndRemoveLocalStream:', error)
            } finally {
                hideLoading()
            }
        }

        let toggleMic = async (e) => {
            try {
                if (localTracks[0].muted){
                    await localTracks[0].setMuted(false)
                    e.target.classList.remove('active')
                    e.target.innerHTML = '<i class="fas fa-microphone"></i>'
                }else{
                    await localTracks[0].setMuted(true)
                    e.target.classList.add('active')
                    e.target.innerHTML = '<i class="fas fa-microphone-slash"></i>'
                }
            } catch (error) {
                console.error('Error toggling mic:', error)
            }
        }

        let toggleCamera = async (e) => {
            try {
                if(localTracks[1].muted){
                    await localTracks[1].setMuted(false)
                    e.target.classList.remove('active')
                    e.target.innerHTML = '<i class="fas fa-video"></i>'
                }else{
                    await localTracks[1].setMuted(true)
                    e.target.classList.add('active')
                    e.target.innerHTML = '<i class="fas fa-video-slash"></i>'
                }
            } catch (error) {
                console.error('Error toggling camera:', error)
            }
        }

        let toggleScreenShare = async (e) => {
            try {
                if(!isScreenSharing) {
                    screenTrack = await AgoraRTC.createScreenVideoTrack()
                    await client.unpublish([localTracks[1]])
                    await client.publish([screenTrack])
                    
                    screenTrack.on('track-ended', async () => {
                        await stopScreenSharing(e)
                    })
                    
                    isScreenSharing = true
                    e.target.classList.add('active')
                    e.target.innerHTML = '<i class="fas fa-stop-circle"></i>'
                } else {
                    await stopScreenSharing(e)
                }
            } catch (error) {
                console.error('Error in screen sharing:', error)
                alert('Failed to share screen: ' + error.message)
            }
        }

        async function stopScreenSharing(e) {
            try {
                await client.unpublish([screenTrack])
                screenTrack.stop()
                screenTrack.close()
                screenTrack = null
                await client.publish([localTracks[1]])
                isScreenSharing = false
                e.target.classList.remove('active')
                e.target.innerHTML = '<i class="fas fa-desktop"></i>'
            } catch (error) {
                console.error('Error stopping screen share:', error)
            }
        }

        function showLoading() {
            document.querySelector('.loading-overlay').style.display = 'flex'
        }

        function hideLoading() {
            document.querySelector('.loading-overlay').style.display = 'none'
        }

        function updateParticipantCount() {
            const count = Object.keys(remoteUsers).length + 1
            document.getElementById('participant-number').textContent = count
        }

        // Event Listeners
        document.getElementById('join-btn').addEventListener('click', joinStream)
        document.getElementById('leave-btn').addEventListener('click', leaveAndRemoveLocalStream)
        document.getElementById('mic-btn').addEventListener('click', toggleMic)
        document.getElementById('camera-btn').addEventListener('click', toggleCamera)
        document.getElementById('screen-btn').addEventListener('click', toggleScreenShare)

        // Error handling for Agora client
        client.on('error', (error) => {
            console.error('Agora client error:', error)
            alert('An error occurred with the video call. Please try rejoining.')
        })

        // Connection state change handling
        client.on('connection-state-change', (curState, prevState) => {
            console.log('Connection state changed from', prevState, 'to', curState)
            if (curState === 'DISCONNECTED') {
                alert('You have been disconnected. Please try rejoining.')
                leaveAndRemoveLocalStream()
            }
        })

