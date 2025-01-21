
/* BASIC SAMPLE USAGE FROM MODULE IMPORT 
// @input Asset.RemoteServiceModule remoteServiceModule

// Import module
const Module = require("./Snapchat Places API API Module");
const ApiModule = new Module.ApiModule(script.remoteServiceModule);


// Example of calling an endpoint in ApiModule, replace with actual endpoint name
ApiModule.endpointName({
    // There might be required parameters
    parameters: {
        "parameter1": "12345"  // Replace with actual parameter names and values
    },
    // Body might be optional
    body: JSON.stringify({
        "additionalInfo": "Some info"  // Adjust based on the actual endpoint requirements
    })
}).then((response) => {
    // Parse response as JSON string and log it
    print("Response metadata: " + JSON.stringify(response.metadata))
    print("Response body: " + response.bodyAsString());
}).catch((error) => {
    print(error + "\n" + error.stack);
});
*/ 

// @input Asset.RemoteServiceModule remoteServiceModule

// Import the module
const Module = require("./Snapchat Places API API Module");
const ApiModule = new Module.ApiModule(script.remoteServiceModule);

// Function to handle the response from get_nearby_places
function onReceiveNearbyPlaces(response) {
    try {
        // Print the entire response to debug the structure
        print("Full Response: " + response.bodyAsString());

        let places = response.bodyAsJson();

        // Correct key is "nearbyPlaces"
        if (places && Array.isArray(places.nearbyPlaces)) {
            const numberOfPlacesToPrint = Math.min(4, places.nearbyPlaces.length);

            places.nearbyPlaces.forEach((place, index) => {
                if (index < numberOfPlacesToPrint) {
                    print("Place Name: " + place.name + ", Place ID: " + place.placeId);
                }
            });
        } else {
            print("No nearby places found or nearbyPlaces is undefined.");
        }
    } catch (error) {
        print("Error parsing places: " + error);
    }
}

// Bind an event to run on start
script.createEvent('OnStartEvent').bind(() => {
    // Call the get_nearby_places API
    ApiModule.get_nearby_places({
        parameters: {
            lat: 34.0162081, // Example latitude
            lng: -118.4563335, // Example longitude
            gps_accuracy_m: 65, // Use default GPS accuracy
            places_limit: 4 // Limit to 4 places
        }
    }).then(onReceiveNearbyPlaces).catch((error) => {
        print("Error fetching nearby places: " + error + "\n" + error.stack);
    });
});