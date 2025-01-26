import React, { useState, useEffect } from 'react';
import { SpeakerHigh, SpeakerX, Pause, Play, VolumeUp } from '@phosphor-icons/react';

export function ReadItToMe({ text }: { text: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Stop speech and reset states when text changes
  useEffect(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setIsLoading(false);
  }, [text]);

  // Cleanup function to stop speech when component unmounts
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Prevent click from bubbling up
    
    if (isSpeaking) {
      if (isPaused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsPaused(true);
      }
      return;
    }

    setIsLoading(true);
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      
      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
      };
      
      utterance.onstart = () => {
        setIsLoading(false);
        setIsSpeaking(true);
      };

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Failed to generate speech:', error);
      setIsLoading(false);
    }
  };

  const handleStop = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="group flex items-center gap-2 transition-colors"
        aria-label={
          isLoading ? 'Loading...' : 
          isSpeaking ? (isPaused ? 'Resume reading' : 'Pause reading') : 
          'Read article aloud'
        }
      >
        {isLoading ? (
          <>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
          </>
        ) : (
          <>
            {isSpeaking ? (
              isPaused ? (
                <>
                  <Play className="h-4 w-4 md:h-5 md:w-5 text-amber-400 dark:text-amber-500 transition-transform duration-300 group-hover:scale-110" weight="duotone" />
                  <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400 group-hover:text-amber-400 dark:group-hover:text-amber-500">Resume</span>
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4 md:h-5 md:w-5 text-amber-400 dark:text-amber-500 transition-transform duration-300 group-hover:scale-110" weight="duotone" />
                  <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400 group-hover:text-amber-400 dark:group-hover:text-amber-500">Pause</span>
                </>
              )
            ) : (
              <>
                <SpeakerHigh className="h-4 w-4 md:h-5 md:w-5 text-amber-400 dark:text-amber-500 transition-transform duration-300 group-hover:scale-110" weight="duotone" />
                <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400 group-hover:text-amber-400 dark:group-hover:text-amber-500">Read it to me</span>
              </>
            )}
          </>
        )}
      </button>
      {isSpeaking && (
        <button
          onClick={handleStop}
          className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        >
          <SpeakerX className="h-4 w-4" weight="fill" />
          <span>Stop</span>
        </button>
      )}
    </div>
  );
} 