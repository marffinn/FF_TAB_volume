// Icon constants
const ICONS = {
    play: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
    pause: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`,
    mute: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    unmute: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`
};

// Fetch audible tabs and YouTube tabs
const audibleTabsQuery = browser.tabs.query({ audible: true });
const youtubeTabsQuery = browser.tabs.query({ url: "*://*.youtube.com/*" });

Promise.all([audibleTabsQuery, youtubeTabsQuery]).then(results => {
    const [audibleTabs, youtubeTabs] = results;
    const tabsMap = new Map();
    
    // Limit iterations to prevent potential DoS
    const maxTabs = 50;
    [...audibleTabs.slice(0, maxTabs), ...youtubeTabs.slice(0, maxTabs)]
        .forEach(tab => tabsMap.set(tab.id, tab));

    const tabs = Array.from(tabsMap.values());
    const tabList = document.getElementById('tab-list');

    if (tabs.length === 0) {
        const message = document.createElement('div');
        message.id = 'no-tabs-message';
        message.textContent = 'No tabs playing audio ';
        tabList.appendChild(message);
        return;
    }



    tabs.forEach(tab => {
        const div = document.createElement('div');
        div.className = 'tab-item';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'tab-info';

        // Add favicon if available
        if (tab.favIconUrl) {
            const favicon = document.createElement('img');
            favicon.src = tab.favIconUrl;
            favicon.alt = 'Tab favicon';
            favicon.width = 16;
            favicon.height = 16;
            favicon.className = 'favicon';
            titleDiv.appendChild(favicon);
        }

        const title = document.createElement('span');
        title.className = 'tab-title';
        title.textContent = tab.title || 'Untitled Tab';
        titleDiv.appendChild(title);
        div.appendChild(titleDiv);

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'volume-controls';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 0;
        slider.max = 100;
        slider.value = 100;  // Default
        slider.dataset.tabId = tab.id;

        const muteButton = document.createElement('button');
        muteButton.className = 'mute-button';
        muteButton.dataset.tabId = tab.id;

        const playPauseButton = document.createElement('button');
        playPauseButton.className = 'play-pause-button';
        playPauseButton.dataset.tabId = tab.id;

        const storageKey = `volume_${tab.id}`;
        const muteKey = `muted_${tab.id}`;

        // Get initial volume and mute state from storage
        browser.storage.sync.get([storageKey, muteKey], (data) => {
            if (data[muteKey]) {
                slider.value = 0;
                setButtonIcon(muteButton, 'unmute');
            } else if (data[storageKey] !== undefined) {
                slider.value = data[storageKey] * 100;
                setButtonIcon(muteButton, 'mute');
            }
        });

        // Get initial play/pause state
        browser.tabs.sendMessage(tab.id, { action: 'getPlayPauseState' })
            .then(response => {
                setButtonIcon(playPauseButton, response?.paused ? 'play' : 'pause');
            })
            .catch(e => console.error(`Could not get play/pause state for tab ${tab.id}:`, e));


        slider.addEventListener('input', (e) => {
            const volume = parseInt(e.target.value);
            const normalizedVolume = volume / 100;
            sendVolumeMessage(e.target.dataset.tabId, normalizedVolume);
            // Batch storage operations
            browser.storage.sync.set({ 
                [storageKey]: normalizedVolume,
                [muteKey]: false 
            });
            setButtonIcon(muteButton, 'mute');
        });

        muteButton.addEventListener('click', (e) => {
            browser.storage.sync.get([storageKey, muteKey], (data) => {
                const isMuted = data[muteKey];
                if (isMuted) {
                    // Unmute
                    browser.storage.sync.get(`volume_before_mute_${tab.id}`, (data_before_mute) => {
                        const lastVolume = data_before_mute[`volume_before_mute_${tab.id}`] || 1;
                        slider.value = lastVolume * 100;
                        sendVolumeMessage(tab.id, lastVolume);
                        // Batch storage operations
                        browser.storage.sync.set({ 
                            [storageKey]: lastVolume,
                            [muteKey]: false 
                        });
                        setButtonIcon(muteButton, 'mute');
                    });
                } else {
                    // Mute
                    const currentVolume = slider.value / 100;
                    slider.value = 0;
                    sendVolumeMessage(tab.id, 0);
                    // Batch storage operations
                    browser.storage.sync.set({ 
                        [`volume_before_mute_${tab.id}`]: currentVolume,
                        [storageKey]: 0,
                        [muteKey]: true 
                    });
                    setButtonIcon(muteButton, 'unmute');
                }
            });
        });

        playPauseButton.addEventListener('click', (e) => {
            browser.tabs.sendMessage(parseInt(e.currentTarget.dataset.tabId), { action: 'togglePlayPause' });
        });

        controlsDiv.appendChild(playPauseButton);
        controlsDiv.appendChild(slider);
        controlsDiv.appendChild(muteButton);
        div.appendChild(controlsDiv);
        tabList.appendChild(div);
    });
}).catch(error => console.error('Error querying tabs:', error));

// Listen for state changes from content scripts
browser.runtime.onMessage.addListener((message, sender) => {
    if (message.action === 'playPauseStateChanged') {
        const button = document.querySelector(`.play-pause-button[data-tab-id="${sender.tab.id}"]`);
        if (button) {
            setButtonIcon(button, message.paused ? 'play' : 'pause');
        }
    }
});

// Helper function to safely set button icons
function setButtonIcon(button, iconType) {
    button.innerHTML = '';
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(ICONS[iconType], 'image/svg+xml');
    button.appendChild(svgDoc.documentElement);
}

// Helper function to send message with better error handling
function sendVolumeMessage(tabId, volume) {
    const id = parseInt(tabId);
    if (isNaN(id)) {
        console.error('Invalid tab ID:', tabId);
        return;
    }
    
    browser.tabs.sendMessage(id, {
        action: 'setVolume',
        volume: volume
    }).catch(error => {
        console.error(`Failed to send volume message to tab ${id}:`, error.message);
    });
}