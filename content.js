let currentVolume = 1.0;

// Get initial volume from storage
browser.runtime.sendMessage({ command: 'getVolume' })
    .then(response => {
        if (response?.volume !== undefined) {
            currentVolume = response.volume;
            applyVolumeToMedia();
        }
    })
    .catch(err => console.error('Failed to get initial volume:', err));

// Listen for messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const mediaElement = document.querySelector('video, audio');

    switch (message.action) {
        case 'setVolume':
            currentVolume = message.volume;
            applyVolumeToMedia();
            sendResponse({ success: true });
            break;
        
        case 'togglePlayPause':
            if (mediaElement) {
                mediaElement.paused ? mediaElement.play() : mediaElement.pause();
                sendResponse({ success: true, paused: mediaElement.paused });
            } else {
                sendResponse({ success: false, error: "No media element found" });
            }
            break;
        
        case 'getPlayPauseState':
            sendResponse({ paused: mediaElement?.paused ?? true });
            break;
    }
    return true;
});

// Function to set volume on all existing media elements
function applyVolumeToMedia() {
    const mediaElements = document.querySelectorAll('audio, video');
    mediaElements.forEach(el => {
        el.volume = currentVolume;
        if (!el.dataset.playPauseListener) {
            el.addEventListener('play', handlePlayPauseEvent);
            el.addEventListener('pause', handlePlayPauseEvent);
            el.dataset.playPauseListener = 'true';
        }
    });
}

function handlePlayPauseEvent(event) {
    browser.runtime.sendMessage({
        action: 'playPauseStateChanged',
        paused: event.target.paused
    }).catch(e => console.error("Error sending play/pause state change:", e));
}



// Observe for new media elements added dynamically
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
                    node.volume = currentVolume;
                }
                // Check for nested media elements
                if (node.querySelectorAll) {
                    node.querySelectorAll('audio, video').forEach(el => el.volume = currentVolume);
                }
            }
        });
    });
});

// Start observing the document body for changes
if (document.body) {
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Apply initial volume on load
applyVolumeToMedia();