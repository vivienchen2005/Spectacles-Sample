import Event from "../Util/Event";
import { setTimeout, clearTimeout } from "../Util/debounce";
import { LocationTracking } from "./Tracking";
import { LoggerVisualization } from "./Logging";
import {
  MapScanning,
  RequiredQualityOrTrackingAlready,
  Timeout,
} from "./MapScanning";
import { MappingTrackingSession } from "./MappingTrackingSession";
import { AreaEvent, Model, ModelEvent } from "./Model";
import { PersistentStorage } from "./PersistentStorage";

// flow

// initialize multiplayer session (hack)
// start loading previous location + anchors
// start mapping
// wait for previous location + anchors loading to complete -> either have a previous location or don't
// if have previous location, start tracking
//   -> wait for tracking to complete
//   -> wait for mapping to complete
// else
//   -> wait for mapping to complete
//
// whenever mapping completes
//   -> don't switch tracking
//   -> instead, only update the model with the new location
//
// if have placed a new anchor
//  -> if we are waiting for an existing map to track
//    -> once tracking completes, update the model
//  -> if we have completed a new map
//    -> update the model
//  -> if we have completed a new map with no previous map
//    -> once tracking starts, update the model
//

// initialization events
export class InitializedEvent {
  loadedAnchors: { [key: string]: SceneObject };
}

export class InitializedLensCloudEvent {}

export class InitializeErrorEvent {
  error: Error;
}

export class AnchorEvent {
  location: LocationAsset;
  sceneObject: SceneObject;
}

export class AnchorError {
  message: string;
  location: LocationAsset;
}

export class AnchorMappingStatusEvent {
  quality?: number;
  capacityUsed?: number;
}

export class AreaActivatedEvent {
  areaId: string;
}

export class AreaDeactivatedEvent {
  areaId: string;
}

export class RetargetableLocationTrackingPromise {
  // !!! assume 'cancelled' operations won't call this;
  // !!! should make sure this is impossible
  resolve([tracking, toLensWorldFromTrackedLocation]: [
    LocationAsset,
    mat4,
  ]): void {
    this.trackingLocation = [tracking, toLensWorldFromTrackedLocation];
    this.flush();
  }

  private waitingToTrack: (([LocationAsset, mat4]) => void)[] = [];
  onceLocationFound: Promise<[LocationAsset, mat4]> = new Promise<
    [LocationAsset, mat4]
  >((resolve, reject) => {
    this.waitingToTrack.push(resolve);
    if (this.trackingLocation) {
      this.flush();
    }
  });

  flush() {
    if (this.trackingLocation) {
      while (this.waitingToTrack.length) {
        let next = this.waitingToTrack.shift()!;
        next(this.trackingLocation);
      }
    }
  }

  trackingLocation?: [LocationAsset, mat4];
}

export interface SpatialPersistenceInterface {
  createAnchor(sceneObject: SceneObject): Promise<AnchorEvent>;
  saveAnchor(sceneObject: SceneObject): Promise<AnchorEvent>;
  deleteAnchor(sceneObject: SceneObject): Promise<AnchorEvent>;
  resetArea(): Promise<void>;
  selectArea(areaID: string | null);
}

export class SpatialPersistence implements SpatialPersistenceInterface {
  private _locationCloudStorageModule: LocationCloudStorageModule;

  // temporary
  private _connectedLensModule: ConnectedLensModule;
  private _useLocalStorage: boolean = false;
  private _mappingInterval: number = 20;
  private _resetDelayInS: number = 0.5;
  private _debug: boolean = true;
  private _incrementalMapping: boolean = false;
  private _enableLoggingPoseSettling: boolean = false;

  private sceneObject: SceneObject;
  private scriptComponent: BaseScriptComponent;

  private mappingAndTracking?: MappingTrackingSession;
  private sceneObjects: { [key: string]: SceneObject } = {};
  private locations: { [key: string]: LocationAsset } = {};

  private static readonly anchorIdStash = "__anchorId";
  static readonly DefaultAreaId: string = "default";
  static readonly DefaultStateAsString: string = JSON.stringify({
    areas: { default: { name: "default" } },
  });

