export interface DefineDestinationDemo extends ScriptComponent {
  updateDestinationWithPlace: (index: number) => void;
  getDestinationCoordinates: () => { latitude: number; longitude: number };
}
