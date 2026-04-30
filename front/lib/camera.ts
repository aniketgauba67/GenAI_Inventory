/******************************** camera.ts ***************************************
 *
 *  Module: Camera
 *
 *  This module provides shared frontend helper logic for the application.
 *
 *  The module provides:
 *
 *  - utility functions imported by pages and components.
 *  - one place for repeated frontend behavior.
 *
 *  Key Structures Used:
 *
 *  - TypeScript exports and shared constants.
 *
 *  This module ensures:
 *
 *  - frontend logic avoids copy-paste drift.
 *  - pages can rely on typed helper functions.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 *****************************************************************************/
import { Capacitor } from "@capacitor/core";
import { Camera, MediaTypeSelection, type CameraPermissionType, type CameraPermissionState } from "@capacitor/camera";

export const isNative = (): boolean => Capacitor.isNativePlatform();

function isAllowed(state: CameraPermissionState): boolean {
  return state === "granted" || state === "limited";
}

async function ensurePermission(permission: CameraPermissionType) {
  if (!isNative()) return;

  const current = await Camera.checkPermissions();
  if (isAllowed(current[permission])) return;

  const requested = await Camera.requestPermissions({ permissions: [permission] });
  if (!isAllowed(requested[permission])) {
    const label = permission === "camera" ? "Camera" : "Photo library";
    throw new Error(`${label} access denied. Enable it in device settings and try again.`);
  }
}

async function resultToFile(webPath: string | undefined, fallbackName: string): Promise<File> {
  if (!webPath) throw new Error("No image path returned by camera.");

  const response = await fetch(webPath);
  const blob = await response.blob();
  return new File([blob], fallbackName, { type: blob.type || "image/jpeg" });
}

export async function takePhoto(): Promise<File> {
  await ensurePermission("camera");

  const photo = await Camera.takePhoto({
    quality: 90,
  });

  return resultToFile(photo.webPath, `shelf_${Date.now()}.jpg`);
}

export async function pickPhotos(): Promise<File[]> {
  await ensurePermission("photos");

  const result = await Camera.chooseFromGallery({
    mediaType: MediaTypeSelection.Photo,
    allowMultipleSelection: true,
    quality: 90,
  });

  return Promise.all(
    result.results.map((photo, index) => resultToFile(photo.webPath, `shelf_${Date.now()}_${index + 1}.jpg`))
  );
}
