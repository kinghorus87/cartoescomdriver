// Utilitários para gestão de cores de cartões, paletas de temas e limpeza de nomes
import { ThemeConfig } from '../types';

export const CARD_COLOR_PRESETS = [
  { name: 'Nubank (Roxo)', color: '#820ad1' },
  { name: 'Caixa (Azul)', color: '#0284c7' },
  { name: 'Banco do Brasil (Amarelo)', color: '#facc15' },
  { name: 'Bradesco (Vermelho)', color: '#dc2626' },
  { name: 'Inter (Laranja)', color: '#ea580c' },
  { name: 'Santander (Rubi)', color: '#ef4444' },
  { name: 'Neon (Ciano)', color: '#06b6d4' },
  { name: 'C6 Bank (Prata Grafite)', color: '#475569' },
  { name: 'Itaú (Laranja Intenso)', color: '#f97316' },
  { name: 'Esmeralda (Verde)', color: '#10b981' },
  { name: 'Índigo Real', color: '#6366f1' },
  { name: 'Rosa Vibrante', color: '#ec4899' },
];

export interface CompleteThemePreset {
  id: string;
  name: string;
  description: string;
  bg: string;
  panel: string;
  accent: string;
  text: string;
  tagColor: string;
}

export const COMPLETE_THEME_PRESETS: CompleteThemePreset[] = [
  {
    id: 'ocean',
    name: 'Azul Oceano Profundo (Padrão)',
    description: 'Tons oceânicos clássicos com azul céu e texto nítido',
    bg: '#071326',
    panel: '#0d1b2a',
    accent: '#38bdf8',
    text: '#f8fafc',
    tagColor: '#38bdf8',
  },
  {
    id: 'charcoal',
    name: 'Grafite & Âmbar Dourado',
    description: 'Estilo executivo neutro com detalhes dourados',
    bg: '#121214',
    panel: '#1f1f23',
    accent: '#f59e0b',
    text: '#f4f4f5',
    tagColor: '#f59e0b',
  },
  {
    id: 'emerald',
    name: 'Floresta Esmeralda',
    description: 'Verde noturno sofisticado e descansado para a visão',
    bg: '#041710',
    panel: '#08261b',
    accent: '#10b981',
    text: '#ecfdf5',
    tagColor: '#10b981',
  },
  {
    id: 'burgundy',
    name: 'Bordô & Carmim Noturno',
    description: 'Paleta nobre de vinho com toques de rosa vivo',
    bg: '#18050e',
    panel: '#260b18',
    accent: '#f43f5e',
    text: '#fff1f2',
    tagColor: '#f43f5e',
  },
  {
    id: 'cyber-purple',
    name: 'Cyber Roxo & Índigo',
    description: 'Visual moderno e imersivo com violeta luminoso',
    bg: '#09081a',
    panel: '#15122e',
    accent: '#a855f7',
    text: '#f5f3ff',
    tagColor: '#a855f7',
  },
  {
    id: 'clean-light',
    name: 'Minimalista Claro (Neve)',
    description: 'Tema claro de alto contraste, limpo e profissional',
    bg: '#f1f5f9',
    panel: '#ffffff',
    accent: '#0284c7',
    text: '#0f172a',
    tagColor: '#0284c7',
  },
];

export const THEME_BG_PRESETS = [
  {
    id: 'deep-ocean',
    name: 'Azul Oceano Profundo',
    color: '#071326',
    preview: '#071326',
    tagColor: '#38bdf8',
    gradient: 'from-[#071326] via-[#0d2342] to-[#071326]',
  },
  {
    id: 'charcoal-dark',
    name: 'Grafite Escuro Neutro',
    color: '#121214',
    preview: '#121214',
    tagColor: '#a1a1aa',
    gradient: 'from-[#121214] via-[#202024] to-[#121214]',
  },
  {
    id: 'forest-emerald',
    name: 'Esmeralda Floresta Profunda',
    color: '#041710',
    preview: '#041710',
    tagColor: '#10b981',
    gradient: 'from-[#041710] via-[#092d20] to-[#041710]',
  },
  {
    id: 'wine-burgundy',
    name: 'Bordô / Vinho Noturno',
    color: '#18050e',
    preview: '#18050e',
    tagColor: '#f43f5e',
    gradient: 'from-[#18050e] via-[#2e0b1c] to-[#18050e]',
  },
  {
    id: 'cyber-indigo',
    name: 'Índigo Espacial',
    color: '#09081a',
    preview: '#09081a',
    tagColor: '#a855f7',
    gradient: 'from-[#09081a] via-[#161233] to-[#09081a]',
  },
  {
    id: 'clean-light',
    name: 'Cinza Claro (Dia)',
    color: '#f1f5f9',
    preview: '#f1f5f9',
    tagColor: '#0284c7',
    gradient: 'from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0]',
  },
];

