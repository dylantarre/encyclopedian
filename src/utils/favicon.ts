export const setFavicon = (): void => {
  // Only change favicon in development
  if (!import.meta.env.DEV) return;
  
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return;

  // Draw circle background
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
  ctx.fillStyle = '#ef4444'; // red-500 for dev
  ctx.fill();
  
  // Draw a simple 'E' for Encyclopedian
  ctx.fillStyle = 'white';
  ctx.font = 'italic bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('E', size/2, size/2);
  
  // Set the favicon
  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  const faviconUrl = canvas.toDataURL('image/png');
  
  if (favicon) {
    favicon.href = faviconUrl;
  } else {
    const newFavicon = document.createElement('link');
    newFavicon.rel = 'icon';
    newFavicon.href = faviconUrl;
    document.head.appendChild(newFavicon);
  }
}; 