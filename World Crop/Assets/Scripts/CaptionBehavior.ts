import { WebView } from "../Web View/WebView";
import animate, { CancelSet } from "SpectaclesInteractionKit/Utils/animate";

@component
export class CaptionBehavior extends BaseScriptComponent {
  @input captionText: Text;
  @input scaleObj: SceneObject;
  @input webView: WebView;

  private trans: Transform;
  private scaleTrans: Transform;
  private webAnchorTrans: Transform;
  private webViewRend: Image;
  private startPos: vec3;
  private startWebScale: number;
  private website = "";
  private websiteLoaded = false;

  private scaleCancel: CancelSet = new CancelSet();
  private webviewCancel: CancelSet = new CancelSet();

  onAwake() {
    this.trans = this.getSceneObject().getTransform();
    this.scaleTrans = this.scaleObj.getTransform();
    this.scaleTrans.setLocalScale(vec3.zero());
    this.webAnchorTrans = this.webView
      .getSceneObject()
      .getParent()
      .getTransform();
    this.createEvent("OnStartEvent").bind(this.start.bind(this));
  }

  start() {
    this.webViewRend = this.webView
      .getSceneObject()
      .getChild(0)
      .getComponent("Component.Image");
    this.webViewRend.enabled = false;
  }

  openCaption(text: string, pos: vec3, rot: quat) {
    var caption = "";
    var textArr = text.split(",");
    if (textArr.length > 1) {
      caption = textArr[0];
      this.website = textArr[1];
    } else {
      caption = textArr[0];
    }

    this.startPos = pos;
    this.startWebScale = this.webViewRend.getTransform().getWorldScale().y;
    this.captionText.text = caption;
    this.trans.setWorldPosition(pos);
    this.trans.setWorldRotation(rot);
    this.webAnchorTrans.setWorldPosition(pos);
    this.webAnchorTrans.setWorldRotation(rot);
    this.trans.setWorldScale(vec3.one().uniformScale(0.5));
    //animate in caption
    if (this.scaleCancel) this.scaleCancel.cancel();
    animate({
      easing: "ease-out-elastic",
      duration: 1,
      update: (t: number) => {
        this.scaleTrans.setLocalScale(
          vec3.lerp(vec3.zero(), vec3.one().uniformScale(1.33), t)
        );
      },
      ended: null,
      cancelSet: this.scaleCancel,
    });
  }

  loadWebSite() {
    if (this.website == "") return;
    print("LOADING WEBSITE: " + this.website);
    if (this.webViewRend.enabled) {
      this.closeWebView();
    } else {
      if (!this.websiteLoaded) {
        this.websiteLoaded = true;
        this.webView.loadURL(this.website);
        //TODO: add onLoaded callback once available, for now just open
        this.openWebView();
      } else {
        this.openWebView();
      }
    }
  }

  closeWebView() {
    this.webViewRend.enabled = false;
    print("Closing WEBVIEW...");
    var currCaptionPos = this.trans.getWorldPosition();
    animate({
      easing: "ease-out-elastic",
      duration: 1,
      update: (t: number) => {
        this.trans.setWorldPosition(
          vec3.lerp(currCaptionPos, this.startPos, t)
        );
      },
      ended: null,
      cancelSet: this.webviewCancel,
    });
    //scale in webview
    animate({
      easing: "ease-out-elastic",
      duration: 1,
      update: (t: number) => {
        this.webAnchorTrans.setLocalScale(
          vec3.lerp(vec3.one(), vec3.zero(), t)
        );
      },
      ended: null,
      cancelSet: this.webviewCancel,
    });
  }

  openWebView() {
    this.webViewRend.enabled = true;
    print("OPENING WEBVIEW....");
    var currCaptionPos = this.trans.getWorldPosition();
    var topWebPosition = currCaptionPos.add(
      this.trans.up.uniformScale(this.startWebScale - 1)
    );
    animate({
      easing: "ease-out-elastic",
      duration: 1,
      update: (t: number) => {
        this.trans.setWorldPosition(
          vec3.lerp(currCaptionPos, topWebPosition, t)
        );
      },
      ended: null,
      cancelSet: this.webviewCancel,
    });
    //scale in webview
    animate({
      easing: "ease-out-elastic",
      duration: 1,
      update: (t: number) => {
        this.webAnchorTrans.setLocalScale(
          vec3.lerp(vec3.zero(), vec3.one(), t)
        );
      },
      ended: null,
      cancelSet: this.webviewCancel,
    });
  }
}