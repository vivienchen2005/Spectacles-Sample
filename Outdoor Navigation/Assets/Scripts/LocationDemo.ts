require("LensStudio:RawLocationModule");
import { SnapchatPlacesDemo } from "./SnapchatPlacesDemo_Declaration"; // Import the JS exports

@component
export class LocationDemo extends BaseScriptComponent {
  @input()
  textLA: Text;

  @input()
  textLO: Text;

  latitude: number = 0; // Store current latitude
  longitude: number = 0; // Store current longitude

  private repeatUpdateUserLocation: DelayedCallbackEvent;
  private locationService: LocationService;

  @input("Component.ScriptComponent")
  snapchatPlaces: SnapchatPlacesDemo;

  // Get the current latitude
  getLatitude(): number {
    return this.latitude; // Return the latest stored value
  }

  // Get the current longitude
  getLongitude(): number {
    return this.longitude; // Return the latest stored value
  }

  onAwake() {
    if (!this.textLA || !this.textLO) {
      print("Error: Text input for latitude or longitude is undefined.");
      return;
    }

    // Initialize the GeoLocation service
    this.createEvent("OnStartEvent").bind(() => {
      this.initializeLocationService();
    });

    // Create a delayed callback to update the location periodically
    this.repeatUpdateUserLocation = this.createEvent("DelayedCallbackEvent");
    this.repeatUpdateUserLocation.bind(() => {
      this.updateLocation();
      // Schedule the next location update in 1 second
      this.repeatUpdateUserLocation.reset(1.0);
    });
  }

  // Initialize the location service
  initializeLocationService() {
    this.locationService = GeoLocation.createLocationService();
    this.locationService.accuracy = GeoLocationAccuracy.Navigation; // Set high accuracy
    // Start the first location update immediately
    this.updateLocation();
  }

  // Fetch and update the user's location
  updateLocation() {
    this.locationService.getCurrentPosition(
      (geoPosition) => {
        // Update latitude, longitude, and other parameters
        this.latitude = geoPosition.latitude;
        this.longitude = geoPosition.longitude;

        // Update the UI text fields
        this.textLA.text = `Latitude: ${this.latitude.toFixed(2)}`;
        this.textLO.text = `Longitude: ${this.longitude.toFixed(2)}`;
        this.snapchatPlaces.fetchNearbyPlaces();
      },
      (error) => {
        print(`Error fetching location: ${error}`);
      }
    );
  }
}
