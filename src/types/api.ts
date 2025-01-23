export interface WikiSearchResponse {
  query: {
    search: Array<{
      title: string;
      snippet: string;
    }>;
  };
}

export interface WikiContentResponse {
  query: {
    pages: Record<string, {
      extract: string;
      title: string;
      missing?: boolean;
      categories?: Array<{ title: string }>;
      links?: Array<{ title: string }>;
    }>;
  };
}

export interface WikiImageResponse {
  query: {
    pages: Record<string, {
      original?: {
        source: string;
      };
      pageimage?: string;
    }>;
  };
}

export interface WikiRandomResponse {
  query: {
    random: Array<{
      title: string;
    }>;
  };
} 