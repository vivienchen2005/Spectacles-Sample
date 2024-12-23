import { setTimeout, clearTimeout } from "../Util/debounce";
import { LoggerVisualization } from "./Logging";

interface LocationStoreState {
  resolve: (locationCloudStore: LocationCloudStore) => void;
  reject: (any) => void;
}

abstract class IStorage {
  static readonly LocationModelStateKeyName = "locationModelState";

  abstract save(stateAsString: string): Promise<void>;
  abstract load(): Promise<string>;

  private logger = LoggerVisualization.createLogger("persistence");
  public log = this.logger.log.bind(this.logger);
}

class RemoteStorage extends IStorage {
  private waitingForLocationStore: LocationStoreState[] = [];

  locationCloudStore?: LocationCloudStore;
  errorInCloudStore?: string;
  locationCloudStorageModule: LocationCloudStorageModule;
  connectedLensModule: ConnectedLensModule;

  constructor(locationCloudStorageModule: LocationCloudStorageModule) {
    super();
    this.locationCloudStorageModule = locationCloudStorageModule;

    this.connectToLocationCloudStore();
  }

  connectToLocationCloudStore() {
    let location = LocationAsset.getProxy("global");
    let options = LocationCloudStorageOptions.create();
    options.location = location;

    options.onDiscoveredNearby.add((_, cloudStore) => {
      this.locationCloudStore = cloudStore;
      this.flushLocationStorageActions();
    });

    options.onError.add((err, message) => {
      let errorMessage =
        "CloudStorageModule: failed to get location store: " + err + message;
      this.errorInCloudStore = errorMessage;
      this.flushLocationStorageActions();
      this.log(errorMessage);
    });

    this.locationCloudStorageModule.getNearbyLocationStores(options);
  }

  private writeOptions: CloudStorageWriteOptions =
    RemoteStorage.makeCloudStorageWriteOptions();
  static makeCloudStorageWriteOptions(): CloudStorageWriteOptions {
    let options = CloudStorageWriteOptions.create();
    options.scope = StorageScope.User;
    return options;
  }

  flushLocationStorageActions() {
    if (this.locationCloudStore) {
      while (this.waitingForLocationStore.length) {
        let next = this.waitingForLocationStore.shift()!;
        next.resolve(this.locationCloudStore);
      }
    } else if (this.errorInCloudStore) {
      while (this.waitingForLocationStore.length) {
        let next = this.waitingForLocationStore.shift()!;
        next.reject(this.errorInCloudStore);
      }
    }
  }

  withLocationCloudStore(): Promise<LocationCloudStore> {
    return new Promise<LocationCloudStore>((resolve, reject) => {
      let storeState: LocationStoreState = { resolve: resolve, reject: reject };
      this.waitingForLocationStore.push(storeState);
      this.flushLocationStorageActions();
    });
  }

  saveToCloudStore(stateAsString: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.withLocationCloudStore().then((locationCloudStore) => {
        locationCloudStore.setValue(
          RemoteStorage.LocationModelStateKeyName,
          stateAsString,
          this.writeOptions,
          (): void => {
            resolve();
          },
          (code, description): void => {
            reject(new Error(description));
          },
        );
      });
    });
  }

  save(stateAsString: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.saveToCloudStore(stateAsString)
        .then(() => {
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  private readOptions: CloudStorageReadOptions =
    RemoteStorage.makeCloudStorageReadOptions();
  static makeCloudStorageReadOptions(): CloudStorageReadOptions {
    let options = CloudStorageReadOptions.create();
    options.scope = StorageScope.User;
    return options;
  }

  loadFromCloudStore(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.withLocationCloudStore()
        .then((locationCloudStore) => {
          locationCloudStore.getValue(
            RemoteStorage.LocationModelStateKeyName,
            this.readOptions,
            (key, value): void => {
              let stateAsString = value as string;
              if (!stateAsString) {
                let error = "[loadFromCloudStore]: no state in cloud storage";
                this.log(error);
                reject(new Error(error));
              } else {
                this.log("[loadFromCloudStore]: load successful");
                resolve(stateAsString);
              }
            },
            (code, description): void => {
              let error = "load fail: " + code + " " + description;
              this.log("[loadFromCloudStore] Error:" + error);
              reject(new Error(error));
            },
          );
        })
        .catch((error) => {
          this.log("[loadFromCloudStore] Error:" + error);
          reject(error);
        });
    });
  }

  load(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.loadFromCloudStore()
        .then((stateAsString) => {
          resolve(stateAsString);
        })
        .catch((error) => {
          this.log("[loadFromCloud] Error: " + error);
          reject(error);
        });
    });
  }
}

