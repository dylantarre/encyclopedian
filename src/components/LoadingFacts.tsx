import React, { useState, useEffect } from 'react';
import { Sparkle } from '@phosphor-icons/react';

const facts = [
  // History
  "The shortest war in history lasted 38 minutes between Britain and Zanzibar in 1896.",
  "Ancient Egyptians used moldy bread as a form of antibiotic.",
  "The first written recipe for cookies was created in Persia in the 7th century.",
  "Vikings used melted snow to wash their faces and hair every Saturday.",
  "The Great Pyramid was the tallest structure on Earth for over 3,800 years.",
  "Cleopatra lived closer in time to the first Pizza Hut than to the building of the pyramids.",
  "The first Olympic games only had one event - a footrace.",
  "Ancient Romans used crushed mouse brains as toothpaste.",
  
  // Science
  "A day on Venus is longer than its year.",
  "Honey never spoils. Archaeologists have found 3000-year-old honey still preserved.",
  "A teaspoonful of neutron star would weigh 6 billion tons.",
  "Bananas are berries, but strawberries aren't.",
  "20% of Earth's oxygen is produced by the Amazon rainforest.",
  "An octopus has three hearts and blue blood.",
  "Humans share 50% of their DNA with bananas.",
  "A cloud can weigh more than a million pounds.",
  
  // Nature
  "Cows have best friends and get stressed when separated.",
  "Sloths can hold their breath for up to 40 minutes underwater.",
  "Hummingbirds are the only birds that can fly backwards.",
  "Butterflies taste with their feet.",
  "Penguins propose to their mates with a pebble.",
  "Hippos produce their own natural sunscreen.",
  "Wombat poop is cube-shaped.",
  "Honeybees can recognize human faces.",
  
  // Architecture
  "The Eiffel Tower can grow up to 6 inches taller during summer.",
  "The Great Wall of China is not visible from space with the naked eye.",
  "The Leaning Tower of Pisa was never straight to begin with.",
  "Rome has over 2000 fountains.",
  "The Empire State Building has its own ZIP code.",
  "The Taj Mahal changes color throughout the day.",
  "The Great Wall of China used sticky rice as mortar.",
  "The Chrysler Building had a secret car showroom on the 65th floor.",
  
  // Language & Literature
  "Shakespeare invented over 1,700 common words we use today.",
  "The shortest complete sentence in English is 'Go.'",
  "The word 'robot' comes from the Czech word for 'forced labor.'",
  "The dot over the letter 'i' is called a tittle.",
  "A pangram is a sentence that contains every letter of the alphabet.",
  "The longest word without a vowel is 'rhythms'.",
  "The most common letter in English is 'e'.",
  "The least used letter in English is 'z'.",
  
  // Food & Drink
  "The first oranges weren't orange - they were green.",
  "Apples float in water because they are 25% air.",
  "Carrots were originally purple, not orange.",
  "Coffee is the second most traded commodity in the world after oil.",
  "The world's most expensive spice is saffron.",
  "Pineapples take two years to grow.",
  "White chocolate isn't actually chocolate.",
  "Ketchup was once sold as medicine.",
  
  // Culture
  "The inventor of the Frisbee was turned into a Frisbee after death.",
  "A group of flamingos is called a 'flamboyance'.",
  "The first person convicted of speeding was going 8 mph.",
  "The longest time between two twins being born is 87 days.",
  "The Olympic flag's colors appear on every country's flag.",
  "The first movie ever made was only 2.11 seconds long.",
  "The most expensive movie prop ever sold was the original Maltese Falcon.",
  "The first music video on MTV was 'Video Killed the Radio Star'.",
  
  // Technology
  "The first computer mouse was made of wood.",
  "The first webcam was created to monitor a coffee pot.",
  "The first text message ever sent said 'Merry Christmas'.",
  "Nintendo was founded in 1889 as a playing card company.",
  "The first YouTube video was about elephants at a zoo.",
  "The first domain name ever registered was Symbolics.com.",
  "The QWERTY keyboard was designed to slow typing down.",
  "The first iPhone didn't have copy and paste functionality.",
  
  // Space
  "There are more stars in space than grains of sand on Earth.",
  "One year on Mercury is just 88 Earth days.",
  "The footprints on the Moon will last for 100 million years.",
  "The Sun loses 4 million tons of mass every second.",
  "Saturn's rings are mostly made of ice and rock.",
  "A day on Mars is only 40 minutes longer than on Earth.",
  "It rains diamonds on Jupiter and Saturn.",
  "The largest known star could fit 1,300 of our suns inside it."
];

export function LoadingFacts() {
  const [currentFact, setCurrentFact] = useState(facts[0]);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentFact(facts[Math.floor(Math.random() * facts.length)]);
        setIsTransitioning(false);
      }, 800);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full text-center px-4">
      <div className="animate-spin h-8 w-8 text-amber-400 dark:text-amber-500 mx-auto mb-8">
        <Sparkle className="h-8 w-8" weight="fill" />
      </div>
      <p className="text-gray-600 dark:text-gray-300 text-xl font-medium mb-6">Loading knowledge...</p>
      <p className={`text-lg leading-relaxed text-gray-700 dark:text-gray-200 transition-opacity duration-800 ${
        isTransitioning ? 'opacity-0' : 'opacity-100'
      }`}>
        <span className="font-semibold text-amber-600 dark:text-amber-400 text-xl">Did you know?</span>{' '}
        {currentFact}
      </p>
    </div>
  );
} 