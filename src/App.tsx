import React, { useState, useEffect, useRef, MouseEvent } from 'react';
import { 
  Book, 
  MagnifyingGlass, 
  Sparkle, 
  BookOpen, 
  Sun, 
  Moon, 
  Compass, 
  Copy 
} from '@phosphor-icons/react';
import { ReadItToMe } from './components/ReadItToMe';
import { LoadingFacts } from './components/LoadingFacts';
import { useTheme } from './ThemeContext';
import { getFacePosition } from './utils/imageUtils';
import { getCategoryIcon } from './utils/categoryIcons';
import { setFavicon } from './utils/favicon';
import type { 
  WikiSearchResponse, 
  WikiContentResponse, 
  WikiImageResponse, 
  WikiRandomResponse 
} from './types/api';
import type { ArticleData } from './types';
import { useNavigate, useParams } from 'react-router-dom';

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

// Add proper return type
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// Add proper type for page parameter
const isValidArticle = (page: Record<string, any>): boolean => {
  if (!page || page.missing || !page.extract) return false;
  
  const extract = page.extract.trim();
  if (extract.length < 100) return false;
  
  if (page.title.includes('(disambiguation)') || 
      extract.toLowerCase().includes('may refer to:') ||
      extract.toLowerCase().includes('disambiguation page')) return false;
  
  if (page.title.startsWith('List of') || 
      page.title.startsWith('Index of')) return false;
      
  return true;
};

