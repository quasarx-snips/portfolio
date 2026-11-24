export interface NameLine {
  script: 'en' | 'hi' | 'bn';
  text: string;
  lang: string;
  label: string;
}

export const NARRATIVE: readonly string[] = [
  'Somewhere beyond the familiar...',
  '...between what is known...',
  '...and what is yet to be imagined...',
  '...lies a world waiting to be discovered.',
];

export const NAMES: readonly NameLine[] = [
  { script: 'en', text: 'Bibhab', lang: 'en', label: 'Bibhab, in English' },
  { script: 'hi', text: 'बिभव', lang: 'hi', label: 'Bibhab, in Hindi' },
  { script: 'bn', text: 'বিভব', lang: 'bn', label: 'Bibhab, in Bengali' },
];

export const SUBTITLE = 'An explorer of ideas, systems and possibilities.';

export const TITLE = 'The Palace of Many Worlds';
