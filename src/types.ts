export interface Lead {
  name: string;
  phone: string;
  url: string;
}

export interface DemoState {
  step: 'capture' | 'demo';
  lead: Lead | null;
  scrapedKnowledge: string;
  iframeBlocked: boolean;
}
