import React, { useState, useEffect } from 'react';
import { CardData, FixedExpense } from '../types';
import { formatCurrency } from '../utils/storage';
import { X, Calendar, DollarSign, Tag, Check, AlertCircle, BookmarkPlus } from 'lucide-react';

interface ModalParcelaFixaProps {
  isOpen: boolean;
  onClose: () => void;
  cards: CardData[];
  defaultCardId?: string;
  persons: string[];
  editingExpense?: FixedExpense | null;
  onSaveExpense: (expense: Omit<FixedExpense, 'id'> & { id?: string }) => void;
}

export const ModalParcelaFixa: React.FC<ModalParcelaFixaProps> = ({
  isOpen,
  onClose,
  cards,
  defaultCardId,
  persons,
  editingExpense,
  onSaveExpense,
}) => {
  const [cardId, setCardId] = useState<string>(defaultCardId || cards[0]?.id || '');
  const [descricao, setDescricao] = useState<string>('');
  const [valorStr, setValorStr] = useState<string>('');
  const [diaMes, setDiaMes] = useState<number>(10);
  const [ativo, setAtivo] = useState<boolean>(true);
  const [pagador, setPagador] = useState<string>(persons[0] || '');
  const [novoPagadorText, setNovoPagadorText] = useState<string>('');
  const [isNovoPagador, setIsNovoPagador] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (editingExpense) {
        setCardId(editingExpense.cardId);
        setDescricao(editingExpense.descricao);
        setValorStr(String(editingExpense.valor));
        setDiaMes(editingExpense.diaMes || 10);
        setAtivo(editingExpense.ativo !== false);
        setPagador(editingExpense.pagador || persons[0] || '');
        setIsNovoPagador(false);
        setNovoPagadorText('');
      } else {
        setCardId(defaultCardId || cards[0]?.id || '');
        setDescricao('');
        setValorStr('');
        setDiaMes(10);
        setAtivo(true);
        setPagador(persons[0] || '');
        setIsNovoPagador(false);
        setNovoPagadorText('');
      }
      setErrorMsg('');
    }
  }, [isOpen, editingExpense, defaultCardId, cards, persons]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!cardId) {
      setErrorMsg('Selecione um cartão para associar a parcela fixa.');
      return;
    }
    const cleanDesc = descricao.trim();
    if (!cleanDesc) {
      setErrorMsg('Informe a descrição da despesa fixa (ex: Anuidade, Totalpass...).');
      return;
    }

    const cleanVal = parseFloat(valorStr.replace(/\./g, '').replace(',', '.').trim());
    if (isNaN(cleanVal) || cleanVal <= 0) {
      setErrorMsg('Informe um valor mensal válido maior que zero.');
      return;
    }

    const diaInt = parseInt(String(diaMes), 10);
    if (isNaN(diaInt) || diaInt < 1 || diaInt > 31) {
      setErrorMsg('O dia do mês deve ser um número entre 1 e 31.');
      return;
    }

    let finalPagador = pagador;
    if (isNovoPagador) {
      const cleanNew = novoPagadorText.trim();
      if (!cleanNew) {
        setErrorMsg('Informe o nome do novo pagador.');
        return;
      }
      finalPagador = cleanNew;
    }

    onSaveExpense({
      id: editingExpense?.id,
      cardId,
      descricao: cleanDesc,
      valor: cleanVal,
      diaMes: diaInt,
      ativo,
      pagador: finalPagador,
    });

    onClose();
  };

  const parsedValPreview = parseFloat(valorStr.replace(/\./g, '').replace(',', '.')) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#111625] border border-slate-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-[#111625] z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-500/10 text-teal-400 rounded-lg border border-teal-500/20">
              <BookmarkPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {editingExpense ? 'Editar Parcela Fixa' : 'Nova Parcela Fixa'}
              </h2>
              <p className="text-xs text-slate-400">Despesa recorrente mensal do cartão</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Cartão Associado */}
          <div>
            <label className="font-semibold text-slate-300 block mb-1">
              Cartão Associado:
            </label>
            <select
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              className="w-full bg-[#162032] border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-teal-500 cursor-pointer"
            >
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Descrição */}
          <div>
            <label className="font-semibold text-slate-300 block mb-1">
              Descrição da Parcela Fixa <span className="text-teal-400">*</span>:
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Tag className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Anuidade, Totalpass, Seguro..."
                className="w-full bg-[#162032] border border-slate-700 text-white rounded-lg pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Valor Mensal e Dia do Mês */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-300 block mb-1">
                Valor Mensal (R$) <span className="text-teal-400">*</span>:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <DollarSign className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={valorStr}
                  onChange={(e) => setValorStr(e.target.value)}
                  placeholder="Ex: 59,90"
                  className="w-full bg-[#162032] border border-slate-700 text-white rounded-lg pl-9 pr-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-teal-500"
                />
              </div>
              {parsedValPreview > 0 && (
                <p className="text-[10px] text-teal-400 mt-1">
                  {formatCurrency(parsedValPreview)}
                </p>
              )}
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1">
                Dia do Mês (1-31) <span className="text-teal-400">*</span>:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={diaMes}
                  onChange={(e) => setDiaMes(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-[#162032] border border-slate-700 text-white rounded-lg pl-9 pr-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Responsável / Pagador */}
          <div>
            <label className="font-semibold text-slate-300 block mb-1.5">
              Responsável / Pagador:
            </label>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {persons.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPagador(p);
                    setIsNovoPagador(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    !isNovoPagador && pagador.toLowerCase() === p.toLowerCase()
                      ? 'bg-teal-400 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsNovoPagador(true)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isNovoPagador
                    ? 'bg-teal-400 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                + Novo
              </button>
            </div>

            {isNovoPagador && (
              <input
                type="text"
                value={novoPagadorText}
                onChange={(e) => setNovoPagadorText(e.target.value)}
                placeholder="Nome do novo responsável"
                className="w-full bg-[#162032] border border-teal-500/50 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-teal-500"
                autoFocus
              />
            )}
          </div>

          {/* Opção / Flag Parcela Fixa Ativa */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-200 block">Parcela fixa ativa</span>
              <span className="text-[10px] text-slate-400">
                Aparece na fatura do mês atual correspondente e entra no simulador
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="w-4 h-4 rounded accent-teal-400 cursor-pointer"
              />
            </label>
          </div>

          {/* Rodapé com Ações */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-xs font-bold bg-teal-400 hover:bg-teal-300 text-slate-950 transition-all shadow-md shadow-teal-500/20 active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{editingExpense ? 'Salvar Alterações' : 'Salvar Parcela Fixa'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
