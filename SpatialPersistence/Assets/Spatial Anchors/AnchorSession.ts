/**
 * ## Anchors
 * Define and track poses in world space.
 */

import Event, { PublicApi } from "./Util/Event";
import {
  SpatialPersistence,
  AnchorEvent,
  AnchorError,
} from "./SpatialPersistence/SpatialPersistence";
import { Anchor, State, UserAnchor } from "./Anchor";
import { WorldAnchor } from "./WorldAnchor";
import { AlignmentProvider } from "./AlignmentProvider";
import { setTimeout } from "./Util/debounce";

/**
 * Types of anchors that will be tracked in a session, specifically
 * those for which known instances will be automatically enumerated
 */
export type SessionAnchorTypes = typeof WorldAnchor | typeof UserAnchor;

/**
 * Options for locating and persisting nearby anchors, past and new.
 */
export class AnchorSessionOptions {
  /**
   * Named scope for storing and retrieving anchors.
   * A13 - only one may be active at a time.
   */
  area: string = "default";

  /**
   * Anchor types to look for.
   * Default to at least searching for WorldAnchors.
   */
  scanForWorldAnchors: boolean = false;
}

/**
 * Storage context for anchors.
 */
export class AnchorSession {
  /**
   * Named scope for storing and retrieving anchors.
   */
  readonly area: string;

  /**
   * Notifies of anchors becoming available within area scope.
   */
  private onAnchorNearbyEvent = new Event<Anchor>();
  public readonly onAnchorNearby = this.onAnchorNearbyEvent.publicApi();

  private onAnchorDeletedEvent = new Event<UserAnchor>();
  public readonly onAnchorDeleted = this.onAnchorDeletedEvent.publicApi();

  private _notifiesOnNearbyWorldAnchors: boolean = false;
  private _anchors: Map<string, UserAnchor> = new Map<string, Anchor>();

  private _spatialPersistence: SpatialPersistence;
  private _onClose: (store: AnchorSession) => Promise<void>;
  private _anchorCount: number = 0;
  private _registrationUnsubscribes: (() => void)[] = [];
  private _isClosing: boolean = false;

  constructor(
    options: AnchorSessionOptions,
    spatialPersistence: SpatialPersistence,
    onClose: (store: AnchorSession) => Promise<void>,
  ) {
    this.area = options.area;
    this._isClosing = false;
    this._onClose = onClose;
    this._notifiesOnNearbyWorldAnchors = options.scanForWorldAnchors;
    this._spatialPersistence = spatialPersistence;
    this._registrationUnsubscribes.push(
      this._spatialPersistence.onLoaded.add(this._onLoaded.bind(this)),
    );
    this._registrationUnsubscribes.push(
      this._spatialPersistence.onLoadError.add(this._onLoadError.bind(this)),
    );

    this._registrationUnsubscribes.push(
      this._spatialPersistence.onFound.add(this._onFound.bind(this)),
    );
    this._registrationUnsubscribes.push(
      this._spatialPersistence.onLost.add(this._onLost.bind(this)),
    );
    this._registrationUnsubscribes.push(
      this._spatialPersistence.onUnloaded.add(this._onUnloaded.bind(this)),
    );
    this._registrationUnsubscribes.push(
      this._spatialPersistence.onDeleted.add(this._onDeleted.bind(this)),
    );

    // finish construction and give receivers a chance to subscribe to activation events before selecting area
    setTimeout(() => {
      this._spatialPersistence.selectArea(this.area);
    }, 0.0);
  }

  /**
   * Stop trying to find or track anchors in the area.
   */
  async close(): Promise<void> {
    this._isClosing == true;
    await this._onClose(this);
    this._registrationUnsubscribes.forEach((unsubscribe) => {
      unsubscribe();
    });
    this._registrationUnsubscribes = [];
  }