export const THEME_PANEL_PRESETS = [
  { id: 'ocean-panel', name: 'Azul Meia-Noite', color: '#0d1b2a' },
  { id: 'slate', name: 'Ardósia Escura', color: '#0f172a' },
  { id: 'charcoal-panel', name: 'Carvão Mineral', color: '#18181b' },
  { id: 'emerald-panel', name: 'Verde Floresta', color: '#062016' },
  { id: 'wine-panel', name: 'Ameixa Escura', color: '#260b18' },
  { id: 'indigo-panel', name: 'Índigo Profundo', color: '#15122e' },
  { id: 'light-panel', name: 'Branco Puro (Claro)', color: '#ffffff' },
  { id: 'slate-light-panel', name: 'Gelo Suave (Claro)', color: '#f8fafc' },
];

export const THEME_ACCENT_PRESETS = [
  { id: 'sky', name: 'Azul Céu (Padrão)', color: '#38bdf8', class: 'text-sky-400 bg-sky-500/15' },
  { id: 'emerald', name: 'Esmeralda', color: '#10b981', class: 'text-emerald-400 bg-emerald-500/15' },
  { id: 'amber', name: 'Âmbar Dourado', color: '#f59e0b', class: 'text-amber-400 bg-amber-500/15' },
  { id: 'purple', name: 'Roxo Elétrico', color: '#a855f7', class: 'text-purple-400 bg-purple-500/15' },
  { id: 'rose', name: 'Rosa Carmim', color: '#f43f5e', class: 'text-rose-400 bg-rose-500/15' },
  { id: 'cyan', name: 'Ciano Neon', color: '#06b6d4', class: 'text-cyan-400 bg-cyan-500/15' },
  { id: 'orange', name: 'Laranja Solar', color: '#f97316', class: 'text-orange-400 bg-orange-500/15' },
  { id: 'blue', name: 'Azul Safira', color: '#2563eb', class: 'text-blue-400 bg-blue-500/15' },
];

export const THEME_TEXT_PRESETS = [
  { id: 'white-ice', name: 'Branco Gelo (Padrão)', color: '#f8fafc' },
  { id: 'silver', name: 'Prata Suave', color: '#e2e8f0' },
  { id: 'cream', name: 'Marfim Dourado', color: '#fef3c7' },
  { id: 'mint', name: 'Menta Clara', color: '#ecfdf5' },
  { id: 'cyan-tint', name: 'Ciano Suave', color: '#e0f2fe' },
  { id: 'lavender', name: 'Lavanda Suave', color: '#f5f3ff' },
  { id: 'dark-slate', name: 'Preto Noturno (Para fundo claro)', color: '#0f172a' },
  { id: 'charcoal-text', name: 'Grafite Escuro', color: '#1e293b' },
];

export const TEXT_COLOR_PRESETS = [
  { name: 'Branco Puro', color: '#ffffff' },
  { name: 'Branco Gelo', color: '#f8fafc' },
  { name: 'Preto Noturno', color: '#0f172a' },
  { name: 'Cinza Ardósia', color: '#1e293b' },
  { name: 'Amarelo Suave', color: '#fef08a' },
  { name: 'Azul Céu', color: '#38bdf8' },
  { name: 'Verde Menta', color: '#4ade80' },
  { name: 'Rosa Pastel', color: '#f472b6' },
];

/**
 * Retorna a cor personalizada do cartão ou sugere a cor oficial do banco com base no nome.
 */
export function getCardColor(card?: { name: string; color?: string }): string {
  if (!card) return '#38bdf8';
  if (card.color && card.color.startsWith('#')) {
    return card.color;
  }

  const nameUpper = (card.name || '').toUpperCase();
  if (nameUpper.includes('NUBANK')) return '#820ad1';
  if (nameUpper.includes('CAIXA')) return '#0284c7';
  if (nameUpper.includes('BRASIL') || nameUpper.includes('BB')) return '#facc15';
  if (nameUpper.includes('BRADESCO')) return '#dc2626';
  if (nameUpper.includes('INTER')) return '#ea580c';
  if (nameUpper.includes('SANTANDER')) return '#ef4444';
  if (nameUpper.includes('ITAU') || nameUpper.includes('ITAÚ')) return '#f97316';
  if (nameUpper.includes('NEON')) return '#06b6d4';
  if (nameUpper.includes('C6')) return '#475569';
  if (nameUpper.includes('MERCADO')) return '#009ee3';
  if (nameUpper.includes('PAN')) return '#0284c7';

  return '#38bdf8';
}

