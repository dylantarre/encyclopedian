const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";  // Default voice ID

export async function POST(req: Request) {
  const { text } = await req.json();
  
  // Limit text to 50 characters
  const limitedText = text.slice(0, 50);
  
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: limitedText,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5
      }
    }),
  });
  
  return response;
} 