# Fetch Example

![](./README-ref/fetch-example.gif)

This is an sample project which uses the Spectacles [Fetch API](https://developers.snap.com/spectacles/about-spectacles-features/apis/fetch). 

> __NOTE__: 
> This project will only work for the Spectacles platform. 

## Prerequisites

Lens Studio: v5.3.0+

Spectacles OS Version: v5.58.621+

Spectacles App iOS: v0.58.1.0+

Spectacles App Android: v0.58.1.0+

To update your Spectacles device and mobile app, please refer to this [guide](https://support.spectacles.com/hc/en-us/articles/30214953982740-Updating).

You can download the latest version of Lens Studio from [here](https://ar.snap.com/download?lang=en-US).

## Getting the project

To obtain the project folder, you need to clone the repository.

> __IMPORTANT__: 
> This project uses Git Large Files Support (LFS). Downloading a zip file using the green button on Github
> **will not work**. You must clone the project with a version of git that has LFS.
> You can download Git LFS here: https://git-lfs.github.com/.

## Initial Project Setup

The project should be pre-configured to get you started without any additional steps. However, if you encounter issues in the Logger Panel, please ensure your Lens Studio environment is set up for [Spectacles](https://developers.snap.com/spectacles/get-started/start-buiding/preview-panel).

## Testing the Lens

### In Lens Studio Editor
Locate the cat in the Scene using the [Interactive Preview Panel](https://developers.snap.com/lens-studio/lens-studio-workflow/previewing-your-lens#interactive-preview). Click on the cat with the left mouse button to simulate a "Poking" gesture within Lens Studio. Repeat the action to receive a new response from the cat.

### In Spectacles Device
To install your Lens on your device, refer to the guide provided [here](https://developers.snap.com/spectacles/get-started/start-buiding/test-lens-on-spectacles).

After successfully installing the Lens, locate the cat in the environment and poke it with your index finger. Repeat the action to receive a new response from the cat.


## Key Script

[FetchCatFacts.ts](./Assets/Scripts/FetchCatFacts.ts) - This is the primary script driving the core behavior of this sample project by accessing the [Fetch API](https://developers.snap.com/spectacles/about-spectacles-features/apis/fetch). The other scripts are supplementary and help build the overall experience.