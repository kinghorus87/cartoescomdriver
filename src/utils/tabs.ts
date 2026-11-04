import { TabPreferences, ViewTab } from '../types';

/** Ordem padrão das páginas da navegação principal. */
export const DEFAULT_TAB_ORDER: ViewTab[] = [
  'limites',
  'matriz',
  'cartoes',
  'dividas',
  'pesquisar',
  'simulador',
  'configuracoes',
];

/**
 * Ordem efetiva das páginas: a ordem salva (ignorando valores inválidos ou repetidos)
 * seguida das páginas que não constam nela, na ordem padrão.
 */
export function resolveTabOrder(prefs?: TabPreferences): ViewTab[] {
  const seen = new Set<ViewTab>();
  const result: ViewTab[] = [];
  (Array.isArray(prefs?.order) ? prefs!.order! : []).forEach((tab) => {
    if (DEFAULT_TAB_ORDER.includes(tab) && !seen.has(tab)) {
      seen.add(tab);
      result.push(tab);
    }
  });
  DEFAULT_TAB_ORDER.forEach((tab) => {
    if (!seen.has(tab)) result.push(tab);
  });
  return result;
}

export function isTabVisible(prefs: TabPreferences | undefined, tab: ViewTab): boolean {
  return prefs?.[tab] !== false;
}

/** Páginas visíveis, já na ordem personalizada. */
export function getVisibleTabs(prefs?: TabPreferences): ViewTab[] {
  return resolveTabOrder(prefs).filter((tab) => isTabVisible(prefs, tab));
}

/**
 * Alterna a visibilidade de uma página. Retorna null se a ação deixaria o aplicativo
 * sem nenhuma página visível (sempre resta pelo menos uma).
 */
export function toggleTabVisibility(prefs: TabPreferences | undefined, tab: ViewTab): TabPreferences | null {
  const currentlyVisible = isTabVisible(prefs, tab);
  if (currentlyVisible && getVisibleTabs(prefs).length <= 1) return null;
  return { ...(prefs || {}), [tab]: !currentlyVisible };
}

/** Move uma página uma posição para cima (-1) ou para baixo (+1) na ordem completa. */
export function moveTab(prefs: TabPreferences | undefined, tab: ViewTab, direction: -1 | 1): TabPreferences {
  const order = resolveTabOrder(prefs);
  const from = order.indexOf(tab);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= order.length) return { ...(prefs || {}), order };
  [order[from], order[to]] = [order[to], order[from]];
  return { ...(prefs || {}), order };
}

/**
 * Página que deve ficar aberta: a atual, se estiver visível. Configurações é sempre acessível
 * pelo atalho de engrenagem do cabeçalho, então não é redirecionada (é por lá que se reexibe páginas).
 * Caso contrário, a primeira página visível.
 */
export function resolveActiveTab(activeTab: ViewTab, prefs?: TabPreferences): ViewTab {
  if (activeTab === 'configuracoes' || isTabVisible(prefs, activeTab)) return activeTab;
  return getVisibleTabs(prefs)[0] || 'configuracoes';
}
