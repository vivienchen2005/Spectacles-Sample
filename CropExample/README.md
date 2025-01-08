# Camera Crop Example

![](CaptureShort.gif)

> **NOTE**:
> This project will only work for the Spectacles platform.

## Prerequisites

Lens Studio: v5.4.0+

Spectacles OS Version: v5.59.218+

Spectacles App iOS: v0.59.1.1+

Spectacles App Android: v0.59.1.1+

To update your Spectacles device and mobile app, please refer to this [guide](https://support.spectacles.com/hc/en-us/articles/30214953982740-Updating).

You can download the latest version of Lens Studio from [here](https://ar.snap.com/download?lang=en-US).

## Getting the Project

To obtain the project folder, you need to clone the repository.

> **IMPORTANT**:
> This project uses Git Large Files Support (LFS). Downloading a zip file using the green button on Github
> **will not work**. You must clone the project with a version of git that has LFS.
> You can download Git LFS here: https://git-lfs.github.com/.

## Initial Project Setup

Add OpenAI key at the top of ChatGPT.ts

## Testing the Lens

### In Lens Studio Editor

[Experimental API](https://developers.snap.com/spectacles/about-spectacles-features/apis/experimental-apis) must be checked in Lens Studio and Device Type Override is set to Spectacles since this uses the Fetch API.

Use the interactive preview to move around and click the screen to test the cropping behavior and ChatGPT functionality.

### On Spectacles Device

[Extended Permissions](https://developers.snap.com/spectacles/permission-privacy/extended-permissions) mode must be enabled because this lens uses the camera frame and external API requests.

Install the lens as normal and pinch both hands close togother, pull your right hand diagonally down to size the capture window, release the pinch on both hands to send capture to ChatGPT.

## How It Works

The camera module allows access to the left or right camera texture on device. To align the image crop with either camera we can use the camera module to get intrinsics and pose (offset) of each camera. We can then create two virtual cameras underneath the main camera and set their respective physical properties. This way we can get camera space positions of objects in 3D space. This project uses those positions to update the screen crop texture accordingly.

There is CropRegion.ts that takes 4 SceneObjects and uses those for the corners of the crop. That could be used to crop a fixed area anchored to the hand or some fixed distance from the camera.
