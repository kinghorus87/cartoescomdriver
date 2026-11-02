import React, { useState, useEffect, useMemo } from 'react';
import { CardData, FixedExpense, SimulatorConfig } from '../types';
import { formatCurrency, MESES_NOMES } from '../utils/storage';
import { cleanCardName, extractDueDayNumber } from '../utils/cardColors';
import { 
  getCardTransactions, 
  toMonthKey, 
  parseMonthKey, 
  getCurrentSystemMonthKey, 
  getVisible7Months, 
  addMonths, 
  diffMonths,
  getRolling36Window,
  formatMonthPill, 
  formatMonthLong 
} from '../utils/timeline';
import { EditableTitle } from './EditableTitle';
import { useColumnResize } from '../utils/useColumnResize';
import { MiniSimuladorConsulta } from './MiniSimuladorConsulta';
import { 
  Calculator, 
  RotateCcw, 
  Plus, 
  Percent, 
  Users, 
  Receipt, 
  Split, 
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Pin,
  AlertTriangle,
  Minus,
  Save,
  BookmarkCheck,
  FolderOpen,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';

// Chaves de armazenamento
// 1. Temporário: sessionStorage (preserva ao mudar de abas, mas é limpo ao fechar o app / nova sessão)
const SESSION_TEMP_CALC_KEY = 'financas_calculadora_temporaria_v2';
const SESSION_EXPANDED_KEY = 'financas_calculadora_expandida_v2';
// 2. Salvo permanentemente pelo usuário: localStorage (mantido após fechar e reabrir o app)
const STORAGE_SAVED_CALC_KEY = 'financas_calculadora_salva_registros_v2';

interface CalculatorInputs {
  somaInput: string;
  abatFaturaTotal: string;
  abatPagamentos: string;
  multValor: string;
  multOperando: string;
  divTotal: string;
  divDivisor: string;
  acresBase: string;
  acresTaxa: string;
  descBase: string;
  descTaxa: string;
}

interface SavedCalculatorRecord {
  id: string;
  dataHora: string;
  timestamp: number;
  valores: CalculatorInputs;
  resumos: {
    somaTotal?: number;
    somaItens?: number;
    abatFatura?: number;
    abatPagamentos?: number;
    abatSaldo?: number;
    abatPct?: number;
    multValor?: number;
    multFator?: number;
    multTotal?: number;
    divTotal?: number;
    divDivisor?: number;
    divParcela?: number;
    acresBase?: number;
    acresTaxa?: number;
    acresTotal?: number;
    descBase?: number;
    descTaxa?: number;
    descTotal?: number;
  };
}

const loadInitialTempCalculator = (): CalculatorInputs => {
  try {
    const raw = sessionStorage.getItem(SESSION_TEMP_CALC_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          somaInput: typeof parsed.somaInput === 'string' ? parsed.somaInput : '',
          abatFaturaTotal: typeof parsed.abatFaturaTotal === 'string' ? parsed.abatFaturaTotal : '',
          abatPagamentos: typeof parsed.abatPagamentos === 'string' ? parsed.abatPagamentos : '',
          multValor: typeof parsed.multValor === 'string' ? parsed.multValor : '',
          multOperando: typeof parsed.multOperando === 'string' ? parsed.multOperando : '',
          divTotal: typeof parsed.divTotal === 'string' ? parsed.divTotal : '',
          divDivisor: typeof parsed.divDivisor === 'string' ? parsed.divDivisor : '',
          acresBase: typeof parsed.acresBase === 'string' ? parsed.acresBase : '',
          acresTaxa: typeof parsed.acresTaxa === 'string' ? parsed.acresTaxa : '',
          descBase: typeof parsed.descBase === 'string' ? parsed.descBase : '',
          descTaxa: typeof parsed.descTaxa === 'string' ? parsed.descTaxa : '',
        };
      }
    }
  } catch (e) {
    // sessionStorage indisponível
  }
  return {
    somaInput: '',
    abatFaturaTotal: '',
    abatPagamentos: '',
    multValor: '',
    multOperando: '',
    divTotal: '',
    divDivisor: '',
    acresBase: '',
    acresTaxa: '',
    descBase: '',
    descTaxa: '',
  };
};

const loadInitialSavedRecords = (): SavedCalculatorRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_SAVED_CALC_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
};

interface MatrizGastosViewProps {
  cards: CardData[];
  persons: string[];
  paidInvoices?: Record<string, boolean>;
  onSelectCard: (cardId: string) => void;
  customTitles?: Record<string, string>;
  onSaveCustomTitle?: (key: string, title: string) => void;
  simulatorConfig?: SimulatorConfig;
  fixedExpenses?: FixedExpense[];
  isMiniSimPinned: boolean;
  onToggleMiniSimPinned: () => void;
  onCloseMiniSim: () => void;
  selectedMonthKey: string;
  onSelectedMonthKeyChange: (monthKey: string) => void;
  referenceMonthKey: string;
  onReferenceMonthKeyChange: (monthKey: string) => void;
}

