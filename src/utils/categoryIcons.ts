import { 
  BookOpen, 
  Leaf, 
  Buildings, 
  Person, 
  Globe, 
  Atom, 
  PaintBrush, 
  MusicNote, 
  FilmSlate, 
  GameController, 
  Heart, 
  Brain, 
  Sword, 
  Calculator, 
  Rocket, 
  Plant 
} from '@phosphor-icons/react';

export const getCategoryIcon = (text: string) => {
  const lowerText = text.toLowerCase();
  
  // Never return BookOpen for related articles
  if (lowerText.includes('history') || lowerText.includes('war') || lowerText.includes('battle')) return Sword;
  if (lowerText.includes('science') || lowerText.includes('physics') || lowerText.includes('chemistry')) return Atom;
  if (lowerText.includes('art') || lowerText.includes('paint')) return PaintBrush;
  if (lowerText.includes('music') || lowerText.includes('song') || lowerText.includes('album')) return MusicNote;
  if (lowerText.includes('film') || lowerText.includes('movie') || lowerText.includes('cinema')) return FilmSlate;
  if (lowerText.includes('game') || lowerText.includes('play')) return GameController;
  if (lowerText.includes('health') || lowerText.includes('medical')) return Heart;
  if (lowerText.includes('philosophy') || lowerText.includes('psychology')) return Brain;
  if (lowerText.includes('math') || lowerText.includes('calculation')) return Calculator;
  if (lowerText.includes('space') || lowerText.includes('astronomy')) return Rocket;
  if (lowerText.includes('nature') || lowerText.includes('environment')) return Leaf;
  if (lowerText.includes('city') || lowerText.includes('architecture')) return Buildings;
  if (lowerText.includes('person') || lowerText.includes('biography')) return Person;
  
  // Default to Globe instead of BookOpen
  return Globe;
}; 