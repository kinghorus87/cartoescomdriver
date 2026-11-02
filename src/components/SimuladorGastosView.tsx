import React, { useState, useMemo, useEffect } from 'react';
import { 
  CardData, 
  FixedExpense, 
  SimulatorConfig, 
  SimulatorBlockFixedExpense, 
  SimulatorPersonMonthRecord 
} from '../types';
import { formatCurrency } from '../utils/storage';
import { 
  getCardTransactions, 
  formatMonthLong, 
  formatMonthPill, 
  getVisible7Months, 
  addMonths, 
  getCurrentSystemMonthKey 
} from '../utils/timeline';
import { 
  Calculator, 
  ArrowLeftRight, 
  Save, 
  Check, 
  User, 
  Calendar,
  Building2, 
  Home, 
  Pin, 
  Pencil, 
  Plus, 
  Trash2, 
  X, 
  Zap,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { ModalConfirmacao } from './ModalConfirmacao';
import { EditableTitle } from './EditableTitle';

interface SimuladorGastosViewProps {
  cards: CardData[];
  persons?: string[];
  config: SimulatorConfig;
  fixedExpenses?: FixedExpense[];
  onSaveConfig: (newConfig: SimulatorConfig) => void;
  customTitles?: Record<string, string>;
  onSaveCustomTitle?: (key: string, title: string) => void;
}

export const SimuladorGastosView: React.FC<SimuladorGastosViewProps> = ({
  cards,
  persons = [],
  config,
  fixedExpenses = [],
  onSaveConfig,
  customTitles = {},
  onSaveCustomTitle,
}) => {
  // Mês selecionado e mês de referência da janela de 7 meses (inicializado dinamicamente com a data atual)
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => getCurrentSystemMonthKey());
  const [referenceMonthKey, setReferenceMonthKey] = useState<string>(() => getCurrentSystemMonthKey());

  // Janela com exatamente 7 meses consecutivos centralizando o mês de referência na 4ª posição
  const visible7Months = useMemo(() => {
    return getVisible7Months(referenceMonthKey);
  }, [referenceMonthKey]);

  // Navegação da janela de 7 meses (igual à barra de Cartões & Meses)
  const handleSelectMonth = (mKey: string) => {
    setSelectedMonthKey(mKey);
    setReferenceMonthKey(mKey);
  };

  const handlePrevWindow = () => {
    setReferenceMonthKey((prev) => addMonths(prev, -1));
  };

  const handleNextWindow = () => {
    setReferenceMonthKey((prev) => addMonths(prev, 1));
  };

  // Coleta todas as pessoas cadastradas ou referenciadas em lançamentos
  const allKnownPersons = useMemo(() => {
    const set = new Set<string>();
    (persons || []).forEach((p) => {
      if (p && p.trim()) set.add(p.trim());
    });
    cards.forEach((card) => {
      Object.values(card.months || {}).forEach((txs) => {
        if (Array.isArray(txs)) {
          txs.forEach((t) => {
            if (t.pagador && t.pagador.trim()) {
              set.add(t.pagador.trim());
            }
          });
        }
      });
    });
    (fixedExpenses || []).forEach((fe) => {
      if (fe.pagador && fe.pagador.trim()) {
        set.add(fe.pagador.trim());
      }
    });
    return Array.from(set);
  }, [persons, cards, fixedExpenses]);

  // Lista de pessoas disponíveis para simulação
  const availablePersons = allKnownPersons.length > 0 ? allKnownPersons : persons;

  const defaultPerson = useMemo(() => {
    if (config.pinnedPerson && availablePersons.some((p) => p.toLowerCase().trim() === config.pinnedPerson?.toLowerCase().trim())) {
      return config.pinnedPerson;
    }
    return availablePersons[0] || '';
  }, [availablePersons, config.pinnedPerson]);

  const [selectedPerson, setSelectedPerson] = useState<string>(defaultPerson);
  const [pinnedPerson, setPinnedPerson] = useState<string | null>(config.pinnedPerson || null);

  useEffect(() => {
    if (!selectedPerson && defaultPerson) {
      setSelectedPerson(defaultPerson);
    } else if (selectedPerson && availablePersons.length > 0) {
      const exists = availablePersons.some(
        (p) => p.toLowerCase().trim() === selectedPerson.toLowerCase().trim()
      );
      if (!exists && defaultPerson) {
        setSelectedPerson(defaultPerson);
      }
    }
  }, [availablePersons, defaultPerson, selectedPerson]);

  // Nomes personalizáveis dos blocos
  const [block1Name, setBlock1Name] = useState<string>(config.block1Name || 'Comercial');
  const [block2Name, setBlock2Name] = useState<string>(config.block2Name || 'Residencial');
  const [isEditingB1, setIsEditingB1] = useState(false);
  const [tempB1, setTempB1] = useState(block1Name);
  const [isEditingB2, setIsEditingB2] = useState(false);
  const [tempB2, setTempB2] = useState(block2Name);

  // Atribuição da Energia (Bloco 1 ou Bloco 2)
  const [energiaBlock, setEnergiaBlock] = useState<'bloco1' | 'bloco2'>(config.energiaBlock || 'bloco2');

  // Parcelas fixas específicas de cada bloco
  const [blockFixedExpenses, setBlockFixedExpenses] = useState<SimulatorBlockFixedExpense[]>(
    config.blockFixedExpenses || []
  );

  // Modais de criação e exclusão de parcelas fixas do bloco
  const [modalFixedBlock, setModalFixedBlock] = useState<'bloco1' | 'bloco2' | null>(null);
  const [editingBlockFixed, setEditingBlockFixed] = useState<SimulatorBlockFixedExpense | null>(null);
  const [fixedDescInput, setFixedDescInput] = useState('');
  const [fixedValInput, setFixedValInput] = useState('');
  const [fixedPayerInput, setFixedPayerInput] = useState(selectedPerson || '');
  const [fixedError, setFixedError] = useState('');
  const [deleteConfirmFixed, setDeleteConfirmFixed] = useState<SimulatorBlockFixedExpense | null>(null);

  // Listas de cartões
  const [mensalList, setMensalList] = useState<string[]>(
    (config.mensalCards || []).filter((c) => c.toLowerCase() !== 'energia')
  );
  const [quinzenaList, setQuinzenaList] = useState<string[]>(
    (config.quinzenaCards || []).filter((c) => c.toLowerCase() !== 'energia')
  );

  // =========================================================================
  // GESTÃO DE VALORES POR PESSOA, MÊS E BLOCO COM RASCUNHO E SALVAMENTO
  // =========================================================================
  const getRecordKey = (person: string, month: string) => {
    return `${(person || '').toLowerCase().trim()}_${month}`;
  };

  const currentRecordKey = useMemo(() => {
    return getRecordKey(selectedPerson, selectedMonthKey);
  }, [selectedPerson, selectedMonthKey]);

  // Rascunhos locais (iniciam vazios para registros novos sem preenchimento automático)
  const [draftRec1, setDraftRec1] = useState<string>('');
  const [draftRec2, setDraftRec2] = useState<string>('');
  const [draftEnergia1, setDraftEnergia1] = useState<string>('');
  const [draftEnergia2, setDraftEnergia2] = useState<string>('');

  // Feedbacks de salvamento e validação
  const [feedbackBloco1, setFeedbackBloco1] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [feedbackBloco2, setFeedbackBloco2] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [savedSuccessAll, setSavedSuccessAll] = useState<boolean>(false);

  // Sincroniza rascunhos quando a pessoa, o mês ou o savedValues mudam
  useEffect(() => {
    const savedRec = config.savedValues?.[currentRecordKey];

    // Bloco 1: se já houver valor salvo anteriormente, carrega; se for novo, começa VAZIO!
    if (savedRec?.bloco1?.rec !== undefined) {
      setDraftRec1(String(savedRec.bloco1.rec));
    } else {
      setDraftRec1('');
    }

    if (savedRec?.bloco1?.energiaValor !== undefined) {
      setDraftEnergia1(String(savedRec.bloco1.energiaValor));
    } else {
      setDraftEnergia1('');
    }

    // Bloco 2: se já houver valor salvo anteriormente, carrega; se for novo, começa VAZIO!
    if (savedRec?.bloco2?.rec !== undefined) {
      setDraftRec2(String(savedRec.bloco2.rec));
    } else {
      setDraftRec2('');
    }

    if (savedRec?.bloco2?.energiaValor !== undefined) {
      setDraftEnergia2(String(savedRec.bloco2.energiaValor));
    } else {
      setDraftEnergia2('');
    }

    // Limpa feedbacks temporários ao navegar
    setFeedbackBloco1(null);
    setFeedbackBloco2(null);
  }, [currentRecordKey, config.savedValues]);

  // Sincroniza quando config externa muda (nomes de blocos, etc.)
  useEffect(() => {
    if (config.mensalCards) setMensalList(config.mensalCards.filter((c) => c.toLowerCase() !== 'energia'));
    if (config.quinzenaCards) setQuinzenaList(config.quinzenaCards.filter((c) => c.toLowerCase() !== 'energia'));
    if (config.block1Name) setBlock1Name(config.block1Name);
    if (config.block2Name) setBlock2Name(config.block2Name);
    if (config.energiaBlock) setEnergiaBlock(config.energiaBlock);
    if (config.blockFixedExpenses) setBlockFixedExpenses(config.blockFixedExpenses);
    if (config.pinnedPerson !== undefined) setPinnedPerson(config.pinnedPerson);
  }, [config]);

  // Garante que todo cartão cadastrado ativo esteja alocado em uma das duas listas
  useEffect(() => {
    const activeCards = cards.filter((c) => !c.archived);
    if (activeCards.length === 0) return;

    setMensalList((prevMensal) => {
      const knownLower = new Set([
        ...prevMensal.map((c) => c.toLowerCase().trim()),
        ...quinzenaList.map((c) => c.toLowerCase().trim()),
      ]);

      const toAdd: string[] = [];
      activeCards.forEach((c) => {
        const cLower = c.name.toLowerCase().trim();
        if (!knownLower.has(cLower)) {
          toAdd.push(c.name);
          knownLower.add(cLower);
        }
      });

      if (toAdd.length === 0) return prevMensal;
      return [...prevMensal, ...toAdd];
    });
  }, [cards, quinzenaList]);

  // Parser seguro de valores monetários digitados
  const parseInputValue = (str: string): number | undefined => {
    const clean = str.trim().replace(/\s/g, '').replace(',', '.');
    if (clean === '') return undefined;
    const num = parseFloat(clean);
    return isNaN(num) ? undefined : num;
  };

  // Verifica se o bloco atual tem valores salvos para esta pessoa e mês
  const currentSavedRecord = config.savedValues?.[currentRecordKey];
  const isBloco1Saved = Boolean(
    currentSavedRecord?.bloco1?.rec !== undefined ||
    currentSavedRecord?.bloco1?.energiaValor !== undefined
  );
  const isBloco2Saved = Boolean(
    currentSavedRecord?.bloco2?.rec !== undefined ||
    currentSavedRecord?.bloco2?.energiaValor !== undefined
  );

  // Valores numéricos instantâneos para visualização em tempo real das fórmulas
  const rec1Num = useMemo(() => {
    const p = parseInputValue(draftRec1);
    return p !== undefined ? Math.max(0, p) : 0;
  }, [draftRec1]);

  const rec2Num = useMemo(() => {
    const p = parseInputValue(draftRec2);
    return p !== undefined ? Math.max(0, p) : 0;
  }, [draftRec2]);

  const energiaValor1Num = useMemo(() => {
    const p = parseInputValue(draftEnergia1);
    return p !== undefined ? Math.max(0, p) : 0;
  }, [draftEnergia1]);

  const energiaValor2Num = useMemo(() => {
    const p = parseInputValue(draftEnergia2);
    return p !== undefined ? Math.max(0, p) : 0;
  }, [draftEnergia2]);

  // Move cartão de Mensal para Quinzena
  const moveMensalToQuinzena = (cardName: string) => {
    setMensalList((prev) => prev.filter((c) => c !== cardName));
    if (!quinzenaList.includes(cardName)) {
      setQuinzenaList((prev) => [...prev, cardName]);
    }
  };

  // Move cartão de Quinzena para Mensal
  const moveQuinzenaToMensal = (cardName: string) => {
    setQuinzenaList((prev) => prev.filter((c) => c !== cardName));
    if (!mensalList.includes(cardName)) {
      setMensalList((prev) => [...prev, cardName]);
    }
  };

  // Alterna o direcionamento da energia entre Bloco 1 e Bloco 2
  const handleToggleEnergiaBlock = () => {
    const next = energiaBlock === 'bloco1' ? 'bloco2' : 'bloco1';
    setEnergiaBlock(next);
    // Transfere o rascunho de energia se preenchido
    if (next === 'bloco2' && draftEnergia1.trim() !== '' && draftEnergia2.trim() === '') {
      setDraftEnergia2(draftEnergia1);
    } else if (next === 'bloco1' && draftEnergia2.trim() !== '' && draftEnergia1.trim() === '') {
      setDraftEnergia1(draftEnergia2);
    }

    onSaveConfig({
      ...config,
      mensalCards: mensalList,
      quinzenaCards: quinzenaList,
      energiaBlock: next,
      block1Name,
      block2Name,
      blockFixedExpenses,
      pinnedPerson,
    });
  };

  // Fixar / desafixar responsável padrão
  const handleTogglePinPerson = () => {
    const isCurrentlyPinned = pinnedPerson?.toLowerCase().trim() === selectedPerson.toLowerCase().trim();
    const nextPin = isCurrentlyPinned ? null : selectedPerson;
    setPinnedPerson(nextPin);
    onSaveConfig({
      ...config,
      mensalCards: mensalList,
      quinzenaCards: quinzenaList,
      energiaBlock,
      block1Name,
      block2Name,
      blockFixedExpenses,
      pinnedPerson: nextPin,
    });
  };

  // Salvar nomes personalizados
  const handleSaveBlock1Name = () => {
    const clean = tempB1.trim() || 'Comercial';
    setBlock1Name(clean);
    setIsEditingB1(false);
    onSaveConfig({
      ...config,
      mensalCards: mensalList,
      quinzenaCards: quinzenaList,
      energiaBlock,
      block1Name: clean,
      block2Name,
      blockFixedExpenses,
      pinnedPerson,
    });
  };

  const handleSaveBlock2Name = () => {
    const clean = tempB2.trim() || 'Residencial';
    setBlock2Name(clean);
    setIsEditingB2(false);
    onSaveConfig({
      ...config,
      mensalCards: mensalList,
      quinzenaCards: quinzenaList,
      energiaBlock,
      block1Name,
      block2Name: clean,
      blockFixedExpenses,
      pinnedPerson,
    });
  };

  // Abertura do modal para adicionar parcela fixa ao bloco
  const handleOpenAddBlockFixed = (block: 'bloco1' | 'bloco2') => {
    setModalFixedBlock(block);
    setEditingBlockFixed(null);
    setFixedDescInput('');
    setFixedValInput('');
    setFixedPayerInput(selectedPerson || 'Todos');
    setFixedError('');
  };

  const handleOpenEditBlockFixed = (fe: SimulatorBlockFixedExpense) => {
    setModalFixedBlock(fe.block);
    setEditingBlockFixed(fe);
    setFixedDescInput(fe.descricao);
    setFixedValInput(String(fe.valor));
    setFixedPayerInput(fe.pagador || 'Todos');
    setFixedError('');
  };

  const handleSaveBlockFixed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixedDescInput.trim()) {
      setFixedError('Informe a descrição da parcela fixa.');
      return;
    }
    const numVal = parseFloat(fixedValInput.replace(',', '.'));
    if (isNaN(numVal) || numVal <= 0) {
      setFixedError('Informe um valor válido maior que zero.');
      return;
    }

    let updatedList: SimulatorBlockFixedExpense[];
    if (editingBlockFixed) {
      updatedList = blockFixedExpenses.map((item) =>
        item.id === editingBlockFixed.id
          ? {
              ...item,
              descricao: fixedDescInput.trim(),
              valor: numVal,
              pagador: fixedPayerInput.trim() || undefined,
            }
          : item
      );
    } else {
      const newItem: SimulatorBlockFixedExpense = {
        id: `bfix-${Date.now()}`,
        block: modalFixedBlock || 'bloco1',
        descricao: fixedDescInput.trim(),
        valor: numVal,
        pagador: fixedPayerInput.trim() || undefined,
      };
      updatedList = [...blockFixedExpenses, newItem];
    }

    setBlockFixedExpenses(updatedList);
    setModalFixedBlock(null);
    setEditingBlockFixed(null);
    onSaveConfig({
      ...config,
      mensalCards: mensalList,
      quinzenaCards: quinzenaList,
      energiaBlock,
      block1Name,
      block2Name,
      blockFixedExpenses: updatedList,
      pinnedPerson,
    });
  };

  const handleConfirmDeleteBlockFixed = () => {
    if (!deleteConfirmFixed) return;
    const updatedList = blockFixedExpenses.filter((item) => item.id !== deleteConfirmFixed.id);
    setBlockFixedExpenses(updatedList);
    setDeleteConfirmFixed(null);
    onSaveConfig({
      ...config,
      mensalCards: mensalList,
      quinzenaCards: quinzenaList,
      energiaBlock,
      block1Name,
      block2Name,
      blockFixedExpenses: updatedList,
      pinnedPerson,
    });
  };

  // Calcula o valor de gastos da pessoa selecionada para um cartão no mês simulado
  const getPersonCardExpense = (cardName: string, monthKey: string, person: string): number => {
    const cNameLower = cardName.toLowerCase().trim();
    const card = cards.find((c) => c.name.toLowerCase().trim() === cNameLower);
    if (!card) return 0;

    const personClean = person.toLowerCase().trim();

    // Transações reais no período para a pessoa selecionada
    const txs = getCardTransactions(card, monthKey);
    let total = txs
      .filter((t) => {
        if (!personClean) return true;
        return (t.pagador || '').toLowerCase().trim() === personClean;
      })
      .reduce((acc, t) => acc + (t.valor || 0), 0);

    // Inclui parcelas fixas ativas aplicáveis à pessoa selecionada naquele mês sem duplicar
    const cardFixed = (fixedExpenses || []).filter(
      (fe) => fe.cardId === card.id && fe.ativo && (!fe.pagador || fe.pagador.toLowerCase().trim() === personClean)
    );

    cardFixed.forEach((fe) => {
      const fixedTxId = `fixed-${fe.id}-${monthKey}`;
      const alreadyInTxs = txs.some((t) => t.id === fixedTxId);
      if (!alreadyInTxs) {
        total += fe.valor;
      }
    });

    return total;
  };

  // Gastos com parcelas fixas cadastradas diretamente nos blocos
  const block1FixedTotal = useMemo(() => {
    const personClean = selectedPerson.toLowerCase().trim();
    return blockFixedExpenses
      .filter(
        (fe) =>
          fe.block === 'bloco1' &&
          (!fe.pagador || fe.pagador.toLowerCase().trim() === 'todos' || fe.pagador.toLowerCase().trim() === personClean)
      )
      .reduce((acc, fe) => acc + (fe.valor || 0), 0);
  }, [blockFixedExpenses, selectedPerson]);

  const block2FixedTotal = useMemo(() => {
    const personClean = selectedPerson.toLowerCase().trim();
    return blockFixedExpenses
      .filter(
        (fe) =>
          fe.block === 'bloco2' &&
          (!fe.pagador || fe.pagador.toLowerCase().trim() === 'todos' || fe.pagador.toLowerCase().trim() === personClean)
      )
      .reduce((acc, fe) => acc + (fe.valor || 0), 0);
  }, [blockFixedExpenses, selectedPerson]);

  // Totais e Sobras calculados com base na pessoa selecionada e atribuição de energia
  const totalMensal = useMemo(() => {
    let sum = mensalList.reduce((acc, cName) => acc + getPersonCardExpense(cName, selectedMonthKey, selectedPerson), 0);
    if (energiaBlock === 'bloco1' && energiaValor1Num > 0) {
      sum += energiaValor1Num;
    }
    sum += block1FixedTotal;
    return sum;
  }, [mensalList, selectedMonthKey, selectedPerson, energiaBlock, energiaValor1Num, block1FixedTotal, cards, fixedExpenses]);

  const totalQuinzena = useMemo(() => {
    let sum = quinzenaList.reduce((acc, cName) => acc + getPersonCardExpense(cName, selectedMonthKey, selectedPerson), 0);
    if (energiaBlock === 'bloco2' && energiaValor2Num > 0) {
      sum += energiaValor2Num;
    }
    sum += block2FixedTotal;
    return sum;
  }, [quinzenaList, selectedMonthKey, selectedPerson, energiaBlock, energiaValor2Num, block2FixedTotal, cards, fixedExpenses]);

  const sobraMensal = rec1Num - totalMensal;
  const sobraQuinzena = rec2Num - totalQuinzena;

  // =========================================================================
  // SALVAR VALORES: BLOCO 1
  // =========================================================================
  const handleSaveBloco1 = () => {
    const recParsed = parseInputValue(draftRec1);
    if (draftRec1.trim() !== '' && (recParsed === undefined || recParsed < 0)) {
      setFeedbackBloco1({ type: 'error', message: 'Informe um valor de recebimento válido.' });
      setTimeout(() => setFeedbackBloco1(null), 3500);
      return;
    }

    const energiaParsed = parseInputValue(draftEnergia1);
    if (energiaBlock === 'bloco1' && draftEnergia1.trim() !== '' && (energiaParsed === undefined || energiaParsed < 0)) {
      setFeedbackBloco1({ type: 'error', message: 'Informe um valor de energia elétrica válido.' });
      setTimeout(() => setFeedbackBloco1(null), 3500);
      return;
    }

    const existingRec = config.savedValues?.[currentRecordKey] || {};
    const updatedRecord: SimulatorPersonMonthRecord = {
      ...existingRec,
      bloco1: {
        rec: recParsed,
        energiaValor: energiaBlock === 'bloco1' ? energiaParsed : existingRec.bloco1?.energiaValor,
      },
    };

    const updatedSavedValues = {
      ...(config.savedValues || {}),
      [currentRecordKey]: updatedRecord,
    };

    onSaveConfig({
      ...config,
      mensalCards: mensalList,
      quinzenaCards: quinzenaList,
      energiaBlock,
      block1Name,
      block2Name,
      blockFixedExpenses,
      pinnedPerson,
      savedValues: updatedSavedValues,
    });

    setFeedbackBloco1({ type: 'success', message: `Valores de ${block1Name} salvos com sucesso!` });
    setTimeout(() => setFeedbackBloco1(null), 3000);
  };

  // =========================================================================
  // SALVAR VALORES: BLOCO 2
  // =========================================================================
  const handleSaveBloco2 = () => {
    const recParsed = parseInputValue(draftRec2);
    if (draftRec2.trim() !== '' && (recParsed === undefined || recParsed < 0)) {
      setFeedbackBloco2({ type: 'error', message: 'Informe um valor de recebimento válido.' });
      setTimeout(() => setFeedbackBloco2(null), 3500);
      return;
    }

    const energiaParsed = parseInputValue(draftEnergia2);
    if (energiaBlock === 'bloco2' && draftEnergia2.trim() !== '' && (energiaParsed === undefined || energiaParsed < 0)) {
      setFeedbackBloco2({ type: 'error', message: 'Informe um valor de energia elétrica válido.' });
      setTimeout(() => setFeedbackBloco2(null), 3500);
      return;
    }

    const existingRec = config.savedValues?.[currentRecordKey] || {};
    const updatedRecord: SimulatorPersonMonthRecord = {
      ...existingRec,
      bloco2: {
        rec: recParsed,
        energiaValor: energiaBlock === 'bloco2' ? energiaParsed : existingRec.bloco2?.energiaValor,
      },
    };

    const updatedSavedValues = {
      ...(config.savedValues || {}),
      [currentRecordKey]: updatedRecord,
    };

    onSaveConfig({
      ...config,
      mensalCards: mensalList,
      quinzenaCards: quinzenaList,
      energiaBlock,
      block1Name,
      block2Name,
      blockFixedExpenses,
      pinnedPerson,
      savedValues: updatedSavedValues,
    });

    setFeedbackBloco2({ type: 'success', message: `Valores de ${block2Name} salvos com sucesso!` });
    setTimeout(() => setFeedbackBloco2(null), 3000);
  };

  // =========================================================================
  // SALVAR VALORES DE AMBOS OS BLOCOS
  // =========================================================================
  const handleSaveAll = () => {
    const rec1Parsed = parseInputValue(draftRec1);
    if (draftRec1.trim() !== '' && (rec1Parsed === undefined || rec1Parsed < 0)) {
      setFeedbackBloco1({ type: 'error', message: 'Informe um valor válido em ' + block1Name });
      setTimeout(() => setFeedbackBloco1(null), 3500);
      return;
    }

    const rec2Parsed = parseInputValue(draftRec2);
    if (draftRec2.trim() !== '' && (rec2Parsed === undefined || rec2Parsed < 0)) {
      setFeedbackBloco2({ type: 'error', message: 'Informe um valor válido em ' + block2Name });
      setTimeout(() => setFeedbackBloco2(null), 3500);
      return;
    }

    const energia1Parsed = parseInputValue(draftEnergia1);
    const energia2Parsed = parseInputValue(draftEnergia2);

    const existingRec = config.savedValues?.[currentRecordKey] || {};
    const updatedRecord: SimulatorPersonMonthRecord = {
      ...existingRec,
      bloco1: {
        rec: rec1Parsed,
        energiaValor: energiaBlock === 'bloco1' ? energia1Parsed : existingRec.bloco1?.energiaValor,
      },
      bloco2: {
        rec: rec2Parsed,
        energiaValor: energiaBlock === 'bloco2' ? energia2Parsed : existingRec.bloco2?.energiaValor,
      },
    };

    const updatedSavedValues = {
      ...(config.savedValues || {}),
      [currentRecordKey]: updatedRecord,
    };

    onSaveConfig({
      ...config,
      mensalCards: mensalList,
      quinzenaCards: quinzenaList,
      energiaBlock,
      block1Name,
      block2Name,
      blockFixedExpenses,
      pinnedPerson,
      savedValues: updatedSavedValues,
    });

    setSavedSuccessAll(true);
    setFeedbackBloco1({ type: 'success', message: 'Salvo com sucesso!' });
    setFeedbackBloco2({ type: 'success', message: 'Salvo com sucesso!' });
    setTimeout(() => {
      setSavedSuccessAll(false);
      setFeedbackBloco1(null);
      setFeedbackBloco2(null);
    }, 3000);
  };

  const isPersonPinned = pinnedPerson?.toLowerCase().trim() === selectedPerson.toLowerCase().trim();

  return (
    <div className="space-y-6 w-full text-slate-100 font-sans">
      {/* Cabeçalho do Simulador */}
      <div className="bg-[#111625] border border-slate-800/90 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-fuchsia-500/10 text-fuchsia-400 rounded-xl border border-fuchsia-500/20 shadow-inner">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <EditableTitle
                  titleKey="simulador_gastos"
                  defaultTitle="Simulador de Gastos"
                  customTitles={customTitles}
                  onSaveCustomTitle={onSaveCustomTitle}
                  className="text-base sm:text-lg font-bold text-white"
                />
                <span className="text-xs bg-fuchsia-500/20 text-fuchsia-300 font-bold px-2 py-0.5 rounded-full border border-fuchsia-500/30 flex items-center gap-1">
                  <span>{selectedPerson}</span>
                  {isPersonPinned && <Pin className="w-3 h-3 fill-amber-400 text-amber-400" />}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Divisão orçamentária entre {block1Name} e {block2Name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveAll}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-md ${
                savedSuccessAll
                  ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20'
                  : 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-fuchsia-600/20 active:scale-95'
              }`}
            >
              {savedSuccessAll ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Valores Salvos!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar valores</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Barra de Controles: Seletor de Pessoa com Pin + Barra Compacta de 7 Meses (Modelo Cartões & Meses) */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Seletor de Pessoa / Pagador com Botão Pin */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold uppercase tracking-wider shrink-0">
              <User className="w-4 h-4 text-fuchsia-400" />
              <span>Simular gastos de:</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {availablePersons.length === 0 ? (
                <span className="text-xs text-slate-500 italic">Nenhum pagador cadastrado</span>
              ) : (
                availablePersons.map((p) => {
                  const isSelected = selectedPerson.toLowerCase().trim() === p.toLowerCase().trim();
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedPerson(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-fuchsia-500 text-slate-950 shadow-md shadow-fuchsia-500/20 scale-105'
                          : 'bg-[#162032] text-slate-300 hover:bg-[#1f2d45] border border-slate-700/60'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })
              )}

              {/* Botão de Fixar / Desafixar Responsável */}
              <button
                type="button"
                onClick={handleTogglePinPerson}
                title={isPersonPinned ? `Desafixar "${selectedPerson}" dos padrões` : `Fixar "${selectedPerson}" como padrão do simulador`}
                className={`ml-1 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  isPersonPinned
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
                }`}
              >
                <Pin className={`w-3.5 h-3.5 ${isPersonPinned ? 'fill-amber-400 text-amber-400' : ''}`} />
                <span>{isPersonPinned ? 'Fixado' : 'Fixar'}</span>
              </button>
            </div>
          </div>

          {/* Barra Compacta de 7 Meses Sincronizada (Modelo Cartões & Meses) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-start lg:justify-end gap-2.5">
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold uppercase tracking-wider">
                <Calendar className="w-4 h-4 text-teal-400" />
                <span>Mês projetado:</span>
              </div>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {formatMonthLong(selectedMonthKey)}
              </span>
            </div>

            {/* Faixa com 7 meses e setas de navegação */}
            <div className="flex items-center gap-1 bg-[#0c1220] p-1.5 rounded-xl border border-slate-800/90 shadow-inner">
              {/* Botão Anterior */}
              <button
                type="button"
                onClick={handlePrevWindow}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="Retroceder mês na janela"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* 7 Pílulas de Meses */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {visible7Months.map((mKey) => {
                  const isSelected = selectedMonthKey === mKey;
                  const pillLabel = formatMonthPill(mKey);

                  return (
                    <div key={mKey} className="flex flex-col items-center min-w-[42px]">
                      <button
                        type="button"
                        onClick={() => handleSelectMonth(mKey)}
                        className={`w-full text-center px-1.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#10b981] text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                            : 'bg-[#162032] text-slate-300 hover:bg-[#1c2a42]'
                        }`}
                      >
                        {pillLabel}
                      </button>
                      {/* Indicador de Seleção embaixo do Pill */}
                      {isSelected && (
                        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-[#10b981] mt-0.5"></div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Botão Próximo */}
              <button
                type="button"
                onClick={handleNextWindow}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="Avançar mês na janela"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid com Dois Blocos Personalizáveis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Painel Esquerdo: BLOCO 1 */}
        <div className="bg-[#111625] border border-slate-800/90 rounded-2xl p-6 flex flex-col justify-between shadow-xl min-h-[520px]">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 shrink-0"></div>
                <div className="min-w-0">
                  {isEditingB1 ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={tempB1}
                        onChange={(e) => setTempB1(e.target.value)}
                        placeholder="Nome do Bloco"
                        className="bg-slate-900 border border-emerald-500 text-white text-xs sm:text-sm font-bold rounded-lg px-2 py-1 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleSaveBlock1Name}
                        title="Salvar nome"
                        className="p-1 bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTempB1(block1Name);
                          setIsEditingB1(false);
                        }}
                        title="Cancelar"
                        className="p-1 bg-slate-800 text-slate-400 rounded-lg hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="truncate">{block1Name}</span>
                      </h3>
                      {/* Botão Lápis para editar o nome do Bloco 1 */}
                      <button
                        type="button"
                        onClick={() => {
                          setTempB1(block1Name);
                          setIsEditingB1(true);
                        }}
                        title="Editar nome deste bloco"
                        className="p-1 text-slate-400 hover:text-emerald-400 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {/* Botão + para adicionar parcela fixa ao Bloco 1 */}
                      <button
                        type="button"
                        onClick={() => handleOpenAddBlockFixed('bloco1')}
                        title={`Adicionar parcela fixa em ${block1Name}`}
                        className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        <Plus className="w-3 h-3 stroke-[3]" />
                        <span>Fixa</span>
                      </button>
                    </div>
                  )}
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Projeção de despesas do bloco {block1Name}
                  </span>
                </div>
              </div>
              <span className="text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 px-2.5 py-1 rounded-lg font-mono font-bold shrink-0">
                {mensalList.length + (energiaBlock === 'bloco1' && energiaValor1Num > 0 ? 1 : 0) + blockFixedExpenses.filter((fe) => fe.block === 'bloco1').length} itens
              </span>
            </div>

            {/* Configuração de Recebimento do Bloco 1 com Botão "Salvar valores" e sem preenchimento falso */}
            <div className="mt-4 p-3.5 bg-[#162032] rounded-xl border border-slate-700/80 shadow-sm space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs sm:text-sm text-slate-200 font-bold block">
                      Recebimento ({block1Name}):
                    </label>
                    {isBloco1Saved ? (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                        <span>Salvo</span>
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700/60 px-1.5 py-0.5 rounded font-mono">
                        Não salvo
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {selectedPerson} • {formatMonthPill(selectedMonthKey)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 font-mono text-base font-extrabold text-emerald-400">
                    <span>R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={draftRec1}
                      onChange={(e) => setDraftRec1(e.target.value)}
                      placeholder="0,00"
                      className="w-28 bg-[#0c1220] border border-slate-700 text-emerald-400 font-bold rounded-lg px-2.5 py-1 text-right focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveBloco1}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                    title={`Salvar valores de ${block1Name} para ${selectedPerson} em ${formatMonthPill(selectedMonthKey)}`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Salvar valores</span>
                  </button>
                </div>
              </div>

              {/* Feedback de sucesso ou erro do Bloco 1 */}
              {feedbackBloco1 && (
                <div
                  className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-in fade-in ${
                    feedbackBloco1.type === 'success'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {feedbackBloco1.type === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  )}
                  <span>{feedbackBloco1.message}</span>
                </div>
              )}
            </div>

            {/* Lista de Itens do Bloco 1 */}
            <div className="mt-4 space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {/* Energia Elétrica se alocada no Bloco 1 */}
              {energiaBlock === 'bloco1' && (
                <div
                  className="py-3 px-3.5 bg-amber-500/10 border border-amber-500/40 rounded-xl flex items-center justify-between text-xs sm:text-sm shadow-sm"
                  title="Parcela fixa de energia elétrica alocada neste bloco"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="font-bold text-white text-sm sm:text-base truncate">
                      Energia Elétrica
                    </span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                      Fixo
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1 font-mono text-sm sm:text-base font-extrabold text-amber-300">
                      <span>R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={draftEnergia1}
                        onChange={(e) => setDraftEnergia1(e.target.value)}
                        placeholder="0,00"
                        className="w-20 bg-slate-900 border border-slate-700 text-amber-300 rounded px-1.5 py-0.5 text-right font-bold text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleEnergiaBlock}
                      title={`Transferir Energia para ${block2Name}`}
                      className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                    >
                      <ArrowLeftRight className="w-4 h-4 text-indigo-400" />
                    </button>
                  </div>
                </div>
              )}

              {/* Parcelas Fixas Específicas do Bloco 1 */}
              {blockFixedExpenses
                .filter((fe) => fe.block === 'bloco1')
                .map((fe) => (
                  <div
                    key={fe.id}
                    className="py-3 px-3.5 bg-[#172033] border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs sm:text-sm shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="font-bold text-white text-sm truncate">
                        {fe.descricao}
                      </span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.2 rounded font-mono font-bold">
                        Fixa do Bloco
                      </span>
                      {fe.pagador && (
                        <span className="text-[10px] text-amber-400 font-medium capitalize truncate">
                          ({fe.pagador})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-sm sm:text-base font-extrabold text-amber-300">
                        {formatCurrency(fe.valor)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenEditBlockFixed(fe)}
                        title="Editar parcela fixa"
                        className="p-1 text-slate-400 hover:text-emerald-300 rounded cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmFixed(fe)}
                        title="Excluir parcela fixa"
                        className="p-1 text-slate-400 hover:text-rose-400 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

              {/* Cartões alocados no Bloco 1 */}
              {mensalList.map((cName) => {
                const val = getPersonCardExpense(cName, selectedMonthKey, selectedPerson);
                return (
                  <div
                    key={cName}
                    onDoubleClick={() => moveMensalToQuinzena(cName)}
                    className="py-3 px-3.5 bg-[#141c2e] hover:bg-[#1a253d] border border-slate-700/60 hover:border-emerald-500/50 rounded-xl flex items-center justify-between text-xs sm:text-sm transition-all group cursor-pointer shadow-sm"
                    title={`Clique duas vezes ou use a seta para mover para ${block2Name}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="font-bold text-white text-sm sm:text-base truncate">
                        {cName}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`font-mono text-sm sm:text-base font-extrabold ${val > 0 ? 'text-amber-300' : 'text-slate-500'}`}>
                        {formatCurrency(val)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); moveMensalToQuinzena(cName); }}
                        title={`Mover para ${block2Name}`}
                        className="opacity-60 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-emerald-300 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                      >
                        <ArrowLeftRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totais do Bloco 1 */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-2.5 text-xs sm:text-sm">
            <div className="flex justify-between items-center text-slate-300">
              <span className="font-medium">Total de Gastos ({selectedPerson}):</span>
              <span className="text-base sm:text-lg font-extrabold font-mono text-white">
                {formatCurrency(totalMensal)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm sm:text-base font-bold pt-2 border-t border-slate-800/60">
              <span className={sobraMensal >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {sobraMensal >= 0 ? `Sobra Líquida ${block1Name}:` : `Déficit ${block1Name}:`}
              </span>
              <span className={`font-mono text-lg sm:text-xl font-extrabold ${sobraMensal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(sobraMensal)}
              </span>
            </div>
          </div>
        </div>

        {/* Painel Direito: BLOCO 2 */}
        <div className="bg-[#111625] border border-slate-800/90 rounded-2xl p-6 flex flex-col justify-between shadow-xl min-h-[520px]">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-3.5 h-3.5 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400/50 shrink-0"></div>
                <div className="min-w-0">
                  {isEditingB2 ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={tempB2}
                        onChange={(e) => setTempB2(e.target.value)}
                        placeholder="Nome do Bloco"
                        className="bg-slate-900 border border-indigo-500 text-white text-xs sm:text-sm font-bold rounded-lg px-2 py-1 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleSaveBlock2Name}
                        title="Salvar nome"
                        className="p-1 bg-indigo-500 text-slate-950 rounded-lg hover:bg-indigo-400 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTempB2(block2Name);
                          setIsEditingB2(false);
                        }}
                        title="Cancelar"
                        className="p-1 bg-slate-800 text-slate-400 rounded-lg hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <Home className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="truncate">{block2Name}</span>
                      </h3>
                      {/* Botão Lápis para editar o nome do Bloco 2 */}
                      <button
                        type="button"
                        onClick={() => {
                          setTempB2(block2Name);
                          setIsEditingB2(true);
                        }}
                        title="Editar nome deste bloco"
                        className="p-1 text-slate-400 hover:text-indigo-400 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {/* Botão + para adicionar parcela fixa ao Bloco 2 */}
                      <button
                        type="button"
                        onClick={() => handleOpenAddBlockFixed('bloco2')}
                        title={`Adicionar parcela fixa em ${block2Name}`}
                        className="flex items-center gap-1 px-2 py-0.5 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/40 text-indigo-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        <Plus className="w-3 h-3 stroke-[3]" />
                        <span>Fixa</span>
                      </button>
                    </div>
                  )}
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Projeção de despesas do bloco {block2Name}
                  </span>
                </div>
              </div>
              <span className="text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 px-2.5 py-1 rounded-lg font-mono font-bold shrink-0">
                {quinzenaList.length + (energiaBlock === 'bloco2' && energiaValor2Num > 0 ? 1 : 0) + blockFixedExpenses.filter((fe) => fe.block === 'bloco2').length} itens
              </span>
            </div>

            {/* Configuração de Recebimento do Bloco 2 com Botão "Salvar valores" e sem preenchimento falso */}
            <div className="mt-4 p-3.5 bg-[#162032] rounded-xl border border-slate-700/80 shadow-sm space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs sm:text-sm text-slate-200 font-bold block">
                      Recebimento ({block2Name}):
                    </label>
                    {isBloco2Saved ? (
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                        <span>Salvo</span>
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700/60 px-1.5 py-0.5 rounded font-mono">
                        Não salvo
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {selectedPerson} • {formatMonthPill(selectedMonthKey)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 font-mono text-base font-extrabold text-indigo-400">
                    <span>R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={draftRec2}
                      onChange={(e) => setDraftRec2(e.target.value)}
                      placeholder="0,00"
                      className="w-28 bg-[#0c1220] border border-slate-700 text-indigo-400 font-bold rounded-lg px-2.5 py-1 text-right focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveBloco2}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                    title={`Salvar valores de ${block2Name} para ${selectedPerson} em ${formatMonthPill(selectedMonthKey)}`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Salvar valores</span>
                  </button>
                </div>
              </div>

              {/* Feedback de sucesso ou erro do Bloco 2 */}
              {feedbackBloco2 && (
                <div
                  className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-in fade-in ${
                    feedbackBloco2.type === 'success'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {feedbackBloco2.type === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  )}
                  <span>{feedbackBloco2.message}</span>
                </div>
              )}
            </div>

            {/* Lista de Itens do Bloco 2 */}
            <div className="mt-4 space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {/* Energia Elétrica se alocada no Bloco 2 */}
              {energiaBlock === 'bloco2' && (
                <div
                  className="py-3 px-3.5 bg-amber-500/10 border border-amber-500/40 rounded-xl flex items-center justify-between text-xs sm:text-sm shadow-sm"
                  title="Parcela fixa de energia elétrica alocada neste bloco"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="font-bold text-white text-sm sm:text-base truncate">
                      Energia Elétrica
                    </span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                      Fixo
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1 font-mono text-sm sm:text-base font-extrabold text-amber-300">
                      <span>R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={draftEnergia2}
                        onChange={(e) => setDraftEnergia2(e.target.value)}
                        placeholder="0,00"
                        className="w-20 bg-slate-900 border border-slate-700 text-amber-300 rounded px-1.5 py-0.5 text-right font-bold text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleEnergiaBlock}
                      title={`Transferir Energia para ${block1Name}`}
                      className="p-1.5 text-slate-400 hover:text-emerald-300 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                    >
                      <ArrowLeftRight className="w-4 h-4 text-emerald-400" />
                    </button>
                  </div>
                </div>
              )}

              {/* Parcelas Fixas Específicas do Bloco 2 */}
              {blockFixedExpenses
                .filter((fe) => fe.block === 'bloco2')
                .map((fe) => (
                  <div
                    key={fe.id}
                    className="py-3 px-3.5 bg-[#172033] border border-indigo-500/30 rounded-xl flex items-center justify-between text-xs sm:text-sm shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="font-bold text-white text-sm truncate">
                        {fe.descricao}
                      </span>
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.2 rounded font-mono font-bold">
                        Fixa do Bloco
                      </span>
                      {fe.pagador && (
                        <span className="text-[10px] text-amber-400 font-medium capitalize truncate">
                          ({fe.pagador})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-sm sm:text-base font-extrabold text-amber-300">
                        {formatCurrency(fe.valor)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenEditBlockFixed(fe)}
                        title="Editar parcela fixa"
                        className="p-1 text-slate-400 hover:text-indigo-300 rounded cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmFixed(fe)}
                        title="Excluir parcela fixa"
                        className="p-1 text-slate-400 hover:text-rose-400 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

              {/* Cartões alocados no Bloco 2 */}
              {quinzenaList.map((cName) => {
                const val = getPersonCardExpense(cName, selectedMonthKey, selectedPerson);
                return (
                  <div
                    key={cName}
                    onDoubleClick={() => moveQuinzenaToMensal(cName)}
                    className="py-3 px-3.5 bg-[#141c2e] hover:bg-[#1a253d] border border-slate-700/60 hover:border-indigo-500/50 rounded-xl flex items-center justify-between text-xs sm:text-sm transition-all group cursor-pointer shadow-sm"
                    title={`Clique duas vezes ou use a seta para mover para ${block1Name}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="font-bold text-white text-sm sm:text-base truncate">
                        {cName}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`font-mono text-sm sm:text-base font-extrabold ${val > 0 ? 'text-amber-300' : 'text-slate-500'}`}>
                        {formatCurrency(val)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); moveQuinzenaToMensal(cName); }}
                        title={`Mover para ${block1Name}`}
                        className="opacity-60 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                      >
                        <ArrowLeftRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totais do Bloco 2 */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-2.5 text-xs sm:text-sm">
            <div className="flex justify-between items-center text-slate-300">
              <span className="font-medium">Total de Gastos ({selectedPerson}):</span>
              <span className="text-base sm:text-lg font-extrabold font-mono text-white">
                {formatCurrency(totalQuinzena)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm sm:text-base font-bold pt-2 border-t border-slate-800/60">
              <span className={sobraQuinzena >= 0 ? 'text-indigo-400' : 'text-red-400'}>
                {sobraQuinzena >= 0 ? `Sobra Líquida ${block2Name}:` : `Déficit ${block2Name}:`}
              </span>
              <span className={`font-mono text-lg sm:text-xl font-extrabold ${sobraQuinzena >= 0 ? 'text-indigo-400' : 'text-red-400'}`}>
                {formatCurrency(sobraQuinzena)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para Adicionar / Editar Parcela Fixa do Bloco */}
      {modalFixedBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>
                  {editingBlockFixed ? 'Editar' : 'Nova'} Parcela Fixa em {modalFixedBlock === 'bloco1' ? block1Name : block2Name}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setModalFixedBlock(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {fixedError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs font-semibold">
                {fixedError}
              </div>
            )}

            <form onSubmit={handleSaveBlockFixed} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Descrição da despesa fixa:
                </label>
                <input
                  type="text"
                  value={fixedDescInput}
                  onChange={(e) => setFixedDescInput(e.target.value)}
                  placeholder="Ex: Aluguel, Condomínio, Internet..."
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Valor mensal (R$):
                </label>
                <input
                  type="text"
                  value={fixedValInput}
                  onChange={(e) => setFixedValInput(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Responsável pelo pagamento:
                </label>
                <select
                  value={fixedPayerInput}
                  onChange={(e) => setFixedPayerInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="Todos">Todos (Comum a todos)</option>
                  {availablePersons.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalFixedBlock(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer shadow-md transition-all active:scale-95"
                >
                  Salvar Parcela
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Parcela Fixa */}
      {deleteConfirmFixed && (
        <ModalConfirmacao
          isOpen={true}
          title="Excluir Parcela Fixa do Bloco"
          message={`Tem certeza que deseja remover a parcela fixa "${deleteConfirmFixed.descricao}" de ${formatCurrency(deleteConfirmFixed.valor)}?`}
          confirmLabel="Sim, excluir"
          onConfirm={handleConfirmDeleteBlockFixed}
          onClose={() => setDeleteConfirmFixed(null)}
          isDestructive={true}
        />
      )}
    </div>
  );
};
