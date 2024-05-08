let marker, circle, zoomed, routingControl;


function resetMap() {
    if (routingControl) {
        map.removeControl(routingControl);
        removeMarker('circle');
    }

    if (!map.hasLayer(markers['start'])) {
        markers['start'].addTo(map);
    }

    if (!map.hasLayer(markers['end'])) {
        markers['end'].addTo(map);
    }

}


function reverseGeocode(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;

    return fetch(url)
        .then(response => response.json())
        .then(data => {
            const address = data.display_name;
            return address.split(',')[1]; // Use only the first part of the display name as the relative name
        })
        .catch(error => {
            console.error('Error fetching reverse geocoding data:', error);
            return null;
        });
}


function success(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const accuracy = pos.coords.accuracy;

    // Remove old markers if any
    if (marker) {
        map.removeLayer(marker);
        map.removeLayer(circle);
    }

    // Create a marker
    marker = L.marker([lat, lng]).addTo(map);
    circle = L.circle([lat, lng], { radius: accuracy % 500 }).addTo(map);

    // Will adjust the window to zoom when run for the first time
    // Otherwise, let the user zoom to the desired scale
    if (!zoomed) {
        // Move the map to the user's location
        zoomed = map.fitBounds(circle.getBounds());

        // Use reverse geocoding to get the address and set it as the default value of the start location text box
        reverseGeocode(lat, lng)
            .then(address => {
                if (address) {
                    document.getElementById('start').value = address;
                    markers['start'] = marker;
                    markers['circle'] = circle;
                }
            });
    }
}


function placeMarker(type, lat, lng) {

    // Remove old markers if any
    if (markers[type]) {
        map.removeLayer(markers[type]);
        delete markers[type];
    }

    // Create a marker
    markers[type] = L.marker([lat, lng]).addTo(map);

    // Set the view to include both markers
    map.fitBounds([
        markers['start'] ? markers['start'].getLatLng() : markers['end'].getLatLng(),
        markers['end'] ? markers['end'].getLatLng() : markers['start'].getLatLng()
    ]);
}


function removeMarker(type) {
    if (markers[type]) {
        map.removeLayer(markers[type]);
        delete markers[type];
    }
}


function addLocation(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    const startInput = document.getElementById('start');
    const endInput = document.getElementById('end');

    if (startInput.value === '' || startInput.value === ' ') {
        placeMarker('start', lat, lng);

        reverseGeocode(lat, lng)
            .then(address => {
                if (address) {
                    startInput.value = address;
                }
            });

    } else if (endInput.value === '' || endInput.value === ' ') {
        placeMarker('end', lat, lng);

        reverseGeocode(lat, lng)
            .then(address => {
                if (address) {
                    endInput.value = address;
                }
            });

    } else { console.log("Could not place marker, necessary locations exist"); }
}


async function geocode(location) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${location}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.length === 0) {
            console.error('No results found');
            return null;
        }

        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    } catch (error) {
        console.error('Error fetching geocoding data:', error);
        return null;
    }
}


function autocomplete(inputId, datalistId) {
    const input = document.getElementById(inputId);
    const datalist = document.getElementById(datalistId);

    input.addEventListener('input', async function() {
        const query = input.value;

        if (query.length < 2) {
            datalist.innerHTML = ''; // Clear the datalist if the query is too short
            return;
        }

        const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json`;
        try {
            const response = await fetch(url);
            const data = await response.json();

            datalist.innerHTML = ''; // Clear the datalist before adding new options

            data.forEach(item => {
                const option = document.createElement('option');
                option.value = item.display_name;
                datalist.appendChild(option);
            });
        } catch (error) {
            console.error('Error fetching autocomplete data:', error);
        }
    });
}


function planTravel() {
    const start = markers['start'] ? markers['start'].getLatLng() : null;
    const end = markers['end'] ? markers['end'].getLatLng() : null;
    const arrivalTimeStr = document.getElementById('time').value.trim();

    if (!start || !end || !arrivalTimeStr) {
        alert('Please select both a start and end location, and enter an arrival time.');
        return;
    }

    const arrivalTime = parseTime(arrivalTimeStr);
    if (!arrivalTime) {
        alert('Invalid arrival time format. Please use HH:mm:Period format.');
        return;
    }

    routingControl = L.Routing.control({
        waypoints: [
            L.latLng(start.lat, start.lng),
            L.latLng(end.lat, end.lng)
        ], 
        routeWhileDragging: true,
        show: false
    }).on('routesfound', function(e) {
        const routes = e.routes;
        if (routes && routes.length > 0) {
            const route = routes[0];
            const travelTimeInSeconds = route.summary.totalTime;

            const leaveTime = new Date(arrivalTime.getTime() - (travelTimeInSeconds * 1200));
            const leaveTimeFormatted = leaveTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

            alert(`You should leave at ${leaveTimeFormatted} to arrive at ${arrivalTimeStr}`);
        }
    }).addTo(map);

    // Handle duplicate markers
    map.removeLayer(markers['start']);
    map.removeLayer(markers['end']);
    
    // Update the start and end markers on drag
    // routingControl.on('routeselected', function(e) {
    //     const route = e.route;
    //     const waypoints = route.waypoints;

    //     if (waypoints.length === 2) {
    //         markers['start'].setLatLng(waypoints[0].latLng);
    //         markers['end'].setLatLng(waypoints[1].latLng);
    //     }
    // });
}


function parseTime(timeString) {
    const regex = /^(\d{1,2}):(\d{2})(\w{2})$/i;
    const match = timeString.match(regex);
    if (!match) {
        return null;
    }

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();

    if (hours === 12) {
        hours = period === 'AM' ? 0 : 12;
    } else {
        hours = period === 'PM' ? hours + 12 : hours;
    }

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
    }

    return new Date(2000, 0, 1, hours, minutes);
}


/* Detect if a start location is entered and place marker */
document.getElementById('start').addEventListener('change', async function() {
    const startLocation = this.value;

    if (startLocation === '' || startLocation === ' ') {
        removeMarker('start');
        removeMarker('circle');
    }

    if (!startLocation) return;

    const startCoordinates = await geocode(startLocation);
    if (!startCoordinates) return;

    placeMarker('start', startCoordinates.lat, startCoordinates.lon);

    resetMap();
});


/* Detect if an end location is entered and place marker */
document.getElementById('end').addEventListener('change', async function() {
    const endLocation = this.value;

    if (endLocation === '' || endLocation === ' ') {
        removeMarker('end');
    }

    if (!endLocation) return;

    const endCoordinates = await geocode(endLocation);
    if (!endCoordinates) return;

    placeMarker('end', endCoordinates.lat, endCoordinates.lon);

    resetMap();
});


/* Initialize map */
var map = L.map('map');
var markers = {}; // Declare markers object

// Default view to include user's current location
navigator.geolocation.getCurrentPosition(function(pos) {
    var lat = pos.coords.latitude;
    var lng = pos.coords.longitude;
    map.setView([lat, lng], 13);

    // Call success function to place marker and set default start location
    success(pos);
}, function (err) {
    if (err === 1) {
        alert("Error: Location access was denied!");
    } else {
        alert("Error: cannot retrieve current location");
    }
});

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);


/* call autocomplete for user input */
autocomplete('start', 'start-locations');
autocomplete('end', 'end-locations');

/* Change location upon user clicks */
map.on('click', addLocation);