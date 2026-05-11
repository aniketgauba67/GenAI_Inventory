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
 *  Editors: Aniket, Dipanker, Liam, Jin, and Philip.
 *
 *****************************************************************************/
import { Capacitor } from "@capacitor/core";
import {
  Camera,
  MediaTypeSelection,
  type CameraPermissionType,
  type CameraPermissionState,
  type MediaResult,
} from "@capacitor/camera";

export const isNative = (): boolean => Capacitor.isNativePlatform();

const NATIVE_IMAGE_OPTIONS = {
  quality: 60,
  targetWidth: 1280,
  targetHeight: 1280,
  correctOrientation: true,
  includeMetadata: true,
};

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

function uniqueSuffix(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function mimeFromFormat(format: string | undefined): string {
  const normalized = (format || "").toLowerCase();
  if (normalized === "png") return "image/png";
  if (normalized === "webp") return "image/webp";
  if (normalized === "jpg" || normalized === "jpeg") return "image/jpeg";
  return "image/jpeg";
}

function extensionFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

async function resultToFile(result: MediaResult, fallbackPrefix: string): Promise<File> {
  const webPath = result.webPath || (result.uri ? Capacitor.convertFileSrc(result.uri) : undefined);
  if (!webPath) throw new Error("No image path returned by camera.");

  const response = await fetch(webPath);
  if (!response.ok) throw new Error("Could not read selected image from device storage.");
  const blob = await response.blob();
  const mime = blob.type || mimeFromFormat(result.metadata?.format);
  return new File([blob], `${fallbackPrefix}_${uniqueSuffix()}.${extensionFromMime(mime)}`, {
    type: mime,
    lastModified: Date.now(),
  });
}

export async function takePhoto(): Promise<File> {
  await ensurePermission("camera");

  const photo = await Camera.takePhoto({
    ...NATIVE_IMAGE_OPTIONS,
  });

  return resultToFile(photo, "shelf");
}

export async function pickPhotos(): Promise<File[]> {
  await ensurePermission("photos");

  const result = await Camera.chooseFromGallery({
    mediaType: MediaTypeSelection.Photo,
    allowMultipleSelection: true,
    ...NATIVE_IMAGE_OPTIONS,
  });

  return Promise.all(
    result.results.map((photo, index) => resultToFile(photo, `shelf_${index + 1}`))
  );
}
