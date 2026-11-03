
import React, { useState, useMemo, useRef } from 'react';
import { CardData } from '../types';
import { formatCurrency } from '../utils/storage';
import {
  generateMonthRange,
  getDynamicMonthRange,
  formatMonthLong,
  CURRENT_REAL_MONTH,
  getRolling36Window,
  diffMonths,
  parseMonthKey,
  isMonthInRollingWindow,
} from '../utils/timeline';
import { cleanCardName } from '../utils/cardColors';
import {
  X,
  CreditCard,
  AlertCircle,
  Plus,
  ChevronDown,
  ChevronUp,
  Star,
  Pin,
  UserPlus,
  Calendar
} from 'lucide-react';

interface ModalLancamentoProps {
  isOpen: boolean;
  onClose: () => void;
  cards: CardData[];
  persons?: string[];
  favoritePersons?: string[];
  onToggleFavoritePerson?: (name: string) => void;
  onAddNewPerson?: (name: string, makeFavorite?: boolean) => void;
  defaultCardName?: string;
  defaultMonthKey?: string;
  onSaveLancamento: (data: {
    cartaoNome: string;
    dataCompra: string;
    descricao: string;
    valorParcela: number;
    totalParcelas: number;
    parcelaInicial?: number;
    mesInicial: string;
    pagador1: string;
    dividir: boolean;
    pagador2?: string;
  }) => void;
}

