var app = {};

(function() {

  document.addEventListener('DOMContentReady', function(event) {
    document.querySelector('#mapsAPI').addEventListener('error', function(event) {
      console.log('Failed to load maps api. try refreshing');
    });
  });

})();

app.foursquareKeys = {
  CLIENT_ID: "VQITOXTPPELG4GSH0BTPLMCQP5EZTCTRZXKJSM5DQ2LWXOTR",
  CLIENT_SECRET: "CRYGV5LHJRT0PFWG35JBMTZ0Y3FBEVLBEJTMQMAGS1YFZE30"
};

//handler for maps api not loading correctly
app.mapsAPIError = function() {
  app.mapsAPIErrorOccurred = true;
  ko.applyBindings(new app.ViewModel());
};

app.initMap = function() {

  app.infowindow = new google.maps.InfoWindow();

  ko.applyBindings(new app.ViewModel());
};

app.Location = function(data) {

  this.title = ko.observable(data.title);
  this.lat = ko.observable(data.location.lat);
  this.lng = ko.observable(data.location.lng);
  this.getDataFrom = data.getDataFrom;
  this.address = ko.observable('');
  this.foursquareInfo = ko.observable('');
  this.wikipediaSnippet = ko.observable('');
  this.loaded = false;

};

app.ViewModel = function() {

  var self = this;

  //toggle minimized state of locations sidebar
  self.locationsSidebarState = ko.observable('');
  self.toggleLocationsSidebar = function(event) {
    this.locationsSidebarState(this.locationsSidebarState() === '' ? 'locations-sidebar-minimized' : '');
  };

  //show error message if maps API has failed to load
  self.errorMessage = ko.observable('');
  if (app.mapsAPIErrorOccurred) {
    self.errorMessage('Error loading Google Maps API. Try refreshing.');
    return;
  }

  self.locations = ko.observableArray([]);
  self.initialLocationsLoaded = ko.observable(false);

  getInitialLocations().then(data => {
    createMapAndInitialMarkers(data);
    self.initialLocationsLoaded(true);
  }).catch(err => {
    self.errorMessage(err);
  });

  //show a loading message while we're getting async data
  self.loadingStatus = ko.observable('Loading...');

  //filters list and adjusts markers based on input
  self.filter = ko.observable();

  //build our filtered array
  self.filteredLocations = ko.computed(function() {

    //return empty array if our initial locations haven't finished loading
    if (!self.initialLocationsLoaded()) { return []; }

    app.mapBounds = new google.maps.LatLngBounds();

    const filtered = self.locations().filter(function(location, index) {
      if (!self.filter() || location.title().toLowerCase().indexOf(self.filter().toLowerCase()) !== -1) {
        location.marker.setMap(app.map);
        app.mapBounds.extend(location.marker.position);
        return location;
      } else {
        location.marker.setMap(null);
      }
    });

    //fit all of the markers on the map, but with a maximum zoom of 15
    if (app.map) {
      app.map.fitBounds(app.mapBounds);
      app.map.setZoom(Math.min(app.map.getZoom(), 15));
    }

    return filtered;
  }, self);

  self.selectedLocation = ko.observable();

  //change selectedLocation and animate location's marker
  self.selectLocation = function(locationIndex) {
    self.selectedLocation(self.filteredLocations()[locationIndex()]);
  };

  //select first location after filtering
  ko.computed(function() {
    self.selectedLocation(self.filteredLocations()[0]);
  }, self);

  //load the first location
  self.selectLocation(function() { return 0; });

  function getInitialLocations() {
    const locationsJSONUrl = 'locations.json';
    return fetch(locationsJSONUrl)
      .then(resp => {
        if (resp.ok) {
          return resp.json();
        } else {
          throw `Failed to retrieve ${locationsJSONUrl}. Please check that the file exists and try refreshing.`;
        }
      })
      .catch(err => {
        if (err.stack && err.stack.indexOf('SyntaxError') === 0) {
          throw `Failed to parse ${locationsJSONUrl}. ${err}`;
        } else {
          throw err;
        }
      })
      .then(data => {
        if (!(data.length && data[0].location)) { throw `Incorrectly formatted ${locationsJSONUrl}`; }
        return data;
      });
  }

  function createMapAndInitialMarkers(data) {

    // Constructor creates a new map - only center and zoom are required.
    // centers on the first element in locations array
    app.map = new google.maps.Map(document.getElementById('map'), {
      center: data[0].location,
      zoom: 15
    });

    google.maps.event.addDomListener(window, 'resize', function() {
      google.maps.event.trigger(app.map, 'resize');
    });

    google.maps.event.addListener(app.map, 'resize', function() {
      //had to use rAF as the resize hadn't finished before the below call, causing it not to fit properly
      requestAnimationFrame(function() { app.map.fitBounds(app.mapBounds); });
    });

    //create our makers
    data.forEach((item, index) => {

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
  }

  //animate the marker and show the infowindow when the selected location changes
  ko.computed(function() {
    const location = self.selectedLocation();
    if (!location) { return; }
    const marker = location.marker;
    animateMarker(marker);
    populateInfoWindow(marker, app.infowindow);
  });

  //load address and wikipedia data when selected location changes, and store it on location obj
  ko.computed(function() {

    const location = self.selectedLocation();

    //exit if there is no selected location (e.g. if a user has entered a filter that has no results)
    if (typeof location === 'undefined') { return; }

    //exit if we've already loaded the data for this location
    if (location.loaded) { return; }

    self.loadingStatus('Loading...');

    //update ViewModel with wikipedia snippet or foursquare info.
    //update ViewModel with with error messages based on where failure occurs.
    if (location.getDataFrom === 'Wikipedia') {

      getInfoFromWikipedia().then(data => {
        location.wikipediaSnippet(data);
        location.loaded = true;
        self.loadingStatus('');
      }).catch(err => {
        self.loadingStatus(err + ' Try refreshing.');
      });
    } else {
      getInfoFromFoursquare().then(data => {
        location.foursquareInfo(data);
        location.loaded = true;
        self.loadingStatus('');
      }).catch(err => {
        self.loadingStatus(err + ' Try refreshing.');
      });
    }

    function getInfoFromFoursquare() {

      const foursquareExploreUrl = `https://api.foursquare.com/v2/venues/explore?ll=${location.lat()},${location.lng()}` +
        `&sortByDistance=1&venuePhotos=1&radius=20` +
        `&client_id=${app.foursquareKeys.CLIENT_ID}&client_secret=${app.foursquareKeys.CLIENT_SECRET}&v=20170905`;

      return fetch(foursquareExploreUrl).then(resp => {
          if (resp.ok) {
            return resp.json();
          } else {
            throw 'Failed to retrieve Foursquare venue data.';
          }
        })
        .catch(err => {
          throw 'Foursquare: ' + err;
        })
        .then(data => {

          try {

            const venue = data.response.groups[0].items[0].venue;

            var foursquareInfo = `${venue.categories[0].name}. `;
            if (venue.price) { foursquareInfo += `${venue.price.message}. `; }
            if (venue.rating) { foursquareInfo += `${venue.rating} rating.`; }

            if (venue.photos.count) {
              const photo = venue.photos.groups[0].items[0];
              foursquareInfo += `<br><img class="venue-img" src="${photo.prefix}width320${photo.suffix}"/>`;
            }

            foursquareInfo += `<br><a href="//foursquare.com/v/${venue.id}">[Fourquare]</a>`;

            return foursquareInfo;
          } catch (err) {
            throw 'Failed to parse Foursquare venue data.';
          }
        });
    }

    function getInfoFromWikipedia() {

      const wikipediaUrl = 'https://en.wikipedia.org/w/api.php?&origin=*&action=query&list=search&format=json&srsearch=';

      return getLocalityInfoFromGoogle().then(lAC => {
        return fetch(`${wikipediaUrl}${lAC.locality}+,${lAC.area}+,${lAC.country}`).then(resp => {
            if (resp.ok) {
              return resp.json();
            } else {
              throw 'Failed to retrieve Wikpedia snippet.';
            }
          })
          .catch(err => {
            throw 'Wikipedia: ' + err;
          })
          .then(data => {
            try {

              //try to find an exact match for the locality-area and article title
              var locationResult = data.query.search.find((item, index) => {
                return item.title === `${lAC.locality}, ${lAC.area}`;
              });

              //if no exact match, just use the first result
              if (!locationResult) { locationResult = data.query.search[0]; }

              const locationPageLink = `<a href="${'https:\/\/en.wikipedia.org\/wiki\/' +
              locationResult.title.replace(' ', '_')}">... [Wikipedia]</a>`;
              return locationResult.snippet + locationPageLink;
            } catch (err) {
              throw 'Failed to parse Wikpedia snippet.';
            }
          });
      });

    }

    //gets suburb etc for location
    function getLocalityInfoFromGoogle() {

      const googleGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=` +
        `${location.lat()},${location.lng()}&key=AIzaSyAFc11aYXpKunavDkM8nxAI0rZyn--Z7fk`;

      return fetch(googleGeocodeUrl).then(resp => {
          if (resp.ok) {
            return resp.json();
          } else {
            throw 'Failed to retrieve location data from Google Maps.';
          }
        })
        .catch(err => {
          throw 'Google Maps: ' + err;
        })
        .then(data => {

          try {

            const localityAreaCountry = data.results[0].address_components.reduce((acc, item, index) => {
              if (item.types.includes('locality')) { acc.locality = item.long_name; }
              if (item.types.includes('administrative_area_level_1')) { acc.area = item.long_name; }
              if (item.types.includes('country')) { acc.country = item.long_name; }
              return acc;
            }, {});

            location.address(data.results[0].formatted_address);

            return localityAreaCountry;
          } catch (err) {
            throw 'Failed to parse location data from Google Maps.';
          }
        });

    }
  }, self);

  //animate markers for a period
  //cancels any markers that are already bouncing when called
  function animateMarker(marker) {

    //cancel any existing bouncing
    self.lastMarker && self.lastMarker.setAnimation(null);

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

};