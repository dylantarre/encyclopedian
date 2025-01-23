export type ImagePosition = {
  url: string;
  position: string;
};

export type ArticleData = {
  title: string;
  definition: string;
  image: {
    url: string;
    caption: string;
    position?: string;
  } | null;
  example: string;
  category: string;
  relatedArticles: {
    title: string;
    extract: string;
    image: {
      url: string;
      caption: string;
      position?: string;
    } | null;
  }[];
}; 