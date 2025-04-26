// @input Component.Text textInput
// @input Component.Text textOutput
// @input Component.Image image
// @input Component.Script ttsComponent {"hint":"Attach the TextToSpeechOpenAI Component"}
// @input SceneObject interactableObject {"hint":"Drag the SceneObject that has the Interactable component"}

const apiKey = "Insert your Open AI Key";

// Remote service module for fetching data
var remoteServiceModule = require("LensStudio:RemoteServiceModule");

var isProcessing = false;

script.createEvent("OnStartEvent").bind(() => {
  onStart();
});

function onStart() {
  // Initialize SIK
  const SIK = require("SpectaclesInteractionKit/SIK").SIK;
  const interactionManager = SIK.InteractionManager;

  if (!script.interactableObject) {
    print(
      "Warning: Please assign a SceneObject with an Interactable component in the inspector"
    );
    return;
  }

  // Get the Interactable from the referenced SceneObject
  const interactable = interactionManager.getInteractableBySceneObject(
    script.interactableObject
  );

  if (!interactable) {
    print(
      "Warning: Could not find Interactable component on the referenced SceneObject"
    );
    return;
  }

  // Define the callback for trigger end event
  const onTriggerEndCallback = (event) => {
    handleTriggerEnd(event);
    print(
      `Interaction triggered by: ${event.interactor.inputType} at position: ${event.interactor.targetHitInfo.hit.position}`
    );
  };

  // Bind the callback to the trigger end event
  interactable.onInteractorTriggerEnd(onTriggerEndCallback);
}

async function handleTriggerEnd(eventData) {
  if (isProcessing) {
    print("A request is already in progress. Please wait.");
    return;
  }

  if (!script.textInput.text || !script.image || !apiKey) {
    print("Text, Image, or API key input is missing");
    return;
  }

  try {
    isProcessing = true;

    // Access the texture from the image component
    const texture = script.image.mainPass.baseTex;
    if (!texture) {
      print("Texture not found in the image component.");
      return;
    }

    const base64Image = await encodeTextureToBase64(texture);

    const requestPayload = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful AI assistant that works for Snapchat that has access to the view that the user is looking at using Augmented Reality Glasses." +
            " The user is asking for help with the following image and text. Keep it short like under 30 words. Be a little funny and keep it positive.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: script.textInput.text },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
    };

    const request = new Request("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestPayload),
    });

    let response = await remoteServiceModule.fetch(request);
    if (response.status === 200) {
      print("step 1");
      let responseData = await response.json();
      script.textOutput.text = responseData.choices[0].message.content;
      print(responseData.choices[0].message.content);
      print("step 2");
      // Call TTS to generate and play speech from the response
      if (script.ttsComponent) {
        script.ttsComponent.api.generateAndPlaySpeech(
          responseData.choices[0].message.content
        );
        print("step 3");
      }
    } else {
      print("Failure: response not successful");
    }
  } catch (error) {
    print("step 4 error");
    print("Error: " + error);
  } finally {
    isProcessing = false;
  }
}

function encodeTextureToBase64(texture) {
  return new Promise((resolve, reject) => {
    Base64.encodeTextureAsync(
      texture,
      resolve,
      reject,
      CompressionQuality.LowQuality,
      EncodingType.Jpg
    );
  });
}
