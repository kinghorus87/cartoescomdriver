import React, { useState, useMemo } from 'react';
import { CardData, FixedExpense, SimulatorConfig } from '../types';
import { formatCurrency, MESES_NOMES } from '../utils/storage';
import { getCardTransactions, toMonthKey } from '../utils/timeline';
import { Calculator, User, Building2, Home, Zap, AlertCircle } from 'lucide-react';

interface MiniSimuladorConsultaProps {
  simulatorConfig?: SimulatorConfig;
  cards: CardData[];
  persons: string[];
  fixedExpenses?: FixedExpense[];
  selectedMonth: number;
  selectedYear?: number;
  selectedMonthKey?: string;
}

export const MiniSimuladorConsulta: React.FC<MiniSimuladorConsultaProps> = ({
  simulatorConfig,
  cards,
  persons,
  fixedExpenses = [],
  selectedMonth,
  selectedYear,
  selectedMonthKey,
}) => {
  // Pessoas conhecidas no sistema
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
    return Array.from(set).sort();
  }, [persons, cards, fixedExpenses]);

  // Pessoa selecionada para consulta (inicia com pinnedPerson salva no simulador ou a primeira disponível)
  const defaultPerson = useMemo(() => {
    if (simulatorConfig?.pinnedPerson && allKnownPersons.some((p) => p.toLowerCase().trim() === simulatorConfig.pinnedPerson?.toLowerCase().trim())) {
      return simulatorConfig.pinnedPerson;
    }
    return allKnownPersons[0] || (persons && persons[0]) || '';
  }, [allKnownPersons, simulatorConfig?.pinnedPerson, persons]);

  const [selectedPerson, setSelectedPerson] = useState<string>(defaultPerson);

  // Sincroniza se a pessoa padrão mudar ou se a atual não existir mais
  React.useEffect(() => {
    if (!selectedPerson && defaultPerson) {
      setSelectedPerson(defaultPerson);
    }
  }, [defaultPerson, selectedPerson]);

  const effectiveYear =
    selectedYear ||
    (selectedMonthKey ? parseInt(selectedMonthKey.split('-')[0], 10) : new Date().getFullYear());

  const monthKey = useMemo(
    () => selectedMonthKey || toMonthKey(effectiveYear, selectedMonth),
    [selectedMonthKey, effectiveYear, selectedMonth]
  );

  // Nomes configurados para os blocos salvos no simulador
  const block1Title = simulatorConfig?.block1Name?.trim() || 'Comercial';
  const block2Title = simulatorConfig?.block2Name?.trim() || 'Residencial';

  // Listas de cartões salvas no simulador (dados exclusivamente salvos)
  const mensalCards = useMemo(() => {
    return (simulatorConfig?.mensalCards || []).filter((c) => c.toLowerCase() !== 'energia');
  }, [simulatorConfig?.mensalCards]);

  const quinzenaCards = useMemo(() => {
    return (simulatorConfig?.quinzenaCards || []).filter((c) => c.toLowerCase() !== 'energia');
  }, [simulatorConfig?.quinzenaCards]);

  // Função idêntica ao SimuladorGastosView para calcular o gasto da pessoa selecionada em um cartão
  const getPersonCardExpense = (cardName: string): number => {
    const cNameLower = cardName.toLowerCase().trim();
    const card = cards.find((c) => c.name.toLowerCase().trim() === cNameLower);
    if (!card) return 0;

    const personClean = selectedPerson.toLowerCase().trim();
    if (!personClean) return 0;

    // Transações reais no período para a pessoa selecionada
    const txs = getCardTransactions(card, monthKey);
    let total = txs
      .filter((t) => (t.pagador || '').toLowerCase().trim() === personClean && !t.pago)
      .reduce((acc, t) => acc + (t.valor || 0), 0);

    // Inclui parcelas fixas ativas do cartão para aquela pessoa naquele mês
    const cardFixed = fixedExpenses.filter(
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

  // Gastos de parcelas fixas cadastradas diretamente nos blocos
  const block1FixedExpenses = useMemo(() => {
    const personClean = selectedPerson.toLowerCase().trim();
    return (simulatorConfig?.blockFixedExpenses || []).filter(
      (fe) =>
        fe.block === 'bloco1' &&
        (!fe.pagador || fe.pagador.toLowerCase().trim() === 'todos' || fe.pagador.toLowerCase().trim() === personClean)
    );
  }, [simulatorConfig?.blockFixedExpenses, selectedPerson]);

  const block1FixedTotal = useMemo(() => {
    return block1FixedExpenses.reduce((acc, fe) => acc + (fe.valor || 0), 0);
  }, [block1FixedExpenses]);

  const block2FixedExpenses = useMemo(() => {
    const personClean = selectedPerson.toLowerCase().trim();
    return (simulatorConfig?.blockFixedExpenses || []).filter(
      (fe) =>
        fe.block === 'bloco2' &&
        (!fe.pagador || fe.pagador.toLowerCase().trim() === 'todos' || fe.pagador.toLowerCase().trim() === personClean)
    );
  }, [simulatorConfig?.blockFixedExpenses, selectedPerson]);

  const block2FixedTotal = useMemo(() => {
    return block2FixedExpenses.reduce((acc, fe) => acc + (fe.valor || 0), 0);
  }, [block2FixedExpenses]);

  // Chave específica da pessoa e do mês para consultar valores salvos no simulador
  const personRecordKey = `${(selectedPerson || '').toLowerCase().trim()}_${monthKey}`;
  const personSavedRecord = simulatorConfig?.savedValues?.[personRecordKey];

  // Atribuição da Energia salva
  const energiaBlock = simulatorConfig?.energiaBlock || 'bloco2';
  const energiaValor = energiaBlock === 'bloco1'
    ? (personSavedRecord?.bloco1?.energiaValor ?? 0)
    : (personSavedRecord?.bloco2?.energiaValor ?? 0);

  // Cálculos do Bloco 1 (exclusivamente com valores salvos)
  const block1CardItems = useMemo(() => {
    return mensalCards.map((cName) => ({
      name: cName,
      valor: getPersonCardExpense(cName),
    }));
  }, [mensalCards, selectedPerson, monthKey, cards, fixedExpenses]);

  const totalBloco1 = useMemo(() => {
    let sum = block1CardItems.reduce((acc, item) => acc + item.valor, 0);
    if (energiaBlock === 'bloco1' && energiaValor > 0) {
      sum += energiaValor;
    }
    sum += block1FixedTotal;
    return sum;
  }, [block1CardItems, energiaBlock, energiaValor, block1FixedTotal]);

  const rec1 = personSavedRecord?.bloco1?.rec ?? 0;
  const hasSavedRec1 = personSavedRecord?.bloco1?.rec !== undefined;
  const sobra1 = rec1 - totalBloco1;

  // Cálculos do Bloco 2 (exclusivamente com valores salvos)
  const block2CardItems = useMemo(() => {
    return quinzenaCards.map((cName) => ({
      name: cName,
      valor: getPersonCardExpense(cName),
    }));
  }, [quinzenaCards, selectedPerson, monthKey, cards, fixedExpenses]);

  const totalBloco2 = useMemo(() => {
    let sum = block2CardItems.reduce((acc, item) => acc + item.valor, 0);
    if (energiaBlock === 'bloco2' && energiaValor > 0) {
      sum += energiaValor;
    }
    sum += block2FixedTotal;
    return sum;
  }, [block2CardItems, energiaBlock, energiaValor, block2FixedTotal]);

  const rec2 = personSavedRecord?.bloco2?.rec ?? 0;
  const hasSavedRec2 = personSavedRecord?.bloco2?.rec !== undefined;
  const sobra2 = rec2 - totalBloco2;

  // Verifica se há dados salvos para exibir
  const hasSavedConfig = Boolean(
    simulatorConfig &&
    (mensalCards.length > 0 || quinzenaCards.length > 0 || (simulatorConfig.blockFixedExpenses && simulatorConfig.blockFixedExpenses.length > 0) || energiaValor > 0 || rec1 > 0 || rec2 > 0 || totalBloco1 > 0 || totalBloco2 > 0)
  );

  return (
    <div className="bg-[#111625] border border-slate-800/90 rounded-2xl p-4 shadow-xl flex flex-col gap-4 text-slate-100 w-full">
      {/* Cabeçalho da Mini Tabela de Consulta */}
      <div className="border-b border-slate-800/80 pb-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-fuchsia-500/10 text-fuchsia-400 rounded-lg border border-fuchsia-500/20">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                Consulta do Simulador
              </h3>
              <p className="text-[10px] text-slate-400">
                Previsão em {MESES_NOMES[selectedMonth - 1]} / {effectiveYear}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700/60 text-slate-300">
            {MESES_NOMES[selectedMonth - 1]?.slice(0, 3)}
          </span>
        </div>

        {/* Seletor de Pessoa */}
        {allKnownPersons.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <User className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
            <span className="text-[11px] text-slate-400 shrink-0">Pessoa:</span>
            <select
              value={selectedPerson}
              onChange={(e) => setSelectedPerson(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700/80 text-white font-bold text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-fuchsia-500 cursor-pointer"
            >
              {allKnownPersons.map((p) => (
                <option key={p} value={p} className="bg-slate-900 text-white">
                  {p}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!hasSavedConfig ? (
        /* Área vazia discreta quando não houver dados salvos */
        <div className="py-8 px-4 text-center rounded-xl bg-slate-900/40 border border-dashed border-slate-800/80">
          <AlertCircle className="w-6 h-6 text-slate-500 mx-auto mb-2 opacity-60" />
          <p className="text-xs font-semibold text-slate-300">
            Nenhum dado salvo no simulador
          </p>
          <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
            Acesse a aba <span className="text-fuchsia-400 font-medium">Simulador de Gastos</span> para organizar os cartões e salvar os valores.
          </p>
        </div>
      ) : (
        /* Conteúdo com rolagem própria */
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* BLOCO 1: Superior (Nome configurado pelo usuário) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-sm flex flex-col gap-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-1.5 min-w-0">
                <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <h4 className="text-xs font-bold text-emerald-300 truncate" title={block1Title}>
                  {block1Title}
                </h4>
              </div>
              <span className="text-[11px] font-mono font-semibold text-emerald-400">
                {formatCurrency(totalBloco1)}
              </span>
            </div>

            {/* Itens do Bloco 1 */}
            <div className="space-y-1.5 text-xs">
              {block1CardItems.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between text-[11px] py-0.5 px-1 rounded hover:bg-slate-800/50"
                >
                  <span className="text-slate-300 truncate max-w-[170px]" title={item.name}>
                    {item.name}
                  </span>
                  <span className="font-mono text-slate-200">
                    {item.valor > 0 ? formatCurrency(item.valor) : '-'}
                  </span>
                </div>
              ))}

              {energiaBlock === 'bloco1' && energiaValor > 0 && (
                <div className="flex items-center justify-between text-[11px] py-0.5 px-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  <span className="flex items-center gap-1 font-medium">
                    <Zap className="w-3 h-3 text-amber-400" />
                    Energia
                  </span>
                  <span className="font-mono">{formatCurrency(energiaValor)}</span>
                </div>
              )}

              {block1FixedExpenses.map((fe) => (
                <div
                  key={fe.id}
                  className="flex items-center justify-between text-[11px] py-0.5 px-1 rounded hover:bg-slate-800/50 text-emerald-300/90"
                >
                  <span className="truncate max-w-[170px]" title={fe.descricao}>
                    {fe.descricao}
                  </span>
                  <span className="font-mono">{formatCurrency(fe.valor)}</span>
                </div>
              ))}

              {block1CardItems.length === 0 && !(energiaBlock === 'bloco1' && energiaValor > 0) && block1FixedExpenses.length === 0 && (
                <p className="text-[10px] text-slate-500 italic py-1 text-center">
                  Nenhum gasto alocado neste bloco
                </p>
              )}
            </div>

            {/* Resumo Financeiro do Bloco 1 */}
            <div className="pt-2 border-t border-slate-800/80 space-y-1 text-[11px]">
              <div className="flex items-center justify-between text-slate-400">
                <span>Recebimento:</span>
                <span className={`font-mono ${hasSavedRec1 ? 'font-medium text-slate-200' : 'text-slate-500 italic text-[10px]'}`}>
                  {hasSavedRec1 ? formatCurrency(rec1) : 'Não informado'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span className="font-semibold text-slate-300">Sobra projetada:</span>
                <span
                  className={`font-mono font-bold ${
                    sobra1 >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatCurrency(sobra1)}
                </span>
              </div>
            </div>
          </div>

          {/* BLOCO 2: Inferior (Nome configurado pelo usuário) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-sm flex flex-col gap-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-1.5 min-w-0">
                <Home className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <h4 className="text-xs font-bold text-cyan-300 truncate" title={block2Title}>
                  {block2Title}
                </h4>
              </div>
              <span className="text-[11px] font-mono font-semibold text-cyan-400">
                {formatCurrency(totalBloco2)}
              </span>
            </div>

            {/* Itens do Bloco 2 */}
            <div className="space-y-1.5 text-xs">
              {block2CardItems.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between text-[11px] py-0.5 px-1 rounded hover:bg-slate-800/50"
                >
                  <span className="text-slate-300 truncate max-w-[170px]" title={item.name}>
                    {item.name}
                  </span>
                  <span className="font-mono text-slate-200">
                    {item.valor > 0 ? formatCurrency(item.valor) : '-'}
                  </span>
                </div>
              ))}

              {energiaBlock === 'bloco2' && energiaValor > 0 && (
                <div className="flex items-center justify-between text-[11px] py-0.5 px-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  <span className="flex items-center gap-1 font-medium">
                    <Zap className="w-3 h-3 text-amber-400" />
                    Energia
                  </span>
                  <span className="font-mono">{formatCurrency(energiaValor)}</span>
                </div>
              )}

              {block2FixedExpenses.map((fe) => (
                <div
                  key={fe.id}
                  className="flex items-center justify-between text-[11px] py-0.5 px-1 rounded hover:bg-slate-800/50 text-cyan-300/90"
                >
                  <span className="truncate max-w-[170px]" title={fe.descricao}>
                    {fe.descricao}
                  </span>
                  <span className="font-mono">{formatCurrency(fe.valor)}</span>
                </div>
              ))}

              {block2CardItems.length === 0 && !(energiaBlock === 'bloco2' && energiaValor > 0) && block2FixedExpenses.length === 0 && (
                <p className="text-[10px] text-slate-500 italic py-1 text-center">
                  Nenhum gasto alocado neste bloco
                </p>
              )}
            </div>

            {/* Resumo Financeiro do Bloco 2 */}
            <div className="pt-2 border-t border-slate-800/80 space-y-1 text-[11px]">
              <div className="flex items-center justify-between text-slate-400">
                <span>Recebimento:</span>
                <span className={`font-mono ${hasSavedRec2 ? 'font-medium text-slate-200' : 'text-slate-500 italic text-[10px]'}`}>
                  {hasSavedRec2 ? formatCurrency(rec2) : 'Não informado'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span className="font-semibold text-slate-300">Sobra projetada:</span>
                <span
                  className={`font-mono font-bold ${
                    sobra2 >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatCurrency(sobra2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