export const ModalLancamento: React.FC<ModalLancamentoProps> = ({
  isOpen,
  onClose,
  cards,
  persons = [],
  favoritePersons = [],
  onToggleFavoritePerson,
  onAddNewPerson,
  defaultCardName,
  defaultMonthKey,
  onSaveLancamento,
}) => {
  const [cartaoNome, setCartaoNome] = useState<string>(
    defaultCardName || cards[0]?.name || ''
  );

  const [dataCompra, setDataCompra] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const [descricao, setDescricao] = useState<string>('');
  const [valorParcela, setValorParcela] = useState<string>('');
  const [mesInicialKey, setMesInicialKey] = useState<string>(
    defaultMonthKey || CURRENT_REAL_MONTH
  );
  const [totalParcelas, setTotalParcelas] = useState<number>(1);
  const [parcelaInicial, setParcelaInicial] = useState<number>(1);
  const [usarParcelaInicial, setUsarParcelaInicial] = useState<boolean>(false);
  const [showCustomParcelas, setShowCustomParcelas] =
    useState<boolean>(false);

  // Pagadores favoritos e outros pagadores da conta
  const favPayers = useMemo(() => {
    return favoritePersons || [];
  }, [favoritePersons]);

  const otherPayers = useMemo(() => {
    return (persons || []).filter(
      (p) => !favPayers.some((f) => f.toLowerCase().trim() === p.toLowerCase().trim())
    );
  }, [persons, favPayers]);

  const [pagador1Opt, setPagador1Opt] = useState<string>('');
  const [showOutros1, setShowOutros1] = useState<boolean>(false);
  const [outro1Text, setOutro1Text] = useState<string>('');
  const [outro1IsFav, setOutro1IsFav] = useState<boolean>(false);

  const [dividir, setDividir] = useState<boolean>(false);
  const [pagador2Opt, setPagador2Opt] = useState<string>('');
  const [showOutros2, setShowOutros2] = useState<boolean>(false);
  const [outro2Text, setOutro2Text] = useState<string>('');
  const [outro2IsFav, setOutro2IsFav] = useState<boolean>(false);

  const [errorMsg, setErrorMsg] = useState<string>('');

  const getTodayLocalYMD = (): string => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const { startMonthKey, endMonthKey, months: rollingMonths } = useMemo(() => getRolling36Window(), []);

  // Opções de meses estritamente delimitadas pela janela móvel contínua de 36 meses
  const availableMonthOptions = useMemo(() => {
    return rollingMonths.map((key) => ({
      key,
      label: formatMonthLong(key),
    }));
  }, [rollingMonths]);

  // Limites da data da compra vinculados aos 36 meses
  const minDate = `${startMonthKey}-01`;
  const maxDate = useMemo(() => {
    const { year: y, month: m } = parseMonthKey(endMonthKey);
    const lastDay = new Date(y, m, 0).getDate();
    return `${endMonthKey}-${String(lastDay).padStart(2, '0')}`;
  }, [endMonthKey]);

  // Quantidade máxima de parcelas a partir do mês inicial selecionado para não exceder a janela
  const maxAllowedParcelas = useMemo(() => {
    return Math.max(1, Math.min(36, diffMonths(mesInicialKey, endMonthKey) + 1));
  }, [mesInicialKey, endMonthKey]);

  // Limpa os campos da compra sem perder o cartão e o mês selecionados.
  const limparFormulario = () => {
    setDataCompra(getTodayLocalYMD());
    setDescricao('');
    setValorParcela('');
    setTotalParcelas(1);
    setParcelaInicial(1);
    setUsarParcelaInicial(false);
    setShowCustomParcelas(false);

    const defaultP1 = favPayers[0] || persons[0] || '';
    setPagador1Opt(defaultP1);
    setShowOutros1(false);
    setOutro1Text('');
    setOutro1IsFav(false);

    setDividir(false);
    const defaultP2 = favPayers[1] || persons[1] || favPayers[0] || persons[0] || '';
    setPagador2Opt(defaultP2);
    setShowOutros2(false);
    setOutro2Text('');
    setOutro2IsFav(false);

    setErrorMsg('');
  };

  const handleClose = () => {
    limparFormulario();
    onClose();
  };

  React.useEffect(() => {
    if (isOpen) {
      limparFormulario();
      if (defaultCardName) {
        setCartaoNome(defaultCardName);
      } else if (cards.length > 0) {
        setCartaoNome((current) =>
          cards.some((card) => card.name === current)
            ? current
            : cards[0].name
        );
      }

      if (defaultMonthKey) {
        setMesInicialKey(defaultMonthKey);
      }

      const defaultP1 = favPayers[0] || persons[0] || 'Outros';
      setPagador1Opt(defaultP1);

      const defaultP2 = favPayers[1] || persons[1] || favPayers[0] || persons[0] || 'Outros';
      setPagador2Opt(defaultP2);
    } else {
      limparFormulario();
    }
  }, [isOpen, defaultCardName, defaultMonthKey, cards, favPayers, persons]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!cartaoNome) {
      setErrorMsg('Por favor, selecione um cartão de destino.');
      return;
    }

    if (!descricao.trim()) {
      setErrorMsg('Por favor, preencha a descrição da compra.');
      return;
    }

    const val = parseFloat(valorParcela.replace(',', '.'));

    if (isNaN(val) || val <= 0) {
      setErrorMsg(
        'Por favor, informe um valor de parcela válido maior que zero.'
      );
      return;
    }

    if (!Number.isInteger(totalParcelas) || totalParcelas < 1 || totalParcelas > 120) {
      setErrorMsg('Informe uma quantidade de parcelas entre 1 e 120.');
      return;
    }

    if (usarParcelaInicial) {
      if (isNaN(parcelaInicial) || parcelaInicial < 1) {
        setErrorMsg('O número da parcela inicial deve ser igual ou maior que 1.');
        return;
      }
      if (parcelaInicial > totalParcelas) {
        setErrorMsg(
          `O número da parcela inicial (${parcelaInicial}) não pode ser maior do que a quantidade total de parcelas (${totalParcelas}).`
        );
        return;
      }
    }

    if (!dataCompra) {
      setErrorMsg('Por favor, informe a data da compra.');
      return;
    }

    const p1Nome =
      pagador1Opt === 'Outros' ? outro1Text.trim() : pagador1Opt;

    if (!p1Nome) {
      setErrorMsg('Informe o nome do primeiro pagador.');
      return;
    }

    let p2Nome = '';

    if (dividir) {
      p2Nome =
        pagador2Opt === 'Outros' ? outro2Text.trim() : pagador2Opt;

      if (!p2Nome) {
        setErrorMsg('Informe o nome do segundo pagador para a divisão.');
        return;
      }

      if (p1Nome.toLowerCase().trim() === p2Nome.toLowerCase().trim()) {
        setErrorMsg('Selecione duas pessoas diferentes para dividir a compra.');
        return;
      }
    }

    // Se cadastrou um novo pagador digitado livremente, salva-o na conta do usuário
    if (pagador1Opt === 'Outros' && p1Nome && onAddNewPerson) {
      onAddNewPerson(p1Nome, outro1IsFav);
    }
    if (dividir && pagador2Opt === 'Outros' && p2Nome && onAddNewPerson) {
      onAddNewPerson(p2Nome, outro2IsFav);
    }

    if (totalParcelas > maxAllowedParcelas) {
      setErrorMsg(
        `A quantidade de parcelas (${totalParcelas}x) ultrapassa a janela móvel de 36 meses. O limite a partir de ${formatMonthLong(mesInicialKey)} é de ${maxAllowedParcelas}x.`
      );
      return;
    }

    const [ano, mes, dia] = dataCompra.split('-');
    const dataFormatada = `${dia}/${mes}/${ano}`;

    try {
      onSaveLancamento({
        cartaoNome,
        dataCompra: dataFormatada,
        descricao: descricao.trim(),
        valorParcela: val,
        totalParcelas,
        parcelaInicial: usarParcelaInicial ? parcelaInicial : 1,
        mesInicial: mesInicialKey,
        pagador1: p1Nome,
        dividir,
        pagador2: dividir ? p2Nome : undefined,
      });

      // Só limpa depois que a função de salvamento retorna sem erro.
      limparFormulario();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar lançamento:', error);
      setErrorMsg(
        'Não foi possível salvar o lançamento. Confira os dados e tente novamente.'
      );
    }
  };

  const parsedValor = parseFloat(valorParcela.replace(',', '.')) || 0;
  const parcelasRestantes = usarParcelaInicial
    ? Math.max(1, totalParcelas - parcelaInicial + 1)
    : totalParcelas;
  const valorTotalCompra = parsedValor * totalParcelas;
  const valorTotalLancar = parsedValor * parcelasRestantes;
  const valorDivididoParcela = dividir
    ? Math.round((parsedValor / 2) * 100) / 100
    : parsedValor;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Lançamento de Parcelas
              </h2>
              <p className="text-xs text-slate-400">
                frmLLancarCartoes — Distribuição mês a mês
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar formulário"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Cartão de destino */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-300 block">
                Cartão de Destino:
              </label>

              {cards.find((c) => c.name === cartaoNome)?.dueDay && (
                <span className="text-[11px] text-emerald-400 font-mono font-medium">
                  Vencimento dia {cards.find((c) => c.name === cartaoNome)?.dueDay}
                </span>
              )}
            </div>

            <select
              value={cartaoNome}
              onChange={(e) => setCartaoNome(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {cards.map((c) => (
                <option key={c.id} value={c.name}>
                  {cleanCardName(c.name)}
                </option>
              ))}
            </select>
          </div>

          {/* Data e mês inicial */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-300 block mb-1">
                Data da Compra:
              </label>

              <div
                onClick={() => {
                  try {
                    dateInputRef.current?.showPicker?.();
                    dateInputRef.current?.focus();
                  } catch {}
                }}
                className="relative cursor-pointer"
              >
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={dataCompra}
                  min={minDate}
                  max={maxDate}
                  onClick={(e) => {
                    try {
                      (e.currentTarget as any).showPicker?.();
                    } catch {}
                  }}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setDataCompra(newDate);
                    if (newDate && newDate.includes('-')) {
                      const [y, m] = newDate.split('-');
                      if (y && m) {
                        const calculatedKey = `${y}-${m.padStart(2, '0')}`;
                        if (isMonthInRollingWindow(calculatedKey)) {
                          setMesInicialKey(calculatedKey);
                        }
                      }
                    }
                  }}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-9 pr-3 py-2 text-xs font-mono focus:outline-none focus:border-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1">
                Mês da 1ª Parcela (Ano/Mês real):
              </label>

              <select
                value={mesInicialKey}
                onChange={(e) => setMesInicialKey(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {availableMonthOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="font-semibold text-slate-300 block mb-1">
              Descrição da Compra:
            </label>

            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Tênis, Supermercado, Celular..."
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Valor e total */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-300 block mb-1">
                Valor da Parcela (R$):
              </label>

              <input
                type="text"
                inputMode="decimal"
                value={valorParcela}
                onChange={(e) => setValorParcela(e.target.value)}
                placeholder="0,00"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1">
                Total da Compra:
              </label>

              <div className="bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-emerald-400 flex flex-col justify-center">
                <span>{formatCurrency(valorTotalCompra)}</span>
                {usarParcelaInicial && parcelasRestantes < totalParcelas && (
                  <span className="text-[10px] text-emerald-300/80 font-normal mt-0.5">
                    A lançar ({parcelasRestantes} parcelas restantes): {formatCurrency(valorTotalLancar)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quantidade de parcelas */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-300 block">
                Quantidade de Parcelas:{' '}
                <span className="text-emerald-400 font-bold font-mono">
                  {totalParcelas}x
                </span>
                {usarParcelaInicial && (
                  <span className="ml-2 text-xs font-normal text-amber-400">
                    (iniciando na {parcelaInicial}ª parcela)
                  </span>
                )}
              </label>

              {showCustomParcelas && (
                <span className="text-[11px] text-slate-400">
                  Personalize a quantidade de parcelas
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setTotalParcelas(num);
                    if (parcelaInicial > num) setParcelaInicial(1);
                    setShowCustomParcelas(false);
                  }}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    totalParcelas === num && !showCustomParcelas
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {num}x
                </button>
              ))}

              <button
                type="button"
                onClick={() => setShowCustomParcelas(!showCustomParcelas)}
                title="Selecionar quantidade superior a 12 parcelas"
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  showCustomParcelas || totalParcelas > 12
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800 text-emerald-400 border border-emerald-500/30 hover:bg-slate-700'
                }`}
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Mais</span>
              </button>
            </div>

            {showCustomParcelas && (
              <div className="mt-2.5 p-3 bg-slate-900 border border-slate-700 rounded-xl space-y-2.5 animate-in fade-in">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-300">
                    Atalhos rápidos:
                  </span>

                  {[4, 16, 18, 48].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setTotalParcelas(preset);
                        if (parcelaInicial > preset) setParcelaInicial(1);
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer font-mono ${
                        totalParcelas === preset
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {preset}x
                    </button>
                  ))}

                  <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700">
                    <label className="text-xs text-slate-300 whitespace-nowrap">
                      Ou digite o número exato:
                    </label>

                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={totalParcelas}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 1 && val <= 120) {
                          setTotalParcelas(val);
                          if (parcelaInicial > val) setParcelaInicial(1);
                        }
                      }}
                      className="w-20 bg-slate-800 border border-slate-600 text-white rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />

                    <span className="text-xs text-slate-400">parcelas</span>
                  </div>
                </div>
              </div>
            )}

            {/* Opção D — Escolher parcela inicial (somente quando parcelado) */}
            {totalParcelas > 1 && (
              <div className="mt-3 p-3 bg-slate-900/90 border border-slate-700/80 rounded-xl space-y-2.5 animate-in fade-in">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={usarParcelaInicial}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setUsarParcelaInicial(checked);
                      if (!checked) {
                        setParcelaInicial(1);
                      }
                    }}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-800 border-slate-700 focus:ring-0 cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-white">
                      Opção D — Escolher parcela inicial
                    </span>
                    <span className="text-[11px] text-slate-400">
                      (compra em andamento)
                    </span>
                  </div>
                </label>

                {usarParcelaInicial && (
                  <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2.5 animate-in fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">
                          Número da Parcela Inicial:
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={totalParcelas}
                          value={parcelaInicial}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val >= 1) {
                              setParcelaInicial(val);
                            }
                          }}
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                        />
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          Começa na parcela {parcelaInicial} (as anteriores já foram pagas)
                        </span>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">
                          Quantidade Total de Parcelas:
                        </label>
                        <input
                          type="number"
                          min={Math.max(1, parcelaInicial)}
                          max={120}
                          value={totalParcelas}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val >= 1 && val <= 120) {
                              setTotalParcelas(val);
                            }
                          }}
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                        />
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          Total contratado da compra original ({totalParcelas}x)
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-[11px] leading-relaxed">
                      <strong>Resumo do lançamento:</strong> Serão geradas as parcelas de <strong>{parcelaInicial}/{totalParcelas}</strong> até <strong>{totalParcelas}/{totalParcelas}</strong> ({totalParcelas - parcelaInicial + 1} parcelas), iniciando na fatura de <strong>{formatMonthLong(mesInicialKey)}</strong>. As parcelas anteriores não serão criadas.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Primeiro pagador */}
          <div className="p-3.5 bg-slate-800/50 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300 block text-xs">
                Pagador / Responsável 1:
              </span>

              <span className="text-[11px] text-slate-400">
                Fixados em destaque e outros
              </span>
            </div>

            {/* Se houver favoritos fixados */}
            {favPayers.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  Fixados / Favoritos:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {favPayers.map((p) => {
                    const isSelected = pagador1Opt.toLowerCase().trim() === p.toLowerCase().trim();
                    return (
                      <div key={p} className="inline-flex items-center">
                        <button
                          type="button"
                          onClick={() => setPagador1Opt(p)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                              : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-amber-500/40'
                          }`}
                        >
                          <Star className={`w-3 h-3 ${isSelected ? 'fill-slate-950 text-slate-950' : 'fill-amber-400 text-amber-400'}`} />
                          <span>{p}</span>
                          {onToggleFavoritePerson && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavoritePerson(p);
                              }}
                              title="Desafixar dos favoritos"
                              className="ml-1 p-0.5 text-amber-400/80 hover:text-amber-300 hover:bg-black/30 rounded cursor-pointer"
                            >
                              <Pin className="w-2.5 h-2.5 fill-amber-400" />
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Outros pagadores cadastrados na conta */}
            {otherPayers.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-slate-700/60">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Outros Pagadores:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {otherPayers.map((p) => {
                    const isSelected = pagador1Opt.toLowerCase().trim() === p.toLowerCase().trim();
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPagador1Opt(p)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <span>{p}</span>
                        {onToggleFavoritePerson && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavoritePerson(p);
                            }}
                            title="Fixar como favorito"
                            className="ml-0.5 p-0.5 text-slate-500 hover:text-amber-400 hover:bg-black/20 rounded cursor-pointer"
                          >
                            <Pin className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Botão de cadastrar novo pagador */}
            <div className="pt-1 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPagador1Opt('Outros')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  pagador1Opt === 'Outros'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-800 text-teal-400 hover:bg-slate-700 border border-teal-500/30'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Novo Pagador</span>
              </button>
            </div>

            {pagador1Opt === 'Outros' && (
              <div className="p-3 bg-slate-900 border border-emerald-500/40 rounded-xl space-y-2 animate-in fade-in">
                <input
                  type="text"
                  value={outro1Text}
                  onChange={(e) => setOutro1Text(e.target.value)}
                  placeholder="Digite o nome do novo pagador"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300">
                  <input
                    type="checkbox"
                    checked={outro1IsFav}
                    onChange={(e) => setOutro1IsFav(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
                  />
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span>Fixar como favorito para aparecer em destaque nos próximos lançamentos</span>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Divisão da despesa */}
          <div className="p-3.5 bg-slate-800/50 rounded-xl border border-slate-800 space-y-2.5">
            <label className="flex items-center gap-2 cursor-pointer text-slate-200 font-semibold">
              <input
                type="checkbox"
                checked={dividir}
                onChange={(e) => setDividir(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
              />

              <span>Dividir valor da compra com outra pessoa? (50% cada)</span>
            </label>

            {dividir && (
              <div className="pt-2.5 mt-2 border-t border-slate-700/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 block text-xs">
                    Segundo Pagador (Divisão 50%):
                  </span>

                  <span className="text-[11px] text-slate-400">
                    Fixados em destaque e outros
                  </span>
                </div>

                {/* Se houver favoritos fixados */}
                {favPayers.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      Fixados / Favoritos:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {favPayers.map((p) => {
                        const isSelected = pagador2Opt.toLowerCase().trim() === p.toLowerCase().trim();
                        return (
                          <div key={p} className="inline-flex items-center">
                            <button
                              type="button"
                              onClick={() => setPagador2Opt(p)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-teal-400 text-slate-950 shadow-md shadow-teal-500/20'
                                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-amber-500/40'
                              }`}
                            >
                              <Star className={`w-3 h-3 ${isSelected ? 'fill-slate-950 text-slate-950' : 'fill-amber-400 text-amber-400'}`} />
                              <span>{p}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Outros pagadores cadastrados na conta */}
                {otherPayers.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-700/60">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                      Outros Pagadores:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {otherPayers.map((p) => {
                        const isSelected = pagador2Opt.toLowerCase().trim() === p.toLowerCase().trim();
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPagador2Opt(p)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-teal-400 text-slate-950 font-bold'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            <span>{p}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Botão de cadastrar novo pagador para o segundo responsável */}
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPagador2Opt('Outros')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      pagador2Opt === 'Outros'
                        ? 'bg-teal-400 text-slate-950 font-bold shadow-sm'
                        : 'bg-slate-800 text-teal-400 hover:bg-slate-700 border border-teal-500/30'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Novo Pagador</span>
                  </button>
                </div>

                {pagador2Opt === 'Outros' && (
                  <div className="p-3 bg-slate-900 border border-teal-500/40 rounded-xl space-y-2 animate-in fade-in">
                    <input
                      type="text"
                      value={outro2Text}
                      onChange={(e) => setOutro2Text(e.target.value)}
                      placeholder="Digite o nome do segundo pagador"
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-teal-500"
                    />
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300">
                      <input
                        type="checkbox"
                        checked={outro2IsFav}
                        onChange={(e) => setOutro2IsFav(e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
                      />
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span>Fixar como favorito para aparecer em destaque nos próximos lançamentos</span>
                      </div>
                    </label>
                  </div>
                )}

                <div className="text-[11px] text-emerald-400 font-medium pt-1">
                  * Serão geradas 2 linhas por mês: cada pagador pagará{' '}
                  {formatCurrency(valorDivididoParcela)} por parcela.
                </div>
              </div>
            )}
          </div>

          {/* Rodapé */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors font-semibold cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
            >
              Confirmar Lançamento ({totalParcelas}x)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
