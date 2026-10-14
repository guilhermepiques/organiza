// Paletas de cor de destaque. O resto da interface usa tons neutros (definidos em css/tokens.css).
// Para criar uma paleta nova, basta adicionar um item aqui: ela aparece sozinha em Ajustes.

export const PALETTES = [
  {
    id: 'grafite',
    name: 'Grafite',
    light: { accent: '#27272a', contrast: '#ffffff', soft: '#ededee' },
    dark: { accent: '#e7e7ea', contrast: '#18181b', soft: '#2a2a2f' },
  },
  {
    id: 'indigo',
    name: 'Índigo',
    light: { accent: '#4f46e5', contrast: '#ffffff', soft: '#eceefe' },
    dark: { accent: '#8b8df8', contrast: '#13132b', soft: '#24244a' },
  },
  {
    id: 'salvia',
    name: 'Sálvia',
    light: { accent: '#4b7a5d', contrast: '#ffffff', soft: '#e9f2ec' },
    dark: { accent: '#8dbf9e', contrast: '#10201a', soft: '#1e2e25' },
  },
  {
    id: 'coral',
    name: 'Coral',
    light: { accent: '#dc4c3e', contrast: '#ffffff', soft: '#fcebe8' },
    dark: { accent: '#f2836f', contrast: '#2a110c', soft: '#3a221d' },
  },
  {
    id: 'oceano',
    name: 'Oceano',
    light: { accent: '#0e7490', contrast: '#ffffff', soft: '#e3f3f7' },
    dark: { accent: '#5cc6de', contrast: '#06222a', soft: '#14303a' },
  },
  {
    id: 'ameixa',
    name: 'Ameixa',
    light: { accent: '#8e3b8a', contrast: '#ffffff', soft: '#f5eaf4' },
    dark: { accent: '#d592d1', contrast: '#2a0f29', soft: '#33203a' },
  },
  {
    id: 'ambar',
    name: 'Âmbar',
    light: { accent: '#b45309', contrast: '#ffffff', soft: '#fbf0e2' },
    dark: { accent: '#f0b25a', contrast: '#2b1a05', soft: '#3a2a14' },
  },
];

/** Cores disponíveis para eventos e blocos no calendário. null = cor de destaque da paleta. */
export const EVENT_COLORS = [
  { id: null, name: 'Destaque' },
  { id: '#3b82f6', name: 'Azul' },
  { id: '#16a34a', name: 'Verde' },
  { id: '#ca8a04', name: 'Mostarda' },
  { id: '#ea580c', name: 'Laranja' },
  { id: '#e11d48', name: 'Vermelho' },
  { id: '#db2777', name: 'Rosa' },
  { id: '#7c3aed', name: 'Roxo' },
  { id: '#0891b2', name: 'Ciano' },
  { id: '#71717a', name: 'Cinza' },
];

export const PROJECT_COLORS = ['#71717a', '#3b82f6', '#16a34a', '#ca8a04', '#ea580c', '#e11d48', '#db2777', '#7c3aed', '#0891b2'];
