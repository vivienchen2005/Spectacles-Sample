// @input Component.ScriptComponent mapComponent
// @input Component.ScriptComponent snapchatPlacesDemo
// @input Component.ScriptComponent destinationPointer


/* TEST HERE YOUR COORDINATES 
script.createEvent("OnStartEvent").bind(function () {
  var onMaptilesLoaded = function () {
    var longitude = -118.4537586;
    var latitude = 34.0162081;
    var mapPin = script.mapComponent.createMapPin(longitude, latitude);
  };

  script.mapComponent.onMaptilesLoaded(onMaptilesLoaded);
});
*/

let destinationLongitude = 0;
let destinationLatitude = 0;

// Function to update the map pin at specified coordinates
script.api.updateMapPin = function (longitude, latitude) {
  // Check if mapComponent is available
  if (!script.mapComponent) {
    print("Error: mapComponent is not set.");
    return;
  }

  // Function to create the map pin
  var createPin = function () {
    var mapPin = script.mapComponent.createMapPin(longitude, latitude);
    if (mapPin) {
      print(
        "Map pin created at Longitude: " + longitude + ", Latitude: " + latitude
      );
    } else {
      print("Failed to create map pin.");
    }
  };

  // Check if the map tiles are already loaded
  if (script.mapComponent.areMapTilesLoaded()) {
    createPin();
  } else {
    // Bind to the map tiles loaded event
    script.mapComponent.onMaptilesLoaded(createPin);
  }
};

// Example function to connect both functionalities
function updateDestinationWithPlace(index) {
  print("updateDestinationWithPlace Executed");
  const coordinates = script.snapchatPlacesDemo.getCoordinatesByIndex(index);
  print(
    "HERE Coordinates for " +
      coordinates.name +
      ": Latitude: " +
      coordinates.latitude +
      ", Longitude: " +
      coordinates.longitude
  );
  destinationLatitude = coordinates.latitude;
  destinationLongitude = coordinates.longitude;
  print(
    "getDestinationCoordinates1 : " +
      destinationLatitude +
      " " +
      destinationLongitude
  );

  this.destinationPointer.updateDestinationPointer(
    destinationLongitude,
    destinationLatitude
  );
  this.destinationPointer.alignDestinationObject();

  script.mapComponent.removeMapPins();
  print("Map pins removed.");
  // Create a new map pin at the specified location
  var mapPin = script.mapComponent.createMapPin(
    coordinates.longitude,
    coordinates.latitude
  );
  print("Map pins created.");
}

// You need this to expose the method to the script api
// do not use module.exports or scipts.api in this file (deprecated)
// Expose functions using script.api for use by other scripts
script.updateDestinationWithPlace = updateDestinationWithPlace;
