# My Neighborhood Map

This map shows places near my home that my son and I visit regularly.

To see a snippet of information about the suburb (locality) where an address place is located,
or information on a venue, click a marker or the location's name in the Locations sidebar list.

The Locations sidebar list can be filtered based on title with the text input field.

## Running

As locations.json is now fetch'ed, it's not possible to run this with the file URI scheme, a server is needed.

1. Make sure you have node and npm installed.
2. Extract the files to a folder.
3. Open a terminal and go to the folder.
4. Run `npm install http-server -g` (check http-server options if you need to choose a specific port).
5. Run `http-server`.

Note: http-server is not listed as a dependency in a package.json file as it's the kind of thing one installs
globally AND you might choose to use different software to run a server. The software is irrelevant, it's just
that file URIs can't be used with the fetch API so a server is needed.

## APIs Used

- Uses Google Maps API
- Uses Google Maps Geocoding API to convert lat/lng to address
- Uses Wikipedia API to get a snippet about the locality (or the snippet of the disambiguation page)
- Uses Foursquare to get venue info and photo.

## Resources
- Code from previous Udacity lessons code
- Knockout website
- Stack Overflow (with special mention to https://stackoverflow.com/questions/29589730/how-to-filter-google-map-markers-with-knockout-js)
- CSS Tricks
- MDN
- Wikipedia API docs
- Foursquare API docs