  private requiredQualityOrTrackingAlreadyTrigger?: RequiredQualityOrTrackingAlready; // !!! mapping after tracking a separate map -> quality << 1.0

  private trackingSceneObject: SceneObject;
  private mappingSceneObject: SceneObject;

  constructor(
    locationCloudStorageModule: LocationCloudStorageModule,
    connectedLensModule: ConnectedLensModule,
    useLocalStorage: boolean,
    mappingInterval: number,
    resetDelayInS: number,
    debug: boolean,
    incrementalMapping: boolean,
    enableLoggingPoseSettling: boolean,
  ) {
    this._locationCloudStorageModule = locationCloudStorageModule;
    this._connectedLensModule = connectedLensModule;
    this._useLocalStorage = useLocalStorage;
    this._mappingInterval = mappingInterval;
    this._resetDelayInS = resetDelayInS;
    this._debug = debug;
    this._incrementalMapping = incrementalMapping;
    this._enableLoggingPoseSettling = enableLoggingPoseSettling;
  }

  async createAnchor(sceneObject: SceneObject): Promise<AnchorEvent> {
    let persistedLocationId = getGuid();
    let anchor = LocationAsset.getProxy(persistedLocationId);

    this.sceneObjects[persistedLocationId] = sceneObject;
    this.locations[persistedLocationId] = anchor;
    (sceneObject as ScriptObject)[SpatialPersistence.anchorIdStash] =
      persistedLocationId;

    let anchorEvent = new AnchorEvent();
    anchorEvent.location = anchor;
    anchorEvent.sceneObject = sceneObject;

    return anchorEvent;
  }

  async saveAnchor(sceneObject: SceneObject): Promise<AnchorEvent> {
    let anchorId = (sceneObject as ScriptObject)[
      SpatialPersistence.anchorIdStash
    ];
    this.log("Saving " + anchorId);

    let [trackedLocation, toLensWorldFromTrackedLocation] =
      await this.onceAnyLocationFound;

    let toLensWorldFromSceneObject = sceneObject
      .getTransform()
      .getWorldTransform();
    let toTrackedLocationFromLensWorld =
      toLensWorldFromTrackedLocation.inverse();
    let toTrackedLocationFromAnchor = toTrackedLocationFromLensWorld.mult(
      toLensWorldFromSceneObject,
    );

    let serializedLocationId =
      await this.persistentStorage.storeLocation(trackedLocation);

    let modelEvent = await this.model.saveAnchor(
      anchorId,
      serializedLocationId,
      toTrackedLocationFromAnchor,
    );

    // model was updated, now we need to save
    this.triggerSceneSave();

    // forward the event
    let location = this.locations[modelEvent.anchor];
    let savedSceneObject = this.sceneObjects[modelEvent.anchor];

    let anchorEvent = new AnchorEvent();
    anchorEvent.location = location;
    anchorEvent.sceneObject = savedSceneObject;

    return anchorEvent;
  }

  async deleteAnchor(sceneObject: SceneObject): Promise<AnchorEvent> {
    let anchorId = (sceneObject as ScriptObject)[
      SpatialPersistence.anchorIdStash
    ];
    this.log("Deleting " + anchorId);
    let modelEvent = await this.model.deleteAnchor(anchorId);

    let anchorEvent = this.createAnchorEvent(modelEvent);

    return anchorEvent;
  }

  async resetArea(): Promise<void> {
    // can't reset if load hasn't completed
    await this.previousState.finally(async () => {
      this.log("resetting area " + this.model.currentAreaId);
      this.model.reset().then(() => {
        // !!! should be triggered by model
        // !!! missing is model notifying subscribers that state has changed due to lastTrackedLocation being cleared
        this.triggerSceneSave();
      });
    });
  }

  selectArea(areaID: string | null) {
    this.model.selectArea(areaID);
  }

