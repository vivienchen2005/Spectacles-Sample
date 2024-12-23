import { setTimeout, clearTimeout } from "../Util/debounce";
import { LocationTracking } from "./Tracking";
import { LoggerVisualization } from "./Logging";
import { MapScanning } from "./MapScanning";

// a MappingTrackingSession is guaranteed to have at least one MapScanning or LocationTracking
// and never more than one of each
//
// This is needed in R54 to maintain the underlying VOS tracking session

export class MappingTrackingSession {
  mapScanning?: MapScanning;
  locationTracking?: LocationTracking;
  waitForReleaseInS: number;

  constructor(mapScanning: MapScanning, waitForReleaseInS: number) {
    this.mapScanning = mapScanning;
    this.waitForReleaseInS = waitForReleaseInS;
  }

  destroy(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.mapScanning) {
        this.mapScanning.destroy();
      }
      if (this.locationTracking) {
        this.locationTracking.destroy();
      }
      this.mapScanning = null;
      this.locationTracking = null;
      setTimeout(() => {
        resolve();
      }, this.waitForReleaseInS * 1000);
    });
  }

  private waitingForMapScanning: ((MapScanning) => void)[] = [];
  private waitingForLocationTracking: ((LocationTracking) => void)[] = [];

  flushMapScanningActions() {
    if (this.mapScanning) {
      while (this.waitingForMapScanning.length) {
        let next = this.waitingForMapScanning.shift()!;
        next(this.mapScanning);
      }
    }
  }
  flushLocationTrackingActions() {
    if (this.locationTracking) {
      while (this.waitingForLocationTracking.length) {
        let next = this.waitingForLocationTracking.shift()!;
        next(this.locationTracking);
      }
    }
  }

  withMapScanning(): Promise<MapScanning> {
    return new Promise<MapScanning>((resolve, reject) => {
      this.waitingForMapScanning.push(resolve);
      this.flushMapScanningActions();
    });
  }

  withLocationTracking(): Promise<LocationTracking> {
    return new Promise<LocationTracking>((resolve, reject) => {
      this.waitingForLocationTracking.push(resolve);
      this.flushLocationTrackingActions();
    });
  }

  replaceMapScanning(
    mapScanningReplacer: () => MapScanning,
  ): Promise<MapScanning> {
    // we can only replace the mapping session if we have a LocatedAtComponent
    return this.withLocationTracking().then(
      (locationTracking: LocationTracking) => {
        return new Promise<MapScanning>((resolve, reject) => {
          if (this.mapScanning) {
            this.log("replacing mapScanning");

            this.mapScanning.destroy();

            this.mapScanning = null;
            setTimeout(() => {
              this.mapScanning = mapScanningReplacer();
              this.waitingForMapScanning.push(resolve);
              this.flushMapScanningActions();
            }, this.waitForReleaseInS * 1000);
          } else {
            this.log("initializing mapScanning");

            this.mapScanning = mapScanningReplacer();
            this.waitingForMapScanning.push(resolve);
            this.flushMapScanningActions();
          }
        });
      },
    );
  }

  replaceLocationTracking(
    locationTrackingReplacer: () => LocationTracking,
  ): Promise<LocationTracking> {
    // we can only replace the LocationTracking if we have a MappingSession
    return this.withMapScanning().then((mapScanning: MapScanning) => {
      return new Promise<LocationTracking>((resolve, reject) => {
        if (this.locationTracking) {
          this.log("replacing tracking");

          this.locationTracking.destroy();

          this.locationTracking = null;
          setTimeout(() => {
            this.locationTracking = locationTrackingReplacer();
            this.waitingForLocationTracking.push(resolve);
            this.flushLocationTrackingActions();
          }, this.waitForReleaseInS * 1000);
        } else {
          this.log("initializing tracking");

          this.locationTracking = locationTrackingReplacer();
          this.waitingForLocationTracking.push(resolve);
          this.flushLocationTrackingActions();
        }
      });
    });
  }

  private logger = LoggerVisualization.createLogger("mappingtracking");
  private log = (message: string) => this.logger.log(message);
}
