import React, { useState, useEffect } from 'react';
import { SpeakerHigh, SpeakerX, Pause, Play } from '@phosphor-icons/react';

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
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
      >
        {isLoading ? (
          <>
            <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full" />
            <span>Read it to me</span>
          </>
        ) : (
          <>
            {isSpeaking ? (
              isPaused ? <Play className="h-4 w-4" weight="fill" /> : <Pause className="h-4 w-4" weight="fill" />
            ) : (
              <SpeakerHigh className="h-4 w-4" weight="fill" />
            )}
            <span>
              {isSpeaking 
                ? (isPaused ? 'Resume' : 'Pause') 
                : 'Read it to me'
              }
            </span>
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