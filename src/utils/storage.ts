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
 * Retorna os dados padrão da aplicação: agora 100% zerados por padrão.
 */
export function getDefaultSeedData(): SeedData {
  return getEmptySeedData();
}

/**
 * Obtém os dados iniciais do localStorage, iniciando 100% zerado por padrão.
 */
export function getInitialData(): SeedData {
  try {
    // Força a reinicialização zerada uma vez para limpar dados legados do Excel salvos anteriormente
    const hasZeroedInit = localStorage.getItem(RESET_ZEROED_VERSION_KEY);
    if (!hasZeroedInit) {
      localStorage.setItem(RESET_ZEROED_VERSION_KEY, 'true');
      const empty = getEmptySeedData();
      saveAppData(empty);
      return empty;
    }

    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.cards)) {
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

  const empty = getEmptySeedData();
  saveAppData(empty);
  return empty;
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
 * Limpa completamente o localStorage e restaura os dados 100% ZERADOS.
 */
export function resetToSeedData(): SeedData {
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
