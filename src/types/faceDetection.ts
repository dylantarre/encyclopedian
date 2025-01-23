interface FaceDetector {
  detect(image: HTMLImageElement): Promise<Array<{
    boundingBox: DOMRectReadOnly;
  }>>;
}

declare global {
  interface Window {
    FaceDetector: {
      new(): FaceDetector;
    };
  }
} 