export const MatrizGastosView: React.FC<MatrizGastosViewProps> = ({
  cards,
  persons,
  paidInvoices = {},
  onSelectCard,
  customTitles = {},
  onSaveCustomTitle,
  simulatorConfig,
  fixedExpenses = [],
  isMiniSimPinned,
  onToggleMiniSimPinned,
  onCloseMiniSim,
  selectedMonthKey,
  onSelectedMonthKeyChange,
  referenceMonthKey,
  onReferenceMonthKeyChange,
}) => {
  const { colWidths, isCustomized, handleMouseDown, resetWidths } = useColumnResize('matriz');
  
  // Navegação Temporal Dinâmica: Padrão 7 Meses Consecutivos (igual Dívidas Totais e Simulador)
  const currentRealMonthKey = useMemo(() => getCurrentSystemMonthKey(), []);
  const { startMonthKey, endMonthKey } = useMemo(() => getRolling36Window(), []);

  const visible7Months = useMemo(() => {
    return getVisible7Months(referenceMonthKey);
  }, [referenceMonthKey]);

  // Bloqueio rigoroso nas extremidades da janela móvel de 36 meses
  const canPrevWindow = useMemo(() => {
    if (!visible7Months.length) return false;
    return diffMonths(startMonthKey, visible7Months[0]) > 0;
  }, [startMonthKey, visible7Months]);

  const canNextWindow = useMemo(() => {
    if (!visible7Months.length) return false;
    return diffMonths(visible7Months[visible7Months.length - 1], endMonthKey) > 0;
  }, [endMonthKey, visible7Months]);

  const handlePrevWindow = () => {
    if (!canPrevWindow) return;
    const target = addMonths(referenceMonthKey, -1);
    onReferenceMonthKeyChange(diffMonths(startMonthKey, target) < 0 ? startMonthKey : target);
  };

  const handleNextWindow = () => {
    if (!canNextWindow) return;
    const target = addMonths(referenceMonthKey, 1);
    onReferenceMonthKeyChange(diffMonths(target, endMonthKey) < 0 ? endMonthKey : target);
  };

  const handleSelectMonth = (mKey: string) => {
    onSelectedMonthKeyChange(mKey);
    onReferenceMonthKeyChange(mKey);
  };

  const parsedSelected = useMemo(() => parseMonthKey(selectedMonthKey), [selectedMonthKey]);
  const selectedMonth = parsedSelected.month;

  // Mini Simulador: Recolhível e Fixável (Item 3)
  const [isMiniSimExpanded, setIsMiniSimExpanded] = useState<boolean>(false);
  const isMiniSimOpen = isMiniSimExpanded || isMiniSimPinned;
  
  // 1. PRESERVAÇÃO TEMPORÁRIA: carrega da sessão ativa (mantida entre abas, limpa em nova sessão)
  const initialTemp = useMemo(() => loadInitialTempCalculator(), []);

  // Estado de expansão da Calculadora Financeira (preserva estado na sessão)
  const [isCalcExpanded, setIsCalcExpanded] = useState<boolean>(() => {
    try {
      const savedExp = sessionStorage.getItem(SESSION_EXPANDED_KEY);
      if (savedExp !== null) return savedExp === 'true';
    } catch (e) {}
    const hasValues = Object.values(initialTemp).some((v) => v.trim().length > 0);
    return hasValues;
  });

  // Estados dos cálculos da calculadora financeira temporária
  // Operação A: Soma de lista
  const [somaInput, setSomaInput] = useState<string>(initialTemp.somaInput);

  // Operação B: Abatimento de Fatura
  const [abatFaturaTotal, setAbatFaturaTotal] = useState<string>(initialTemp.abatFaturaTotal);
  const [abatPagamentos, setAbatPagamentos] = useState<string>(initialTemp.abatPagamentos);

  // Operação C: Multiplicação com operandos livres
  const [multValor, setMultValor] = useState<string>(initialTemp.multValor);
  const [multOperando, setMultOperando] = useState<string>(initialTemp.multOperando);

  // Operação D: Divisão com operandos livres e proteção contra divisão por zero
  const [divTotal, setDivTotal] = useState<string>(initialTemp.divTotal);
  const [divDivisor, setDivDivisor] = useState<string>(initialTemp.divDivisor);

  // Operação E: Acréscimo Percentual
  const [acresBase, setAcresBase] = useState<string>(initialTemp.acresBase);
  const [acresTaxa, setAcresTaxa] = useState<string>(initialTemp.acresTaxa);

  // Operação F: Desconto Percentual
  const [descBase, setDescBase] = useState<string>(initialTemp.descBase);
  const [descTaxa, setDescTaxa] = useState<string>(initialTemp.descTaxa);

  // Sincroniza estado temporário com sessionStorage para sobreviver a trocas de aba e desmontagem do componente
  useEffect(() => {
    const currentTemp: CalculatorInputs = {
      somaInput,
      abatFaturaTotal,
      abatPagamentos,
      multValor,
      multOperando,
      divTotal,
      divDivisor,
      acresBase,
      acresTaxa,
      descBase,
      descTaxa,
    };
    try {
      sessionStorage.setItem(SESSION_TEMP_CALC_KEY, JSON.stringify(currentTemp));
    } catch (e) {}
  }, [
    somaInput,
    abatFaturaTotal,
    abatPagamentos,
    multValor,
    multOperando,
    divTotal,
    divDivisor,
    acresBase,
    acresTaxa,
    descBase,
    descTaxa,
  ]);

  // Alterna expansão da calculadora mantendo a preferência temporária na sessão
  const handleToggleCalculator = () => {
    setIsCalcExpanded((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(SESSION_EXPANDED_KEY, String(next));
      } catch (e) {}
      return next;
    });
  };

  // 2. REGISTROS SALVOS PERMANENTEMENTE: carregados do localStorage
  const [savedRecords, setSavedRecords] = useState<SavedCalculatorRecord[]>(() => loadInitialSavedRecords());
  const [isSavedModalOpen, setIsSavedModalOpen] = useState<boolean>(false);
  const [calcToast, setCalcToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showCalcToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setCalcToast({ message, type });
    setTimeout(() => {
      setCalcToast(null);
    }, 4500);
  };

  // Botão "Limpar tudo": limpa APENAS o conteúdo temporário da tela e da sessão ativa, sem apagar os cálculos salvos
  const handleClearTemporary = () => {
    setSomaInput('');
    setAbatFaturaTotal('');
    setAbatPagamentos('');
    setMultValor('');
    setMultOperando('');
    setDivTotal('');
    setDivDivisor('');
    setAcresBase('');
    setAcresTaxa('');
    setDescBase('');
    setDescTaxa('');
    try {
      sessionStorage.removeItem(SESSION_TEMP_CALC_KEY);
    } catch (e) {}
    showCalcToast('Cálculos temporários limpos. Os cálculos salvos permanecem intactos.', 'info');
  };

  // Mantém os cartões rigorosamente ordenados pela data de vencimento (menor para o maior: 1, 5, 10, 16, 25)
  // Extrai dia numérico de textos como "Dia 10", " 5 ", etc., e envia sem vencimento ao final (999)
  const activeCards = cards.filter((c) => !c.archived);
  const sortedCards = [...activeCards].sort((a, b) => {
    const dayA = extractDueDayNumber(a.dueDay);
    const dayB = extractDueDayNumber(b.dueDay);
    if (dayA !== dayB) return dayA - dayB;
    return a.name.localeCompare(b.name);
  });

  const isCardMonthPaid = (cardId: string, monthOrKey?: string | number): boolean => {
    const mKey = typeof monthOrKey === 'string'
      ? parseMonthKey(monthOrKey).key
      : toMonthKey(parsedSelected.year, monthOrKey !== undefined ? monthOrKey : selectedMonth);
    return Boolean(paidInvoices[`${cardId}_${mKey}`]);
  };

  // Funções de apuração contábil da matriz utilizando getCardTransactions para integridade de competência
  const getCardMonthPersonSum = (card: CardData, personName: string, monthOrKey?: string | number): number => {
    const mKey = typeof monthOrKey === 'string'
      ? parseMonthKey(monthOrKey).key
      : toMonthKey(parsedSelected.year, monthOrKey !== undefined ? monthOrKey : selectedMonth);
    // Se a fatura foi marcada como paga, o valor deixa de compor os gastos em aberto
    if (isCardMonthPaid(card.id, mKey)) return 0;

    const txs = getCardTransactions(card, mKey);
    return txs
      .filter((t) => !t.pago && t.pagador?.toLowerCase().trim() === personName.toLowerCase().trim())
      .reduce((acc, t) => acc + (t.valor || 0), 0);
  };

  const getCardMonthTotal = (card: CardData, monthOrKey?: string | number): number => {
    const mKey = typeof monthOrKey === 'string'
      ? parseMonthKey(monthOrKey).key
      : toMonthKey(parsedSelected.year, monthOrKey !== undefined ? monthOrKey : selectedMonth);
    // Se a fatura foi marcada como paga, o valor deixa de compor os gastos em aberto
    if (isCardMonthPaid(card.id, mKey)) return 0;

    const txs = getCardTransactions(card, mKey);
    return txs
      .filter((t) => !t.pago)
      .reduce((acc, t) => acc + (t.valor || 0), 0);
  };

  const getPersonMonthTotal = (personName: string, monthOrKey?: string | number): number => {
    return sortedCards.reduce((acc, card) => acc + getCardMonthPersonSum(card, personName, monthOrKey), 0);
  };

  const totalMesGeral = sortedCards.reduce((acc, card) => acc + getCardMonthTotal(card, selectedMonthKey), 0);

  // Parser seguro para moeda e números pt-BR
  const parseBrValue = (val: string): number => {
    if (!val) return 0;
    const clean = val.replace(/\s/g, '').replace(/R\$/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  // Cálculos reativos da calculadora
  // A) Soma de múltiplos valores
  const hasSomaInput = somaInput.trim().length > 0;
  const calculateSomaList = () => {
    if (!hasSomaInput) return { total: 0, count: 0 };
    const lines = somaInput.split(/[\n,;+]+/);
    let total = 0;
    let count = 0;
    for (const item of lines) {
      const v = parseBrValue(item);
      if (v !== 0) {
        total += v;
        count++;
      }
    }
    return { total, count };
  };
  const { total: totalSoma, count: countSoma } = calculateSomaList();

  // B) Abatimento de Fatura
  const hasAbatInput = abatFaturaTotal.trim().length > 0 || abatPagamentos.trim().length > 0;
  const valFatura = parseBrValue(abatFaturaTotal);
  const valPagamentos = parseBrValue(abatPagamentos);
  const saldoRestante = Math.max(0, valFatura - valPagamentos);
  const pctQuitado = valFatura > 0 ? Math.min(100, (valPagamentos / valFatura) * 100) : 0;

  // C) Multiplicação com operando livre
  const hasMultInput = multValor.trim().length > 0 || multOperando.trim().length > 0;
  const valMult = parseBrValue(multValor);
  const fatorMult = parseBrValue(multOperando);
  const totalMult = Math.round(valMult * fatorMult * 100) / 100;

  // D) Divisão com operandos livres e trava de divisão por zero
  const hasDivInput = divTotal.trim().length > 0 || divDivisor.trim().length > 0;
  const valDivTotal = parseBrValue(divTotal);
  const divisorNum = parseBrValue(divDivisor);
  const isZeroDivision = hasDivInput && divisorNum === 0;
  const valPorDivisao = hasDivInput && !isZeroDivision ? Math.round((valDivTotal / divisorNum) * 100) / 100 : 0;

  // E) Acréscimo Percentual
  const hasAcresInput = acresBase.trim().length > 0 || acresTaxa.trim().length > 0;
  const valAcresBase = parseBrValue(acresBase);
  const taxaAcres = parseBrValue(acresTaxa);
  const valorDoAcrescimo = Math.round((valAcresBase * (taxaAcres / 100)) * 100) / 100;
  const totalComAcrescimo = valAcresBase + valorDoAcrescimo;

  // F) Desconto Percentual
  const hasDescInput = descBase.trim().length > 0 || descTaxa.trim().length > 0;
  const valDescBase = parseBrValue(descBase);
  const taxaDesc = parseBrValue(descTaxa);
  const valorDoDesconto = Math.round((valDescBase * (taxaDesc / 100)) * 100) / 100;
  const totalComDesconto = Math.max(0, valDescBase - valorDoDesconto);

  // Salvar operações e conteúdo atual da calculadora permanentemente (localStorage)
  const handleSaveData = () => {
    const hasAnyInput =
      hasSomaInput ||
      hasAbatInput ||
      hasMultInput ||
      hasDivInput ||
      hasAcresInput ||
      hasDescInput;

    if (!hasAnyInput) {
      showCalcToast('Nenhuma operação preenchida na calculadora para salvar.', 'error');
      return;
    }

    const now = new Date();
    const dataHoraStr =
      now.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }) +
      ' às ' +
      now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });

    const newRecord: SavedCalculatorRecord = {
      id: `calc-${Date.now()}`,
      dataHora: dataHoraStr,
      timestamp: Date.now(),
      valores: {
        somaInput,
        abatFaturaTotal,
        abatPagamentos,
        multValor,
        multOperando,
        divTotal,
        divDivisor,
        acresBase,
        acresTaxa,
        descBase,
        descTaxa,
      },
      resumos: {
        somaTotal: hasSomaInput ? totalSoma : undefined,
        somaItens: hasSomaInput ? countSoma : undefined,
        abatFatura: hasAbatInput ? valFatura : undefined,
        abatPagamentos: hasAbatInput ? valPagamentos : undefined,
        abatSaldo: hasAbatInput ? saldoRestante : undefined,
        abatPct: hasAbatInput && valFatura > 0 ? pctQuitado : undefined,
        multValor: hasMultInput ? valMult : undefined,
        multFator: hasMultInput ? fatorMult : undefined,
        multTotal: hasMultInput ? totalMult : undefined,
        divTotal: hasDivInput ? valDivTotal : undefined,
        divDivisor: hasDivInput ? divisorNum : undefined,
        divParcela: hasDivInput && !isZeroDivision ? valPorDivisao : undefined,
        acresBase: hasAcresInput ? valAcresBase : undefined,
        acresTaxa: hasAcresInput ? taxaAcres : undefined,
        acresTotal: hasAcresInput ? totalComAcrescimo : undefined,
        descBase: hasDescInput ? valDescBase : undefined,
        descTaxa: hasDescInput ? taxaDesc : undefined,
        descTotal: hasDescInput ? totalComDesconto : undefined,
      },
    };

    const updated = [newRecord, ...savedRecords];
    setSavedRecords(updated);
    try {
      localStorage.setItem(STORAGE_SAVED_CALC_KEY, JSON.stringify(updated));
      showCalcToast('Operações e cálculos salvos com sucesso! Guardados permanentemente.', 'success');
    } catch (e) {
      showCalcToast('Erro ao salvar no armazenamento local.', 'error');
    }
  };

  // Carregar um cálculo salvo na calculadora temporária
  const handleLoadSavedRecord = (record: SavedCalculatorRecord) => {
    setSomaInput(record.valores.somaInput || '');
    setAbatFaturaTotal(record.valores.abatFaturaTotal || '');
    setAbatPagamentos(record.valores.abatPagamentos || '');
    setMultValor(record.valores.multValor || '');
    setMultOperando(record.valores.multOperando || '');
    setDivTotal(record.valores.divTotal || '');
    setDivDivisor(record.valores.divDivisor || '');
    setAcresBase(record.valores.acresBase || '');
    setAcresTaxa(record.valores.acresTaxa || '');
    setDescBase(record.valores.descBase || '');
    setDescTaxa(record.valores.descTaxa || '');
    setIsSavedModalOpen(false);
    showCalcToast(`Cálculo de ${record.dataHora} carregado na calculadora!`, 'success');
  };

  // Excluir um cálculo salvo específico sem afetar os dados temporários
  const handleDeleteSavedRecord = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedRecords.filter((r) => r.id !== id);
    setSavedRecords(updated);
    try {
      localStorage.setItem(STORAGE_SAVED_CALC_KEY, JSON.stringify(updated));
      showCalcToast('Cálculo salvo excluído com sucesso.', 'info');
    } catch (e) {}
  };

  return (
    <div className="w-full space-y-5 text-slate-100 font-sans">
      {/* Cabeçalho Superior da Aba */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <EditableTitle
              titleKey="matriz_gastos_pessoa"
              defaultTitle="Matriz de Gastos por Pessoa"
              customTitles={customTitles}
              onSaveCustomTitle={onSaveCustomTitle}
              className="text-base sm:text-lg font-bold text-white tracking-tight"
            />
            <p className="text-xs text-slate-400">
              Visão contábil ampla por responsável e calculadora financeira de apoio
            </p>
          </div>
        </div>

        {/* NAVEGAÇÃO TEMPORAL: BARRA DE 7 MESES CONSECUTIVOS (PADRÃO DÍVIDAS TOTAIS E SIMULADOR) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-start lg:justify-end gap-2.5">
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-sky-400" />
              <span>Mês apurado:</span>
            </div>
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {formatMonthLong(selectedMonthKey)}
            </span>
            {selectedMonthKey !== currentRealMonthKey && (
              <button
                type="button"
                onClick={() => {
                  onSelectedMonthKeyChange(currentRealMonthKey);
                  onReferenceMonthKeyChange(currentRealMonthKey);
                }}
                className="text-[11px] text-sky-400 hover:text-sky-300 underline font-medium cursor-pointer ml-1"
                title="Voltar ao mês atual de referência"
              >
                (Voltar ao Mês Atual)
              </button>
            )}
          </div>

          {/* Faixa com 7 meses e setas de navegação */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 shadow-inner">
            {/* Botão Anterior */}
            <button
              type="button"
              onClick={handlePrevWindow}
              disabled={!canPrevWindow}
              className={`p-1 rounded text-slate-400 transition-colors shrink-0 ${
                canPrevWindow
                  ? 'hover:text-white hover:bg-slate-800 cursor-pointer'
                  : 'opacity-25 cursor-not-allowed hover:text-slate-400 hover:bg-transparent'
              }`}
              title={canPrevWindow ? "Retroceder mês na janela" : "Início da janela móvel de 36 meses atingido"}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* 7 Pílulas de Meses */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {visible7Months.map((mKey) => {
                const isSelected = selectedMonthKey === mKey;
                const pillLabel = formatMonthPill(mKey);

                return (
                  <button
                    key={mKey}
                    type="button"
                    onClick={() => handleSelectMonth(mKey)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20 scale-105'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {pillLabel}
                  </button>
                );
              })}
            </div>

            {/* Botão Próximo */}
            <button
              type="button"
              onClick={handleNextWindow}
              disabled={!canNextWindow}
              className={`p-1 rounded text-slate-400 transition-colors shrink-0 ${
                canNextWindow
                  ? 'hover:text-white hover:bg-slate-800 cursor-pointer'
                  : 'opacity-25 cursor-not-allowed hover:text-slate-400 hover:bg-transparent'
              }`}
              title={canNextWindow ? "Avançar mês na janela" : "Final da janela móvel de 36 meses atingido"}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mini Simulador de Consulta: Faixa compacta quando recolhido (Item 3) */}
      {!isMiniSimOpen && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsMiniSimExpanded(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsMiniSimExpanded(true);
            }
          }}
          className="w-full flex items-center justify-between p-3.5 bg-slate-900/95 hover:bg-slate-850 border border-slate-800 hover:border-slate-700/80 rounded-2xl transition-all cursor-pointer text-left shadow-lg group select-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-fuchsia-500/10 text-fuchsia-400 rounded-xl border border-fuchsia-500/20 shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-white group-hover:text-fuchsia-300 transition-colors">
                  Consulta do Simulador de Gastos
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full font-medium">
                  Recolhida
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Clique nesta faixa para expandir a consulta ao lado do detalhamento de gastos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-fuchsia-400 hover:text-fuchsia-300 shrink-0 px-2.5 py-1 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20">
            <span>Expandir ao lado</span>
            <ChevronDown className="w-4 h-4 text-fuchsia-400 group-hover:translate-y-0.5 transition-transform" />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LAYOUT EM DUAS ÁREAS: ÁREA PRINCIPAL (MATRIZ + DETALHAMENTO) E ÁREA LATERAL (MINI SIMULADOR) */}
      {/* ========================================================================= */}
      <div className={isMiniSimOpen ? "flex flex-col lg:flex-row gap-5 items-start w-full" : "w-full"}>
        {/* ÁREA PRINCIPAL: Matriz de Gastos e Detalhamento de Gastos (Calculadora de Apoio) */}
        <div className={isMiniSimOpen ? "flex-1 min-w-0 w-full space-y-6" : "w-full space-y-6"}>
          {/* TABELA DA MATRIZ CONSOLIDADA: LARGURA TOTAL EXPANDIDA */}
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl w-full overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-3">
                  <EditableTitle
                    titleKey="detalhamento_gastos"
                    defaultTitle="Detalhamento dos Gastos"
                    customTitles={customTitles}
                    onSaveCustomTitle={onSaveCustomTitle}
                    className="text-sm sm:text-base font-bold text-white"
                  />
                  {isCustomized && (
                    <button
                      type="button"
                      onClick={resetWidths}
                      className="text-[11px] text-sky-400 hover:text-sky-300 underline font-medium cursor-pointer"
                      title="Restaurar larguras padrão das colunas"
                    >
                      Restaurar larguras automáticas
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Valores apurados em {formatMonthLong(selectedMonthKey)} distribuídos por cartão e pagador
                </p>
              </div>
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-2 text-right">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Geral do Mês</span>
                <span className="text-xl sm:text-2xl font-normal text-amber-400 font-mono">
                  {formatCurrency(totalMesGeral)}
                </span>
              </div>
            </div>

            {/* Tabela Compacta com Colunas Próximas, Redimensionáveis e Rolagem Fluida */}
            <div className="overflow-x-auto max-h-[72vh] overflow-y-auto rounded-xl border border-slate-800">
              <table className="w-auto min-w-full sm:min-w-0 table-auto border-collapse text-xs text-left text-slate-300">
                <thead className="bg-slate-800/95 text-slate-300 uppercase text-[11px] font-semibold border-b border-slate-700 sticky top-0 z-20">
                  <tr>
                    <th 
                      style={{ width: colWidths['card'] || undefined, minWidth: 160 }}
                      className="relative px-3.5 py-2 sticky left-0 bg-slate-800 z-30 shadow-sm whitespace-nowrap text-xs font-bold text-slate-200"
                    >
                      Cartão
                      <div 
                        onMouseDown={(e) => handleMouseDown('card', e, 160)}
                        className="absolute -right-1.5 top-0 bottom-0 w-3.5 cursor-col-resize hover:bg-sky-500/50 active:bg-sky-500 z-30" 
                        title="Arraste para redimensionar"
                      />
                    </th>
                    <th 
                      style={{ width: colWidths['total'] || undefined, minWidth: 120 }}
                      className="relative px-3.5 py-2 text-right font-bold text-amber-300 whitespace-nowrap text-xs"
                    >
                      Total
                      <div 
                        onMouseDown={(e) => handleMouseDown('total', e, 120)}
                        className="absolute -right-1.5 top-0 bottom-0 w-3.5 cursor-col-resize hover:bg-sky-500/50 active:bg-sky-500 z-30" 
                        title="Arraste para redimensionar"
                      />
                    </th>
                    {persons.map((p) => (
                      <th 
                        key={p} 
                        style={{ width: colWidths[`person_${p}`] || undefined, minWidth: 120 }}
                        className="relative px-3.5 py-2 text-right whitespace-nowrap capitalize text-xs font-bold text-slate-200"
                      >
                        {p}
                        <div 
                          onMouseDown={(e) => handleMouseDown(`person_${p}`, e, 110)}
                          className="absolute -right-1.5 top-0 bottom-0 w-3.5 cursor-col-resize hover:bg-sky-500/50 active:bg-sky-500 z-30" 
                          title="Arraste para redimensionar"
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {sortedCards.length === 0 ? (
                    <tr>
                      <td colSpan={2 + Math.max(1, persons.length)} className="px-4 py-8 text-center text-slate-400">
                        <p className="font-semibold text-white">Nenhum cartão cadastrado</p>
                        <p className="text-xs text-slate-500 mt-1">A matriz de gastos está totalmente zerada. Cadastre seus cartões e lançamentos para visualizar os valores por pagador.</p>
                      </td>
                    </tr>
                  ) : (
                    sortedCards.map((card) => {
                    const totalCardMonth = getCardMonthTotal(card, selectedMonthKey);
                    const isPaid = isCardMonthPaid(card.id, selectedMonthKey);
                    return (
                      <tr 
                        key={card.id}
                        onClick={() => onSelectCard(card.id)}
                        className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                      >
                        <td 
                          style={{ width: colWidths['card'] || undefined }}
                          className="px-3.5 py-2 font-medium text-white sticky left-0 bg-slate-900 group-hover:bg-slate-850 z-10 whitespace-nowrap"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs sm:text-sm group-hover:text-sky-300 transition-colors">
                              {cleanCardName(card.name)}
                            </span>
                            {card.dueDay && (
                              <span className="text-[10px] bg-slate-800 text-slate-400 font-mono px-1.5 py-0.5 rounded border border-slate-700/60 shrink-0">
                                {card.dueDay.replace(/\D/g, '') || card.dueDay}
                              </span>
                            )}
                            {isPaid && (
                              <span className="text-[9.5px] bg-emerald-950/80 text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-500/40 shrink-0">
                                Paga
                              </span>
                            )}
                            <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                          </div>
                        </td>
                        <td 
                          style={{ width: colWidths['total'] || undefined }}
                          className="px-3.5 py-2 text-right font-mono whitespace-nowrap text-[20px] sm:text-[21px] font-normal text-amber-400"
                        >
                          {isPaid ? (
                            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-1.5 py-0.2 rounded font-sans">
                              ✓ Paga
                            </span>
                          ) : totalCardMonth > 0 ? (
                            formatCurrency(totalCardMonth)
                          ) : (
                            '-'
                          )}
                        </td>
                        {persons.map((p) => {
                          const val = getCardMonthPersonSum(card, p, selectedMonthKey);
                          return (
                            <td 
                              key={p} 
                              style={{ width: colWidths[`person_${p}`] || undefined }}
                              className="px-3.5 py-2 text-right font-mono whitespace-nowrap text-[19px] sm:text-[20px] font-normal"
                            >
                              {isPaid ? (
                                <span className="text-xs text-emerald-500/70 font-sans italic font-normal">Quitado</span>
                              ) : val > 0 ? (
                                <span className="text-slate-100 font-normal">{formatCurrency(val)}</span>
                              ) : (
                                <span className="text-slate-600 font-normal">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }))}
                </tbody>
                <tfoot className="bg-slate-800/95 border-t-2 border-slate-700 text-white sticky bottom-0 z-20">
                  <tr>
                    <td 
                      style={{ width: colWidths['card'] || undefined }}
                      className="px-3.5 py-2.5 sticky left-0 bg-slate-800 z-30 font-normal tracking-wide whitespace-nowrap text-xs text-slate-300"
                    >
                      TOTAL GERAL
                    </td>
                    <td 
                      style={{ width: colWidths['total'] || undefined }}
                      className="px-3.5 py-2.5 text-right text-amber-300 font-normal font-mono text-[20px] sm:text-[21px] whitespace-nowrap"
                    >
                      {formatCurrency(totalMesGeral)}
                    </td>
                    {persons.map((p) => (
                      <td 
                        key={p} 
                        style={{ width: colWidths[`person_${p}`] || undefined }}
                        className="px-3.5 py-2.5 text-right text-sky-400 font-mono font-normal text-[19px] sm:text-[20px] whitespace-nowrap"
                      >
                        {formatCurrency(getPersonMonthTotal(p, selectedMonthKey))}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                Clique em qualquer linha para abrir os lançamentos detalhados do cartão
              </span>
              <span className="font-mono text-slate-500">{sortedCards.length} cartões apurados</span>
            </div>
          </div>

      {/* ========================================================================= */}
      {/* 2. CALCULADORA FINANCEIRA EXPANSÍVEL COM AS 6 OPERAÇÕES SIMULTÂNEAS        */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl shadow-xl overflow-hidden transition-all">
        {/* Barra de Abertura / Fechamento da Calculadora */}
        <div
          onClick={(e) => {
            // Se o clique veio de um botão, input ou form (como EditableTitle), não alternar
            const target = e.target as HTMLElement;
            if (target.closest('button, input, form, textarea')) return;
            handleToggleCalculator();
          }}
          className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 hover:bg-slate-850/60 transition-colors cursor-pointer text-left border-b border-slate-800 select-none"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <EditableTitle
                  titleKey="calculadora_apoio"
                  defaultTitle="Calculadora Financeira de Apoio"
                  customTitles={customTitles}
                  onSaveCustomTitle={onSaveCustomTitle}
                  className="text-sm sm:text-base font-bold text-white"
                />
                <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  6 Operações Simultâneas
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Soma de múltiplos valores, abatimento de fatura, multiplicação, divisão, acréscimo e desconto
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleCalculator();
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors cursor-pointer shrink-0"
          >
            <span>{isCalcExpanded ? 'Recolher Calculadora' : 'Abrir Calculadora (6 Operações)'}</span>
            {isCalcExpanded ? (
              <ChevronUp className="w-4 h-4 text-sky-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-sky-400" />
            )}
          </button>
        </div>

        {/* Grade com Todas as 6 Operações Visíveis Simultaneamente */}
        {isCalcExpanded && (
          <div className="p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
            {/* Barra de Ações Superiores: Salvar dados, Cálculos salvos e Limpar tudo */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-400 pb-2 border-b border-slate-800">
              <span>Operações matemáticas livres — 100% isoladas dos registros de compras</span>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Botão Salvar dados (persistência voluntária permanente) */}
                <button
                  type="button"
                  onClick={handleSaveData}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                  title="Salvar as operações e o conteúdo atual da calculadora permanentemente"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar dados</span>
                </button>

                {/* Botão Consultar Cálculos Salvos */}
                {savedRecords.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsSavedModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                    title="Consultar cálculos salvos anteriormente"
                  >
                    <BookmarkCheck className="w-3.5 h-3.5 text-sky-400" />
                    <span>Cálculos salvos ({savedRecords.length})</span>
                  </button>
                )}

                {/* Botão Limpar Tudo (Somente temporário) */}
                <button
                  type="button"
                  onClick={handleClearTemporary}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-700"
                  title="Limpar apenas os cálculos temporários da tela (não apaga os dados salvos)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpar tudo</span>
                </button>

                <span className="font-mono text-emerald-400 ml-1 hidden lg:inline">Padrão pt-BR com vírgula</span>
              </div>
            </div>

            {/* Notificação / Feedback de Sucesso ou Erro */}
            {calcToast && (
              <div
                className={`p-2.5 rounded-xl text-xs font-medium flex items-center justify-between animate-in fade-in ${
                  calcToast.type === 'success'
                    ? 'bg-emerald-950/90 border border-emerald-500/50 text-emerald-300'
                    : calcToast.type === 'error'
                    ? 'bg-rose-950/90 border border-rose-500/50 text-rose-300'
                    : 'bg-sky-950/90 border border-sky-500/50 text-sky-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {calcToast.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : calcToast.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
                  )}
                  <span>{calcToast.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCalcToast(null)}
                  className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {/* OPERAÇÃO A: SOMA DE MÚLTIPLOS VALORES */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-md">
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-bold text-xs text-white flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-emerald-400" />
                      A) Soma de Múltiplos Valores
                    </span>
                    <button
                      type="button"
                      onClick={() => setSomaInput('')}
                      title="Limpar campos"
                      className="text-slate-400 hover:text-amber-400 p-1 rounded cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <label className="text-[11px] text-slate-400 block">
                    Valores (um por linha ou separados por vírgula):
                  </label>
                  <textarea
                    rows={3}
                    value={somaInput}
                    onChange={(e) => setSomaInput(e.target.value)}
                    placeholder="Ex: 120,50&#10;85,90&#10;240,00"
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between min-h-[42px]">
                  <span className="text-[11px] text-slate-400">
                    {hasSomaInput ? `Total (${countSoma} itens):` : 'Total:'}
                  </span>
                  <span className="font-mono font-black text-sm text-emerald-400">
                    {hasSomaInput ? formatCurrency(totalSoma) : ''}
                  </span>
                </div>
              </div>

              {/* OPERAÇÃO B: ABATIMENTO DE FATURA */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-md">
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-bold text-xs text-white flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-sky-400" />
                      B) Abatimento de Fatura
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAbatFaturaTotal('');
                        setAbatPagamentos('');
                      }}
                      title="Limpar campos"
                      className="text-slate-400 hover:text-amber-400 p-1 rounded cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10.5px] text-slate-400 block mb-0.5">Fatura Total (R$):</label>
                      <input
                        type="text"
                        value={abatFaturaTotal}
                        onChange={(e) => setAbatFaturaTotal(e.target.value)}
                        placeholder="Ex: 2500,00"
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 font-mono font-bold focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10.5px] text-slate-400 block mb-0.5">Pagamentos (R$):</label>
                      <input
                        type="text"
                        value={abatPagamentos}
                        onChange={(e) => setAbatPagamentos(e.target.value)}
                        placeholder="Ex: 1850,00"
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 font-mono font-bold focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                </div>
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg space-y-1 min-h-[42px]">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Saldo Restante:</span>
                    <span className="font-mono font-black text-sm text-amber-400">
                      {hasAbatInput ? formatCurrency(saldoRestante) : ''}
                    </span>
                  </div>
                  {hasAbatInput && valFatura > 0 && (
                    <div className="flex justify-between items-center text-[10px] text-slate-500 pt-0.5 border-t border-slate-800">
                      <span>Quitado:</span>
                      <span className="font-bold text-teal-400 font-mono">{pctQuitado.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* OPERAÇÃO C: MULTIPLICAÇÃO COM OPERANDOS LIVRES */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-md">
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-bold text-xs text-white flex items-center gap-1.5">
                      <span>×</span>
                      C) Multiplicação Livre
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMultValor('');
                        setMultOperando('');
                      }}
                      title="Limpar campos"
                      className="text-slate-400 hover:text-amber-400 p-1 rounded cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10.5px] text-slate-400 block mb-0.5">Valor (R$):</label>
                      <input
                        type="text"
                        value={multValor}
                        onChange={(e) => setMultValor(e.target.value)}
                        placeholder="Ex: 189,90"
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 font-mono font-bold focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10.5px] text-slate-400 block mb-0.5">Multiplicar por:</label>
                      <input
                        type="text"
                        value={multOperando}
                        onChange={(e) => setMultOperando(e.target.value)}
                        placeholder="Ex: 10"
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 font-mono font-bold focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                </div>
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between min-h-[42px]">
                  <span className="text-[11px] text-slate-400">Total Multiplicado:</span>
                  <span className="font-mono font-black text-sm text-emerald-400">
                    {hasMultInput ? formatCurrency(totalMult) : ''}
                  </span>
                </div>
              </div>

              {/* OPERAÇÃO D: DIVISÃO COM OPERANDOS LIVRES E TRAVA DE ZERO */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-md">
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-bold text-xs text-white flex items-center gap-1.5">
                      <Split className="w-3.5 h-3.5 text-teal-400" />
                      D) Divisão Livre (Trava Zero)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDivTotal('');
                        setDivDivisor('');
                      }}
                      title="Limpar campos"
                      className="text-slate-400 hover:text-amber-400 p-1 rounded cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10.5px] text-slate-400 block mb-0.5">Valor Total (R$):</label>
                      <input
                        type="text"
                        value={divTotal}
                        onChange={(e) => setDivTotal(e.target.value)}
                        placeholder="Ex: 450,00"
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 font-mono font-bold focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10.5px] text-slate-400 block mb-0.5">Dividir por:</label>
                      <input
                        type="text"
                        value={divDivisor}
                        onChange={(e) => setDivDivisor(e.target.value)}
                        placeholder="Ex: 3"
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 font-mono font-bold focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                </div>
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between min-h-[42px]">
                  <span className="text-[11px] text-slate-400">Por Parcela / Pessoa:</span>
                  {!hasDivInput ? (
                    <span className="font-mono font-black text-sm text-teal-400"></span>
                  ) : isZeroDivision ? (
                    <span className="text-red-400 font-bold text-xs flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Divisão por zero
                    </span>
                  ) : (
                    <span className="font-mono font-black text-sm text-teal-400">
                      {formatCurrency(valPorDivisao)}
                    </span>
                  )}
                </div>
              </div>

              {/* OPERAÇÃO E: ACRÉSCIMO PERCENTUAL */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-md">
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-bold text-xs text-white flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                      E) Acréscimo Percentual
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAcresBase('');
                        setAcresTaxa('');
                      }}
                      title="Limpar campos"
                      className="text-slate-400 hover:text-amber-400 p-1 rounded cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10.5px] text-slate-400 block mb-0.5">Valor Base (R$):</label>
                      <input
                        type="text"
                        value={acresBase}
                        onChange={(e) => setAcresBase(e.target.value)}
                        placeholder="Ex: 1000,00"
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 font-mono font-bold focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10.5px] text-slate-400 block mb-0.5">Taxa (%):</label>
                      <input
                        type="text"
                        value={acresTaxa}
                        onChange={(e) => setAcresTaxa(e.target.value)}
                        placeholder="Ex: 5,5"
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 font-mono font-bold focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                </div>
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg space-y-0.5 min-h-[42px]">
                  <div className="flex justify-between items-center text-[11px] text-slate-400">
                    <span>Acréscimo (+):</span>
                    <span className="font-mono font-bold text-amber-400">
                      {hasAcresInput ? formatCurrency(valorDoAcrescimo) : ''}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-0.5 border-t border-slate-800">
                    <span className="text-white font-semibold">Total Final:</span>
                    <span className="font-mono font-black text-sm text-emerald-400">
                      {hasAcresInput ? formatCurrency(totalComAcrescimo) : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* OPERAÇÃO F: DESCONTO PERCENTUAL */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-md">
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-bold text-xs text-white flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                      F) Desconto Percentual
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDescBase('');
                        setDescTaxa('');
                      }}
                      title="Limpar campos"
                      className="text-slate-400 hover:text-amber-400 p-1 rounded cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10.5px] text-slate-400 block mb-0.5">Valor Base (R$):</label>
                      <input
                        type="text"
                        value={descBase}
                        onChange={(e) => setDescBase(e.target.value)}
                        placeholder="Ex: 800,00"
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 font-mono font-bold focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10.5px] text-slate-400 block mb-0.5">Desconto (%):</label>
                      <input
                        type="text"
                        value={descTaxa}
                        onChange={(e) => setDescTaxa(e.target.value)}
                        placeholder="Ex: 10"
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 font-mono font-bold focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                </div>
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg space-y-0.5 min-h-[42px]">
                  <div className="flex justify-between items-center text-[11px] text-slate-400">
                    <span>Economia (-):</span>
                    <span className="font-mono font-bold text-teal-400">
                      {hasDescInput ? formatCurrency(valorDoDesconto) : ''}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-0.5 border-t border-slate-800">
                    <span className="text-white font-semibold">Total com Desconto:</span>
                    <span className="font-mono font-black text-sm text-emerald-400">
                      {hasDescInput ? formatCurrency(totalComDesconto) : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* ÁREA LATERAL INDEPENDENTE: Mini Simulador de Consulta */}
    {isMiniSimOpen && (
      <aside className="w-full lg:w-80 xl:w-96 shrink-0 lg:sticky lg:top-20 space-y-2">
        {/* Barra de Controles: Fixar e Recolher */}
        <div className="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-800 rounded-xl shadow-md">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
            <Calculator className="w-3.5 h-3.5 text-fuchsia-400" />
            <span>Consulta do Simulador</span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Botão Fixar / Desafixar */}
            <button
              type="button"
              onClick={onToggleMiniSimPinned}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                isMiniSimPinned
                  ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40 shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white border-slate-700/60'
              }`}
              title={isMiniSimPinned ? 'Desafixar consulta (permitir recolhimento)' : 'Fixar consulta aberta'}
            >
              <Pin className={`w-3.5 h-3.5 ${isMiniSimPinned ? 'fill-current' : ''}`} />
              <span>{isMiniSimPinned ? 'Fixado' : 'Fixar'}</span>
            </button>

            {/* Botão Recolher */}
            <button
              type="button"
              onClick={() => {
                setIsMiniSimExpanded(false);
                onCloseMiniSim();
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer"
              title="Recolher consulta para liberar espaço"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Recolher</span>
            </button>
          </div>
        </div>

        <MiniSimuladorConsulta
          simulatorConfig={simulatorConfig}
          cards={cards}
          persons={persons}
          fixedExpenses={fixedExpenses}
          selectedMonth={parseMonthKey(selectedMonthKey).month}
          selectedYear={parsedSelected.year}
          selectedMonthKey={selectedMonthKey}
        />
      </aside>
    )}

    {/* MODAL DE CONSULTA DE CÁLCULOS SALVOS */}
    {isSavedModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
        <div className="bg-[#111625] border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <BookmarkCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Cálculos Salvos da Calculadora</h3>
                <p className="text-xs text-slate-400">
                  Cálculos persistidos permanentemente com o botão &ldquo;Salvar dados&rdquo;
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSavedModalOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Lista dos Cálculos Salvos */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
            {savedRecords.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <BookmarkCheck className="w-8 h-8 mx-auto mb-2 opacity-50 text-slate-500" />
                <p className="text-sm font-semibold">Nenhum cálculo salvo ainda.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Preencha os dados na calculadora e clique em &ldquo;Salvar dados&rdquo; para guardá-los permanentemente.
                </p>
              </div>
            ) : (
              savedRecords.map((record) => (
                <div
                  key={record.id}
                  className="p-3.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white">
                        Salvo em {record.dataHora}
                      </span>
                    </div>

                    {/* Resumos das operações presentes no registro salvo */}
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      {record.resumos.somaTotal !== undefined && (
                        <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">
                          Soma: {formatCurrency(record.resumos.somaTotal)}
                        </span>
                      )}
                      {record.resumos.abatSaldo !== undefined && (
                        <span className="bg-sky-950/80 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded font-mono">
                          Saldo Restante: {formatCurrency(record.resumos.abatSaldo)}
                        </span>
                      )}
                      {record.resumos.multTotal !== undefined && (
                        <span className="bg-teal-950/80 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded font-mono">
                          Multiplicação: {formatCurrency(record.resumos.multTotal)}
                        </span>
                      )}
                      {record.resumos.divParcela !== undefined && (
                        <span className="bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-mono">
                          Divisão: {formatCurrency(record.resumos.divParcela)}
                        </span>
                      )}
                      {record.resumos.acresTotal !== undefined && (
                        <span className="bg-amber-950/80 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono">
                          Acréscimo: {formatCurrency(record.resumos.acresTotal)}
                        </span>
                      )}
                      {record.resumos.descTotal !== undefined && (
                        <span className="bg-rose-950/80 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded font-mono">
                          Desconto: {formatCurrency(record.resumos.descTotal)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => handleLoadSavedRecord(record)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg transition-all shadow-sm cursor-pointer"
                      title="Carregar este cálculo na calculadora temporária"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Carregar</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteSavedRecord(record.id, e)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Excluir este cálculo salvo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3.5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
            <span>{savedRecords.length} cálculo(s) salvo(s)</span>
            <button
              type="button"
              onClick={() => setIsSavedModalOpen(false)}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
</div>
  );
};