  awake(sceneObject: SceneObject, scriptComponent: BaseScriptComponent) {
    this.sceneObject = sceneObject;
    this.scriptComponent = scriptComponent;

    this.trackingSceneObject = global.scene.createSceneObject("tracking");
    this.trackingSceneObject.setParent(sceneObject);

    this.mappingSceneObject = global.scene.createSceneObject("mapping");
    this.mappingSceneObject.setParent(sceneObject);
    let mappingLocatedAt = this.mappingSceneObject.createComponent(
      "LocatedAtComponent",
    ) as LocatedAtComponent;
    mappingLocatedAt.location = LocationAsset.getAROrigin();

    this.model = new Model();
    // !!! persistent storage needs to be per area, not per tracked location

    // Makes sure local storage is used in LS preview
    if (global.deviceInfoSystem.isEditor()) {
      this._useLocalStorage = true;
    }
    this.persistentStorage = new PersistentStorage(
      this._useLocalStorage,
      this._locationCloudStorageModule,
    );

    this.model.onAnchorLoaded.add(this.notifyAnchorLoaded.bind(this));
    this.model.onAnchorUnloaded.add(this.notifyAnchorUnloaded.bind(this));
    this.model.onAnchorDeleted.add(this.notifyAnchorDeleted.bind(this));

    this.model.onAreaActivated.add(this.notifyAreaActivated.bind(this));
    this.model.onAreaDeactivated.add(this.notifyAreaDeactivated.bind(this));
  }

  private alreadyInitialized: boolean = false;
  private initializingDelayInSec: number = 1.0;
  private async initializeMappingAndTracking(): Promise<MappingTrackingSession> {
    if (this.alreadyInitialized) {
      await delay(this.initializingDelayInSec);
    }
    this.alreadyInitialized = true;

    this.log("initializing mapping and tracking");

    let mapScanning = this.createMapScanning();

    // mapping control
    let trigger = new RequiredQualityOrTrackingAlready();
    trigger.quality = 1.0;
    trigger.allowCheckpoint = false;
    trigger.trackingAlready = false;
    this.requiredQualityOrTrackingAlreadyTrigger = trigger;
    mapScanning
      .checkpoint(trigger)
      .then(async (newlyMappedLocation) => {
        await this.updateModelAgainstScan(newlyMappedLocation);
        let toLensWorldFromMapping = this.mappingSceneObject
          .getTransform()
          .getWorldTransform();
        this.locationPromiseGatherer.resolve([
          newlyMappedLocation,
          toLensWorldFromMapping,
        ]);
        this.firstMapCompleted(newlyMappedLocation);
      })
      .catch((error) => {
        this.log("error during initial checkpointing: " + error);
      });

    return new MappingTrackingSession(mapScanning, this._resetDelayInS);
  }

  private createMapScanning(): MapScanning {
    let mapScanning = new MapScanning(
      this._locationCloudStorageModule,
      this.scriptComponent,
    );
    mapScanning.onMappingStatus.add((status) => {
      this.onAnchorMappingStatusEvent.invoke(status);
    });
    return mapScanning;
  }

  async firstMapCompleted(newlyMappedLocation: LocationAsset) {
    // we need to wait for previous state to load or fail to load - otherwise we don't
    // know if we should wait for it to track
    this.log("startup mapping completed");
    try {
      let previousLocation = await this.previousState;
      // [A9] - we need a successful localization of the old location to proceed
      // this.log("waiting for previous localization before applying new map");
      // this.onceAnyLocationFound.then(([trackedLocation, toLensWorldFromTrackedLocation]) => {
      // this.log("tracking previous localization");
      // this.track(newlyMappedLocation);
      // });
    } catch {
      this.track(newlyMappedLocation);
    } finally {
      if (this._incrementalMapping) {
        this.scheduleSubsequentMap();
      }
    }
  }

