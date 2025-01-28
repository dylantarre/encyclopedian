import ReactGA4 from 'react-ga4';

const TRACKING_ID = 'G-XXXXXXXXXX'; // Replace with your Google Analytics tracking ID

export const initGA = (): void => {
  ReactGA4.initialize(TRACKING_ID);
};

export const logPageView = (path: string): void => {
  ReactGA4.send({
    hitType: "pageview",
    page: path
  });
};

export const logEvent = (category: string, action: string): void => {
  ReactGA4.event({
    category: category,
    action: action,
  });
}; 