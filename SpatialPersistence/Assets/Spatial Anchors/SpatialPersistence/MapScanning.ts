import { setTimeout, clearTimeout } from "../Util/debounce";
import Event from "../Util/Event";
import { LoggerVisualization } from "./Logging";

// !!! fix predeclared interface
export interface MappingSession_FIXED extends MappingSession {
  checkpoint(): void;
  quality: number;
}

// -- MAPPING SESSION EVENT CLASSES
export type MappingStatusEvent = {
  quality: number;
  capacityUsed: number;
};

// LensStudio Mock for MappingSession
class MockMappingSession {
  canCheckpoint: boolean = true;
  onMapped: any; // event1<LocationAsset, void> is not recognized outside Lens Studio
  quality: number = 1.0;
  capacityUsed: number = 0.07; // a value lower than 'maxAllowedCapacityUsed'
  wearableMinimumSize: number;
  wearableMaximumSize: number;
  handheldMinimumSize: number;
  handheldMaximumSize: number;
  checkpoint(): void {}
  cancel(): void {}
  onCapacityUsedAtLimit: Event<void>;
  onQualityAcceptable: Event<void>;
  throttling: any; // MappingSession.MappingThrottling enum type
  wearableAcceptableRawCapacity: number;
  wearableAllowEarlyCheckpoint: boolean;
  isOfType() {}
  isSame() {}
  getTypeName() {}
}

export class Timeout {
  timeoutInS: number;
}
export class RequiredQualityOrTrackingAlready {
  quality: number;
  allowCheckpoint: boolean;
  trackingAlready: boolean;
}

// -- MAPPING SESSION
export class MapScanning {
  private onMappingStatusEvent = new Event<MappingStatusEvent>();
  public readonly onMappingStatus = this.onMappingStatusEvent.publicApi();
  public readonly maxAllowedCapacityUsed: number = 0.1; // finetuned to reduce the map download lag to <1s
  // TODO (oelkhatib): Remove the hysteresis factor as soon as map saving
  // is properly async on a background thread and the map size estimate is
  // fixed.
  public readonly capacityHysteresisFactor: number = 1.3;

  locationCloudStorageModule: LocationCloudStorageModule;
  mappingSession?: MappingSession_FIXED | MockMappingSession;
  activelyMapping: boolean = false;
  private cancelCheckpoint: any;
  private updateEvent: SceneEvent;

  constructor(
    locationCloudStorageModule: LocationCloudStorageModule,
    script: ScriptComponent,
  ) {
    this.locationCloudStorageModule = locationCloudStorageModule;

    this.updateEvent = script.createEvent("UpdateEvent");
    this.updateEvent.bind(this.notifyUpdate.bind(this));

    var mappingOptions = LocatedAtComponent.createMappingOptions();
    mappingOptions.locationCloudStorageModule = this.locationCloudStorageModule;
    mappingOptions.location = LocationAsset.getAROrigin();

    if (global.deviceInfoSystem.isEditor()) {
      this.mappingSession = new MockMappingSession();
    } else {
      this.mappingSession = LocatedAtComponent.createMappingSession(
        mappingOptions,
      ) as MappingSession_FIXED;
    }

    this.log("Scanning start");
    this.activelyMapping = true;
  }

  async checkpoint(
    completionCriterion: Timeout | RequiredQualityOrTrackingAlready,
  ): Promise<LocationAsset> {
    this.log("checkpoint trigger requested");

    let checkpointed = new Promise<LocationAsset>((resolve, reject) => {
      if (global.deviceInfoSystem.isEditor()) {
        resolve(LocationAsset.getAROrigin());
      } else {
        let onCheckpointedRegistration = this.mappingSession.onMapped.add(
          (location: LocationAsset) => {
            this.log("checkpoint completed");

            this.mappingSession.onMapped.remove(onCheckpointedRegistration);

            resolve(location);
          },
        );
      }
    });

    if (completionCriterion instanceof Timeout) {
      await this.triggerCheckpointWithTimeout(completionCriterion as Timeout);
    } else {
      await this.triggerCheckpointWithRequiredQuality(
        completionCriterion as RequiredQualityOrTrackingAlready,
      );
    }

    return checkpointed;
  }

  destroy() {
    this.log("destroying");
    this.activelyMapping = false;
    this.mappingSession = null;
    clearTimeout(this.cancelCheckpoint);
  }

  private notifyUpdate(): void {
    if (this.activelyMapping) {
      let capacityUsed = this.mappingSession.capacityUsed;
      let quality = this.mappingSession.quality;

      this.onMappingStatusEvent.invoke({
        capacityUsed: capacityUsed,
        quality: quality,
      } as MappingStatusEvent);
    }
  }

  private async triggerCheckpointWithTimeout(timeout: Timeout): Promise<void> {
    return new Promise((resolve, reject) => {
      var canCheckpoint = this.mappingSession.canCheckpoint;
      this.log("timeout - canCheckpoint:" + canCheckpoint.toString());

      this.cancelCheckpoint = setTimeout(() => {
        this.log("timeout - triggering checkpoint");
        this.activelyMapping = false;
        this.mappingSession.checkpoint();
        resolve();
      }, timeout.timeoutInS * 1000);
    });
  }

  private async triggerCheckpointWithRequiredQuality(
    requiredQuality: RequiredQualityOrTrackingAlready,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      var canCheckpoint = this.mappingSession.canCheckpoint;
      this.log("quality - canCheckpoint:" + canCheckpoint.toString());

      let subscription = this.onMappingStatus.add(
        (status: MappingStatusEvent) => {
          // TODO (oelkhatib): Remove the hysteresis factor as soon as map
          // saving is properly async on a background thread and the map size
          // estimate is fixed.
          // NOTE: Map sizes tend to slightly go down when saved which makes
          // this check sensitive to the map size threshold. To prevent
          // additional lag when saving maps that are almost at the size
          // threshold, we add a hysteresis factor.
          if (
            ((status.quality >= requiredQuality.quality &&
              this.activelyMapping) ||
              requiredQuality.trackingAlready) &&
            requiredQuality.allowCheckpoint &&
            status.capacityUsed * this.capacityHysteresisFactor <
              this.maxAllowedCapacityUsed
          ) {
            this.log(
              "quality - triggering checkpoint - trackingAlready: " +
                requiredQuality.trackingAlready.toString(),
            );
            this.onMappingStatusEvent.remove(subscription);
            this.activelyMapping = false;
            this.mappingSession.checkpoint();
            resolve();
          }
        },
      );
    });
  }

  private logger = LoggerVisualization.createLogger("mapper");
  private log = (message: string) => this.logger.log(message);
}
