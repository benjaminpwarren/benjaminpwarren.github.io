var app = {};

app.initialLocations = [
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
    center: app.initialLocations[0].location,
    zoom: 15
  });

  app.infowindow = new google.maps.InfoWindow();

  ko.applyBindings(new app.ViewModel());
}

document.addEventListener('DOMContentLoaded', function(event) {
  //click handler for options box minimize toggle
  document.querySelector('#optionsBoxToggle').addEventListener('click', function(event) {
    event.target.parentNode.classList.toggle('options-box-minimized');
  });
});

app.Location = function(data) {

  this.title = ko.observable(data.title);
  this.lat = ko.observable(data.location.lat);
  this.lng = ko.observable(data.location.lng);
  this.address = ko.observable('');
  this.wikipediaIntro = ko.observable('');
  this.loaded = false;

};

app.ViewModel = function() {

  var self = this;

  this.locations = ko.observableArray([]);
  app.initialLocations.forEach(function(item, index) {

    var location = new app.Location(item);
    location.marker = new google.maps.Marker({
      map: app.map,
      position: item.location,
      title: item.title,
      animation: google.maps.Animation.DROP,
      id: index
    });

    location.marker.addListener('click', function() {
      self.selectedLocation(self.locations()[this.id]);
      populateInfoWindow(this, app.infowindow);
    });

    self.locations.push(location);
  });

  this.selectedLocation = ko.observable();

  //show a loading message while we're getting async data
  this.loadingStatus = ko.observable('Loading...');

  //filters list and adjusts markers based on input
  this.filter = ko.observable();
  this.filteredLocations = ko.computed(function() {

    var bounds = new google.maps.LatLngBounds();

    const filtered = this.locations().filter(function(location, index) {
      if (!self.filter() || location.title().toLowerCase().indexOf(self.filter().toLowerCase()) !== -1) {
        location.marker.setMap(app.map);
        bounds.extend(location.marker.position);
        return location;
      } else {
        location.marker.setMap(null);
      }
    });

    //fit all of the markers on the map, but with a maximum zoom of 15
    app.map.fitBounds(bounds);
    app.map.setZoom(Math.min(app.map.getZoom(), 15));

    return filtered;
  }, this);

  //select first location after filtering
  ko.computed(function() {
    self.selectedLocation(self.filteredLocations()[0]);
  }, this);

  //change selectedLocation and animate location's marker
  this.selectLocation = function(locationIndex) {
    self.selectedLocation(self.filteredLocations()[locationIndex()]);
  }

  //animate the marker when the selected location changes
  ko.computed(function() {
    const marker = self.selectedLocation().marker;
    animateMarker(marker);
    populateInfoWindow(marker, app.infowindow);
  });

  //load the first location
  this.selectLocation(function() { return 0; });

  //load address and wikipedia data when selected location changes, and store it on location obj
  ko.computed(function() {

    const location = self.selectedLocation();

    //exit if there is no selected location (e.g. if a user has entered a filter that has no results)
    if (typeof location === 'undefined') { return; }

    //exit if we've already loaded the data for this location
    if (location.loaded) { return; }

    getLocalityInfoFromGoogle();

    //gets suburb etc for location and update ViewModels with address and then calls loadWikipediaData
    //update ViewModel with with error messages based on where failure occurs.
    function getLocalityInfoFromGoogle() {

      self.loadingStatus('Loading...');

      const googleGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.lat()},${location.lng()}&key=AIzaSyAFc11aYXpKunavDkM8nxAI0rZyn--Z7fk`

      fetch(googleGeocodeUrl).then(resp => {
        if (resp.ok) {
          return resp.json();
        } else {
          throw 'Failed to retrieve location data.';
        }
      }).then(data => {

        try {

          const localityAreaCountry = data.results[0].address_components.reduce((acc, item, index) => {
            if (item.types.includes('locality')) { acc.locality = item.long_name; }
            if (item.types.includes('administrative_area_level_1')) { acc.area = item.long_name; }
            if (item.types.includes('country')) { acc.country = item.long_name; }
            return acc;
          }, {});

          location.address(data.results[0].formatted_address);

          loadWikipediaData(localityAreaCountry);

        } catch (err) {
          throw 'Failed to parse location data.';
        }
      }).catch(err => {
        self.loadingStatus(err + ' Try refreshing.')
      });
    }

    //update ViewModel with wikipedia snippet for the supplied locality, area, and country.
    //update ViewModel with with error messages based on where failure occurs.
    function loadWikipediaData(lAC) {

      const wikipediaUrl = 'https://en.wikipedia.org/w/api.php?&origin=*&action=query&list=search&format=json&srsearch=';

      fetch(`${wikipediaUrl}${lAC.locality}+,${lAC.area}+,${lAC.country}`).then(function(resp) {
        if (resp.ok) {
          return resp.json();
        } else {
          throw 'Failed to retrieve Wikpedia snippet.';
        }
      }).then(function(data) {
        try {
          const locationResult = data.query.search[0];
          const locationPageLink = `<a href="${'https:\/\/en.wikipedia.org\/wiki\/' + locationResult.title.replace(' ', '_')}">... [Wikipedia]</a>`;
          location.wikipediaIntro(locationResult.snippet + locationPageLink);
          location.loaded = true;
          self.loadingStatus('');
        } catch (err) {
          throw 'Failed to parse Wikpedia snippet.';
        }
      }).catch(err => {
        self.loadingStatus(err + ' Try refreshing.')
      })

    }
  }, this);

  //animate markers for a period
  //cancels any markers that are already bouncing when called
  function animateMarker(marker) {

    //cancel any existing bouncing
    self.lastMarker && self.lastMarker.setAnimation(null)

    marker.setAnimation(google.maps.Animation.BOUNCE);

    //stop bouncing after bouncePeriod multiple
    const bouncePeriod = 700; // derived by trial-and-error
    const bounces = 6;
    setTimeout(function() {
      marker.setAnimation(null);
    }, bouncePeriod * bounces);

    //remember the marker so we can cancel its bouncing if the user changes selection
    self.lastMarker = marker;
  }

  // This function populates the infowindow when the marker is clicked. We'll only allow
  // one infowindow which will open at the marker that is clicked, and populate based
  // on that markers position.
  // Copied from previous Udacity lessons
  function populateInfoWindow(marker, infowindow) {
    // Check to make sure the infowindow is not already opened on this marker.
    if (infowindow.marker != marker) {
      infowindow.marker = marker;
      infowindow.setContent(`<strong>${marker.title}</strong><br><small>See the Locations sidebar for more info.</small>`);
      infowindow.open(map, marker);
      // Make sure the marker property is cleared if the infowindow is closed.
      infowindow.addListener('closeclick', function() {
        infowindow.setMarker = null;
      });
    }
  }

}