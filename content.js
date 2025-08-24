let currentVolume = 1.0;  // Default

// Get initial volume from storage
browser.runtime.sendMessage({ command: 'getVolume' }).then(response => {
    if (response && response.volume !== undefined) {
        currentVolume = response.volume;
        applyVolumeToMedia();
    }
}).catch(err => console.error(err));


// Listen for messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);  // Debug log
    const mediaElement = document.querySelector('video, audio');

    if (message.action === 'setVolume') {
        currentVolume = message.volume;
        applyVolumeToMedia();
        sendResponse({ success: true });
    } else if (message.action === 'togglePlayPause') {
        if (mediaElement) {
            if (mediaElement.paused) {
                mediaElement.play();
            } else {
                mediaElement.pause();
            }
            sendResponse({ success: true, paused: mediaElement.paused });
        } else {
            sendResponse({ success: false, error: "No media element found" });
        }
    } else if (message.action === 'getPlayPauseState') {
        if (mediaElement) {
            sendResponse({ paused: mediaElement.paused });
        } else {
            // If no media is found, it can't be "playing", so treat as paused.
            sendResponse({ paused: true });
        }
    }
    // Keep the message channel open for asynchronous response
    return true;
});

// Function to set volume on all existing media elements
function applyVolumeToMedia() {
    const mediaElements = document.querySelectorAll('audio, video');
    console.log('Applying volume ' + currentVolume + ' to ' + mediaElements.length + ' media elements');  // Debug log
    mediaElements.forEach(el => {
        el.volume = currentVolume;
        // Add listeners if they haven't been added yet
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
        if (mutation.addedNodes) {
            mutation.addedNodes.forEach((node) => {
                if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
                    node.volume = currentVolume;
                }
                // Also check for nested media
                node.querySelectorAll('audio, video').forEach(el => el.volume = currentVolume);
            });
        }
    });
});

// Start observing the document body for changes
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Apply initial volume on load
applyVolumeToMedia();
console.log('Content script loaded and ready');  // Initial log to confirm injection