import { NorthPointer } from "./NorthPointer";
import { SnapchatPlacesDemo } from "./SnapchatPlacesDemo_Declaration"; // Import the JS exports
import { DefineDestinationDemo } from "./DefineDestinationDemo_Declaration"; // Import the JS exports
@component
export class ObjectToggler extends BaseScriptComponent {
  @input
  private introPanel: SceneObject;
  @input
  private arrowChildNorth: SceneObject; // we disable the child arrow visualization, we keep the rotating parent reference
  @input
  private destinationPanel: SceneObject;
  @input
  private navigationPanel: SceneObject;
  @input
  private arrowParentDestination: SceneObject;
  @input
  private northPointer: NorthPointer;
  @input
  private locationDemo: SceneObject;
  @input
  private snapchatPlacesDemo: SceneObject;
  @input
  private mapObject: SceneObject;
  @input
  private mapComponent: ScriptComponent;
  @input
  private textloadingAlert: Text;

  @input("Component.ScriptComponent")
  snapchatPlaces: SnapchatPlacesDemo;
  @input("Component.ScriptComponent")
  defineDestination: DefineDestinationDemo;

  // Enable Intro Panel: user is introduced to the experience and set the north
  public enableIntroPanel() {
    // handle map
    this.locationDemo.enabled = true;
    this.snapchatPlacesDemo.enabled = true;
    this.mapObject.enabled = true;
    this.mapComponent.enabled = true;
    // handle the UI
    this.textloadingAlert.enabled = false;
    this.introPanel.enabled = true;
    this.arrowChildNorth.enabled = true;
    this.destinationPanel.enabled = false;
    this.navigationPanel.enabled = false;
    this.arrowParentDestination.enabled = false;
    print("Intro Panel enabled");
  }
  // Enable Destination Panel: user set the north and is ready to set the destination
  public enableDestinationPanel() {
    // handle map
    this.locationDemo.enabled = true;
    this.snapchatPlacesDemo.enabled = true;
    this.mapObject.enabled = true;
    this.mapComponent.enabled = true;

    // set north pointer to the north
    this.northPointer.alignTarget();

    // find nearby places
    this.snapchatPlaces.fetchNearbyPlaces();

    // handle the UI
    this.textloadingAlert.enabled = true;
    this.introPanel.enabled = false;
    this.arrowChildNorth.enabled = true;

    this.destinationPanel.getTransform().setLocalPosition(new vec3(-10, 0, 0));
    this.navigationPanel.getTransform().setLocalPosition(new vec3(10, 0, 0));

    this.destinationPanel.enabled = true;
    this.navigationPanel.enabled = true;
    this.arrowParentDestination.enabled = false;
    print("Intro Panel enabled");
  }
  // Enable Navigation Panel: user set the destination and is ready to navigate
  public enableNavigationPanel() {
    // handle map
    this.locationDemo.enabled = true;
    this.snapchatPlacesDemo.enabled = true;
    this.mapObject.enabled = true;
    this.mapComponent.enabled = true;
    // handle the UI
    this.textloadingAlert.enabled = false;
    this.introPanel.enabled = false;
    this.arrowChildNorth.enabled = true;
    this.destinationPanel.enabled = false;
    this.navigationPanel.getTransform().setLocalPosition(new vec3(0, 0, 0));
    this.navigationPanel.enabled = true;
    this.arrowParentDestination.enabled = true;

    print("Intro Panel enabled");
  }

  public DefineDestinationOption1() {
    this.defineDestination.updateDestinationWithPlace(1);
  }
  public DefineDestinationOption2() {
    this.defineDestination.updateDestinationWithPlace(2);
  }
  public DefineDestinationOption3() {
    this.defineDestination.updateDestinationWithPlace(3);
  }
  public DefineDestinationOption4() {
    this.defineDestination.updateDestinationWithPlace(4);
  }
}
