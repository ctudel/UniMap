//++++++++++++++
// MAP FUNCTIONS
//++++++++++++++

let marker, circle, zoomed, routingControl;

/* Resets map interface */
let resetMap = () => {
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

/* Finds an address based on latitude and longtitude */
let reverseGeocode = async (lat, lng) => {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;

    return await fetch(url)
        .then(async response => await response.json())
        .then(async data => {
            const address = data.display_name;
            await new Promise(resolve => setTimeout(resolve, 1000));
            return address.split(',')[1]; // Use only the first part of the display name as the relative name
        })
        .catch(error => {
            console.error('Error fetching reverse geocoding data:', error);
            return null;
        });
}

/* Locates the user's current position if successfully found */
let success = async (pos) => {
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
        const address = await reverseGeocode(lat, lng);
        if (address) {
            document.getElementById('start').value = address;
            markers['start'] = marker;
            markers['circle'] = circle;
        }
    }
}


/* 
 * Place a marker on the map given latitude and longtitude.
 * param 'type' is the key value used for storing a marker in the
 *      markers array
 */
let placeMarker = (type, lat, lng) => {

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


/* Removes a marker from the map */
let removeMarker = (type) => {
    if (markers[type]) {
        map.removeLayer(markers[type]);
        delete markers[type];
    }
}


/* Places a marker when a user clicks on the map */
let placeMarkerAtCursor = async (e) => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    const startInput = document.getElementById('start');
    const endInput = document.getElementById('end');

    // Validate start address does not exist
    if (startInput.value === '' || startInput.value === ' ') {
        placeMarker('start', lat, lng);

        const address = await reverseGeocode(lat, lng);
        if (address) {
            startInput.value = address;
            resetMap();
        }

    // Validate end target address does not exist
    } else {
        placeMarker('end', lat, lng);

        const address = await reverseGeocode(lat, lng);
        if (address) {
            endInput.value = address;
            resetMap();
        }

    } 
}


