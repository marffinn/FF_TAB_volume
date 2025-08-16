// Fetch only audible tabs
browser.tabs.query({ audible: true }).then(tabs => {
    const tabList = document.getElementById('tab-list');

    if (tabs.length === 0) {
        const message = document.createElement('div');
        message.id = 'no-tabs-message';
        message.textContent = 'No tabs playing audio';
        tabList.appendChild(message);
        return;
    }

    tabs.forEach(tab => {
        const div = document.createElement('div');
        div.className = 'tab-item';

        const titleDiv = document.createElement('div');
        titleDiv.style.display = 'flex';
        titleDiv.style.alignItems = 'center';

        // Add favicon if available
        if (tab.favIconUrl) {
            const favicon = document.createElement('img');
            favicon.src = tab.favIconUrl;
            favicon.alt = 'Tab favicon';
            favicon.width = 16;
            favicon.height = 16;
            favicon.style.marginRight = '5px';
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

        const numberInput = document.createElement('input');
        numberInput.type = 'number';
        numberInput.min = 0;
        numberInput.max = 100;
        numberInput.value = 100;  // Default
        numberInput.dataset.tabId = tab.id;

        // Sync slider to number input and send message
        slider.addEventListener('input', (e) => {
            const volume = parseInt(e.target.value);
            numberInput.value = volume;
            const normalizedVolume = volume / 100;
            sendVolumeMessage(e.target.dataset.tabId, normalizedVolume);
        });

        // Sync number input to slider and send message
        numberInput.addEventListener('input', (e) => {
            let volume = parseInt(e.target.value);
            if (isNaN(volume)) volume = 100;  // Fallback if invalid
            volume = Math.max(0, Math.min(100, volume));  // Clamp between 0-100
            slider.value = volume;
            numberInput.value = volume;  // Update in case of clamping
            const normalizedVolume = volume / 100;
            sendVolumeMessage(e.target.dataset.tabId, normalizedVolume);
        });

        controlsDiv.appendChild(slider);
        controlsDiv.appendChild(numberInput);
        div.appendChild(controlsDiv);
        tabList.appendChild(div);
    });
}).catch(error => console.error('Error querying tabs:', error));

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