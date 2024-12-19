# High-Five Interaction Lens

## Overview
This project showcases a real-time collaborative AR experience where two users perform a high-five gesture. The system synchronizes hand positions across devices and detects when the hands are close enough to trigger the high-five. This interaction activates shared visual effects and displays the users' names. It demonstrates the potential of [Connected Lenses](https://developers.snap.com/spectacles/about-spectacles-features/connected-lenses/overview) for creating engaging social connections in AR.

![](./README-ref/HighFiveExample.gif)

## Prerequisites

Lens Studio: v5.4.0+

Spectacles OS Version: v5.59.218+

Spectacles App iOS: v0.59.1.1+

Spectacles App Android: v0.59.1.1+

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
1. Open the Lens in Lens Studio and create two Interactive Previews using the [Interactive Preview Panel](https://developers.snap.com/lens-studio/lens-studio-workflow/previewing-your-lens#interactive-preview)
2. Click the Multiplayer button for both previews. They will connect to the same session and map surroundings automatically.
3. Simulate a high-five gesture by interacting within the connected session:
   - Select the [Webcam mode](https://developers.snap.com/lens-studio/lens-studio-workflow/previewing-your-lens#webcam-mode) and use your left hand to mimic the high-five gesture between the two previews.
   - Verify that the high-five gesture triggers the shared animation between the two users.
   - Confirm that both usernames are displayed correctly in each preview.

### In Spectacles Device
1. Connect two pairs of Spectacles to the same session following the [Playing Connected Lenses Guide](https://developers.snap.com/spectacles/about-spectacles-features/connected-lenses/overview#playing-connected-lenses-on-spectacles).
2. Test functionality:
   - Perform a high-five gesture using the right hands of the two users. Confirm that the shared animation appears between their hands.
   - Verify that both usernames are displayed correctly for each user and that the effect functions seamlessly.

## Key Script

[EntryPointMain.ts](./Assets/HighFive/Scripts/EntryPointMain/EntryPointMain.ts) - This script serves as the entry point for the Lens logic, initializing and managing the execution of other scripts within the project.
