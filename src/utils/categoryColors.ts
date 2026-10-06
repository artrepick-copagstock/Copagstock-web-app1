export interface CategoryColor {
  bg: string;
  text: string;
  border: string;
}

const CATEGORY_PALETTES: CategoryColor[] = [
  { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' }, // blue
  { bg: '#fdf4ff', text: '#a21caf', border: '#f5d0fe' }, // fuchsia
  { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' }, // emerald
  { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' }, // orange
  { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' }, // violet
  { bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4' }, // teal
  { bg: '#fff1f2', text: '#be123c', border: '#fecdd3' }, // rose
  { bg: '#fefce8', text: '#a16207', border: '#fef08a' }, // yellow
  { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' }, // sky
  { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' }, // purple
  { bg: '#f7fee7', text: '#4d7c0f', border: '#d9f99d' }, // lime
  { bg: '#ecfeff', text: '#0e7490', border: '#a5f3fc' }, // cyan
  { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' }, // indigo
  { bg: '#fffbeb', text: '#b45309', border: '#fde68a' }, // amber
  { bg: '#fdf2f8', text: '#be185d', border: '#fbcfe8' }, // pink
  { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' }, // slate
];

export function getCategoryBadgeStyle(category: string): CategoryColor {
  if (!category || category === 'ทั้งหมด') {
    return { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };
  }
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CATEGORY_PALETTES.length;
  return CATEGORY_PALETTES[index];
}
