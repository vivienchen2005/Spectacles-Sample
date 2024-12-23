import Event from "../Util/Event";
import { LoggerVisualization } from "./Logging";

export class Localization {
  location: string; // custom LocationAsset serialized id
  toLocationFromAnchor: mat4 = mat4.identity();

  toJS(): object {
    return {
      location: this.location,
      toLocationFromAnchor: Model.mat4toJS(this.toLocationFromAnchor),
    };
  }

  static makeLocalization(obj: object): Localization {
    let loc = new Localization();
    loc.location = obj["location"];
    loc.toLocationFromAnchor = Model.makeMat4(obj["toLocationFromAnchor"]);
    return loc;
  }
}

export class Anchor {
  location: string; // proxy LocationAsset serialized id
  localizations: Localization[];

  toJS(): object {
    let localizations = [];
    for (let localization of this.localizations) {
      localizations.push(localization.toJS());
    }
    return {
      location: this.location,
      localizations: localizations,
    };
  }

  static makeAnchor(obj: object): Anchor {
    let anchor = new Anchor();
    anchor.location = obj["location"] as string;
    let localizations: Localization[] = [];
    for (let localization of obj["localizations"] as object[]) {
      localizations.push(Localization.makeLocalization(localization));
    }
    anchor.localizations = localizations;
    return anchor;
  }
}

export class AreaEvent {
  area: Area;
  areaId: string;
  isNewArea: boolean;
}

export class Area {
  name: string;
  anchors: { [key: string]: Anchor } = {};
  lastTrackedLocation?: string;

  toJS(): object {
    let anchors = {};
    for (let anchor in this.anchors) {
      anchors[anchor] = this.anchors[anchor].toJS();
    }
    let object = {
      name: this.name,
      anchors: anchors,
    };
    if (this.lastTrackedLocation) {
      object["lastTrackedLocation"] = this.lastTrackedLocation;
    }
    return object;
  }

  static makeArea(obj: object): Area {
    let area = new Area();
    area.name = "name" in obj ? (obj["name"] as string) : "default";
    let anchors: { [key: string]: Anchor } = {};
    if ("anchors" in obj) {
      for (let anchor in obj["anchors"] as { [key: string]: object }) {
        anchors[anchor] = Anchor.makeAnchor(obj.anchors[anchor]);
      }
    }
    area.anchors = anchors;
    if ("lastTrackedLocation" in obj) {
      area.lastTrackedLocation = obj.lastTrackedLocation as string;
    }
    return area;
  }

  static makeAreas(obj: object): { [key: string]: Area } {
    let areas: { [key: string]: Area } = {};
    for (let area in obj as { [key: string]: Area }) {
      areas[area] = Area.makeArea(obj[area]);
    }
    return areas;
  }
}

export class ModelEvent {
  anchor: string;
  trackedLocation: string;
  toTrackedLocationFromAnchor?: mat4;
}

export class Model {
  areas: { [key: string]: Area } = {};
  currentAreaId: string | null = null;

  get area(): Area | null {
    return this.currentAreaId ? this.areas[this.currentAreaId] : null;
  }

  toJson(): string {
    let areas = {};
    for (let areaKey in this.areas) {
      areas[areaKey] = this.areas[areaKey].toJS();
    }

    return JSON.stringify({
      areas: areas,
      currentAreaId: this.currentAreaId,
    });
  }

  static fromJson(json: string): Model {
    let object = JSON.parse(json);
    let model = new Model();
    let areas: { [key: string]: Area } = {};

    model.areas = "areas" in object ? Area.makeAreas(object.areas) : areas;
    model.currentAreaId =
      "currentAreaId" in object ? (object.currentAreaId as string) : null;

    return model;
  }

  private onAnchorLoadedEvent = new Event<ModelEvent>();
  public readonly onAnchorLoaded = this.onAnchorLoadedEvent.publicApi();

  private onAnchorUnloadedEvent = new Event<ModelEvent>();
  public readonly onAnchorUnloaded = this.onAnchorUnloadedEvent.publicApi();

  private onAnchorDeletedEvent = new Event<ModelEvent>();
  public readonly onAnchorDeleted = this.onAnchorDeletedEvent.publicApi();

  private onAreaActivatedEvent = new Event<AreaEvent>();
  public readonly onAreaActivated = this.onAreaActivatedEvent.publicApi();

  private onAreaDeactivatedEvent = new Event<AreaEvent>();
  public readonly onAreaDeactivated = this.onAreaDeactivatedEvent.publicApi();

  createArea(areaID: string) {
    if (areaID in this.areas) {
      return;
    }

    this.log("creating new area: " + areaID);
    let area = new Area();
    area.name = areaID;
    this.areas[areaID] = area;
  }

  selectArea(areaId: string | null) {
    if (areaId == this.currentAreaId) {
      return;
    }

    this.deactivateArea();
    this.currentAreaId = areaId;
    this.activateArea();
  }

  deactivateArea() {
    if (!this.currentAreaId) {
      return;
    }
    this.unloadAnchorsForCurrentArea();

    let currentAreaEvent: AreaEvent = {
      area: this.area,
      isNewArea: false,
      areaId: this.currentAreaId,
    };
    this.onAreaDeactivatedEvent.invoke(currentAreaEvent);
  }

