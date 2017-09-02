var app = {};

app.locations = [
  { title: 'My House', location: { lat: -32.906838, lng: 151.748455 } },
  { title: 'Birdy\'s Cafe', location: { lat: -32.907900, lng: 151.748186 } },
  { title: 'Suspension Espresso', location: { lat: -32.917224, lng: 151.749160 } },
  { title: 'Islington Park Playground', location: { lat: -32.912520, lng: 151.747810 } },
  { title: 'Aunty Emma\'s House', location: { lat: -32.897508, lng: 151.739595 } },
  { title: 'Hamilton Station', location: { lat: -32.918480, lng: 151.748464 } },
  { title: 'Work', location: { lat: -32.925363, lng: 151.771947 } },
];

app.initMap = function() {

  // Constructor creates a new map - only center and zoom are required.
  // centers on the first element in locations array
  app.map = new google.maps.Map(document.getElementById('map'), {
    center: app.locations[0].location,
    zoom: 15
  });

  var largeInfowindow = new google.maps.InfoWindow();
  var bounds = new google.maps.LatLngBounds();

  // Create a marker per location, and create an array of markers.
  // *Modified from course
  const markers = app.locations.map(function(item, index) {

    const marker = new google.maps.Marker({
      map: app.map,
      position: item.location,
      title: item.title,
      animation: google.maps.Animation.DROP,
      id: index
    });

    marker.addListener('click', function() {
      animateMarker(this);
      populateInfoWindow(marker, largeInfowindow)
    });

    bounds.extend(marker.position);
    return marker;
  });

  app.map.fitBounds(bounds);

  function animateMarker(marker) {
    marker.setAnimation(google.maps.Animation.BOUNCE);
    setTimeout(function(){
      marker.setAnimation(null);
    }, 700);
  }

  // This function populates the infowindow when the marker is clicked. We'll only allow
  // one infowindow which will open at the marker that is clicked, and populate based
  // on that markers position.
  // *Copied from course
  function populateInfoWindow(marker, infowindow) {
    // Check to make sure the infowindow is not already opened on this marker.
    if (infowindow.marker != marker) {
      infowindow.marker = marker;
      infowindow.setContent('<div>' + marker.title + '</div>');
      infowindow.open(map, marker);
      // Make sure the marker property is cleared if the infowindow is closed.
      infowindow.addListener('closeclick', function() {
        infowindow.setMarker = null;
      });
    }
  }

}

function initMap() {
  app.initMap();
}