import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

// Favorite functionality
let favorites = JSON.parse(localStorage.getItem('favoriteTrainLines')) || [];

function saveFavorites() {
    localStorage.setItem('favoriteTrainLines', JSON.stringify(favorites));
}

function updateFavoriteButtons() {
    document.querySelectorAll('.favorite-button').forEach(button => {
        const line = button.dataset.line;
        if (favorites.includes(line)) {
            button.textContent = '★';
        } else {
            button.textContent = '☆';
        }
    });
}

function renderFavorites() {
    const favoritesList = document.getElementById('favorites-list');
    favoritesList.innerHTML = '';
    
    favorites.forEach(line => {
        const favoriteItem = document.createElement('div');
        favoriteItem.className = 'favorite-item';
        
        const img = document.createElement('img');
        img.src = `train_icon_img/${line}.png`;
        img.alt = `Line ${line} icon`;
        img.className = 'line-icon';
        
        const name = document.createElement('span');
        name.className = 'line-name';
        name.textContent = `Line ${line}`;
        
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-favorite';
        removeButton.textContent = 'Remove';
        removeButton.addEventListener('click', () => {
            favorites = favorites.filter(fav => fav !== line);
            saveFavorites();
            updateFavoriteButtons();
            renderFavorites();
        });
        
        favoriteItem.appendChild(img);
        favoriteItem.appendChild(name);
        favoriteItem.appendChild(removeButton);
        
        favoritesList.appendChild(favoriteItem);
    });
}

// Load stops data
let stopsMap = {};

async function loadStopsData() {
    try {
        const response = await fetch('stops.txt');
        const text = await response.text();
        const lines = text.split('\n');
        lines.forEach(line => {
            const parts = line.split(',');
            if (parts.length >= 2) {
                const stopId = parts[0];
                const stopName = parts[1];
                stopsMap[stopId] = stopName;
            }
        });
    } catch (error) {
        console.error('Error loading stops data:', error);
    }
}

// Map train lines to their API endpoint names
function getEndpointName(trainLine) {
    const line = trainLine.toUpperCase();
    
    if (['A', 'C', 'E'].includes(line)) return 'ace';
    if (['B', 'D', 'F', 'M'].includes(line)) return 'bdfm';
    if (line === 'G') return 'g';
    if (['J', 'Z'].includes(line)) return 'jz';
    if (['N', 'Q', 'R', 'W'].includes(line)) return 'nqrw';
    if (line === 'L') return 'l';
    if (line === 'SIR') return 'si';
    if (['1', '2', '3', '4', '5', '6', '7', 'S'].includes(line)) return '';
    
    return line.toLowerCase();
}

async function getTrainData(trainLine) {
    const endpoint = getEndpointName(trainLine);
    const endpointPath = endpoint ? `-${endpoint}` : '';
    const url = `https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs${endpointPath}`;
    
    try {
        const response = await fetch(url, {
            headers: { 'x-api-key': 'YOUR_MTA_API_KEY' }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const buffer = await response.arrayBuffer();
        
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
            new Uint8Array(buffer)
        );

        return feed.entity; 

    } catch (error) {
        console.error("Decoding failed:", error);
    }
}

function getRouteId(trainLine) {
    const line = trainLine.toUpperCase();
    
    if (line === 'SIR') return 'SI';
    if (line === 'S') return 'GS';
    
    return line;
}

async function getFutureStops(trainLine) {
    const data = await getTrainData(trainLine);
    const allStops = [];
    
    if (data) {
        const expectedRouteId = getRouteId(trainLine);
        
        const filteredData = data.filter(entity => {
            return entity.tripUpdate && entity.tripUpdate.trip.routeId === expectedRouteId;
        });
        
        if (filteredData.length === 0) {
            console.log(`No trips found for ${trainLine} (routeId: ${expectedRouteId}). Available routeIds:`, 
                data.filter(e => e.tripUpdate).map(e => e.tripUpdate.trip.routeId).slice(0, 5));
        }
        
        filteredData.forEach(entity => {
            if (entity.tripUpdate) {
                const stops = entity.tripUpdate.stopTimeUpdate.map(update => {
                    const stopName = stopsMap[update.stopId] || update.stopId;
                    return {
                        stopId: update.stopId,
                        stopName: stopName,
                        arrival: new Date(update.arrival?.time * 1000).toLocaleTimeString()
                    };
                });
                allStops.push(...stops);
            }
        });
    }
    
    return allStops;
}

// Dropdown functionality
document.addEventListener('DOMContentLoaded', async () => {
    await loadStopsData();
    const buttons = document.querySelectorAll('.line-dropdown-button');

    buttons.forEach(button => {
        const originalText = button.textContent;
        // Store original text as data attribute for later access
        button.dataset.originalText = originalText;
        
        button.addEventListener('click', async function() {
            const frame = this.closest('.line-frame');
            // Check if next sibling is the dropdown
            let dropdown = frame.nextElementSibling;
            const isOpen = dropdown && dropdown.classList.contains('dropdown-container') && dropdown.style.display === 'block';

            if (isOpen) {
                // Close and delete dropdown
                dropdown.remove();
                this.textContent = this.dataset.originalText;
            } else {
                // Close all other dropdowns
                document.querySelectorAll('.dropdown-container').forEach(d => {
                    d.remove();
                });
                
                // Reset all other buttons to their original text
                document.querySelectorAll('.line-dropdown-button').forEach(btn => {
                    btn.textContent = btn.dataset.originalText;
                });
                
                // Create new dropdown
                dropdown = document.createElement('div');
                dropdown.className = 'dropdown-container';
                frame.insertAdjacentElement('afterend', dropdown);
                this.textContent = '✕ Close';

                const trainLine = this.dataset.line;
                
                const stops = await getFutureStops(trainLine);
                
                dropdown.innerHTML = '';
                
                if (stops.length > 0) {
                    stops.forEach(stop => {
                        const stopItem = document.createElement('div');
                        stopItem.className = 'stop-item';
                        stopItem.innerHTML = `
                            <span class="stop-name">${stop.stopName}</span>
                            <span class="arrival-time">${stop.arrival}</span>
                        `;
                        dropdown.appendChild(stopItem);
                    });
                } else {
                    if (trainLine === 'Z') {
                        dropdown.innerHTML = '<p>Z train is rush hour only</p>';
                    } else {
                        dropdown.innerHTML = '<p>No stops available</p>';
                    }
                }
                
                dropdown.style.display = 'block';
            }
        });
    });

    // Favorite buttons
    document.querySelectorAll('.favorite-button').forEach(button => {
        button.addEventListener('click', function() {
            const line = this.dataset.line;
            if (favorites.includes(line)) {
                favorites = favorites.filter(fav => fav !== line);
            } else {
                favorites.push(line);
            }
            saveFavorites();
            updateFavoriteButtons();
            renderFavorites();
        });
    });
    
    updateFavoriteButtons();
    renderFavorites();
});