  private activateArea() {
    this.log("Activating area " + this.currentAreaId);
    if (!this.currentAreaId) {
      return;
    }

    if (!(this.currentAreaId in this.areas)) {
      this.createArea(this.currentAreaId);
    }

    let isNewArea = this.areas[this.currentAreaId].lastTrackedLocation
      ? false
      : true;

    this.loadAnchorsForCurrentArea();

    let requestedAreaEvent: AreaEvent = {
      area: this.area,
      areaId: this.currentAreaId,
      isNewArea: isNewArea,
    };
    this.onAreaActivatedEvent.invoke(requestedAreaEvent);
  }

  loadAnchorsForCurrentArea(isNewArea?: boolean) {
    for (let anchorId in this.area.anchors) {
      let anchor = this.area.anchors[anchorId];
      // A9: we only expect one localization per anchor
      let localization = anchor.localizations[0];
      let modelEvent: ModelEvent = {
        anchor: anchor.location,
        trackedLocation: localization.location,
        toTrackedLocationFromAnchor: localization.toLocationFromAnchor,
      };
      this.onAnchorLoadedEvent.invoke(modelEvent);
    }
  }

  load(asString: string) {
    try {
      if (this.currentAreaId) {
        throw new Error(
          "Model already loaded - current area " + this.currentAreaId,
        );
      }
      let model = Model.fromJson(asString);
      this.areas = model.areas;
      this.currentAreaId = null; // !!! model.currentAreaId;
      // !!! for the moment we do not support automatically storing / restoring the area to activate

      this.log("Current active area " + this.currentAreaId);
    } catch (e) {
      this.log("Error loading model: " + e + " + " + e.stack);
    }

    // load will finish without selecting an area
  }

  save(): string {
    return this.toJson();
  }

  unloadAnchorsForCurrentArea() {
    this.log("Unloading anchors for current area " + this.currentAreaId);
    for (let anchorId in this.area.anchors) {
      this.log("Unloading anchor: " + anchorId);
      let anchor = this.area.anchors[anchorId];
      // A9: we only expect one localization per anchor
      let localization = anchor.localizations[0];
      let modelEvent: ModelEvent = {
        anchor: anchor.location,
        trackedLocation: localization.location,
        toTrackedLocationFromAnchor: localization.toLocationFromAnchor,
      };
      this.onAnchorUnloadedEvent.invoke(modelEvent);
    }
  }

  async saveAnchor(
    location: string,
    trackedLocation: string,
    toTrackedFromAnchor: mat4,
  ): Promise<ModelEvent> {
    this.log(
      "Saving anchor: " +
        location +
        " at " +
        trackedLocation +
        " with " +
        toTrackedFromAnchor.toString(),
    );
    let anchor = this.area.anchors[location];
    if (anchor === undefined) {
      anchor = new Anchor();
      anchor.localizations = [new Localization()];
      this.area.anchors[location] = anchor;
    }
    anchor.location = location;
    let localization = new Localization();
    localization.location = trackedLocation;
    localization.toLocationFromAnchor = toTrackedFromAnchor;
    anchor.localizations[0] = localization;
    this.area.anchors[location] = anchor;
    let modelEvent: ModelEvent = {
      anchor: location,
      trackedLocation: anchor.localizations[0].location,
      toTrackedLocationFromAnchor: toTrackedFromAnchor,
    };

    return modelEvent;
  }

  async deleteAnchor(location: string): Promise<ModelEvent> {
    try {
      this.log("Deleting anchor: " + location);

      let anchor = this.area.anchors[location];
      let modelEvent: ModelEvent = {
        anchor: location,
        trackedLocation: anchor.localizations[0].location,
        toTrackedLocationFromAnchor:
          anchor.localizations[0].toLocationFromAnchor,
      };
      this.onAnchorUnloadedEvent.invoke(modelEvent);
      delete this.area.anchors[location];
      this.onAnchorDeletedEvent.invoke(modelEvent);

      return modelEvent;
    } catch (e) {
      this.log("Error deleting anchor: " + e + " " + e.stack);
      throw new Error("Error deleting anchor: " + e);
    }
  }

  async reset() {
    if (!this.currentAreaId) {
      return;
    }
    for (let location in this.area.anchors) {
      let modelEvent = await this.deleteAnchor(location);
    }
    this.area.anchors = {};
    this.area.lastTrackedLocation = null;

    this.deactivateArea();
    this.activateArea();
  }

  // utilities
  static vec4toJS(v: vec4): number[] {
    let vector4 = [v.x, v.y, v.z, v.w];
    return vector4;
  }

  static mat4toJS(ltm: mat4): number[][] {
    let matrix4 = [
      this.vec4toJS(ltm.column0),
      this.vec4toJS(ltm.column1),
      this.vec4toJS(ltm.column2),
      this.vec4toJS(ltm.column3),
    ];
    return matrix4;
  }

  static makeVec4(o: number[]): vec4 {
    return new vec4(o[0], o[1], o[2], o[3]);
  }

  static makeMat4(ltmJS: number[][]): mat4 {
    let ltm = new mat4();
    ltm.column0 = this.makeVec4(ltmJS[0]);
    ltm.column1 = this.makeVec4(ltmJS[1]);
    ltm.column2 = this.makeVec4(ltmJS[2]);
    ltm.column3 = this.makeVec4(ltmJS[3]);
    return ltm;
  }

  private logger = LoggerVisualization.createLogger("model");
  private log = this.logger.log.bind(this.logger);
}
