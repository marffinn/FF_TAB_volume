let currentVolume = 1.0;  // Default

// Get initial volume from storage
browser.runtime.sendMessage({ command: 'getVolume' }).then(response => {
    if (response && response.volume !== undefined) {
        currentVolume = response.volume;
        applyVolumeToMedia();
    }
}).catch(err => console.error(err));


// Listen for messages from popup
browser.runtime.onMessage.addListener((message) => {
    console.log('Content script received message:', message);  // Debug log
    if (message.action === 'setVolume') {
        currentVolume = message.volume;
        applyVolumeToMedia();
        return Promise.resolve({ success: true });  // Send a response back for confirmation
    }
});

// Function to set volume on all existing media elements
function applyVolumeToMedia() {
    const mediaElements = document.querySelectorAll('audio, video');
    console.log('Applying volume ' + currentVolume + ' to ' + mediaElements.length + ' media elements');  // Debug log
    mediaElements.forEach(el => {
        el.volume = currentVolume;
    });
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