/**
 * Limpa sufixos redundantes no nome do cartão como '(Leão)', '(dia 16)', '(16)' e final do cartão
 * para exibição estritamente limpa em formulários e seletores.
 */
export function cleanCardName(name: string): string {
  if (!name) return '';
  return name
    .replace(/\s*\(Le[ãa]o\)/gi, '')
    .replace(/\s*\(Final\s*\d+\)/gi, '')
    .replace(/\s*\(\s*dia\s*\d+\s*\)/gi, '')
    .replace(/\s*\(\s*\d+\s*\)/gi, '')
    .trim();
}

/**
 * Extrai rigorosamente o dia numérico do vencimento (ex: 'Dia 10' -> 10, ' 5 ' -> 5, '25' -> 25).
 * Cartões sem vencimento recebem 999 para posicionamento previsível ao final da lista.
 */
export function extractDueDayNumber(dueDay?: string | number): number {
  if (dueDay === undefined || dueDay === null) return 999;
  if (typeof dueDay === 'number') return isNaN(dueDay) ? 999 : dueDay;
  const match = String(dueDay).match(/\d+/);
  return match ? parseInt(match[0], 10) : 999;
}

/**
 * Retorna a cor de fundo efetiva definida pelo usuário ou padrão.
 */
export function getResolvedBgColor(themeConfig?: ThemeConfig): string {
  if (themeConfig?.customBg && themeConfig.customBg.trim()) {
    return themeConfig.customBg.trim();
  }
  const preset = THEME_BG_PRESETS.find((p) => p.id === themeConfig?.bgPreset);
  return preset ? preset.color : '#071326';
}

/**
 * Retorna a cor de destaque efetiva definida pelo usuário ou padrão sky.
 */
export function getResolvedAccentColor(themeConfig?: ThemeConfig): string {
  if (themeConfig?.customAccent && themeConfig.customAccent.trim()) {
    return themeConfig.customAccent.trim();
  }
  const preset = THEME_ACCENT_PRESETS.find((p) => p.id === themeConfig?.accentPreset);
  return preset ? preset.color : '#38bdf8';
}

/**
 * Retorna a cor de painéis e caixas (cards, balões, cabeçalhos internos).
 * Padrão: '#0f172a' (slate-900 / dark slate).
 */
export function getResolvedPanelColor(themeConfig?: ThemeConfig): string {
  if (themeConfig?.customPanelColor && themeConfig.customPanelColor.trim()) {
    return themeConfig.customPanelColor.trim();
  }
  const preset = THEME_PANEL_PRESETS.find((p) => p.id === themeConfig?.panelPreset);
  return preset ? preset.color : '#0f172a';
}

/**
 * Retorna a cor de letras e legendas (títulos, textos principais e legendas).
 * Padrão: '#f8fafc' (branco gelo).
 */
export function getResolvedTextColor(themeConfig?: ThemeConfig): string {
  if (themeConfig?.customTextColor && themeConfig.customTextColor.trim()) {
    return themeConfig.customTextColor.trim();
  }
  const preset = THEME_TEXT_PRESETS.find((p) => p.id === themeConfig?.textPreset);
  if (preset) return preset.color;

  const panel = getResolvedPanelColor(themeConfig);
  const bg = getResolvedBgColor(themeConfig);
  if (isLightColor(panel) || isLightColor(bg)) {
    return '#0f172a';
  }
  return '#f8fafc';
}

/**
 * Determina se uma cor é clara (luminosidade >= 128)
 */
export function isLightColor(hexColor: string): boolean {
  if (!hexColor) return false;
  let hex = hexColor.replace('#', '').trim();
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (hex.length !== 6) return false;
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128;
}

/**
 * Determina se a cor de destaque é escura (ex: preto #000, grafite, azul escuro)
 * para garantir contraste e legibilidade ideais.
 */
export function isDarkAccent(hexColor: string): boolean {
  return !isLightColor(hexColor);
}

