import React from 'react';
import { Book, MagnifyingGlass, Sparkle, BookOpen, Sun, Moon, Compass, SpeakerHigh, SpeakerX, MusicNote, Palette, Flask, Globe, Users, Buildings, Code, GameController, Camera } from '@phosphor-icons/react';
import { ReadItToMe } from './components/ReadItToMe';
import { LoadingFacts } from './components/LoadingFacts';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from './ThemeContext';
import { getFacePosition } from './utils/imageUtils';
import { getCategoryIcon } from './utils/categoryIcons';
import type { ArticleData } from './types';

// Face detection support check
const isFaceDetectionSupported = async () => {
  return 'FaceDetector' in window;
};

type ImagePosition = {
  url: string;
  position: string;
};

// Cache for image positions
const imagePositionCache = new Map<string, string>();

// Constants
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const SEARCH_DEBOUNCE = 500; // 500ms

function App() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { isDark, toggleTheme } = useTheme();
  const [currentArticle, setCurrentArticle] = useState<ArticleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const isInitialMount = useRef(true);

  const stopSpeech = () => {
    window.speechSynthesis.cancel();
  };

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    stopSpeech(); // Stop speech when searching
    
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Don't search if query is too short
    if (query.length < 2) return;
    
    // Add debounce to prevent too many API calls
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(query)}&origin=*`
        );
        
        if (!response.ok) {
          throw new Error('Failed to search Wikipedia');
        }
        
        const data = await response.json();
        const searchResults = data.query.search;
        
        if (searchResults.length > 0) {
          // Get the most relevant result
          const bestMatch = searchResults[0];
          fetchArticleData(bestMatch.title);
        }
      } catch (err) {
        console.error('Search error:', err);
        setError('Failed to search for articles. Please try again.');
      }
    }, SEARCH_DEBOUNCE); // Wait 500ms after user stops typing
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchArticleData = async (title: string) => {
    stopSpeech(); // Stop any ongoing speech
    setIsLoading(true);
    setShowContent(false);
    setError(null);
    let retries = 0;
    
    const isValidArticle = (page: any) => {
      if (!page || page.missing || !page.extract) return false;
      
      // Ensure article has meaningful content
      const extract = page.extract.trim();
      if (extract.length < 100) return false;
      
      // Skip redirects and disambiguation pages
      if (page.title.includes('(disambiguation)') || 
          extract.toLowerCase().includes('may refer to:') ||
          extract.toLowerCase().includes('disambiguation page')) return false;
      
      // Skip lists and indexes
      if (page.title.startsWith('List of') || 
          page.title.startsWith('Index of')) return false;
          
      return true;
    };

    while (retries < MAX_RETRIES) {
    try {
      // Get main article content
      const contentResponse = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|categories|links&explaintext=1&exsectionformat=plain&exlimit=1&titles=${encodeURIComponent(title)}&pllimit=50&origin=*`
      );
      
      if (!contentResponse.ok) {
        throw new Error('Failed to fetch from Wikipedia API');
      }
      
      const contentData = await contentResponse.json();
      const pages = contentData.query.pages;
      const page = pages[Object.keys(pages)[0]];

      // Additional validation for content length
      if (!page.extract || page.extract.length < 100) {
        throw new Error('Article content too short or missing');
      }

      // Fetch image for main article
      const imageResponse = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=original|name&titles=${encodeURIComponent(title)}&origin=*`
      );
      
      if (!imageResponse.ok) {
        throw new Error('Failed to fetch image');
      }
      
      const imageData = await imageResponse.json();
      const imagePages = imageData.query.pages;
      const imagePage = imagePages[Object.keys(imagePages)[0]];
      let mainImagePosition = 'center 25%';
      
      if (imagePage.original) {
        const cachedPosition = imagePositionCache.get(imagePage.original.source);
        if (cachedPosition) {
          mainImagePosition = cachedPosition;
        } else {
          mainImagePosition = await getFacePosition(imagePage.original.source);
          imagePositionCache.set(imagePage.original.source, mainImagePosition);
        }
      }
      
      const mainImage = imagePage.original ? {
        url: imagePage.original.source,
        caption: imagePage.pageimage || '',
        position: mainImagePosition
      } : null;

      // Additional validation for content length
      if (!page.extract || page.extract.length < 100) {
        throw new Error('Article content too short or missing');
      }

      if (!isValidArticle(page)) {
        retries++;
        if (retries === MAX_RETRIES) {
          throw new Error('No valid Wikipedia article found after multiple attempts');
        }
        await delay(RETRY_DELAY);
        continue;
      }

      const extract = page.extract;
      
      // Function to get the base topic from a title
      const getBaseTopic = (title: string) => {
        // Remove years and numbers
        return title.replace(/\d+/g, '')
          // Remove common prefixes
          .replace(/^(The|A|An) /i, '')
          // Remove everything after "in" or similar words if they exist
          .split(/ in | of | at | during /i)[0]
          .trim();
      };

      // Function to calculate similarity between two titles
      const calculateSimilarity = (title1: string, title2: string) => {
        const base1 = getBaseTopic(title1);
        const base2 = getBaseTopic(title2);
        const words1 = base1.toLowerCase().split(/\W+/);
        const words2 = base2.toLowerCase().split(/\W+/);
        const commonWords = words1.filter(word => words2.includes(word));
        return commonWords.length / Math.max(words1.length, words2.length);
      };

      // Get categories and find the most relevant one
      const categories = page.categories || [];
      let relevantCategory = 'General Knowledge';
      
      // Priority list for category selection
      const categoryPriorities = [
        // Look for subject areas first
        (title: string) => /^(History|Science|Technology|Arts|Music|Literature|Philosophy|Religion|Sports|Politics|Geography)/.test(title),
        // Then look for specific types
        (title: string) => /(people|places|events|concepts|books|films|albums)$/i.test(title),
        // Then look for any category that doesn't contain maintenance terms
        (title: string) => {
          const lowercase = title.toLowerCase();
          return !lowercase.includes('articles') &&
            !lowercase.includes('pages') &&
            !lowercase.includes('cs1') &&
            !lowercase.includes('use') &&
            !lowercase.includes('wikipedia') &&
            !lowercase.includes('webarchive') &&
            !lowercase.includes('with') &&
            !lowercase.includes('containing') &&
            !lowercase.includes('stub') &&
            !lowercase.includes('disambiguation');
        }
      ];
      
      // Try each priority level until we find a matching category
      for (const priorityCheck of categoryPriorities) {
        const match = categories.find((cat: { title: string }) => {
          const title = cat.title.replace('Category:', '');
          return priorityCheck(title);
        });
        
        if (match) {
          relevantCategory = match.title.replace('Category:', '');
          break;
        }
      }
      
      // Get related articles from page links
      const links = page.links || [];
      
      // Get main topic categories
      const mainTopics = categories
        .map((cat: { title: string }) => cat.title.replace('Category:', ''))
        .filter((cat: string) => 
          !cat.match(/articles|pages|cs1|use|wikipedia|webarchive|stub|disambiguation/i) &&
          !cat.includes('with') &&
          !cat.includes('containing')
        );

      // Group links by their relation to the main topic
      const groupedLinks = links.reduce((acc: { [key: string]: string[] }, link: { title: string }) => {
        const title = link.title;
        
        // Skip unwanted pages
        if (title.match(/^(Wikipedia:|Template:|Category:|Portal:|Draft:|File:|Help:|Module:|Special:)/i) ||
            title.includes('disambiguation') ||
            title.includes('Redirect')) {
          return acc;
        }

        // Determine the type of relation
        if (title.includes(getBaseTopic(page.title))) {
          acc.direct = [...(acc.direct || []), title];
        } else if (mainTopics.some(topic => title.includes(topic))) {
          acc.related = [...(acc.related || []), title];
        } else {
          acc.broader = [...(acc.broader || []), title];
        }
        
        return acc;
      }, { direct: [], related: [], broader: [] });

      // Filter and sort links for diversity
      const selectDiverseLinks = () => {
        const selected: string[] = [];
        const requiredTypes = {
          direct: false,
          related: false,
          broader: false,
          serendipity: false
        };
        
        // First, ensure we have at least one of each type
        if (groupedLinks.direct?.length) {
          const direct = groupedLinks.direct
            .sort(() => Math.random() - 0.5)[0];
          if (direct) {
            selected.push(direct);
            requiredTypes.direct = true;
          }
        }
        
        if (groupedLinks.related?.length) {
          const related = groupedLinks.related
            .filter(title => !selected.some(s => calculateSimilarity(s, title) > 0.4))
            .sort(() => Math.random() - 0.5)[0];
          if (related) {
            selected.push(related);
            requiredTypes.related = true;
          }
        }
        
        if (groupedLinks.broader?.length) {
          const broader = groupedLinks.broader
            .filter(title => !selected.some(s => calculateSimilarity(s, title) > 0.4))
            .sort(() => Math.random() - 0.5)[0];
          if (broader) {
            selected.push(broader);
            requiredTypes.broader = true;
          }
        }
        
        // Then fill remaining slots with a preference for maintaining type distribution
        const fillRemainingSlots = () => {
          const remainingSlots = 9 - selected.length;
          if (remainingSlots <= 0) return;

          // Distribute remaining slots among available types
          const availableTypes = [
            { type: 'direct', links: groupedLinks.direct },
            { type: 'related', links: groupedLinks.related },
            { type: 'broader', links: groupedLinks.broader }
          ].filter(({ links }) => links?.length > 0);

          for (let i = 0; i < remainingSlots && availableTypes.length > 0; i++) {
            const typeIndex = i % availableTypes.length;
            const { type, links } = availableTypes[typeIndex];
            
            const candidate = links
              .filter(title => !selected.includes(title))
              .find(title => !selected.some(s => calculateSimilarity(s, title) > 0.4));

            if (candidate) {
              selected.push(candidate);
            }
          }
        };

        fillRemainingSlots();
        
        return selected.slice(0, 9);
      };

      const diverseLinks = selectDiverseLinks();
      const selected = diverseLinks; // Store selected links for reference

      // Fetch extracts for related articles
      const relatedResponse = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=original|name&titles=${diverseLinks.join('|')}&origin=*`
      );
      
      if (!relatedResponse.ok) {
        throw new Error('Failed to fetch related articles');
      }
      
      const relatedData = await relatedResponse.json();
      const relatedPages = relatedData.query.pages;
      
      // Process images in parallel
      const imagePositionPromises = Object.values(relatedPages)
        .filter((page: any) => page.original)
        .map(async (page: any) => {
          const cachedPosition = imagePositionCache.get(page.original.source);
          if (cachedPosition) {
            return { url: page.original.source, position: cachedPosition };
          }
          const position = await getFacePosition(page.original.source);
          imagePositionCache.set(page.original.source, position);
          return { url: page.original.source, position };
        });

      const imagePositions = await Promise.all(imagePositionPromises);
      const positionMap = new Map(imagePositions.map(({ url, position }) => [url, position]));
      
      const relatedArticles = Object.values(relatedPages)
        .filter((page: any) => page.extract && page.extract.length > 50 && !page.missing)
        .map((page: any) => ({
          title: page.title,
          extract: page.extract.split(/[.!?](?:\s|$)/)[0] + '.',
          image: page.original ? {
            url: page.original.source,
            caption: page.pageimage || '',
            position: positionMap.get(page.original.source) || 'center 25%'
          } : null,
          type: diverseLinks.indexOf(page.title) < 3 ? 'direct' :
                diverseLinks.indexOf(page.title) < 6 ? 'related' : 'broader'
        }))
        .filter(article => 
          article.extract && 
          article.extract !== '.' && 
          article.extract.length > 20
        )
        // Sort articles by type to ensure consistent order
        .sort((a, b) => {
          const typeOrder = { direct: 0, related: 1, broader: 2 };
          return typeOrder[a.type as keyof typeof typeOrder] - typeOrder[b.type as keyof typeof typeOrder];
        });

      // If we don't have enough articles, fetch random ones to fill the gaps
      if (relatedArticles.length < 9) {
        const randomResponse = await fetch(
          'https://en.wikipedia.org/w/api.php?action=query&format=json&list=random&rnnamespace=0&rnlimit=20&origin=*&rnminsize=1000'
        );
        
        if (!randomResponse.ok) {
          throw new Error('Failed to fetch additional articles');
        }
        
        const randomData = await randomResponse.json();
        const randomTitles = randomData.query.random.map((page: any) => page.title);
        
        // Fetch extracts for random articles
        const randomExtractsResponse = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&titles=${randomTitles.join('|')}&origin=*`
        );
        
        if (!randomExtractsResponse.ok) {
          throw new Error('Failed to fetch random article extracts');
        }
        
        const randomExtractsData = await randomExtractsResponse.json();
        const randomPages = randomExtractsData.query.pages;
        
        const serendipityArticles = Object.values(randomPages)
          .filter((page: any) => page.extract && page.extract.length > 50 && !page.missing)
          .map((page: any) => ({
            title: page.title,
            extract: page.extract.split(/[.!?](?:\s|$)/)[0] + '.',
            type: 'serendipity'
          }))
          .filter(article => 
            article.extract && 
            article.extract !== '.' && 
            article.extract.length > 20 &&
            !relatedArticles.some(existing => existing.title === article.title)
          );
        
        // Ensure we have at least one serendipity article if we're missing any required types
        if (!relatedArticles.some(a => a.type === 'direct') ||
            !relatedArticles.some(a => a.type === 'related') ||
            !relatedArticles.some(a => a.type === 'broader')) {
          const serendipityArticle = serendipityArticles[0];
          if (serendipityArticle) {
            relatedArticles.push(serendipityArticle);
          }
        }

        // Fill remaining slots with serendipity articles
        if (relatedArticles.length < 9) {
          relatedArticles.push(...serendipityArticles.slice(1, 10 - relatedArticles.length));
        }
      }

      // Ensure we only take 9 articles
      const finalArticles = relatedArticles.slice(0, 9);

      setCurrentArticle({
        title: title,
        definition: extract,
        image: mainImage,
        category: relevantCategory,
        relatedArticles: finalArticles
      });
      break; // Success, exit the retry loop
    } catch (err) {
      retries++;
      if (retries === MAX_RETRIES) {
        setError('Failed to fetch article data after multiple attempts. Please try again.');
        console.error('Error fetching data:', err);
      } else {
        await delay(RETRY_DELAY);
        continue;
      }
    }
    }
    setIsLoading(false);
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // Add a small delay before showing content for smooth transition
    timeoutRef.current = setTimeout(() => {
      setShowContent(true);
    }, 100);
  };

  const fetchRandomArticle = async () => {
    let retries = 0;
    
    while (retries < MAX_RETRIES) {
    try {
      const response = await fetch(
        'https://en.wikipedia.org/w/api.php?action=query&format=json&list=random&rnnamespace=0&rnlimit=1&origin=*&rnminsize=3000&rnfilterredir=nonredirects'
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch random article');
      }
      
      const data = await response.json();
      const title = data.query.random[0].title;
      try {
        await fetchArticleData(title);
        break; // Success, exit the retry loop
      } catch (err) {
        retries++;
        if (retries === MAX_RETRIES) {
          throw err;
        }
        await delay(RETRY_DELAY);
        continue;
      }
    } catch (err) {
      retries++;
      if (retries === MAX_RETRIES) {
        setError('Failed to fetch a valid article after multiple attempts. Please try again.');
        console.error('Error fetching random article:', err);
      } else {
        await delay(RETRY_DELAY);
        continue;
      }
    }
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchRandomArticle();
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 font-sans transition-colors duration-200">
      <header className="bg-white dark:bg-gray-800 shadow-sm transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <a 
                href="/"
                className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.reload();
                }}
              >
                <Book className="h-8 w-8 text-amber-600 dark:text-amber-500" weight="duotone" />
                <h1 className="text-2xl font-playfair font-bold text-gray-900 dark:text-white">Encyclopedian</h1>
              </a>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search knowledge..."
                  className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-300"
                  value={searchQuery}
                  onChange={handleSearch}
                />
                <MagnifyingGlass className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-300" weight="thin" />
              </div>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                aria-label="Toggle theme"
              >
                {isDark ? (
                  <Sun className="h-5 w-5 text-amber-500" weight="duotone" />
                ) : (
                  <Moon className="h-5 w-5 text-gray-600" weight="duotone" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-5xl font-playfair font-bold text-gray-900 dark:text-white mb-6">
            Explore stories from history
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Learn something new every day
          </p>
        </div>

        <div 
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-10 transition-all duration-500 ease-in-out cursor-pointer min-h-[300px] relative backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 dark:bg-gray-800/95 rounded-2xl">
              <LoadingFacts />
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-red-500 dark:text-red-400 text-center mb-4">{error}</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fetchRandomArticle();
                }}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : currentArticle && (
            <div className={`flex flex-col transform transition-all duration-700 ease-out ${
              showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <div className="flex justify-between items-start mb-6 relative">
                <div className="flex-1 flex items-start space-x-4">
                  <BookOpen className="h-10 w-10 text-amber-600 dark:text-amber-500 flex-shrink-0" weight="duotone" />
                  <div className="flex-1 flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-4xl font-playfair font-bold text-gray-900 dark:text-white mb-4 leading-tight">{currentArticle.title}</h3>
                    </div>
                    <div className="flex items-center space-x-3 ml-4 relative">
                      <span className="px-4 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-sm font-medium whitespace-nowrap shadow-sm">
                        {currentArticle.category}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {!isExpanded && (
                <p className="text-gray-700 dark:text-gray-200 line-clamp-3 mb-6 transition-all duration-500">
                  {currentArticle.definition.split('\n\n')[0]}
                </p>
              )}
              
              <div className={`transition-all duration-500 ease-out ${
                isExpanded ? 'opacity-100' : 'opacity-0'
              }`}>
                <div className={`space-y-4 transition-all duration-500 ease-out overflow-hidden ${
                  isExpanded ? 'opacity-100' : 'opacity-0 h-0'
                }`}>
                  {currentArticle.definition.split('\n\n').map((paragraph, index) => (
                    <p key={index} className="text-gray-700 dark:text-gray-200">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
              
              {!isExpanded && (
                <div className="flex justify-center mt-4 transition-opacity duration-500">
                  <Sparkle className="h-6 w-6 text-amber-400 dark:text-amber-500 animate-pulse" weight="fill" />
                </div>
              )}
              
              <div className="absolute bottom-4 right-4">
                <ReadItToMe text={isExpanded ? currentArticle.definition : currentArticle.definition.split('\n\n')[0]} />
              </div>
              
              <p className="text-gray-600 dark:text-gray-300 italic text-center mt-4">
                {isExpanded ? 'Click to collapse' : 'Click to reveal...'}
              </p>
            </div>
          )}
        </div>

        {/* Related Articles Section */}
        {currentArticle && !isLoading && !error && (
          <>
            <div className={`mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 transition-all duration-500 ${
              showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}>
              {currentArticle.relatedArticles
                .sort((a, b) => {
                  const typeOrder = { direct: 0, related: 1, broader: 2 };
                  return typeOrder[a.type as keyof typeof typeOrder] - typeOrder[b.type as keyof typeof typeOrder];
                })
                .map((related, index) => (
                <div
                  key={index}
                  className={`relative overflow-hidden group transition-all duration-500 ${
                    showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  }`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                  onClick={() => fetchArticleData(related.title)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && fetchArticleData(related.title)}
                >
                  <div className="relative bg-white dark:bg-gray-800 backdrop-blur-sm rounded-2xl shadow-lg transform transition-transform duration-300 group-hover:-translate-y-1">
                    <div className="aspect-[3/1.5] w-full overflow-hidden rounded-t-2xl bg-gray-100 dark:bg-gray-700 shadow-sm relative">
                      {related.image ? (
                        <img
                          src={related.image.url}
                          alt={related.image.caption}
                         className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                         style={{ objectPosition: related.image.position }}
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-amber-50 to-orange-50 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform duration-300">
                          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-amber-100/30 dark:from-transparent dark:to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          {React.createElement(getCategoryIcon(related.title + ' ' + related.extract), {
                            className: "h-16 w-16 text-amber-500/50 dark:text-amber-400/50 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300",
                            strokeWidth: 1.5
                          })}
                          <div className="absolute inset-0 bg-gradient-to-b from-amber-50/30 dark:from-gray-800/30 to-transparent" />
                        </div>
                      )}
                    </div>
                    <span className={`absolute top-3 right-3 px-2.5 py-1 text-xs font-medium shadow-sm ${
                    related.type === 'direct' ? 'bg-emerald-500 text-white' :
                    related.type === 'related' ? 'bg-purple-500 text-white' :
                    related.type === 'broader' ? 'bg-blue-500 text-white' :
                    'bg-indigo-500 text-white'
                    } rounded-full shadow-md`}>
                    {related.type === 'direct' ? '✨ Down the Rabbit Hole' :
                     related.type === 'related' ? '🔄 Plot Twist' :
                     related.type === 'broader' ? '🌟 Mind Expansion' :
                     '🌌 Quantum Leap'}
                    </span>
                  </div>
                  <div className="p-4">
                    <h4 className="font-playfair font-bold text-xl text-gray-900 dark:text-white group-hover:text-amber-500 transition-colors leading-snug mb-2">
                      {related.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {related.extract}
                    </p>
                  </div>
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-gray-900/5 dark:ring-white/5 group-hover:ring-amber-500/20 transition-colors"></div>
                </div>
              ))}
            </div>

            {/* New Article button - closer to cards */}
            <div className="mt-8 text-center">
              <button
                onClick={fetchRandomArticle}
                className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
              >
                <Compass className="h-5 w-5" weight="fill" />
                <span>New Article</span>
              </button>
            </div>

            {/* Article Type Key - with more spacing */}
            <div className={`mt-16 flex justify-center transition-all duration-500 ${
              showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}>
              <div className="inline-block bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 shadow-lg">
                <div className="grid gap-3">
                  <div className="flex items-center space-x-3">
                    <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500 text-white rounded-full shadow-sm whitespace-nowrap">
                      ✨ Down the Rabbit Hole
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Deep dives into specific aspects
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="px-2 py-0.5 text-xs font-medium bg-purple-500 text-white rounded-full shadow-sm whitespace-nowrap">
                      🔄 Plot Twist
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Interesting related connections
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-500 text-white rounded-full shadow-sm whitespace-nowrap">
                      🌟 Mind Expansion
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Broader context and concepts
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="px-2 py-0.5 text-xs font-medium bg-indigo-500 text-white rounded-full shadow-sm whitespace-nowrap">
                      🌌 Quantum Leap
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Find unexpected discoveries
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="mt-auto py-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center">
            <a 
              href="https://lg.media" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-500 dark:text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors text-sm font-medium"
            >
              Made for goats <span className="text-amber-500 mx-1">🐐</span> by LG Media
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
