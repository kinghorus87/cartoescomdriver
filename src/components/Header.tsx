import React from 'react';
import { ViewTab, TabPreferences, CustomTabNames } from '../types';
import { 
  CreditCard, 
  BarChart3, 
  Search, 
  Users, 
  Calculator, 
  Table,
  Settings,
  LogOut,
  Wrench,
} from 'lucide-react';
import { isDarkAccent } from '../utils/cardColors';

interface HeaderProps {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  accentColor?: string;
  accentTextColor?: string;
  panelColor?: string;
  textColor?: string;
  mutedTextColor?: string;
  tabPreferences?: TabPreferences;
  customHeaderTitle?: string;
  customTabNames?: CustomTabNames;
  onRequestExit?: () => void;
  reallocationCount?: number;
  onOpenCorrecaoParcelas?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  accentColor = '#38bdf8',
  accentTextColor = '#000000',
  panelColor,
  textColor,
  mutedTextColor,
  tabPreferences,
  customHeaderTitle,
  customTabNames,
  onRequestExit,
  reallocationCount = 0,
  onOpenCorrecaoParcelas,
}) => {
  const isAccentDark = isDarkAccent(accentColor);
  const activeTabTextColor = isAccentDark ? '#ffffff' : accentColor;

  const getActiveTabStyle = (tab: ViewTab) => {
    if (activeTab !== tab) {
      return {
        color: textColor || 'var(--theme-text, #f8fafc)',
        borderColor: 'transparent',
      };
    }
    return {
      backgroundColor: `${accentColor}25`,
      color: '#ffffff',
      borderColor: `${accentColor}80`,
      boxShadow: `0 0 12px ${accentColor}20`,
    };
  };

  return (
    <header 
      className="border-b sticky top-0 z-30 shadow-md transition-all"
      style={{ 
        backgroundColor: panelColor || 'var(--theme-panel, #0f172a)',
        borderBottomColor: 'var(--theme-border, rgba(148, 163, 184, 0.16))',
        borderTop: `3px solid ${accentColor}`,
        color: textColor || 'var(--theme-text, #f8fafc)'
      }}
    >
      <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between sm:justify-center relative h-16 py-2">
          {/* Logo e Título Centralizados */}
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-transform hover:scale-105 shrink-0"
              style={{ 
                backgroundColor: accentColor, 
                color: accentTextColor,
                boxShadow: `0 4px 14px ${accentColor}40`
              }}
            >
              <CreditCard className="w-6 h-6 stroke-[2.2]" style={{ color: accentTextColor }} />
            </div>
            <div>
              <h1 
                className="text-lg sm:text-xl font-bold tracking-tight leading-tight"
                style={{ color: textColor || 'var(--theme-text, #f8fafc)' }}
              >
                {customHeaderTitle || 'Cartões'}
              </h1>
              <p 
                className="text-xs"
                style={{ color: mutedTextColor || 'var(--theme-text-muted, #94a3b8)' }}
              >
                Controle financeiro, limites e parcelas no computador
              </p>
            </div>
          </div>

          {/* Botão de Atalho para Configurações no canto direito */}
          <div className="absolute right-0 flex items-center gap-1.5">
            {reallocationCount > 0 && onOpenCorrecaoParcelas && (
              <button
                type="button"
                onClick={onOpenCorrecaoParcelas}
                title={`Existem ${reallocationCount} parcelas para realocar de 2026 para 2027+`}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Realocar</span>
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold">
                  {reallocationCount}
                </span>
              </button>
            )}

            <button
              onClick={() => onTabChange('configuracoes')}
              title="Abrir Configurações e Gestão Local"
              style={
                activeTab === 'configuracoes'
                  ? {
                      backgroundColor: `${accentColor}25`,
                      color: '#ffffff',
                      borderColor: `${accentColor}80`,
                    }
                  : {
                      color: textColor || 'var(--theme-text, #f8fafc)',
                      borderColor: 'transparent',
                    }
              }
              className="p-2 rounded-xl transition-colors cursor-pointer border"
            >
              <Settings className="w-5 h-5" />
            </button>
            {onRequestExit && (
              <button
                type="button"
                onClick={onRequestExit}
                aria-label="Sair do Cartões"
                title="Sair do aplicativo"
                style={{ color: textColor || 'var(--theme-text, #f8fafc)' }}
                className="px-2 py-2 rounded-xl transition-colors cursor-pointer border border-transparent hover:bg-slate-800/70 hover:border-slate-700 flex items-center gap-1.5"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline text-xs font-semibold">Sair</span>
              </button>
            )}
          </div>
        </div>

        {/* Barra de Navegação de Abas Centralizada e Adaptável */}
        <nav 
          className="flex flex-wrap items-center justify-center gap-1 sm:gap-2 py-2 border-t"
          style={{ borderTopColor: 'var(--theme-border, rgba(148, 163, 184, 0.16))' }}
        >
          <button
            onClick={() => onTabChange('limites')}
            style={getActiveTabStyle('limites')}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer border hover:opacity-90 active:scale-95"
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span>{customTabNames?.limites || 'Painel de Limites'}</span>
          </button>

          <button
            onClick={() => onTabChange('matriz')}
            style={getActiveTabStyle('matriz')}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer border hover:opacity-90 active:scale-95"
          >
            <Table className="w-4 h-4 shrink-0" />
            <span>{customTabNames?.matriz || 'Matriz de Gastos'}</span>
          </button>

          <button
            onClick={() => onTabChange('cartoes')}
            style={getActiveTabStyle('cartoes')}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer border hover:opacity-90 active:scale-95"
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>{customTabNames?.cartoes || 'Cartões & Meses'}</span>
          </button>

          {tabPreferences?.dividas !== false && (
            <button
              onClick={() => onTabChange('dividas')}
              style={getActiveTabStyle('dividas')}
              className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer border hover:opacity-90 active:scale-95"
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>{customTabNames?.dividas || 'Dívidas Totais'}</span>
            </button>
          )}

          {tabPreferences?.pesquisar !== false && (
            <button
              onClick={() => onTabChange('pesquisar')}
              style={getActiveTabStyle('pesquisar')}
              className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer border hover:opacity-90 active:scale-95"
            >
              <Search className="w-4 h-4 shrink-0" />
              <span>{customTabNames?.pesquisar || 'Pesquisar Itens'}</span>
            </button>
          )}

          {tabPreferences?.simulador !== false && (
            <button
              onClick={() => onTabChange('simulador')}
              style={getActiveTabStyle('simulador')}
              className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer border hover:opacity-90 active:scale-95"
            >
              <Calculator className="w-4 h-4 shrink-0" />
              <span>{customTabNames?.simulador || 'Simulador de Gastos'}</span>
            </button>
          )}

          <button
            onClick={() => onTabChange('configuracoes')}
            style={getActiveTabStyle('configuracoes')}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer border hover:opacity-90 active:scale-95"
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>Configurações &amp; Dados</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
