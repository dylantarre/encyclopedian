import { MusicNote, Palette, Flask, Globe, Users, Buildings, Code, GameController, Camera, BookOpen } from '@phosphor-icons/react';

export const getCategoryIcon = (category: string) => {
  const normalizedText = category.toLowerCase();
  
  if (normalizedText.includes('music') || normalizedText.includes('song') || normalizedText.includes('concert') || normalizedText.includes('band')) {
    return MusicNote;
  }
  if (normalizedText.includes('art') || normalizedText.includes('paint') || normalizedText.includes('draw') || normalizedText.includes('design')) {
    return Palette;
  }
  if (normalizedText.includes('science') || normalizedText.includes('chemistry') || normalizedText.includes('physics') || normalizedText.includes('experiment')) {
    return Flask;
  }
  if (normalizedText.includes('geography') || normalizedText.includes('place') || normalizedText.includes('country') || normalizedText.includes('city')) {
    return Globe;
  }
  if (normalizedText.includes('people') || normalizedText.includes('society') || normalizedText.includes('community') || normalizedText.includes('culture')) {
    return Users;
  }
  if (normalizedText.includes('history') || normalizedText.includes('politics') || normalizedText.includes('war') || normalizedText.includes('empire')) {
    return Buildings;
  }
  if (normalizedText.includes('technology') || normalizedText.includes('computer') || normalizedText.includes('software') || normalizedText.includes('digital')) {
    return Code;
  }
  if (normalizedText.includes('game') || normalizedText.includes('sport') || normalizedText.includes('play') || normalizedText.includes('athlete')) {
    return GameController;
  }
  if (normalizedText.includes('film') || normalizedText.includes('movie') || normalizedText.includes('cinema') || normalizedText.includes('camera')) {
    return Camera;
  }
  
  return BookOpen;
}; 