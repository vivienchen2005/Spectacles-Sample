// @input Component.Text introText
// @input SceneObject uiRoot
// @input Component.ScriptComponent pinchButtonScript
print("📌 IntroSequence.js is running");

function onPressed() {
    print("pressed");
    if (script.introText) {
        script.introText.enabled = false;
    }
    if (script.uiRoot) {
        script.uiRoot.enabled = true;
    }
    if (script.pinchButtonScript) {
        script.pinchButtonScript.getSceneObject().enabled = false;
    }
}

if (script.uiRoot) {
    script.uiRoot.enabled = false;
}

if (script.pinchButtonScript && script.pinchButtonScript.api && script.pinchButtonScript.api.addOnPressedCallback) {
    print("registering pinch callback");
    script.pinchButtonScript.api.addOnPressedCallback(onPressed);
}
