// Fetch audible tabs and YouTube tabs
const audibleTabsQuery = browser.tabs.query({ audible: true });
const youtubeTabsQuery = browser.tabs.query({ url: "*://*.youtube.com/*" });

const playIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-play"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
`;

const pauseIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-pause"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
`;

Promise.all([audibleTabsQuery, youtubeTabsQuery]).then(results => {
    const audibleTabs = results[0];
    const youtubeTabs = results[1];

    const tabsMap = new Map();
    audibleTabs.forEach(tab => tabsMap.set(tab.id, tab));
    youtubeTabs.forEach(tab => tabsMap.set(tab.id, tab));

    const tabs = Array.from(tabsMap.values());
    const tabList = document.getElementById('tab-list');

    if (tabs.length === 0) {
        const message = document.createElement('div');
        message.id = 'no-tabs-message';
        message.textContent = 'No tabs playing audio ';
        tabList.appendChild(message);
        return;
    }

    const muteIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-volume-2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
`;

    const unmuteIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-volume-x"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
`;

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
                muteButton.innerHTML = unmuteIcon;
            } else if (data[storageKey] !== undefined) {
                slider.value = data[storageKey] * 100;
                muteButton.innerHTML = muteIcon;
            }
        });

        // Get initial play/pause state
        browser.tabs.sendMessage(tab.id, { action: 'getPlayPauseState' })
            .then(response => {
                if (response && response.paused) {
                    playPauseButton.innerHTML = playIcon;
                } else {
                    playPauseButton.innerHTML = pauseIcon;
                }
            })
            .catch(e => console.error("Could not get initial play/pause state:", e));


        slider.addEventListener('input', (e) => {
            const volume = parseInt(e.target.value);
            const normalizedVolume = volume / 100;
            sendVolumeMessage(e.target.dataset.tabId, normalizedVolume);
            browser.storage.sync.set({ [storageKey]: normalizedVolume });
            browser.storage.sync.set({ [muteKey]: false });
            muteButton.innerHTML = muteIcon;
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
                        browser.storage.sync.set({ [storageKey]: lastVolume });
                        browser.storage.sync.set({ [muteKey]: false });
                        muteButton.innerHTML = muteIcon;
                    });
                } else {
                    // Mute
                    browser.storage.sync.set({ [`volume_before_mute_${tab.id}`]: slider.value / 100 });
                    slider.value = 0;
                    sendVolumeMessage(tab.id, 0);
                    browser.storage.sync.set({ [storageKey]: 0 });
                    browser.storage.sync.set({ [muteKey]: true });
                    muteButton.innerHTML = unmuteIcon;
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
            if (message.paused) {
                button.innerHTML = playIcon;
            } else {
                button.innerHTML = pauseIcon;
            }
        }
    }
});

// Helper function to send message with logging
function sendVolumeMessage(tabId, volume) {
    browser.tabs.sendMessage(parseInt(tabId), {
        action: 'setVolume',
        volume: volume
    }).then(response => {
        console.log('Message sent successfully to tab ' + tabId + ', response:', response);
    }).catch(error => {
        console.error('Error sending message to tab ' + tabId + ':', error.message);
    });
}