  async scheduleSubsequentMap() {
    if (this._mappingInterval > 0.0) {
      this.log("scheduling subsequent map");

      let mapScanning = await this.mappingAndTracking.withMapScanning();
      this.log(
        "mapping session capacity used: " +
          mapScanning.mappingSession.capacityUsed,
      );

      // "capacityUsed" is scaled relative to the "wearableMaximumSize_" parameter
      // defined in LensCore:
      // capacityUsed = std::min(rawCapacity / wearableMaximumSize_, 1.0)
      if (
        mapScanning.mappingSession.capacityUsed >
        mapScanning.maxAllowedCapacityUsed
      ) {
        this.log("capacity used above threshold - stopping map saves");
        return;
      }

      let trigger = new Timeout();
      trigger.timeoutInS = this._mappingInterval;
      let newlyMappedLocation = await mapScanning.checkpoint(trigger);

      await this.updateModelAgainstScan(newlyMappedLocation);
      let toLensWorldFromMapping = this.mappingSceneObject
        .getTransform()
        .getWorldTransform();
      this.locationPromiseGatherer.resolve([
        newlyMappedLocation,
        toLensWorldFromMapping,
      ]);
      this.scheduleSubsequentMap();
    }
  }

  async updateModelAgainstScan(newlyMappedLocation: LocationAsset) {
    this.log("updating model against scan");

    this.model.area.lastTrackedLocation =
      await this.persistentStorage.storeLocation(newlyMappedLocation);
    this.triggerSceneSave();

    // we have mapped in the the new location but will not be tracking it.
    // All anchors already in the model will need to be updated
    // this must be done via the model, not the local list of scene objects / locations
    // as they may not be in the model yet
    for (let anchorId in this.model.area.anchors) {
      // !!! area cannot be null, no checkpoint can be asked for without an activate
      // !!! ie we are safe using this.model.area - how can we make this obvious?
      let toLensWorldFromAnchor = this.sceneObjects[anchorId]
        .getTransform()
        .getWorldTransform();
      let toLensWorldFromAROrigin = this.mappingSceneObject
        .getTransform()
        .getWorldTransform();
      let toNewlyMappedLocationFromAnchor = toLensWorldFromAROrigin
        .inverse()
        .mult(toLensWorldFromAnchor);
      this.model.saveAnchor(
        anchorId,
        this.model.area.lastTrackedLocation, // !!! area cannot be null, no checkpoint can be asked for without an activate
        // !!! ie we are safe using this.model.area - how can we make this obvious?
        toNewlyMappedLocationFromAnchor,
      );
    }
  }

  //!!! temp hack due to ordering
  //!!!    this component needs to be ahead of consumers in scene graph so events
  //!!!    are available for consumers to subscribe to
  //!!!
  //!!!    it also wants to deserialize previous state
  //!!!
  //!!!    however the consumers may wish to react to this state via the events
  //!!!    they haven't yet had a chance to subscribe to
  //!!!
  //!!!    so we have to make sure that the events published by this component are
  //!!!    there and can be subscribed to before deserializing
  //!!!
  //!!!    atm we supply an 'initialize' function and onInitializeEvent for consumers
  //!!!    to subscribe to, such that they can control when deserialize happens
  private previousState?: Promise<void>;
  async initialize(): Promise<void> {
    this.log("initializing");

    this.previousState = this.loadPrevious();
    try {
      await this.previousState;
    } catch (noPreviousStateError) {
      this.log(
        "no previous location state - using default state" +
          noPreviousStateError,
      );
      this.model.load(SpatialPersistence.DefaultStateAsString);
      this.model.selectArea(SpatialPersistence.DefaultAreaId);
    }
  }

  private async loadPrevious(): Promise<void> {
    try {
      let stateAsString = await this.persistentStorage.loadFromStore();
      this.model.load(stateAsString);
    } catch (error) {
      throw new Error("previous location failed to load");
    }
  }

