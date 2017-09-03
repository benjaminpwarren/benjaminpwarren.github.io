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

  this.marker = new google.maps.Marker({
    map: app.map,
    position: data.location,
    title: data.title,
    animation: google.maps.Animation.DROP
  });

};

app.ViewModel = function() {

  var self = this;

  this.locations = ko.observableArray([]);
  app.initialLocations.forEach(function(item, index) {
    self.locations.push(new app.Location(item));
  });

  this.selectedLocation = ko.observable();

  //show a loading message while we're getting async data
  this.loadingStatus = ko.observable('Loading...');

  //filters list and adjusts markers input
  this.filter = ko.observable();
  this.filteredLocations = ko.computed(function() {

    var bounds = new google.maps.LatLngBounds();

    const filtered = this.locations().filter(function(location) {
      if (!self.filter() || location.title().toLowerCase().indexOf(self.filter().toLowerCase()) !== -1) {
        location.marker.setMap(app.map);
        bounds.extend(location.marker.position);
        return location;
      } else {
        location.marker.setMap(null);
      }
    });

    app.map.fitBounds(bounds);
    app.map.setZoom(Math.min(app.map.getZoom(), 15));

    return filtered;
  }, this);

  //show first location after filtering
  ko.computed(function() {
    self.selectedLocation(self.filteredLocations()[0]);
  }, this);

  //change selectedLocation and animate location's marker
  this.selectLocation = function(locationIndex) {
    self.selectedLocation(self.filteredLocations()[locationIndex()]);
    animateMarker(self.selectedLocation().marker);
  }

  //load the first location
  this.selectLocation(function() { return 0; });

  //load address and wikipedia data when selected location changes, and store it on location obj
  ko.computed(function() {

    const location = self.selectedLocation();

    if (location.loaded) { return; }

    getLocalityInfoFromGoogle();

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

          self.selectedLocation().address(data.results[0].formatted_address);

          loadWikipediaData(localityAreaCountry);
        } catch (err) {
          throw 'Failed to parse location data.';
        }
      }).catch(err => {
        self.loadingStatus(err + ' Try refreshing.')
      });
    }

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
          const locationPageLink = `<a href="${'https:\/\/en.wikipedia.org\/wiki\/' + locationResult.title.replace(' ', '_')}">...</a>`;
          self.selectedLocation().wikipediaIntro(locationResult.snippet + locationPageLink);
          self.selectedLocation().loaded = true;
          self.loadingStatus('');
        } catch (err) {
          throw 'Failed to retrieve Wikpedia snippet.';
        }
      }).catch(err => {
        self.loadingStatus(err + ' Try refreshing.')
      })

    }
  }, this);

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

}
