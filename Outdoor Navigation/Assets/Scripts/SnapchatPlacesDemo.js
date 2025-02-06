// @input Asset.RemoteServiceModule remoteServiceModule

//@input Component.ScriptComponent locationDemo

// @input Component.Text longitudeText
// @input Component.Text latitudeText

// @input Component.Text textCurentLocation

// @input Component.Text[] textComponents

// Import the module
const Module = require("./../Snapchat Places API API Module");
const ApiModule = new Module.ApiModule(script.remoteServiceModule);

function onReceiveNearbyPlaces(response) {
  return new Promise((resolve, reject) => {
    try {
      print("Full Response: " + response.bodyAsString());

      let places = response.bodyAsJson();

      if (places && Array.isArray(places.nearbyPlaces)) {
        script.nearbyPlaces = places.nearbyPlaces;
        const numberOfPlacesToPrint = Math.min(5, places.nearbyPlaces.length);

        const promises = places.nearbyPlaces.map((place, index) => {
          if (index < numberOfPlacesToPrint) {
            return ApiModule.get_place({
              parameters: {
                place_id: place.placeId,
              },
            })
              .then((response) => {
                const placeMetadata = response.bodyAsJson();
                print(
                  `Metadata for ${place.name}: ${JSON.stringify(placeMetadata)}`
                );

                if (
                  placeMetadata.place &&
                  placeMetadata.place.geometry &&
                  placeMetadata.place.geometry.centroid
                ) {
                  const latitude = placeMetadata.place.geometry.centroid.lat;
                  const longitude = placeMetadata.place.geometry.centroid.lng;
                  print(
                    `Coordinates for ${place.name}: Latitude: ${latitude}, Longitude: ${longitude}`
                  );

                  script.nearbyPlaces[index].geometry = {
                    centroid: {
                      lat: latitude,
                      lng: longitude,
                    },
                  };
                } else {
                  print(`Coordinates not found for ${place.name}`);
                }
              })
              .catch((error) => {
                print(
                  `Error fetching place metadata for ${place.name}: ${error.message}`
                );
              });
          } else {
            return Promise.resolve();
          }
        });

        Promise.all(promises)
        /*
          .then(() => {
            script.nearbyPlaces.forEach((place, index) => {
              switch (index) {
                case 0:
                  if (script.textCurentLocation) {
                    script.textCurentLocation.text = "Welcome to " + place.name;
                  }
                  break;
                case 1:
                  if (script.textComponent1) {
                    script.textComponent1.text = place.name;
                  }
                  break;
                case 2:
                  if (script.textComponent2) {
                    script.textComponent2.text = place.name;
                  }
                  break;
                case 3:
                  if (script.textComponent3) {
                    script.textComponent3.text = place.name;
                  }
                  break;
                case 4:
                  if (script.textComponent4) {
                    script.textComponent4.text = place.name;
                  }
                  break;
              }
            });
            resolve();
            */
            .then(() => {
              script.nearbyPlaces.forEach((place, index) => {
                if (index === 0 && script.textCurentLocation) {
                  script.textCurentLocation.text = "Welcome to " + place.name;
                } else if (index > 0 && index <= script.textComponents.length) {
                  let textComponent = script.textComponents[index - 1];
                  if (textComponent) {
                    textComponent.text = place.name;
                  }
                }
              });
              resolve();
          })
          .catch((promiseError) => {
            print(`Promise.all error: ${promiseError.message}`);
            reject(promiseError);
          });
      } else {
        print("No nearby places found or nearbyPlaces is undefined.");
        resolve();
      }
    } catch (error) {
      print("Error parsing places: " + error.message);
      reject(error);
    }
  });
}

function fetchNearbyPlaces() {
  print("fetchNearbyPlaces Executed");
  print("Latitude: " + script.locationDemo.getLatitude());
  print("Longitude: " + script.locationDemo.getLongitude());

  let latitude = script.locationDemo.getLatitude();
  let longitude = script.locationDemo.getLongitude();

  if (isNaN(latitude) || isNaN(longitude)) {
    print(`Invalid coordinates: latitude=${latitude}, longitude=${longitude}`);
    return;
  }

  ApiModule.get_nearby_places({
    parameters: {
      lat: latitude,
      lng: longitude,
      gps_accuracy_m: 65,
      places_limit: 5,
    },
  })
    .then(onReceiveNearbyPlaces)
    .then(() => {
      print("All metadata fetched and stored.");
    })
    .catch((error) => {
      print(
        "Error fetching nearby places: " + error.message + "\n" + error.stack
      );
    });
}

// Define a function to get coordinates by index
function getCoordinatesByIndex(index) {
  if (
    !script.nearbyPlaces ||
    index < 0 ||
    index >= script.nearbyPlaces.length
  ) {
    print("Invalid index or no nearby places available.");
    return;
  }

  const place = script.nearbyPlaces[index];
  if (place && place.geometry && place.geometry.centroid) {
    const latitude = place.geometry.centroid.lat;
    const longitude = place.geometry.centroid.lng;
    print(
      `Coordinates for ${place.name}: Latitude: ${latitude}, Longitude: ${longitude}`
    );
    return { latitude, longitude };
  } else {
    print("Coordinates not found for the selected place.");
    return null;
  }
}

// You need this to expose the method to the script api
// do not use module.exports or scipts.api in this file (deprecated)
// Expose functions using script.api for use by other scripts
script.fetchNearbyPlaces = fetchNearbyPlaces;

// exposed for JS
script.getCoordinatesByIndex = getCoordinatesByIndex;
