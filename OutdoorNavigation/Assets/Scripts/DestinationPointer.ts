import { DefineDestinationDemo } from "./DefineDestinationDemo_Declaration"; // Import the JS exports
import { LocationDemo } from "./LocationDemo";
@component
export class DestinationPointer extends BaseScriptComponent {
  @input private destinationArrow: SceneObject;
  @input private lookAt: LookAtComponent;
  @input private destinationObject: SceneObject;
  @input private locationDemo: LocationDemo;
  @input("Component.ScriptComponent")
  defineDestination: DefineDestinationDemo;

  private destinationLongitudeStored: number;
  private destinationLatitudeStored: number;

  // Define the distance as a constant
  private static readonly DISTANCE: number = -100000000; // Fixed distance in local units 1km

  public alignDestinationObject() {
    const userLat = this.locationDemo.getLatitude();
    const userLong = this.locationDemo.getLongitude();

    // Convert lat/long differences to local space
    // Note: Z is typically North in local space
    const deltaX = -(this.destinationLongitudeStored - userLong); // West is -X
    const deltaZ = this.destinationLatitudeStored - userLat; // North is +Z

    // Get arrow's current position
    const arrowPos = this.destinationArrow.getTransform().getWorldPosition();

    // Move destination object relative to arrow
    this.destinationObject.getTransform().setWorldPosition(
      new vec3(
        arrowPos.x + deltaX * DestinationPointer.DISTANCE,
        arrowPos.y, // Keep same height
        arrowPos.z + deltaZ * DestinationPointer.DISTANCE
      )
    );

    print(
      `Destination position: ${this.destinationObject
        .getTransform()
        .getWorldPosition()}`
    );

    // LookAt will handle the rotation
    if (this.lookAt) {
      this.lookAt.enabled = true;
    }
  }

  public updateDestinationPointer(
    destinationLongitude: number,
    destinationLatitude: number
  ) {
    this.destinationLongitudeStored = destinationLongitude;
    this.destinationLatitudeStored = destinationLatitude;
    this.alignDestinationObject();
  }
}