/**
 * Retorna cor de texto de alto contraste (#ffffff ou #000000) baseada na luminosidade da cor de fundo.
 * Suporta hex (3 e 6 dígitos com ou sem #), rgb(...) e rgba(...).
 * Luminosidade percebida YIQ (ITU-R BT.601):
 * - Fundo escuro (YIQ < 128): texto branco #ffffff
 * - Fundo claro (YIQ >= 128): texto preto #000000
 */
export function getAutoContrastTextColor(bgColor?: string): '#ffffff' | '#000000' {
  if (!bgColor) return '#ffffff';
  const clean = bgColor.trim().toLowerCase();
  
  if (clean === 'transparent' || clean === 'rgba(0, 0, 0, 0)') {
    return '#ffffff';
  }

  let r = 0, g = 0, b = 0;

  const rgbMatch = clean.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    r = parseInt(rgbMatch[1], 10) || 0;
    g = parseInt(rgbMatch[2], 10) || 0;
    b = parseInt(rgbMatch[3], 10) || 0;
  } else {
    let hex = clean.replace('#', '').trim();
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16) || 0;
      g = parseInt(hex.substring(2, 4), 16) || 0;
      b = parseInt(hex.substring(4, 6), 16) || 0;
    } else {
      return '#ffffff';
    }
  }

  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
}

/**
 * Retorna cor de texto de alto contraste (#ffffff ou #000000) baseada na cor de fundo.
 */
export function getContrastTextColor(hexColor: string): '#000000' | '#ffffff' {
  return getAutoContrastTextColor(hexColor);
}

/**
 * Retorna uma variação derivada e harmoniosa para textos secundários e legendas,
 * garantindo que acompanhe fielmente a cor escolhida em "Letras" (ex: se preto, gera um cinza-escuro/preto atenuado;
 * se cinza, gera um cinza proporcional; se outra cor, gera variação suave da mesma cor sem desvios azulados).
 */
export function getDerivedTextColor(baseColor: string, alpha: number): string {
  if (!baseColor) return `rgba(148, 163, 184, ${alpha})`;
  let hex = baseColor.replace('#', '').trim();
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return baseColor;
}

/**
 * Retorna a cor secundária / atenuada para legendas derivada diretamente da cor de texto escolhida.
 */
export function getResolvedMutedTextColor(textColor: string, _panelOrBgColor?: string): string {
  return getDerivedTextColor(textColor || '#f8fafc', 0.72);
}

/**
 * Retorna a cor terciária / sutil para textos complementares e notas.
 */
export function getResolvedSubtleTextColor(textColor: string, _panelOrBgColor?: string): string {
  return getDerivedTextColor(textColor || '#f8fafc', 0.55);
}

/**
 * Retorna a cor de borda proporcional aos painéis.
 */
export function getResolvedBorderColor(panelColor: string): string {
  return isLightColor(panelColor) ? 'rgba(15, 23, 42, 0.12)' : 'rgba(148, 163, 184, 0.16)';
}

/**
 * Retorna o fundo sutil (cabeçalhos de tabela, cards aninhados).
 */
export function getResolvedPanelSubtleColor(panelColor: string): string {
  return isLightColor(panelColor) ? '#f1f5f9' : 'rgba(255, 255, 255, 0.05)';
}

/**
 * Retorna a cor de fundo dos campos de input.
 */
export function getResolvedInputBgColor(panelColor: string): string {
  return isLightColor(panelColor) ? 'rgba(241, 245, 249, 0.9)' : 'rgba(0, 0, 0, 0.3)';
}

/**
 * Extrai os dígitos finais de um cartão (ex: '•••• 1234' -> '1234', 'FINAL 5678' -> '5678').
 * Se não houver dígitos válidos ou se o campo estiver vazio, retorna string vazia.
 */
export function extractCardFinalDigits(cardOrDigits?: { finalCard?: string; isFisico?: string; isVirtual?: string } | string): string {
  if (!cardOrDigits) return '';
  if (typeof cardOrDigits === 'string') {
    const digits = cardOrDigits.replace(/\D/g, '');
    return digits ? digits.slice(-4) : '';
  }
  const sources = [cardOrDigits.finalCard, cardOrDigits.isFisico, cardOrDigits.isVirtual];
  for (const src of sources) {
    if (!src) continue;
    const digits = src.replace(/\D/g, '');
    if (digits && digits.length >= 2) {
      return digits.slice(-4);
    }
  }
  return '';
}
