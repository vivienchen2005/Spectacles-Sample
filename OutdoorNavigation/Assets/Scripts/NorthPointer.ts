@component
export class NorthPointer extends BaseScriptComponent {
  @input
  private arrowObject: SceneObject;

  @input
  private lookAt: LookAtComponent;

  @input
  private northObject: SceneObject;

  // Define the distance as a constant
  private static readonly DISTANCE: number = -100000000; // Fixed distance in local units 1km

  public alignTarget() {
    print("alignTarget called");
    // Stop updates at the beginning of alignTarget
    this.lookAt.enabled = false;

    // Calculate the forward position at the specified distance
    const forwardPosition = this.calculateForwardPosition();

    // Debug print the calculated forward position
    print(`Calculated Forward Position: ${forwardPosition.toString()}`);

    // Set the north object's position to the calculated forward position
    if (this.northObject && this.northObject.getTransform()) {
      this.northObject.getTransform().setWorldPosition(forwardPosition);
      print("North object position set");
    } else {
      print("North object or its transform is not available");
    }
    // Restart updates at the end of alignTarget
    this.lookAt.enabled = true;
  }

  private calculateForwardPosition(): vec3 {
    if (!this.arrowObject || !this.arrowObject.getTransform()) {
      print("Reference object or its transform is not available");
      return new vec3(0, 0, 0); // Creating a zero vector
    }

    // Get the forward vector of the reference object and normalize it
    const forwardVector = this.arrowObject.getTransform().forward.normalize();

    // Debug print the forward vector
    print(`Forward Vector: ${forwardVector.toString()}`);

    // Calculate the target position by adding the forward vector scaled by distance
    const currentPosition = this.arrowObject.getTransform().getWorldPosition();
    print(`Current Position: ${currentPosition.toString()}`);

    const scaledForward = forwardVector.uniformScale(NorthPointer.DISTANCE); // Scale the forward vector
    print(`Scaled Forward: ${scaledForward.toString()}`);

    const forwardPosition = currentPosition.add(scaledForward);

    // Ensure the y-position is the same as the reference object
    forwardPosition.y = currentPosition.y;

    return forwardPosition;
  }
}