function App(): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { isDark, toggleTheme } = useTheme();
  const [currentArticle, setCurrentArticle] = useState<ArticleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const isInitialMount = useRef(true);
  const [isImageExpanded, setIsImageExpanded] = useState<boolean>(false);
  const [showCopied, setShowCopied] = useState(false);
  const navigate = useNavigate();
  const { articleTitle } = useParams();
  const isLoadingRef = useRef(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const stopSpeech = () => {
    window.speechSynthesis.cancel();
  };

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
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
        
        const data: WikiSearchResponse = await response.json();
        const searchResults = data.query.search;
        
        if (searchResults.length > 0) {
          await fetchArticleData(searchResults[0].title);
        }
      } catch (err: unknown) {
        console.error('Search error:', err);
        setError('Failed to search for articles. Please try again.');
      }
    }, SEARCH_DEBOUNCE);
  };

  const fetchArticleImage = async (title: string) => {
    try {
      console.log('Fetching image for:', title);
      const imageResponse = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail|original&pithumbsize=1000&titles=${encodeURIComponent(title)}&origin=*`
      );
      
      if (!imageResponse.ok) {
        console.warn('Failed to fetch image:', imageResponse.statusText);
        return null;
      }

      const imageData = await imageResponse.json();
      console.log('Image data:', imageData);
      
      const imagePages = imageData.query.pages;
      const imagePage = imagePages[Object.keys(imagePages)[0]];
      let mainImagePosition = 'center 25%';

      // Get the actual image URL
      const imageUrl = imagePage.thumbnail?.source;
      if (!imageUrl) {
        console.warn('No image URL found');
        return null;
      }

      console.log('Found image URL:', imageUrl);

      // Try to get cached position first
      const cachedPosition = imagePositionCache.get(imageUrl);
      if (cachedPosition) {
        mainImagePosition = cachedPosition;
      } else {
        mainImagePosition = await getFacePosition(imageUrl);
        imagePositionCache.set(imageUrl, mainImagePosition);
      }

      return {
        url: imageUrl,
        caption: '',
        credit: '',
        position: mainImagePosition
      };
    } catch (err) {
      console.error('Error fetching image:', err);
      return null;
    }
  };

  const fetchRelatedArticles = async (links: Array<{ title: string }>) => {
    const relatedArticles = [];
    
    for (const link of links) {
      if (relatedArticles.length >= 9) break;
      
      try {
        const response = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=original|thumbnail&pithumbsize=400&titles=${encodeURIComponent(link.title)}&origin=*`
        );

        if (!response.ok) continue;

        const data = await response.json();
        const pages = data.query.pages;
        const page = pages[Object.keys(pages)[0]];

        if (page.missing || !page.extract) continue;

        const imageUrl = page.original?.source || page.thumbnail?.source;
        
        relatedArticles.push({
          title: page.title,
          extract: page.extract,
          image: imageUrl ? {
            url: imageUrl,
            caption: '',
            position: 'center'
          } : null
        });
      } catch (err) {
        console.warn(`Failed to fetch related article ${link.title}:`, err);
        continue;
      }
    }

    return relatedArticles;
  };

  const fetchArticleData = async (title: string): Promise<void> => {
    if (isLoadingRef.current) {
      console.log('Already loading, skipping fetch');
      return;
    }
    
    try {
      console.log('Starting fetch for:', title);
      isLoadingRef.current = true;
      
      // Clear everything at once
      setShowContent(false);
      setCurrentArticle(null);
      stopSpeech();
      setError(null);
      setIsLoading(true);
      
      // Fetch and process all data first
      const contentResponse = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|categories|links&explaintext=1&exsectionformat=plain&exlimit=1&titles=${encodeURIComponent(title)}&pllimit=50&origin=*`
      );
      
      if (!contentResponse.ok) {
        throw new Error('Failed to fetch from Wikipedia API');
      }
      
      const contentData: WikiContentResponse = await contentResponse.json();
      const pages = contentData.query.pages;
      const page = pages[Object.keys(pages)[0]];

      if (page.missing) {
        throw new Error('Article not found');
      }

      const extract = page.extract;
      const categories = page.categories?.map(c => c.title) || [];
      const relevantCategory = categories.find(c => !c.includes(':')) || 'General';

      // 3. Fetch image and related articles in parallel
      const [mainImage, relatedArticles] = await Promise.all([
        fetchArticleImage(title),
        fetchRelatedArticles(page.links || [])
      ]);

      // 4. Set all data at once when everything is ready
      const articleData = {
        title: title,
        definition: extract,
        image: mainImage,
        category: relevantCategory,
        relatedArticles: relatedArticles.slice(0, 9)
      };

      console.log('Fetch complete, updating state');
      setCurrentArticle(articleData);
      setIsLoading(false);
      setShowContent(true);

      // Update URL last, after content is loaded
      navigate(`/article/${encodeURIComponent(title)}`, { replace: true });
      
    } catch (err: unknown) {
      console.error('Fetch failed:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
      setIsLoading(false);
      setShowContent(false);
    } finally {
      isLoadingRef.current = false;
      console.log('Fetch cycle complete');
    }
  };

  const fetchRandomArticle = async (retryCount = 0): Promise<void> => {
    stopSpeech();
    setIsLoading(true);
    setShowContent(false);
    setError(null);
    
    try {
      const response = await fetch(
        'https://en.wikipedia.org/w/api.php?action=query&format=json&list=random&rnnamespace=0&rnlimit=1&origin=*&rnminsize=3000&rnfilterredir=nonredirects'
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch random article');
      }
      
      const data: WikiRandomResponse = await response.json();
      await fetchArticleData(data.query.random[0].title).catch(async (err) => {
        if (retryCount < 4) { // Try up to 5 times (initial + 4 retries)
          console.log(`Retrying... Attempt ${retryCount + 2}/5`);
          await fetchRandomArticle(retryCount + 1);
        } else {
          throw err; // If all retries fail, throw the error
        }
      });
      
    } catch (err: unknown) {
      if (retryCount < 4) {
        console.log(`Retrying... Attempt ${retryCount + 2}/5`);
        await fetchRandomArticle(retryCount + 1);
      } else {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to fetch a random article. Please try again.');
        }
        console.error('Error fetching random article:', err);
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    // Skip the first render since we'll fetch random article
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (!articleTitle) {
        fetchRandomArticle();
      }
      return;
    }

    let isCancelled = false;

    // Only fetch if we have a title and it's different from current
    if (articleTitle && (!currentArticle || articleTitle !== currentArticle.title)) {
      console.log('URL changed, fetching:', articleTitle);
      const title = decodeURIComponent(articleTitle);
      
      // Wait for any current fetch to complete
      setTimeout(() => {
        if (!isCancelled && !isLoadingRef.current) {
          fetchArticleData(title);
        }
      }, 100);
    }

    return () => {
      isCancelled = true;
    };
  }, [articleTitle, currentArticle?.title]);

  useEffect(() => {
    setFavicon();
    return () => {
      const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (favicon) {
        favicon.href = '/favicon.ico';
      }
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current && 
        !searchContainerRef.current.contains(event.target as Node) && 
        isSearchExpanded && 
        !searchQuery
      ) {
        setIsSearchExpanded(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSearchExpanded, searchQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 font-sans transition-colors duration-200">
      <header className="bg-white dark:bg-gray-800 shadow-sm transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            {/* Logo and search section */}
            <div className="flex items-center justify-between gap-4 w-full">
              {/* Logo - hide on mobile when search is expanded */}
              <div className={`transition-all duration-300 ${
                isSearchExpanded ? 'hidden md:flex' : 'flex'
              }`}>
                <a 
                  href="/"
                  className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.reload();
                  }}
                >
                  <Book className="h-8 w-8 text-amber-600 dark:text-amber-500" weight="duotone" />
                  <h1 className="text-2xl font-playfair font-bold text-gray-900 dark:text-white">
                    Encyclopedian
                  </h1>
                </a>
              </div>

              {/* Search */}
              <div 
                ref={searchContainerRef}
                className={`relative transition-all duration-300 ${
                  isSearchExpanded ? 'w-full' : 'w-10 md:w-80'
                }`}
              >
                {/* Mobile search button */}
                <button 
                  className={`md:hidden absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 ${
                    isSearchExpanded ? 'hidden' : 'block'
                  }`}
                  onClick={() => setIsSearchExpanded(true)}
                  aria-label="Open search"
                >
                  <MagnifyingGlass className="h-5 w-5" weight="duotone" />
                </button>

                {/* Search input */}
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={handleSearch}
                  onBlur={() => !searchQuery && setIsSearchExpanded(false)}
                  className={`w-full bg-gray-100 dark:bg-gray-800 dark:text-white rounded-lg pl-10 pr-4 py-2 text-sm transition-all duration-300 ${
                    isSearchExpanded ? 'opacity-100' : 'opacity-0 md:opacity-100'
                  }`}
                />

                {/* Search icon */}
                <div className={`absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 ${
                  isSearchExpanded ? 'block' : 'hidden md:block'
                }`}>
                  <MagnifyingGlass className="h-5 w-5" weight="duotone" />
                </div>
              </div>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className={`transition-all duration-300 ${
                  isSearchExpanded ? 'hidden md:block' : 'block'
                }`}
                aria-label="Toggle theme"
              >
                {isDark ? (
                  <Sun className="h-5 w-5 text-amber-400" weight="duotone" />
                ) : (
                  <Moon className="h-5 w-5 text-amber-400" weight="duotone" />
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
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 dark:bg-gray-800/95 rounded-2xl w-full px-10">
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
            <div className={`flex flex-col ${
              showContent ? 'block' : 'hidden'
            }`}>
              {/* Image Section */}
              {currentArticle.image && (
                <div 
                  className={`w-full overflow-hidden rounded-xl relative transition-all duration-500 cursor-pointer mb-8 ${
                    isImageExpanded ? 'h-[800px]' : isExpanded ? 'h-[600px]' : 'h-[400px]'
                  }`}
                  onClick={(e: MouseEvent<HTMLDivElement>) => {
                    e.stopPropagation();
                    setIsImageExpanded(!isImageExpanded);
                  }}
                >
                  <img
                    src={currentArticle.image.url}
                    alt={currentArticle.image.caption || currentArticle.title}
                    className={`w-full h-full object-cover transition-all duration-500 ${
                      isImageExpanded ? 'scale-110' : isExpanded ? 'scale-105' : 'scale-100'
                    }`}
                    style={{ objectPosition: currentArticle.image.position || 'center' }}
                  />
                  {currentArticle.image.caption && currentArticle.image.caption !== '' && (
                    <div className="absolute top-0 right-0 bg-black/50 text-white p-2 text-sm rounded-bl-lg">
                      {currentArticle.image.caption}
                    </div>
                  )}
                  {currentArticle.image.credit && (
                    <div className="absolute bottom-0 right-0 bg-black/50 text-white p-2 text-xs rounded-tl-lg">
                      Photo: {currentArticle.image.credit}
                    </div>
                  )}
                </div>
              )}

              {/* Title and Category Section */}
              <div className="flex flex-col md:flex-row justify-between items-start mb-8 relative">
                <div className="flex flex-col md:flex-row md:items-start w-full gap-4">
                  {/* Icon and Category */}
                  <div className="flex items-center justify-between w-full md:w-auto mb-4 md:mb-0">
                    <div className="flex items-center gap-4">
                      <BookOpen className="h-10 w-10 text-amber-600 dark:text-amber-500 flex-shrink-0" weight="duotone" />
                      <div className="flex items-center space-x-3">
                        <span className="px-4 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-sm font-medium whitespace-nowrap shadow-sm">
                          {currentArticle.category}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Title */}
                  <div className="flex-1">
                    <h3 className="text-4xl font-playfair font-bold text-gray-900 dark:text-white leading-tight">
                      {currentArticle.title}
                    </h3>
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
                  isExpanded ? 'opacity-100 pb-12' : 'opacity-0 h-0'
                }`}>
                  {currentArticle.definition.split('\n\n').map((paragraph, index) => (
                    <p key={index} className="text-gray-700 dark:text-gray-200">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
              
              {isExpanded ? (
                <div className="flex justify-center mt-4 mb-16 md:mb-4">
                  <p className="text-gray-600 dark:text-gray-300 italic text-center group">
                    <span className="inline-flex items-center gap-2 transition-all duration-300 group-hover:text-amber-400 dark:group-hover:text-amber-500">
                      Click to collapse
                      <span className="inline-block transition-transform duration-300 group-hover:-translate-y-1">↑</span>
                    </span>
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center mt-4 mb-16 md:mb-4 transition-opacity duration-500 group">
                  <Sparkle 
                    className="h-6 w-6 text-amber-400 dark:text-amber-500 mb-4 animate-pulse" 
                    weight="fill" 
                  />
                  <p className="text-gray-600 dark:text-gray-300 italic text-center group-hover:text-amber-400 dark:group-hover:text-amber-500">
                    Click to reveal
                    <span className="inline-block transition-transform duration-300 group-hover:translate-y-1 ml-2">↓</span>
                  </p>
                </div>
              )}
              
              {/* Bottom controls */}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(
                      isExpanded ? currentArticle.definition : currentArticle.definition.split('\n\n')[0]
                    );
                    setShowCopied(true);
                    setTimeout(() => setShowCopied(false), 2000);
                  }}
                  className="group flex items-center gap-2 transition-colors relative"
                  aria-label="Copy article text"
                >
                  <Copy className="h-5 w-5 text-amber-400 dark:text-amber-500 transition-transform duration-300 group-hover:scale-110" weight="duotone" />
                  <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-amber-400 dark:group-hover:text-amber-500">
                    {showCopied ? 'Copied!' : 'Copy text'}
                    </span>
                </button>

                <ReadItToMe text={isExpanded ? currentArticle.definition : currentArticle.definition.split('\n\n')[0]} />
              </div>
            </div>
          )}
        </div>

        {/* Related Articles Section */}
        {currentArticle && !isLoading && !error && (
          <>
            <div className={`mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 ${
              showContent ? 'block' : 'hidden'
          }`}>
            {currentArticle.relatedArticles
              .sort((a, b) => {
                const typeOrder = { direct: 0, related: 1, broader: 2 };
                return typeOrder[a.type as keyof typeof typeOrder] - typeOrder[b.type as keyof typeof typeOrder];
              })
              .map((related, index) => (
              <div
                key={index}
                  className="relative overflow-hidden group opacity-0 animate-fadeIn"
                  style={{ 
                    animationDelay: `${index * 100}ms`,
                    animationFillMode: 'forwards'
                  }}
                onClick={() => fetchArticleData(related.title)}
                role="button"
                tabIndex={0}
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

            {/* New Article button with animation */}
            <div className="mt-8 text-center">
          <button
            onClick={fetchRandomArticle}
                className="group inline-flex items-center gap-3 px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
              >
                <Compass 
                  className="h-5 w-5 transition-transform duration-300 group-hover:rotate-180" 
                  weight="duotone"
                />
                <span className="text-lg">Discover Another Story</span>
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
          </button>
          </div>

            {/* Article Type Key - with more spacing */}
            <div className={`mt-16 flex justify-center ${
              showContent ? 'block' : 'hidden'
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