/* Retrieves the coordinates given an address */
let geocode = async (location) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${location}`;

    try { // attempt to fetch location
        const response = await fetch(url);
        const data = await response.json();

        if (data.length === 0) {
            console.error('No results found');
            return null;
        }

        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }; // parse coords

    } catch (error) {
        console.error('Error fetching geocoding data:', error);
        return null;
    }
}


let getNewLocation = async (address, id) => {
    const location = address;

    if (location === '' || location === ' ') {
        removeMarker(id);
        if (id = 'start') removeMarker('circle');
    }

    if (!location) return;

    const locationCoordinates = await geocode(location);
    if (!locationCoordinates) return;

    placeMarker(id, locationCoordinates.lat, locationCoordinates.lon);

    resetMap();
}


/* Time estimation and routing logic between two points */
let planTravel = () => {
    const start = markers['start'] ? markers['start'].getLatLng() : null;
    const end = markers['end'] ? markers['end'].getLatLng() : null;
    const arrivalTimeStr = document.getElementById('time').value.trim();

    if (!start || !end || !arrivalTimeStr) {
        showAlert('Please select a start, end location, and desired arrival time.');
        return;
    }

    const arrivalTime = parseTime(arrivalTimeStr);  // parse user time input
    if (!arrivalTime) {
        showAlert('Invalid arrival time format. Please use HH:mm(am/pm) format.');
        return;
    }

    // Create a route and add it to the map
    routingControl = L.Routing.control({
        waypoints: [
            L.latLng(start.lat, start.lng), // start coords
            L.latLng(end.lat, end.lng) // end coords
        ], 
        routeWhileDragging: true,
        show: false
    }).addTo(map);
    
    // Start calculations
    routingControl.on('routesfound', function(e) {
        const routes = e.routes;
        if (routes && routes.length > 0) {
            const route = routes[0];
            const travelTimeInSeconds = route.summary.totalTime;

            // Estimate time to leave for poignant arrival time
            const leaveTime = new Date(arrivalTime.getTime() - (travelTimeInSeconds * 1200));
            const leaveTimeFormatted = leaveTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

            notification(`You should leave at ${leaveTimeFormatted} to arrive at ${arrivalTimeStr}`);
        }
    });

    // Handle duplicate markers
    map.removeLayer(markers['start']);
    map.removeLayer(markers['end']);
}


/* Parse user input as 12hr formatted time */
let parseTime = (timeString) => {
    let regex = /^(\d{1,2}):(\d{2})(\w{2})$/i; // reg expression to match
    let match = timeString.match(regex);

    if (!match) {
        regex = /^(\d{1,2})(\w{2})$/i;
        match = timeString.match(regex);

        if (!match) return null;

        let hours = parseInt(match[1], 10);
        const period = match[2].toUpperCase();

        return scanParsedTime(hours, period, null);
    }

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();

    return scanParsedTime(hours, minutes, period);
}


// field 2 could be minutes or period. field 3 can only be period if minutes exist
let scanParsedTime = (hours, minsOrPeriod, period) => {
    if ((period === null)) {

        if (hours === 12) {
            hours = minsOrPeriod === 'AM' ? 0 : 12; // param 2 is period
        } else {
            hours = minsOrPeriod === 'PM' ? hours + 12 : hours;
        }

        if (hours < 0 || hours > 23) {
            return null;
        }

        return new Date(2000, 0, 1, hours, 0);

    } else {

        if (hours === 12) {
            hours = period === 'AM' ? 0 : 12;
        } else {
            hours = period === 'PM' ? hours + 12 : hours;
        }

        if (hours < 0 || hours > 23 || minsOrPeriod < 0 || minsOrPeriod > 59) { // param 2 is minutes
            return null;
        }

        return new Date(2000, 0, 1, hours, minsOrPeriod);

    }
}


function showAlert(message) {
    var alertBox = document.getElementById('alert');
    var alertText = document.getElementById('alert-text');
    alertText.textContent = message;
    alertBox.style.display = 'block';
  
    // Hide the alert after 3 seconds
    setTimeout(function() {
      alertBox.style.display = 'none';
    }, 3000);
  }


function notification(message) {
    var notificationBox = document.getElementById('notification');
    var notificationText = document.getElementById('notification-text');
    notificationText.textContent = message;
    notificationBox.style.display = 'block';

    setTimeout(function() {
        notificationBox.style.display = 'none';
    }, 3000)
}
  


//+++++++++++++
// HTML ACTIONS
//+++++++++++++

/* Activate routing between two points if the enter key is pressed */
document.getElementById('start').addEventListener('keypress', async function(event) {
    if (event.key === 'Enter') {
        await getNewLocation(this.value,'start');
        planTravel();
    }
});

document.getElementById('end').addEventListener('keypress', async function(event) {
    if (event.key === 'Enter') {
        await getNewLocation(this.value, 'end');
        planTravel();
    }
});

document.getElementById('time').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        planTravel();
    }
});

/* Detect if a new location is entered and place marker */
document.getElementById('start').addEventListener('change', async function() {
    await getNewLocation(this.value, 'start');
});

document.getElementById('end').addEventListener('change', async function() {
    await getNewLocation(this.value, 'end');
});




//++++++++++++++
// PROGRAM CALLS
//++++++++++++++

/* Initialize map */
var map = L.map('map').setView([43.618881, -116.215019], 13);
var markers = {}; // Declare markers object

/* Import a visual for our map */
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	}).addTo(map);

// Get user's current location and create new marker with it in the map's view
navigator.geolocation.getCurrentPosition(async function(pos) {
    var lat = pos.coords.latitude;
    var lng = pos.coords.longitude;
    map.setView([lat, lng], 13);

    // Call success function to place marker and set default start location to user's current location
    await success(pos);
}, function (err) {
    if (err === 1) {
        showAlert("Error: Location access was denied!");
    } else {
        showAlert("Error: cannot retrieve current location");
    }
});

/* Change location upon user clicks */
map.on('click', placeMarkerAtCursor);