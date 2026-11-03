import React, { useState, useEffect, useRef } from 'react';
import { CardData } from '../types';
import { formatCurrency } from '../utils/storage';
import { BankCardVisual } from './BankCardVisual';
import { CARD_COLOR_PRESETS, getCardColor, extractCardFinalDigits } from '../utils/cardColors';
import { 
  X, 
  CreditCard, 
  DollarSign, 
  Calendar, 
  Hash, 
  Check, 
  AlertCircle, 
  Palette, 
  Image as ImageIcon, 
  RotateCcw,
  Upload
} from 'lucide-react';

interface ModalEditarCartaoProps {
  isOpen: boolean;
  onClose: () => void;
  card: CardData;
  onSave: (updatedCard: {
    id: string;
    name: string;
    limite: number;
    dueDay: string;
    finalCard?: string;
    isFisico?: string;
    isVirtual?: string;
    color?: string;
    customImage?: string;
    exibirIdentificacao?: boolean;
  }) => { success: boolean; message?: string };
}

export const ModalEditarCartao: React.FC<ModalEditarCartaoProps> = ({
  isOpen,
  onClose,
  card,
  onSave,
}) => {
  const [name, setName] = useState<string>('');
  const [limite, setLimite] = useState<string>('');
  const [dueDay, setDueDay] = useState<string>('');
  const [showDayPicker, setShowDayPicker] = useState<boolean>(false);
  const [exibirIdentificacao, setExibirIdentificacao] = useState<boolean>(true);
  const [finalFisico, setFinalFisico] = useState<string>('');
  const [finalVirtual, setFinalVirtual] = useState<string>('');
  const [color, setColor] = useState<string>('#38bdf8');
  const [customImage, setCustomImage] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Ao abrir o modal ou trocar de cartão, carrega os dados atuais do cartão selecionado
  useEffect(() => {
    if (isOpen && card) {
      setName(card.name || '');
      setLimite(card.limite !== undefined ? String(card.limite) : '');
      const dayNum = (card.dueDay || '').replace(/\D/g, '');
      setDueDay(dayNum || card.dueDay || '');
      setShowDayPicker(false);
      setExibirIdentificacao(card.exibirIdentificacao !== false);
      setFinalFisico(extractCardFinalDigits(card.isFisico || ''));
      setFinalVirtual(extractCardFinalDigits(card.isVirtual || ''));
      setColor(getCardColor(card));
      setCustomImage(card.customImage || '');
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, card]);

  if (!isOpen) return null;

  // Upload e compressão de foto personalizada
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 640;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.88);
          setCustomImage(compressed);
          setErrorMsg('');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Validação 1: Nome obrigatório
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('O nome do cartão é obrigatório.');
      return;
    }

    // Validação 2: Limite total obrigatório e numérico >= 0
    const cleanLimiteStr = limite.replace(/\./g, '').replace(',', '.').trim();
    if (!cleanLimiteStr) {
      setErrorMsg('O limite total é obrigatório.');
      return;
    }
    const parsedLimite = parseFloat(cleanLimiteStr);
    if (isNaN(parsedLimite) || parsedLimite < 0) {
      setErrorMsg('Informe um valor de limite válido (igual ou maior que zero).');
      return;
    }

    // Validação 3: Dia de vencimento da fatura obrigatório (1 a 31)
    const cleanDayStr = dueDay.replace(/\D/g, '').trim();
    if (!cleanDayStr) {
      setErrorMsg('O dia de vencimento da fatura é obrigatório (entre 1 e 31).');
      return;
    }
    const dayInt = parseInt(cleanDayStr, 10);
    if (isNaN(dayInt) || dayInt < 1 || dayInt > 31) {
      setErrorMsg('O dia de vencimento deve ser um número válido entre 1 e 31.');
      return;
    }

    const formattedDueDay = `dia ${String(dayInt).padStart(2, '0')}`;
    const cleanFisico = finalFisico.replace(/\D/g, '').slice(-4);
    const cleanVirtual = finalVirtual.replace(/\D/g, '').slice(-4);

    const result = onSave({
      id: card.id,
      name: trimmedName,
      limite: parsedLimite,
      dueDay: formattedDueDay,
      finalCard: cleanFisico ? `FINAL ${cleanFisico}` : '',
      isFisico: cleanFisico ? `FISICO ${cleanFisico}` : '',
      isVirtual: cleanVirtual ? `VIRTUAL ${cleanVirtual}` : '',
      color: color || '#38bdf8',
      customImage: customImage.trim() || undefined,
      exibirIdentificacao,
    });

    if (result.success) {
      setSuccessMsg(result.message || 'Cartão atualizado com sucesso!');
      setTimeout(() => {
        onClose();
      }, 700);
    } else {
      setErrorMsg(result.message || 'Erro ao salvar alterações no cartão.');
    }
  };

  const parsedLimitePreview = parseFloat(limite.replace(/\./g, '').replace(',', '.')) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Editar Cartão</h2>
              <p className="text-xs text-slate-400">Personalize a aparência, limites e vencimento do cartão</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Fechar formulário"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* VISUALIZAÇÃO EM TEMPO REAL DO CARTÃO */}
          <div className="p-4 bg-slate-950/70 border border-slate-800/90 rounded-2xl flex flex-col items-center">
            <span className="text-[11px] font-semibold text-slate-400 mb-2.5">
              Representação visual do cartão (tempo real):
            </span>
            <div className="w-60 h-36 sm:w-68 sm:h-40">
              <BankCardVisual
                name={name || 'NOME DO CARTÃO'}
                color={color}
                finalDigits={exibirIdentificacao ? (finalFisico || finalVirtual) : ''}
                customImage={customImage}
                className="w-full h-full"
              />
            </div>

            {/* Alternância entre Foto Personalizada e Desenho Padrão */}
            <div className="mt-3 flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              {customImage ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-teal-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-teal-500/30"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Trocar foto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomImage('')}
                    className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-amber-500/30"
                    title="Remover imagem e voltar ao modelo padrão com nome e cor"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Voltar ao modelo padrão</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-1 px-3 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-teal-400" />
                  <span>Enviar foto personalizada (opcional)</span>
                </button>
              )}
            </div>
          </div>

          {/* Nome do Cartão */}
          <div>
            <label className="font-semibold text-slate-300 block mb-1">
              Nome do Cartão <span className="text-emerald-400">*</span>:
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Nubank, Inter, Itaú..."
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Cor de Fundo do Cartão */}
          <div>
            <label className="font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-sky-400" />
              <span>Cor de fundo do cartão:</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {CARD_COLOR_PRESETS.map((p) => (
                <button
                  key={p.color}
                  type="button"
                  onClick={() => setColor(p.color)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer shadow-sm ${
                    color.toLowerCase() === p.color.toLowerCase()
                      ? 'scale-115 border-white ring-2 ring-emerald-500/60'
                      : 'border-white/20 hover:scale-110'
                  }`}
                  style={{ backgroundColor: p.color }}
                  title={p.name}
                />
              ))}
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700">
                <input
                  type="color"
                  value={color.startsWith('#') ? color : '#38bdf8'}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                  title="Cor livre"
                />
                <span className="text-[10px] text-slate-400 font-mono">{color}</span>
              </div>
            </div>
          </div>

          {/* Limite e Vencimento (Ficam Acima da Identificação) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-300 block mb-1">
                Limite Total (R$) <span className="text-emerald-400">*</span>:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <DollarSign className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={limite}
                  onChange={(e) => setLimite(e.target.value)}
                  placeholder="Ex: 5000 ou 5000.00"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-9 pr-3 py-2 text-xs font-mono font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>
              {parsedLimitePreview > 0 && (
                <p className="text-[11px] text-emerald-400 mt-1">
                  Visualização: {formatCurrency(parsedLimitePreview)}
                </p>
              )}
            </div>

            <div className="relative">
              <label className="font-semibold text-slate-300 block mb-1">
                Dia de Vencimento da Fatura <span className="text-emerald-400">*</span>:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={dueDay}
                  onClick={() => setShowDayPicker(true)}
                  onChange={(e) => setDueDay(e.target.value)}
                  placeholder="1 a 31"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-9 pr-3 py-2 text-xs font-mono font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
                />
              </div>

              {/* Seletor Compacto de 1 a 31 (Item 4.2) */}
              {showDayPicker && (
                <div className="absolute left-0 right-0 top-full mt-1.5 p-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 animate-in fade-in">
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800 text-[11px] text-slate-400">
                    <span className="font-semibold">Selecione o dia (1 a 31):</span>
                    <button
                      type="button"
                      onClick={() => setShowDayPicker(false)}
                      className="text-slate-400 hover:text-white px-1"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setDueDay(String(d));
                          setShowDayPicker(false);
                        }}
                        className={`py-1 text-center rounded text-xs font-mono font-bold transition-colors cursor-pointer ${
                          parseInt(dueDay, 10) === d
                            ? 'bg-emerald-500 text-slate-950 font-black'
                            : 'bg-slate-800 hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4.1: IDENTIFICAÇÃO COM CAIXA DE SELEÇÃO (ABAIXO DO LIMITE) */}
          <div className="pt-3 border-t border-slate-800 space-y-2.5">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-200">
              <input
                type="checkbox"
                checked={exibirIdentificacao}
                onChange={(e) => setExibirIdentificacao(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 bg-slate-800 border-slate-700 focus:ring-0 cursor-pointer"
              />
              <span className="text-white">Exibir identificação do cartão</span>
            </label>

            {exibirIdentificacao && (
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2 animate-in fade-in">
                <p className="text-[11px] text-slate-400">
                  Informe os 4 dígitos finais do cartão físico e/ou virtual para fácil reconhecimento:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-1">
                      Final físico (opcional):
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={finalFisico}
                      onChange={(e) => setFinalFisico(e.target.value.replace(/\D/g, ''))}
                      placeholder="Ex: 1234"
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-1">
                      Final virtual (opcional):
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={finalVirtual}
                      onChange={(e) => setFinalVirtual(e.target.value.replace(/\D/g, ''))}
                      placeholder="Ex: 5678"
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Rodapé com Ações */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Salvar alterações</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
