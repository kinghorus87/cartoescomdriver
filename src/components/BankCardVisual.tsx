import React from 'react';
import { getCardColor, getContrastTextColor, extractCardFinalDigits } from '../utils/cardColors';
import { Wifi } from 'lucide-react';

export interface BankCardVisualProps {
  name: string;
  color?: string;
  textColor?: string;
  finalDigits?: string;
  customImage?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  showOverlayHover?: boolean;
  overlayText?: string;
}

export const BankCardVisual: React.FC<BankCardVisualProps> = ({
  name,
  color,
  textColor,
  finalDigits,
  customImage,
  className = '',
  onClick,
  showOverlayHover = false,
  overlayText = 'Alterar Foto',
}) => {
  const cardBgColor = color || getCardColor({ name });
  const contrastText = textColor || getContrastTextColor(cardBgColor);
  const cleanDigits = extractCardFinalDigits(finalDigits);

  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl overflow-hidden shadow-xl border border-white/15 select-none transition-all group ${
        onClick ? 'cursor-pointer active:scale-95' : ''
      } ${className}`}
      style={{
        backgroundColor: cardBgColor,
        color: contrastText,
      }}
    >
      {/* Imagem personalizada ou Desenho estilizado */}
      {customImage ? (
        <img
          src={customImage}
          alt={name}
          className="w-full h-full object-cover object-center rounded-2xl"
        />
      ) : (
        <div className="w-full h-full p-3.5 sm:p-4.5 flex flex-col justify-between relative overflow-hidden bg-gradient-to-tr from-black/30 via-transparent to-white/20">
          {/* Marca d'água estilizada geométrica de cartão bancário */}
          <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full border-[18px] border-white/5 pointer-events-none" />
          <div className="absolute right-6 -bottom-12 w-28 h-28 rounded-full border-[12px] border-white/5 pointer-events-none" />

          {/* Topo do Cartão: Chip + Contactless e Nome do Banco */}
          <div className="flex items-start justify-between gap-2 z-10">
            <div className="flex items-center gap-2">
              {/* Chip metálico dourado com ranhuras realistas */}
              <div className="w-7 h-5 sm:w-8.5 sm:h-6 rounded-[4px] bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border border-amber-300/80 shadow-inner relative flex items-center justify-center overflow-hidden shrink-0">
                <div className="absolute inset-x-0 top-1/2 h-[1px] bg-amber-800/40" />
                <div className="absolute inset-y-0 left-1/2 w-[1px] bg-amber-800/40" />
                <div className="w-2.5 h-2 rounded-[2px] border border-amber-700/40 bg-amber-300/30" />
              </div>

              {/* Símbolo de aproximação / Contactless */}
              <Wifi 
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 rotate-90 opacity-70 shrink-0" 
                style={{ color: contrastText }} 
              />
            </div>

            {/* Nome do Cartão no topo direito */}
            <div className="text-right min-w-0 flex-1 max-w-[75%] pl-1">
              <span
                className="font-extrabold tracking-normal uppercase text-[11px] sm:text-xs leading-tight line-clamp-2 block drop-shadow-sm"
                style={{ color: contrastText }}
                title={name}
              >
                {name || 'CARTÃO'}
              </span>
            </div>
          </div>

          {/* Base do Cartão: Número com final opcional e indicador de bandeira */}
          <div className="flex items-end justify-between gap-2 pt-2 z-10">
            <div>
              {/* Se o final tiver sido informado, exibe •••• 1234. Se vazio, nada é exibido além do nome */}
              {cleanDigits ? (
                <div className="flex items-center gap-1.5 font-mono tracking-widest text-xs sm:text-sm font-bold opacity-95 drop-shadow-sm">
                  <span className="text-[10px] sm:text-xs tracking-tighter opacity-80">••••</span>
                  <span>{cleanDigits}</span>
                </div>
              ) : null}

              <span
                className="text-[9px] uppercase tracking-widest font-semibold block opacity-75 mt-0.5"
                style={{ color: contrastText }}
              >
                Crédito
              </span>
            </div>

            {/* Emblema estético de bandeira bancária (dois círculos entrelaçados) */}
            <div className="flex items-center -space-x-2 shrink-0 opacity-85">
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-red-500/80 shadow-sm" />
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-amber-400/80 shadow-sm" />
            </div>
          </div>
        </div>
      )}

      {/* Hover para trocar foto quando habilitado */}
      {showOverlayHover && (
        <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[11px] font-bold z-20 backdrop-blur-[1px]">
          <span>{overlayText}</span>
        </div>
      )}
    </div>
  );
};
