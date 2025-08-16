chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.command === 'getVolume') {
        const storageKey = `volume_${sender.tab.id}`;
        chrome.storage.sync.get(storageKey, function(data) {
            sendResponse({ volume: data[storageKey] !== undefined ? data[storageKey] : 1 });
        });
        return true; // Indicates that the response is sent asynchronously
    }
});