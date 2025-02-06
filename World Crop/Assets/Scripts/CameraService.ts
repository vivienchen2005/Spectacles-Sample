@component
export class CameraService extends BaseScriptComponent {
  @input editorCamera: Camera;
  @input specsLeftCamera: Camera;
  @input specsRightCamera: Camera;
  @input screenCropTexture: Texture;
  @input deviceCamTexture: Texture;
  @input camModule: CameraModule;

  private isEditor = global.deviceInfoSystem.isEditor();

  onAwake() {
    this.createEvent("OnStartEvent").bind(this.start.bind(this));
  }

  start() {
    var camID = this.isEditor
      ? CameraModule.CameraId.Default_Color
      : CameraModule.CameraId.Right_Color;
    var camRequest = CameraModule.createCameraRequest();
    camRequest.cameraId = camID;
    camRequest.imageSmallerDimension = this.isEditor ? 352 : 756;
    var camTexture = this.camModule.requestCamera(camRequest);
    var camTexControl = camTexture.control as CameraTextureProvider; 
    var cropTexControl = this.screenCropTexture.control as CropTextureProvider;
    cropTexControl.inputTexture = camTexture;
    camTexControl.onNewFrame.add(() => {});  
    if (this.isEditor) {
      return;
    }
    var leftTrackingCamera =
      global.deviceInfoSystem.getTrackingCameraForId(camID);
    var rightTrackingCamera = global.deviceInfoSystem.getTrackingCameraForId(
      CameraModule.CameraId.Right_Color
    );
    this.SetUpVirtualCamera(this.specsLeftCamera, leftTrackingCamera);
    this.SetUpVirtualCamera(this.specsRightCamera, rightTrackingCamera);
  }

  SetUpVirtualCamera(camComp, trackingCam) {
    //set pose
    var camTrans = camComp.getSceneObject().getTransform();
    camTrans.setLocalTransform(trackingCam.pose);
    //set intrinsics
    var aspect = trackingCam.resolution.x / trackingCam.resolution.y;
    camComp.aspect = aspect;
    const avgFocalLengthPixels =
      (trackingCam.focalLength.x + trackingCam.focalLength.y) / 2;
    const fovRadians =
      2 * Math.atan(trackingCam.resolution.y / 2 / avgFocalLengthPixels);
    camComp.fov = fovRadians;
  }

  WorldToEditorCameraSpace(worldPos) {
    return this.CameraToScreenSpace(this.editorCamera, worldPos);
  }

  WorldToTrackingLeftCameraSpace(worldPos) {
    return this.CameraToScreenSpace(this.specsLeftCamera, worldPos);
  }

  WorldToTrackingRightCameraSpace(worldPos) {
    return this.CameraToScreenSpace(this.specsRightCamera, worldPos);
  }

  CameraToScreenSpace(camComp, worldPos) {
    var screenPoint = camComp.worldSpaceToScreenSpace(worldPos);
    var localX = this.Remap(screenPoint.x, 0, 1, -1, 1);
    var localY = this.Remap(screenPoint.y, 1, 0, -1, 1);
    return new vec2(localX, localY);
  }

  Remap(value, low1, high1, low2, high2) {
    return low2 + ((high2 - low2) * (value - low1)) / (high1 - low1);
  }
}
