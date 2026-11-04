export interface Transaction {
  id: string;
  linha?: number;
  purchaseId?: string;
  data: string;
  descricao: string;
  parcelas: string;
  valor: number;
  pagador: string;
  pago?: boolean;
}

/**
 * Parcela temporariamente retirada da sequência (ex.: total de parcelas reduzido
 * ou numeração avançada na edição "Alterar todas as ocorrências").
 * Fica guardada no cartão, fora de `months`, para poder reaparecer depois.
 */
export interface ArchivedInstallment {
  monthKey: string; // Mês original da parcela no formato AAAA-MM
  tx: Transaction;  // Registro completo (data, valor, descrição, pagador, pago, purchaseId)
}

export interface FixedExpense {
  id: string;
  cardId: string;
  descricao: string;
  valor: number;
  diaMes: number; // 1 a 31
  ativo: boolean;
  pagador?: string;
  dataCriacao?: string;
}

export interface ThemeConfig {
  bgPreset?: string;
  accentPreset?: string;
  panelPreset?: string;
  textPreset?: string;
  themePreset?: string;
  customBg?: string; // 1. Cor do fundo geral
  customAccent?: string; // 2. Cor de destaque
  customPanelColor?: string; // 3. Cor dos painéis e caixas
  customTextColor?: string; // 4. Cor das letras e legendas
}

export interface CardData {
  id: string;
  name: string;
  limite: number;
  disponivel: number;
  dueDay: string;
  finalCard: string;
  isFisico: string;
  isVirtual: string;
  customImage?: string;
  color?: string; // Cor individual de fundo/destaque do cartão
  textColor?: string; // Cor individual dos textos internos do balão
  archived?: boolean; // Cartão desativado/arquivado com histórico preservado
  exibirIdentificacao?: boolean; // Caixa de seleção: Exibir identificação do cartão
  months: Record<string, Transaction[]>;
  archivedInstallments?: ArchivedInstallment[]; // Parcelas retiradas da sequência, recuperáveis (não aparecem como lançamentos ativos)
}

export interface CustomTabNames {
  limites?: string;
  matriz?: string;
  cartoes?: string;
  dividas?: string;
  pesquisar?: string;
  simulador?: string;
}

export interface SimulatorBlockFixedExpense {
  id: string;
  block: 'bloco1' | 'bloco2';
  descricao: string;
  valor: number;
  pagador?: string;
}

export interface SimulatorBlockSavedValues {
  rec?: number;
  energiaValor?: number;
}

export interface SimulatorPersonMonthRecord {
  bloco1?: SimulatorBlockSavedValues;
  bloco2?: SimulatorBlockSavedValues;
}

export interface SimulatorConfig {
  mensalCards: string[];
  quinzenaCards: string[];
  rec1?: number;
  rec2?: number;
  energiaValor?: number;
  energiaBlock?: 'bloco1' | 'bloco2';
  block1Name?: string;
  block2Name?: string;
  blockFixedExpenses?: SimulatorBlockFixedExpense[];
  pinnedPerson?: string | null;
  savedValues?: Record<string, SimulatorPersonMonthRecord>;
}

export interface TabPreferences {
  // Visibilidade por página: ausente ou true = visível; false = oculta (compatível com dados antigos)
  limites?: boolean;
  matriz?: boolean;
  cartoes?: boolean;
  dividas?: boolean;
  pesquisar?: boolean;
  simulador?: boolean;
  configuracoes?: boolean;
  // Ordem personalizada das páginas na navegação principal (páginas ausentes entram no fim, na ordem padrão)
  order?: ViewTab[];
}

export interface SeedData {
  cards: CardData[];
  cardsList: string[];
  persons: string[];
  hiddenPersons?: string[];
  favoritePersons?: string[];
  tabPreferences?: TabPreferences;
  fixedExpenses?: FixedExpense[];
  paidInvoices?: Record<string, boolean>; // chave: `${cardId}_${monthKey}`
  themeConfig?: ThemeConfig;
  layoutMode?: 'mobile' | 'pc';
  customTabNames?: CustomTabNames;
  customHeaderTitle?: string;
  customTitles?: Record<string, string>; // Títulos editáveis por lápis (Item 6)
  dividasSelectedYear?: number;
  simulator: SimulatorConfig;
}

export type ViewTab = 'limites' | 'matriz' | 'cartoes' | 'dividas' | 'pesquisar' | 'simulador' | 'configuracoes';