  private async track(location: LocationAsset) {
    this.log(
      "starting tracking for " +
        (location as any).locationId +
        " " +
        (location as any).locationType,
    );
    return this.mappingAndTracking!.replaceLocationTracking(() => {
      //// nuke the old tracking
      let locationTracking = new LocationTracking(
        this.scriptComponent,
        this.trackingSceneObject,
        location,
        this._enableLoggingPoseSettling,
      );
      return locationTracking;
    }).then((locationTracking) => {
      locationTracking.onceFound.then(
        async ([trackedLocation, toLensWorldFromTrackedLocation]) => {
          // early complete any quality-based scan in progress
          if (this.requiredQualityOrTrackingAlreadyTrigger) {
            this.requiredQualityOrTrackingAlreadyTrigger.allowCheckpoint =
              this._incrementalMapping; // only allow scan to complete if we are incrementally mapping
            this.requiredQualityOrTrackingAlreadyTrigger.trackingAlready = true;
          }

          // we expect to track either an old location or a new location with no anchors.
          // So the only anchors that will need to be handled are new or updated anchors.
          this.locationPromiseGatherer.resolve([
            trackedLocation,
            toLensWorldFromTrackedLocation,
          ]);

          let newLocation =
            await this.persistentStorage.storeLocation(trackedLocation);
          if (this.model.area.lastTrackedLocation !== newLocation) {
            this.model.area.lastTrackedLocation = newLocation;
            this.triggerSceneSave();
          }
        },
      );
    });
  }

  // sequences
  //
  //    initialize()
  //      (loading)
  //        => onLoaded
  //        => onLoaded
  //        => onLoaded
  //      (in parallel with)
  //        => initialize lens cloud
  //    => onInitialized
  //    ...
  //    => onFound
  //
  //
  //    saveAnchor()
  //    => onSaved
  //
  //
  //    deleteAnchor()
  //    => onDeleted
  //

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

  // implementation
  private model: Model;
  private persistentStorage?: PersistentStorage;

  private saveOperation: Promise<void>;

  private triggerSceneSave() {
    // todo: wait 5s then save
    this.log("triggering save");
    let stateAsString = this.model.save();

    this.saveOperation = this.persistentStorage
      .saveToStore(stateAsString)
      .then(() => {
        this.log("save successful");
      })
      .catch((error) => {
        this.log("save failed: " + error);
      });
  }

  private notifyAnchorLoaded(modelEvent: ModelEvent) {
    let anchorLocation = LocationAsset.getProxy(modelEvent.anchor);

    let continueWithPersistedLocation = (
      persistedLocation: LocationAsset,
    ): void => {
      let sceneObject = global.scene.createSceneObject(
        "anchor-" + anchorLocation.getProxyId(),
      );
      sceneObject.setParent(this.trackingSceneObject);

      sceneObject[SpatialPersistence.anchorIdStash] =
        anchorLocation.getProxyId();
      this.locations[modelEvent.anchor] = anchorLocation;
      this.sceneObjects[modelEvent.anchor] = sceneObject;

      let anchorEvent = new AnchorEvent();
      anchorEvent.location = anchorLocation;
      anchorEvent.sceneObject = this.sceneObjects[modelEvent.anchor];

      this.onLoadedEvent.invoke(anchorEvent);

      this.onceAnyLocationFound
        .then(([trackedLocation, toLensWorldFromTrackedLocation]) => {
          // deletion / unloading can happen
          if (!(modelEvent.anchor in this.locations)) {
            return;
          }
          sceneObject
            .getTransform()
            .setLocalTransform(modelEvent.toTrackedLocationFromAnchor);

          // we are now tracking so have _found_ the anchor
          this.onFoundEvent.invoke({
            location: this.locations[modelEvent.anchor],
            sceneObject: sceneObject,
          });
        })
        .catch((error) => {
          this.onLoadErrorEvent.invoke({
            message: error,
            location: anchorLocation,
          });
        });
    };
    continueWithPersistedLocation(anchorLocation);
  }

  private createAnchorEvent(modelEvent: ModelEvent) {
    let location = this.locations[modelEvent.anchor];
    let sceneObject = this.sceneObjects[modelEvent.anchor];

    let anchorEvent = new AnchorEvent();
    anchorEvent.location = location;
    anchorEvent.sceneObject = sceneObject;

    return anchorEvent;
  }

