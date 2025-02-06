import Event from "../Util/Event";
export {
  InitializedEvent,
  InitializeErrorEvent,
  AnchorEvent,
  AnchorError,
  AnchorMappingStatusEvent,
  AreaActivatedEvent,
  AreaDeactivatedEvent,
} from "./SpatialPersistence";
import {
  InitializedEvent,
  InitializeErrorEvent,
  AnchorError,
  AnchorEvent,
  AnchorMappingStatusEvent,
  AreaActivatedEvent,
  AreaDeactivatedEvent,
  SpatialPersistence,
  SpatialPersistenceInterface,
} from "./SpatialPersistence";

@component
export class SpatialPersistenceComponent
  extends BaseScriptComponent
  implements SpatialPersistenceInterface
{
  @input locationCloudStorageModule: LocationCloudStorageModule;

  // temporary
  @input connectedLensModule: ConnectedLensModule;
  @input useLocalStorage: boolean = false;
  @input mappingInterval: number = 20;
  @input resetDelayInS: number = 0.5;
  @input debug: boolean = true;
  @input incrementalMapping: boolean = false;
  @input enableLoggingPoseSettling: boolean = false;

  private spatialPersistence: SpatialPersistence;

  onAwake() {
    this.spatialPersistence = new SpatialPersistence(
      this.locationCloudStorageModule,
      this.connectedLensModule,
      this.useLocalStorage,
      this.mappingInterval,
      this.resetDelayInS,
      this.debug,
      this.incrementalMapping,
      this.enableLoggingPoseSettling,
    );

    // forward events from implementation
    this.spatialPersistence.onLoaded.add((event: AnchorEvent) => {
      this.onLoadedEvent.invoke(event);
    });
    this.spatialPersistence.onLoadError.add((event: AnchorError) => {
      this.onLoadErrorEvent.invoke(event);
    });
    this.spatialPersistence.onUnloaded.add((event: AnchorEvent) => {
      this.onUnloadedEvent.invoke(event);
    });
    this.spatialPersistence.onFound.add((event: AnchorEvent) => {
      this.onFoundEvent.invoke(event);
    });
    this.spatialPersistence.onLost.add((event: AnchorEvent) => {
      this.onLostEvent.invoke(event);
    });
    this.spatialPersistence.onDeleted.add((event: AnchorEvent) => {
      this.onDeletedEvent.invoke(event);
    });
    this.spatialPersistence.onDeleteError.add((event: AnchorError) => {
      this.onDeleteErrorEvent.invoke(event);
    });
    this.spatialPersistence.onAnchorMappingStatus.add(
      (event: AnchorMappingStatusEvent) => {
        this.onAnchorMappingStatusEvent.invoke(event);
      },
    );
    this.spatialPersistence.onAreaActivated.add((event: AreaActivatedEvent) => {
      this.onAreaActivatedEvent.invoke(event);
    });
    this.spatialPersistence.onAreaDeactivated.add(
      (event: AreaDeactivatedEvent) => {
        this.onAreaDeactivatedEvent.invoke(event);
      },
    );

    this.spatialPersistence.awake(this.sceneObject, this);
  }

  createAnchor(sceneObject: SceneObject): Promise<AnchorEvent> {
    return this.spatialPersistence.createAnchor(sceneObject);
  }

  saveAnchor(sceneObject: SceneObject): Promise<AnchorEvent> {
    return this.spatialPersistence.saveAnchor(sceneObject);
  }

  deleteAnchor(sceneObject: SceneObject): Promise<AnchorEvent> {
    return this.spatialPersistence.deleteAnchor(sceneObject);
  }

  resetArea(): Promise<void> {
    return this.spatialPersistence.resetArea();
  }

  selectArea(areaID: string | null) {
    this.spatialPersistence.selectArea(areaID);
  }

  initialize() {
    this.spatialPersistence.initialize().then(() => {
      this.onInitializedEvent.invoke(new InitializedEvent());
    });
  }
  private onInitializedEvent = new Event<InitializedEvent>();
  public readonly onInitialized = this.onInitializedEvent.publicApi();

  private onInitializeErrorEvent = new Event<InitializeErrorEvent>();
  public readonly onInitializeError = this.onInitializeErrorEvent.publicApi();

  private onLoadedEvent = new Event<AnchorEvent>();
  public readonly onLoaded = this.onLoadedEvent.publicApi();

  private onLoadErrorEvent = new Event<AnchorError>();
  public readonly onLoadError = this.onLoadErrorEvent.publicApi();

  private onUnloadedEvent = new Event<AnchorEvent>();
  public readonly onUnloaded = this.onUnloadedEvent.publicApi();

  private onFoundEvent = new Event<AnchorEvent>();
  public readonly onFound = this.onFoundEvent.publicApi();

  private onLostEvent = new Event<AnchorEvent>();
  public readonly onLost = this.onLostEvent.publicApi();

  private onDeletedEvent = new Event<AnchorEvent>();
  public readonly onDeleted = this.onDeletedEvent.publicApi();

  private onDeleteErrorEvent = new Event<AnchorError>();
  public readonly onDeleteError = this.onDeleteErrorEvent.publicApi();

  // debugging / ui
  private onAnchorMappingStatusEvent = new Event<AnchorMappingStatusEvent>();
  public readonly onAnchorMappingStatus =
    this.onAnchorMappingStatusEvent.publicApi();

  // Outgoing area selection events
  private onAreaActivatedEvent = new Event<AreaActivatedEvent>();
  public readonly onAreaActivated = this.onAreaActivatedEvent.publicApi();

  private onAreaDeactivatedEvent = new Event<AreaDeactivatedEvent>();
  public readonly onAreaDeactivated = this.onAreaDeactivatedEvent.publicApi();
}
