import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

export const isNative = (): boolean => Capacitor.isNativePlatform();

export async function takePhoto(): Promise<File> {
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
    quality: 90,
  });
  const response = await fetch(photo.webPath!);
  const blob = await response.blob();
  return new File([blob], `shelf_${Date.now()}.jpg`, { type: "image/jpeg" });
}

export async function pickPhotos(): Promise<File[]> {
  const result = await Camera.pickImages({ quality: 90 });
  return Promise.all(
    result.photos.map(async (photo) => {
      const response = await fetch(photo.webPath!);
      const blob = await response.blob();
      return new File([blob], `shelf_${Date.now()}.jpg`, { type: "image/jpeg" });
    })
  );
}

export function filesToFileList(files: File[]): FileList {
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  return dt.files;
}
