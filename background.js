chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === 'getVolume') {
        const storageKey = `volume_${sender.tab.id}`;
        chrome.storage.sync.get(storageKey, (data) => {
            if (chrome.runtime.lastError) {
                sendResponse({ volume: 1, error: chrome.runtime.lastError.message });
                return;
            }
            sendResponse({ volume: data[storageKey] ?? 1 });
        });
        return true;
    }
});