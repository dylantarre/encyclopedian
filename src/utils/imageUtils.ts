interface Face {
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Face detection support check
export const isFaceDetectionSupported = async () => {
  return 'FaceDetector' in window;
};

// Function to get face position
export const getFacePosition = async (imageUrl: string): Promise<string> => {
  try {
    if (!await isFaceDetectionSupported()) {
      return 'center 25%';
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    ctx.drawImage(img, 0, 0);

    const faceDetector = new window.FaceDetector();
    const faces = await faceDetector.detect(img);

    if (faces.length > 0) {
      const avgX = faces.reduce((sum: number, face: Face) => 
        sum + face.boundingBox.x + face.boundingBox.width / 2, 0) / faces.length;
      const avgY = faces.reduce((sum: number, face: Face) => 
        sum + face.boundingBox.y + face.boundingBox.height / 2, 0) / faces.length;

      const xPercent = (avgX / img.width) * 100;
      const yPercent = (avgY / img.height) * 100;

      return `${xPercent}% ${yPercent}%`;
    }

    return 'center 25%';
  } catch (error) {
    console.warn('Face detection failed:', error);
    return 'center 25%';
  }
}; 