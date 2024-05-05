var map = L.map('map');
map.setView([51.505, -0.09], 13);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Keep getting the current position of the user
navigator.geolocation.watchPosition(success, error);

let marker, circle, zoomed;

function success(pos) {
    // extract latitude and longitude
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const accuracy = pos.coords.accuracy;

    // remove old markers if any
    if (marker) {
        map.removeLayer(marker);
        map.removeLayer(circle);
    }

    // create a marker
    marker = L.marker([lat, lng]).addTo(map);
    circle = L.circle([lat, lng], { radius: accuracy }).addTo(map);

    // will adjust the window to zoom when run for the first time
    // otherwise let the user zoom to desired scale
    if (!zoomed) {
        // move the map to the user's location
        zoomed = map.fitBounds(circle.getBounds());
    }
}

function error(err){
    if (err === 1) {
        alert("Error: Location access was denied!");
    } else {
        alert("Error: cannot retrieve current location");
    }
}