  private notifyAnchorUnloaded(modelEvent: ModelEvent): AnchorEvent {
    this.log("unloading anchor " + modelEvent.anchor);

    try {
      // model was not updated so no need to save

      // as far as the ui is concerned, the anchor is gone

      // forward the event
      let anchorEvent = this.createAnchorEvent(modelEvent);

      // anchor was unloaded, we no longer care about it
      this.locations[modelEvent.anchor] = undefined;
      this.sceneObjects[modelEvent.anchor] = undefined;

      this.log(
        "invoking onUnloaded due to unloading anchor " + modelEvent.anchor,
      );
      this.onUnloadedEvent.invoke(anchorEvent);
      this.onDeletedEvent.invoke(anchorEvent);

      return anchorEvent;
    } catch (error) {
      this.log("error unloading anchor: " + error + " " + error.stack);
    }
  }

  private notifyAnchorDeleted(modelEvent: ModelEvent) {
    // model was updated, now we need to save
    this.triggerSceneSave();

    // we don't notify UI at this point - anchor was unloaded, and that is forwarded as a delete
    // event to UI
  }

  private notifyAreaActivated(areaEvent: AreaEvent) {
    // At this point all prev anchors are unloaded if there was an area switch
    this.initializeMappingAndTracking()
      .then(async (mappingAndTracking) => {
        this.mappingAndTracking = mappingAndTracking;

        if (areaEvent.isNewArea) {
          this.requiredQualityOrTrackingAlreadyTrigger.allowCheckpoint = true;
        } else {
          let lastTrackedLocation =
            await this.persistentStorage.retrieveLocation(
              areaEvent.area.lastTrackedLocation,
            );
          this.log(
            "tracking area " +
              areaEvent.areaId +
              " with location ID: " +
              (lastTrackedLocation as any).locationId,
          );
          this.track(lastTrackedLocation);
        }

        this.onceAnyLocationFound.then(() => {
          let areaActivatedEvent: AreaActivatedEvent = {
            areaId: areaEvent.areaId,
          };

          this.onAreaActivatedEvent.invoke(areaActivatedEvent);
        });
      })
      .finally(async () => {
        await this.onceAnyLocationFound;
        this.requiredQualityOrTrackingAlreadyTrigger.allowCheckpoint =
          this._incrementalMapping; // only allow first scan to complete if we are incrementally mapping
      });
  }

  private notifyAreaDeactivated(deletedAreaEvent: AreaEvent) {
    this.locationPromiseGatherer = new RetargetableLocationTrackingPromise();
    this.onceAnyLocationFound = this.locationPromiseGatherer.onceLocationFound;

    // Destroy current mapping-tracking session
    if (this.mappingAndTracking) {
      this.mappingAndTracking
        .destroy()
        .then(() => {
          this.mappingAndTracking = undefined;
          this.log(
            deletedAreaEvent.areaId +
              " deactivated - destroyed mapping and tracking session",
          );
        })
        .catch((error) => {
          this.log("error destroying mapping and tracking session: " + error);
          throw new Error(
            "error destroying mapping and tracking session: " + error,
          );
        });
    }

    let areaDeactivatedEvent: AreaDeactivatedEvent = {
      areaId: deletedAreaEvent.areaId,
    };
    this.onAreaDeactivatedEvent.invoke(areaDeactivatedEvent);
  }

  // A9 behaviour - wait for any location to be tracked, then we resolve
  private locationPromiseGatherer = new RetargetableLocationTrackingPromise();
  private onceAnyLocationFound = this.locationPromiseGatherer.onceLocationFound;

  private logger = LoggerVisualization.createLogger("component");
  private log = this.logger.log.bind(this.logger);
}

async function delay(seconds: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, seconds * 1000);
  });
}

const getGuid = () => {
  // return uuid of form xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  let uuid = "";
  let currentChar;
  for (
    currentChar = 0;
    currentChar < /* 36 minus four hyphens */ 32;
    currentChar += 1
  ) {
    switch (currentChar) {
      case 8:
      case 20:
        uuid += "-";
        uuid += ((Math.random() * 16) | 0).toString(16);
        break;
      case 12:
        uuid += "-";
        uuid += "4";
        break;
      case 16:
        uuid += "-";
        uuid += ((Math.random() * 4) | 8).toString(16); // Not the difference for this position
        break;
      default:
        uuid += ((Math.random() * 16) | 0).toString(16);
    }
  }
  return uuid;
};
