import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

let staticOrder = {}; // stationId → stop_sequence

async function loadStaticOrder(trainLine) {
    staticOrder = {}; // reset

    const response = await fetch('stop_times.txt');
    const text = await response.text();
    const lines = text.split('\n');

    const routeId = getRouteId(trainLine); // e.g. "1", "GS", "SI"

    for (const line of lines) {
        const parts = line.split(',');
        if (parts.length < 5) continue;

        const tripId = parts[0];
        const stopId = parts[1];
        const stopSequence = parseInt(parts[4]);

        // Match route by checking the end of tripId
        if (!tripId.includes(`_${routeId}`)) continue;

        // Only northbound
        if (!stopId.endsWith('N')) continue;

        const stationId = stopId.slice(0, -1);

        // Only take the first occurrence (static order is same for all trips)
        if (!staticOrder[stationId]) {
            staticOrder[stationId] = stopSequence;
        }
    }
}

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

// async function getFutureStops(trainLine) {
//     const data = await getTrainData(trainLine);
//     const allStops = [];
    
//     if (data) {
//         const expectedRouteId = getRouteId(trainLine);
        
//         const filteredData = data.filter(entity => {
//             return entity.tripUpdate && entity.tripUpdate.trip.routeId === expectedRouteId;
//         });
        
//         if (filteredData.length === 0) {
//             console.log(`No trips found for ${trainLine} (routeId: ${expectedRouteId}). Available routeIds:`, 
//                 data.filter(e => e.tripUpdate).map(e => e.tripUpdate.trip.routeId).slice(0, 5));
//         }
        
//         // filteredData.forEach(entity => {
//         //     if (entity.tripUpdate) {
//                 // const stops = entity.tripUpdate.stopTimeUpdate.map(update => {
//                 //     const stopName = stopsMap[update.stopId] || update.stopId;
//                 //     return {
//                 //         stopId: update.stopId,
//                 //         stopName: stopName,
//                 //         arrival: new Date(update.arrival?.time * 1000).toLocaleTimeString()
//                 //     };
//                 // });
//         //         const stops = entity.tripUpdate.stopTimeUpdate
//         //         .slice() // copy so we don’t mutate original
//         //         .sort((a, b) => a.stopSequence - b.stopSequence)
//         //         .map(update => {
//         //             const stopName = stopsMap[update.stopId] || update.stopId;
//         //             return {
//         //                 stopId: update.stopId,
//         //                 stopName: stopName,
//         //                 arrival: new Date(update.arrival?.time * 1000).toLocaleTimeString(),
//         //                 stopSequence: update.stopSequence
//         //             };
//         //         });
//         //         allStops.push(...stops);
//         //     }
//         // });
//         const stationMap = {};

//         filteredData.forEach(entity => {
//             if (!entity.tripUpdate) return;

//             entity.tripUpdate.stopTimeUpdate.forEach(update => {
//                 const fullId = update.stopId;      // e.g. "101N"
//                 const stationId = fullId.slice(0, -1); // "101"
//                 const dir = fullId.slice(-1);      // "N" or "S"

//                 const stopName = stopsMap[fullId] || stopsMap[stationId] || fullId;

//                 if (!stationMap[stationId]) {
//                     stationMap[stationId] = {
//                         stopName,
//                         stopSequence: update.stopSequence,
//                         northbound: [],
//                         southbound: []
//                     };
//                 }

//                 const arrival = new Date(update.arrival?.time * 1000).toLocaleTimeString();

//                 if (dir === 'N') stationMap[stationId].northbound.push(arrival);
//                 if (dir === 'S') stationMap[stationId].southbound.push(arrival);
//             });
//         });

//         // Convert map → array
//         const orderedStations = Object.values(stationMap)
//             .sort((a, b) => a.stopSequence - b.stopSequence);

//         // Build final output
//         const finalStops = [];

//         orderedStations.forEach(st => {
//             finalStops.push({
//                 stopName: st.stopName + " (NB)",
//                 arrival: st.northbound[0] || "—"
//             });
//             finalStops.push({
//                 stopName: st.stopName + " (SB)",
//                 arrival: st.southbound[0] || "—"
//             });
//         });

//         allStops.push(...finalStops);
//     }
    
//     return allStops;
// }
async function getFutureStops(trainLine) {
    await loadStaticOrder(trainLine); // loads NB static order

    const data = await getTrainData(trainLine);
    if (!data) return [];

    const expectedRouteId = getRouteId(trainLine);

    const filteredData = data.filter(entity =>
        entity.tripUpdate &&
        entity.tripUpdate.trip.routeId === expectedRouteId
    );

    const realtimeStops = [];

    filteredData.forEach(entity => {
        entity.tripUpdate.stopTimeUpdate.forEach(update => {
            const stopId = update.stopId;
            const stationId = stopId.slice(0, -1);

            // Only sort using NB static order, but allow SB to appear
            const staticOrderValue = staticOrder[stationId] || 9999;

            const baseStationId = stopId.slice(0, -1); // remove N/S
            const direction = stopId.slice(-1) === "N" ? "NB" : "SB";
            const stopName = (stopsMap[baseStationId] || baseStationId) + ` (${direction})`;

            realtimeStops.push({
                stationId,
                stopId,
                stopName,
                direction, // <-- THIS IS WHAT YOU WANTED
                arrival: update.arrival?.time
                    ? new Date(update.arrival.time * 1000).toLocaleTimeString()
                    : "—",
                staticOrder: staticOrderValue
            });
        });
    });

    // Sort by static NB order
    realtimeStops.sort((a, b) => a.staticOrder - b.staticOrder);

    // Keep only the earliest arrival per station per direction
    const earliestMap = {}; 
    // structure: earliestMap[stationId] = { N: stopObj, S: stopObj }

    realtimeStops.forEach(stop => {
        if (!earliestMap[stop.stationId]) {
            earliestMap[stop.stationId] = { N: null, S: null };
        }

        const dir = stop.direction; // "NB" or "SB"
        const key = dir === "NB" ? "N" : "S";

        // Convert arrival to timestamp for comparison
        const arrivalUnix = stop.arrival === "—"
            ? Infinity
            : new Date(`1970-01-01T${stop.arrival}`).getTime();

        if (!earliestMap[stop.stationId][key]) {
            earliestMap[stop.stationId][key] = { ...stop, arrivalUnix };
        } else {
            if (arrivalUnix < earliestMap[stop.stationId][key].arrivalUnix) {
                earliestMap[stop.stationId][key] = { ...stop, arrivalUnix };
            }
        }
    });

    // Flatten back into an array
    const filteredStops = [];

    Object.values(earliestMap).forEach(st => {
        if (st.N) filteredStops.push(st.N);
        if (st.S) filteredStops.push(st.S);
    });

    // Sort using static order (NB order)
    filteredStops.sort((a, b) => a.staticOrder - b.staticOrder);

    return filteredStops;
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