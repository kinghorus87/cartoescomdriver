import seedDataRaw from '../data/seedData.json';
import { SeedData } from '../types';
import { pruneOutOfWindowData } from './timeline';

export const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const LOCAL_STORAGE_KEY = 'cartoes_economias_dados_locais';

export const RESET_ZEROED_VERSION_KEY = 'cartoes_economias_zeroed_v1';

/**
 * Cria a estrutura inicial 100% ZERADA (sem cartões, sem lançamentos e sem matriz pré-preenchida).
 */
export function getEmptySeedData(): SeedData {
  return {
    cards: [],
    cardsList: [],
    persons: [],
    hiddenPersons: [],
    favoritePersons: [],
    tabPreferences: {
      pesquisar: true,
      dividas: true,
      simulador: true,
    },
    fixedExpenses: [],
    paidInvoices: {},
    themeConfig: {
      bgPreset: 'deep-navy',
      accentPreset: 'sky',
    },
    layoutMode: 'pc',
    customTabNames: {
      limites: 'Painel de Limites',
      matriz: 'Matriz de Gastos',
      cartoes: 'Cartões & Meses',
      dividas: 'Dívidas Totais',
      pesquisar: 'Pesquisar Itens',
      simulador: 'Simulador de Gastos',
    },
    customHeaderTitle: 'Cartões',
    customTitles: {},
    dividasSelectedYear: new Date().getFullYear(),
    simulator: {
      mensalCards: [],
      quinzenaCards: [],
      energiaBlock: 'bloco2',
      block1Name: 'Comercial',
      block2Name: 'Residencial',
      blockFixedExpenses: [],
      pinnedPerson: null,
      savedValues: {},
    },
  };
}

/**
 * Retorna os dados padrão da aplicação carregando a base de cartões da planilha (19 cartões).
 */
export function getDefaultSeedData(): SeedData {
  const raw = seedDataRaw as any;
  return {
    ...getEmptySeedData(),
    ...raw,
    cards: (raw.cards || []).map((c: any) => ({
      ...c,
      disponivel: typeof c.disponivel === 'number' ? c.disponivel : c.limite,
      months: c.months || {},
    })),
    cardsList: raw.cardsList || (raw.cards || []).map((c: any) => c.name),
    persons: raw.persons || [],
    favoritePersons: ['Paloma', 'Celia'],
    simulator: {
      ...getEmptySeedData().simulator,
      ...(raw.simulator || {}),
      blockFixedExpenses: [],
      savedValues: {},
    },
  };
}

/**
 * Obtém os dados iniciais do localStorage, iniciando com os dados da planilha se ainda não houver dados salvos.
 */
export function getInitialData(): SeedData {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.cards) && parsed.cards.length > 0) {
        const loadedData: SeedData = {
          ...getEmptySeedData(),
          ...parsed,
          cards: parsed.cards || [],
          cardsList: parsed.cardsList || [],
          persons: parsed.persons || [],
          favoritePersons: parsed.favoritePersons || [],
          hiddenPersons: parsed.hiddenPersons || [],
          fixedExpenses: parsed.fixedExpenses || [],
          paidInvoices: parsed.paidInvoices || {},
          customTitles: parsed.customTitles || {},
          customTabNames: {
            ...getEmptySeedData().customTabNames,
            ...(parsed.customTabNames || {}),
          },
          customHeaderTitle: parsed.customHeaderTitle || 'Cartões',
          dividasSelectedYear: parsed.dividasSelectedYear || new Date().getFullYear(),
          simulator: {
            ...getEmptySeedData().simulator,
            ...(parsed.simulator || {}),
            blockFixedExpenses: parsed.simulator?.blockFixedExpenses || [],
            savedValues: parsed.simulator?.savedValues || {},
          },
        };

        // Exclusão definitiva de dados que saíram da janela de 36 meses
        const { data: pruned, prunedMonthsCount, prunedTxsCount } = pruneOutOfWindowData(loadedData);
        if (prunedMonthsCount > 0 || prunedTxsCount > 0) {
          saveAppData(pruned);
          return pruned;
        }

        return loadedData;
      }
    }
  } catch (err) {
    console.error('Erro ao ler dados do localStorage:', err);
  }

  const defaultData = getDefaultSeedData();
  saveAppData(defaultData);
  return defaultData;
}

/**
 * Salva os dados do aplicativo no localStorage.
 */
export function saveAppData(data: SeedData): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Erro ao salvar no localStorage:', err);
  }
}

/**
 * Restaura os dados originais da planilha (19 cartões).
 */
export function resetToSeedData(): SeedData {
  const defaultData = getDefaultSeedData();
  saveAppData(defaultData);
  return defaultData;
}

/**
 * Limpa completamente o localStorage e deixa os dados 100% zerados.
 */
export function resetToZeroedData(): SeedData {
  const empty = getEmptySeedData();
  saveAppData(empty);
  return empty;
}

/**
 * Exporta arquivo JSON de backup para o computador.
 */
export function exportBackup(data: SeedData): void {
  const timestamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dados-cartoes_backup_${timestamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Formata moeda no padrão brasileiro (BRL).
 */
export function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}