class LocalStorage extends IStorage {
  constructor() {
    super();
  }

  save(stateAsString: string): Promise<void> {
    return new Promise<void>(() => {
      global.persistentStorageSystem.store.putString(
        LocalStorage.LocationModelStateKeyName,
        stateAsString,
      );
      Promise.resolve();
    });
  }

  load(): Promise<string> {
    this.log("[local] loading");

    return new Promise<string>((resolve, reject) => {
      let stateAsString = global.persistentStorageSystem.store.getString(
        LocalStorage.LocationModelStateKeyName,
      ) as string;
      if (stateAsString == "") {
        let errorMsg = "no local state found";
        this.log(errorMsg);
        reject(new Error(errorMsg));
      } else {
        this.log("local load successful");
        resolve(stateAsString);
      }
    });
  }
}

export class PersistentStorage {
  useLocalStorage: boolean;
  locationCloudStorageModule: LocationCloudStorageModule;
  storage: IStorage;

  constructor(
    useLocalStorage: boolean,
    locationCloudStorageModule: LocationCloudStorageModule,
  ) {
    this.useLocalStorage = useLocalStorage;
    this.locationCloudStorageModule = locationCloudStorageModule;

    if (this.useLocalStorage) {
      this.storage = new LocalStorage();
    } else {
      this.storage = new RemoteStorage(locationCloudStorageModule);
    }
  }

  retrieveLocation(serializedLocationId: string): Promise<LocationAsset> {
    if (global.deviceInfoSystem.isEditor()) {
      return Promise.resolve(LocationAsset.getAROrigin());
    }
    return new Promise<LocationAsset>((resolve, reject) => {
      this.locationCloudStorageModule.retrieveLocation(
        serializedLocationId,
        (location: LocationAsset) => {
          resolve(location);
        },
        (error: string) => {
          reject(
            new Error(
              "[LocationCloudStorageModule] failed to get location - " +
                serializedLocationId +
                " " +
                error,
            ),
          );
        },
      );
    });
  }

  storeLocation(location: LocationAsset): Promise<string> {
    if (global.deviceInfoSystem.isEditor()) {
      return Promise.resolve("ls-preview-location-id");
    }
    return new Promise<string>((resolve, reject) => {
      this.locationCloudStorageModule.storeLocation(
        location,
        (serializedLocationId: string) => {
          resolve(serializedLocationId);
        },
        (err: string) => {
          reject(
            new Error(
              "[LocationCloudStorageModule] failed to store location - " + err,
            ),
          );
        },
      );
    });
  }

  // Model storage
  async saveToStore(stateAsString: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.storage
        .save(stateAsString)
        .then(() => {
          this.log("save successful");
          resolve();
        })
        .catch((error) => {
          this.log("save failed: " + error);
          reject(error);
        });
    });
  }

  async loadFromStore(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.storage
        .load()
        .then((stateAsString) => {
          this.log("load successful");
          resolve(stateAsString);
        })
        .catch((error) => {
          this.log("load failed: " + error);
          reject(error);
        });
    });
  }

  private logger = LoggerVisualization.createLogger("persistence");
  private log = this.logger.log.bind(this.logger);
}
