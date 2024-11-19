import Easing from "LSTween/TweenJS/Easing";
import { FetchCatFacts } from "./FetchCatFacts";
import { Interactable } from "SpectaclesInteractionKit/Components/Interaction/Interactable/Interactable";
import { LSTween } from "LSTween/LSTween";

@component
export class CatFactAnimator extends BaseScriptComponent {
  @input
  thoughtBubbleImage: Image; // Image component for the thought bubble
  @input
  thoughtBubbleText: Text; // Text component for the thought bubble

  @input
  fetchCatFacts: FetchCatFacts; // Component to fetch cat facts

  @input
  catInteractable: Interactable; // Interactable component for the cat

  @input
  animationPlayer: AnimationPlayer; // Animation player component

  @input
  hintImage: Image; // Image component for the hint

  @input("Component.ScriptComponent")
  animationStateMachine: any; // State machine for animations

  // Flag to check if the interaction has been activated once
  private hasBeenActivatedOnce = false;

  onAwake() {
    // Initialize the thought bubble with no alpha
    this.initializeThoughtBubble();

    // Add event listener for cat interaction
    this.catInteractable.onTriggerStart.add((args) => {
      if (!this.hasBeenActivatedOnce) {
        this.hasBeenActivatedOnce = true;
        this.playAnimationOnTrigger();
      }

      // Fetch cat facts when interaction is triggered
      this.fetchCatFacts.getCatFacts();
    });

    // Update thought bubble text when a cat fact is received
    this.fetchCatFacts.catFactReceived.add((args) => {
      this.thoughtBubbleText.text = args;
    });
  }

  // Play animation when the interaction is triggered
  private playAnimationOnTrigger() {
    // Delay the animation for 1.5 seconds
    LSTween.rawTween(1500)
      .onComplete(() => {
        // Move the thought bubble from bottom to top
        LSTween.moveFromToLocal(
          this.thoughtBubbleImage.sceneObject.getTransform(),
          new vec3(2, 25, 0),
          new vec3(2, 31, 0),
          500
        )
          .easing(Easing.Cubic.Out)
          .start();

        // Fade in the thought bubble image
        LSTween.alphaTo(this.thoughtBubbleImage.mainMaterial, 1, 600)
          .easing(Easing.Cubic.Out)
          .start();

        // Fade in the thought bubble text
        LSTween.textAlphaTo(this.thoughtBubbleText, 1, 600)
          .easing(Easing.Cubic.Out)
          .start();
      })
      .start();

    // Hide the hint image
    LSTween.alphaTo(this.hintImage.mainMaterial, 0, 300)
      .easing(Easing.Cubic.Out)
      .start();

    // Play standing animation
    this.animationStateMachine.setTrigger("stand");
  }

  // Initialize the thought bubble with no alpha
  private initializeThoughtBubble() {
    const imageColorNoAlpha = this.thoughtBubbleImage.mainPass.baseColor;
    imageColorNoAlpha.a = 0;
    this.thoughtBubbleImage.mainPass.baseColor = imageColorNoAlpha;

    const textColorNoAlpha = this.thoughtBubbleText.textFill.color;
    textColorNoAlpha.a = 0;
    this.thoughtBubbleText.textFill.color = textColorNoAlpha;
  }
}