  /**
   * Save an anchor in storage after user modifications.
   */
  async saveAnchor(anchor: UserAnchor): Promise<UserAnchor> {
    this._checkIsNotClosing();

    if (!(anchor instanceof WorldAnchor)) {
      throw new Error("Only WorldAnchors supported");
    }

    let anchorEvent = await this._spatialPersistence.saveAnchor(
      (anchor as WorldAnchor)._sceneObject,
    );

    return anchor;
  }

  /**
   * Delete anchor from the storage context.
   */
  async deleteAnchor(anchor: UserAnchor): Promise<UserAnchor> {
    this._checkIsNotClosing();

    if (!(anchor instanceof WorldAnchor)) {
      throw new Error("Only WorldAnchors supported");
    }

    let anchorEvent = await this._spatialPersistence.deleteAnchor(
      (anchor as WorldAnchor)._sceneObject,
    );

    return anchor;
  }

  /**
   * Delete all anchors and reset ability to track in current area.
   */
  async reset(): Promise<void> {
    this._checkIsNotClosing();

    await this._spatialPersistence.resetArea();
    this._anchors = new Map<string, Anchor>();
  }

  /**
   * Create a world anchor.
   *
   * @param toWorldFromAnchor - World pose of anchor. 'World' is the coordinate system of scene graph root, compatible with a child rendering camera positioned by DeviceTracking set to world.
   */
  async createWorldAnchor(
    toWorldFromAnchor: mat4,
    alignment?: AlignmentProvider,
  ): Promise<WorldAnchor> {
    this._checkIsNotClosing();

    let anchorSceneObject: SceneObject = global.scene.createSceneObject(
      "_anchor_" + this._anchorCount++,
    );
    anchorSceneObject.getTransform().setWorldTransform(toWorldFromAnchor);

    try {
      let anchorEvent =
        await this._spatialPersistence.createAnchor(anchorSceneObject);

      let anchor = new WorldAnchor(
        anchorEvent.location,
        anchorSceneObject,
        alignment,
      );

      // having waited on this._spatialPersistence.createAnchor
      // anchor on creation is found, with nothing watching on handlers yet
      // via anchor resolved from AnchorSession.createWorldAnchor
      anchor.state = State.Found;

      this._anchors.set(anchor.id, anchor);

      return anchor;
    } catch (error) {
      throw new Error("Failed to create anchor: " + error);
    }
  }

  // implementation details
  private _checkIsNotClosing() {
    if (this._isClosing === true) {
      throw new Error("Session is closing");
    }
  }

  private _onLoaded(event: AnchorEvent) {
    // todo (gbakker) - need to support alignment serialization
    let anchor = new WorldAnchor(event.location, event.sceneObject);
    this._anchors.set(event.location.getProxyId(), anchor);
    // todo (gbakker) - as specced atm anchor will be ready to track, we should verify this
    anchor.state = State.Ready;
    if (this._notifiesOnNearbyWorldAnchors) {
      this.onAnchorNearbyEvent.invoke(anchor);
    }
  }

  private _onLoadError(event: AnchorError) {
    // it doesn't exist yet and never will o_O
    // todo (gbakker) - need to support alignment serialization
    let anchor = new WorldAnchor(event.location);
    this._anchors.set(event.location.getProxyId(), anchor);
    anchor.state = State.Error;

    if (this._notifiesOnNearbyWorldAnchors) {
      this.onAnchorNearbyEvent.invoke(anchor);
    }
  }

  private _onUnloaded(event: AnchorEvent) {
    this._anchors.get(event.location.getProxyId()).state = State.CannotTrack;
  }

  private _onFound(event: AnchorEvent) {
    this._anchors.get(event.location.getProxyId()).state = State.Found;
  }

  private _onLost(event: AnchorEvent) {
    this._anchors.get(event.location.getProxyId()).state = State.Lost;
  }

  private _onDeleted(event: AnchorEvent) {
    let anchor = this._anchors.get(event.location.getProxyId());
    this.onAnchorDeletedEvent.invoke(anchor);
  }
}
