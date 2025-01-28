declare module 'react-ga4' {
  interface EventParams {
    category: string;
    action: string;
  }

  interface PageViewParams {
    hitType: string;
    page: string;
  }

  export function initialize(trackingId: string): void;
  export function send(params: PageViewParams): void;
  export function event(params: EventParams): void;
} 