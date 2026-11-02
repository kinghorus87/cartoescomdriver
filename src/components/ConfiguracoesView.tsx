import React, { useState, useEffect } from 'react';
import { 
  HardDrive,
  Download,
  Upload,
  RotateCcw,
  SlidersHorizontal,
  Users,
  Search,
  Calculator,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  Star,
  Pin,
  UserPlus,
  Trash2,
  Type,
  Check,
  CreditCard,
  Table,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Palette,
  Layers,
  Sparkles
} from 'lucide-react';
import { SeedData, TabPreferences, CustomTabNames, ThemeConfig } from '../types';
import { resetToOriginalData } from '../utils/browserStorage';
import { exportBackup } from '../utils/storage';
import { GoogleDriveBackup } from './GoogleDriveBackup';
import { ModalConfirmacao } from './ModalConfirmacao';
import { 
  COMPLETE_THEME_PRESETS,
  THEME_BG_PRESETS, 
  THEME_ACCENT_PRESETS, 
  THEME_PANEL_PRESETS, 
  THEME_TEXT_PRESETS,
  CompleteThemePreset,
  getResolvedBgColor,
  getResolvedPanelColor, 
  getResolvedAccentColor, 
  getResolvedTextColor,
  getResolvedMutedTextColor,
  getResolvedBorderColor,
  isLightColor,
  getContrastTextColor,
} from '../utils/cardColors';

export type SectionKey = 
  | 'arquivo_local' 
  | 'tema_cores'
  | 'visibilidade_abas' 
  | 'titulo_cabecalho' 
  | 'nomes_abas' 
  | 'pagadores_favoritos';

export const PINNED_STORAGE_KEY = 'economias_config_pinned_sections';

interface ConfiguracoesViewProps {
  appData: SeedData;
  onUpdateAppData: (data: SeedData) => void;
  accentColor?: string;
  accentTextColor?: string;
  panelColor?: string;
  textColor?: string;
}

export const ConfiguracoesView: React.FC<ConfiguracoesViewProps> = ({
  appData,
  onUpdateAppData,
  accentColor = '#38bdf8',
  accentTextColor = '#000000',
  panelColor,
  textColor,
}) => {
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Pagadores
  const [newPayerInput, setNewPayerInput] = useState('');
  const [newPayerMakeFavorite, setNewPayerMakeFavorite] = useState(false);

  // Personalização do Cabeçalho e Nomes das Abas (Itens 14 & 15)
  const [headerTitleInput, setHeaderTitleInput] = useState(appData.customHeaderTitle || 'Cartões');
  const [tabNamesInput, setTabNamesInput] = useState<CustomTabNames>({
    limites: appData.customTabNames?.limites || 'Painel de Limites',
    matriz: appData.customTabNames?.matriz || 'Matriz de Gastos',
    cartoes: appData.customTabNames?.cartoes || 'Cartões & Meses',
    dividas: appData.customTabNames?.dividas || 'Dívidas Totais',
    pesquisar: appData.customTabNames?.pesquisar || 'Pesquisar Itens',
    simulador: appData.customTabNames?.simulador || 'Simulador de Gastos',
  });

  // Estado para recolher/expandir a faixa de temas pré-coordenados
  const [isThemesExpanded, setIsThemesExpanded] = useState<boolean>(false);

  // =========================================================================
  // SISTEMA DE SEÇÕES RETRÁTEIS COM PINO PERSISTENTE (Requisito 2)
  // - Pino desmarcado: ao sair e voltar, a seção retorna RECOLHIDA.
  // - Pino marcado: permanece ABERTA ao sair e voltar, e após reabrir o app.
  // =========================================================================
  const [pinnedSections, setPinnedSections] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(PINNED_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    return {};
  });

  // Estado transitório de abertura durante a sessão atual:
  // Inicializa EXATAMENTE com as seções que estão fixadas (se não estiver fixada, inicia recolhida).
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(PINNED_STORAGE_KEY);
      if (raw) {
        const pinned = JSON.parse(raw);
        // Se houver seções fixadas, abre apenas elas. Se nenhuma estiver fixada, abre apenas 'arquivo_local' ou todas fechadas conforme o requisito.
        const initial: Record<string, boolean> = {};
        (['arquivo_local', 'tema_cores', 'visibilidade_abas', 'titulo_cabecalho', 'nomes_abas', 'pagadores_favoritos'] as SectionKey[]).forEach((key) => {
          initial[key] = Boolean(pinned[key]);
        });
        return initial;
      }
    } catch {
      // ignore
    }
    // Padrão limpo: sem pinos, tudo recolhido
    return {};
  });

  const isSectionPinned = (key: SectionKey): boolean => Boolean(pinnedSections[key]);
  const isSectionOpen = (key: SectionKey): boolean => Boolean(openSections[key]);

  const toggleSectionOpen = (key: SectionKey) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const togglePinSection = (key: SectionKey) => {
    const nextPinnedState = !pinnedSections[key];
    const updated = {
      ...pinnedSections,
      [key]: nextPinnedState,
    };
    setPinnedSections(updated);
    try {
      localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }

    // Se marcou o pino, garante que a seção fique aberta imediatamente
    if (nextPinnedState) {
      setOpenSections((prev) => ({ ...prev, [key]: true }));
      showFeedback('Seção fixada como sempre aberta (permanecerá aberta ao sair e retornar)!', 'info');
    } else {
      showFeedback('Seção desafixada. Ao sair das configurações, ela voltará recolhida.', 'info');
    }
  };

  const expandAllSections = () => {
    const allOpen: Record<string, boolean> = {
      arquivo_local: true,
      tema_cores: true,
      visibilidade_abas: true,
      titulo_cabecalho: true,
      nomes_abas: true,
      pagadores_favoritos: true,
    };
    setOpenSections(allOpen);
    showFeedback('Todas as seções foram expandidas.', 'info');
  };

  const collapseUnpinnedSections = () => {
    const onlyPinned: Record<string, boolean> = {
      arquivo_local: Boolean(pinnedSections.arquivo_local),
      tema_cores: Boolean(pinnedSections.tema_cores),
      visibilidade_abas: Boolean(pinnedSections.visibilidade_abas),
      titulo_cabecalho: Boolean(pinnedSections.titulo_cabecalho),
      nomes_abas: Boolean(pinnedSections.nomes_abas),
      pagadores_favoritos: Boolean(pinnedSections.pagadores_favoritos),
    };
    setOpenSections(onlyPinned);
    showFeedback('Seções não fixadas foram recolhidas.', 'info');
  };

  const pinnedCount = Object.values(pinnedSections).filter(Boolean).length;

  useEffect(() => {
    if (appData.customHeaderTitle) setHeaderTitleInput(appData.customHeaderTitle);
    if (appData.customTabNames) {
      setTabNamesInput({
        limites: appData.customTabNames.limites || 'Painel de Limites',
        matriz: appData.customTabNames.matriz || 'Matriz de Gastos',
        cartoes: appData.customTabNames.cartoes || 'Cartões & Meses',
        dividas: appData.customTabNames.dividas || 'Dívidas Totais',
        pesquisar: appData.customTabNames.pesquisar || 'Pesquisar Itens',
        simulador: appData.customTabNames.simulador || 'Simulador de Gastos',
      });
    }
  }, [appData.customHeaderTitle, appData.customTabNames]);

  const handleSaveHeaderTitle = () => {
    const clean = headerTitleInput.trim() || 'Cartões';
    setHeaderTitleInput(clean);
    onUpdateAppData({
      ...appData,
      customHeaderTitle: clean,
    });
    showFeedback('Título do cabeçalho salvo com sucesso!', 'success');
  };

  const handleResetHeaderTitle = () => {
    setHeaderTitleInput('Cartões');
    onUpdateAppData({
      ...appData,
      customHeaderTitle: 'Cartões',
    });
    showFeedback('Título do cabeçalho restaurado para "Cartões".', 'info');
  };

  const handleSaveTabName = (tabKey: keyof CustomTabNames, defaultName: string) => {
    const val = (tabNamesInput[tabKey] || '').trim() || defaultName;
    const updated = {
      ...tabNamesInput,
      [tabKey]: val,
    };
    setTabNamesInput(updated);
    onUpdateAppData({
      ...appData,
      customTabNames: {
        ...(appData.customTabNames || {}),
        [tabKey]: val,
      },
    });
    showFeedback(`Nome da aba atualizado para "${val}".`, 'success');
  };

  const handleResetTabName = (tabKey: keyof CustomTabNames, defaultName: string) => {
    const updated = {
      ...tabNamesInput,
      [tabKey]: defaultName,
    };
    setTabNamesInput(updated);
    onUpdateAppData({
      ...appData,
      customTabNames: {
        ...(appData.customTabNames || {}),
        [tabKey]: defaultName,
      },
    });
    showFeedback(`Nome da aba restaurado para "${defaultName}".`, 'info');
  };

  const showFeedback = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4500);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && Array.isArray(parsed.cards)) {
          onUpdateAppData(parsed);
          showFeedback('Dados importados com sucesso a partir do arquivo JSON!', 'success');
        } else {
          showFeedback('Arquivo JSON com formato inválido para o aplicativo Cartões.', 'error');
        }
      } catch {
        showFeedback('Não foi possível ler o arquivo JSON selecionado.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmResetSeed = async () => {
    setIsResetConfirmOpen(false);
    try {
      const res = await resetToOriginalData();
      if (res && Array.isArray(res.cards)) {
        onUpdateAppData(res);
        showFeedback('Todas as tabelas foram zeradas com sucesso!', 'info');
      } else {
        showFeedback('Erro ao zerar dados locais.', 'error');
      }
    } catch {
      showFeedback('Erro ao zerar dados locais.', 'error');
    }
  };

  // Gerenciamento de preferências de abas
  const tabPrefs = appData.tabPreferences || {
    pesquisar: true,
    dividas: true,
    simulador: true,
  };

  const handleToggleTab = (tab: keyof TabPreferences) => {
    const updated: TabPreferences = {
      ...tabPrefs,
      [tab]: !tabPrefs[tab],
    };
    onUpdateAppData({
      ...appData,
      tabPreferences: updated,
    });
    showFeedback(
      `Aba "${tab === 'pesquisar' ? 'Pesquisa de itens' : tab === 'dividas' ? 'Dívidas totais' : 'Simulador de gastos'}" ${
        updated[tab] ? 'ativada' : 'desativada'
      }.`,
      'info'
    );
  };

  // Pagadores
  const visiblePersons = appData.persons.filter(
    (p) => !(appData.hiddenPersons || []).some((h) => h.toLowerCase().trim() === p.toLowerCase().trim())
  );
  const effectiveFavs = appData.favoritePersons || [];

  const handleAddNewPayer = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newPayerInput.trim();
    if (!clean) return;

    const alreadyExists = appData.persons.some(
      (p) => p.toLowerCase().trim() === clean.toLowerCase()
    );

    let nextPersons = [...appData.persons];
    let nextHidden = [...(appData.hiddenPersons || [])];

    if (alreadyExists) {
      nextHidden = nextHidden.filter((h) => h.toLowerCase().trim() !== clean.toLowerCase());
    } else {
      nextPersons.push(clean);
    }

    let nextFavs = [...effectiveFavs];
    if (newPayerMakeFavorite && !nextFavs.some((f) => f.toLowerCase().trim() === clean.toLowerCase())) {
      nextFavs.push(clean);
    }

    onUpdateAppData({
      ...appData,
      persons: nextPersons,
      hiddenPersons: nextHidden,
      favoritePersons: nextFavs,
    });

    setNewPayerInput('');
    setNewPayerMakeFavorite(false);
    showFeedback(`Pagador "${clean}" adicionado com sucesso!`, 'success');
  };

  const handleToggleFavorite = (personName: string) => {
    const clean = personName.trim();
    const isFav = effectiveFavs.some((f) => f.toLowerCase().trim() === clean.toLowerCase());
    const nextFavs = isFav
      ? effectiveFavs.filter((f) => f.toLowerCase().trim() !== clean.toLowerCase())
      : [...effectiveFavs, clean];

    onUpdateAppData({
      ...appData,
      favoritePersons: nextFavs,
    });
    showFeedback(
      isFav ? `"${clean}" removido dos favoritos.` : `"${clean}" fixado como favorito no topo!`,
      'info'
    );
  };

  const handleRemovePayer = (personName: string) => {
    const clean = personName.trim();
    const nextHidden = [...(appData.hiddenPersons || []), clean];
    const nextFavs = effectiveFavs.filter((f) => f.toLowerCase().trim() !== clean.toLowerCase());

    onUpdateAppData({
      ...appData,
      hiddenPersons: nextHidden,
      favoritePersons: nextFavs,
    });
    showFeedback(`Pagador "${clean}" removido das listas ativas.`, 'info');
  };

  // Gerenciamento de Tema e Cores (4 Cores Independentes)
  const currentTheme = appData.themeConfig || {};
  const currentBgColor = getResolvedBgColor(currentTheme);
  const currentPanelColor = panelColor || getResolvedPanelColor(currentTheme);
  const currentAccentColor = accentColor || getResolvedAccentColor(currentTheme);
  const currentTextColor = textColor || getResolvedTextColor(currentTheme);
  const currentMutedTextColor = getResolvedMutedTextColor(currentTextColor, currentPanelColor);
  const currentBorderColor = getResolvedBorderColor(currentPanelColor);
  const isLight = isLightColor(currentBgColor) || isLightColor(currentPanelColor);

  const handleApplyCompletePreset = (preset: CompleteThemePreset) => {
    onUpdateAppData({
      ...appData,
      themeConfig: {
        ...currentTheme,
        themePreset: preset.id,
        bgPreset: preset.id,
        panelPreset: preset.id,
        accentPreset: preset.id,
        textPreset: preset.id,
        customBg: preset.bg,
        customPanelColor: preset.panel,
        customAccent: preset.accent,
        customTextColor: preset.text,
      },
    });
    showFeedback(`Tema completo "${preset.name}" aplicado!`, 'success');
  };

  const handleUpdateBgPreset = (presetId: string) => {
    const preset = THEME_BG_PRESETS.find((p) => p.id === presetId);
    onUpdateAppData({
      ...appData,
      themeConfig: {
        ...currentTheme,
        bgPreset: presetId,
        customBg: preset ? preset.color : undefined,
      },
    });
    showFeedback('Cor de fundo geral atualizada!', 'success');
  };

  const handleUpdateCustomBg = (colorHex: string) => {
    onUpdateAppData({
      ...appData,
      themeConfig: {
        ...currentTheme,
        customBg: colorHex,
      },
    });
  };

  const handleUpdateAccentColor = (colorHex: string) => {
    onUpdateAppData({
      ...appData,
      themeConfig: {
        ...currentTheme,
        customAccent: colorHex,
      },
    });
    showFeedback('Cor de destaque atualizada!', 'success');
  };

  const handleUpdatePanelColor = (colorHex: string) => {
    onUpdateAppData({
      ...appData,
      themeConfig: {
        ...currentTheme,
        customPanelColor: colorHex,
      },
    });
    showFeedback('Cor dos painéis e caixas atualizada!', 'success');
  };

  const handleUpdateTextColor = (colorHex: string) => {
    onUpdateAppData({
      ...appData,
      themeConfig: {
        ...currentTheme,
        customTextColor: colorHex,
      },
    });
    showFeedback('Cor das letras e legendas atualizada!', 'success');
  };

  const handleResetTheme = () => {
    onUpdateAppData({
      ...appData,
      themeConfig: {
        bgPreset: 'deep-ocean',
        accentPreset: 'sky',
        panelPreset: 'slate',
        textPreset: 'white-ice',
        customBg: '#071326',
        customPanelColor: '#0f172a',
        customAccent: '#38bdf8',
        customTextColor: '#f8fafc',
      },
    });
    showFeedback('Tema e 4 cores restaurados para os padrões!', 'info');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between shadow-2xl border text-sm transition-all duration-300 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : feedback.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
              : 'bg-sky-950/90 border-sky-500/50 text-sky-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : feedback.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-sky-400 shrink-0" />
            )}
            <span className="font-medium">{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white text-xs cursor-pointer px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Título da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <HardDrive className="w-6 h-6 text-emerald-400" />
            <span>Configurações &amp; Gestão do Aplicativo</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Opções retráteis com pino para fixar seções abertas permanentemente
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Dados neste navegador + cópia opcional no Drive</span>
          </span>
        </div>
      </div>

      {/* Barra de Controles Rápidos das Seções Retráteis (Requisito 2) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-900/70 border border-slate-800/80 rounded-2xl text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <SlidersHorizontal className="w-4 h-4 text-sky-400" />
          <span className="font-semibold">Organização das Seções:</span>
          {pinnedCount > 0 ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
              <Pin className="w-3 h-3 fill-amber-300 rotate-45" />
              {pinnedCount} {pinnedCount === 1 ? 'seção fixada aberta' : 'seções fixadas abertas'}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 italic">
              Nenhuma seção fixada (voltam recolhidas ao sair e retornar)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAllSections}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition cursor-pointer border border-slate-700 flex items-center gap-1.5"
            title="Expandir todas as opções de configurações"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Expandir Todas</span>
          </button>
          <button
            type="button"
            onClick={collapseUnpinnedSections}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition cursor-pointer border border-slate-700 flex items-center gap-1.5"
            title="Recolher opções não fixadas"
          >
            <ChevronUp className="w-3.5 h-3.5" />
            <span>Recolher Não Fixadas</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 1: ARQUIVO LOCAL DE DADOS & BACKUPS                                  */}
      {/* ========================================================================= */}
      <div 
        className="border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl transition-all"
        style={{ backgroundColor: currentPanelColor }}
      >
        <div 
          onClick={() => toggleSectionOpen('arquivo_local')}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80 cursor-pointer select-none group"
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-inner shrink-0"
              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
            >
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base group-hover:text-sky-300 transition-colors">
                  Dados Locais e Cópias de Segurança
                </h3>
                {isSectionPinned('arquivo_local') && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                    <Pin className="w-2.5 h-2.5 fill-amber-300 rotate-45" /> Fixada aberta
                  </span>
                )}
                {!isSectionOpen('arquivo_local') && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    Recolhida
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Dados salvos neste navegador, exportação JSON e cópia no Drive</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
            {/* Botão de Fixar / Desafixar com Pino (Requisito 2.2) */}
            <button
              type="button"
              onClick={() => togglePinSection('arquivo_local')}
              className={`px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
                isSectionPinned('arquivo_local')
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title={isSectionPinned('arquivo_local') ? "Seção fixada como sempre aberta. Clique para desafixar." : "Fixar esta seção sempre aberta ao retornar"}
            >
              <Pin className={`w-3.5 h-3.5 transition-transform ${isSectionPinned('arquivo_local') ? 'rotate-45 fill-amber-400 text-amber-400' : ''}`} />
              <span className="hidden sm:inline">{isSectionPinned('arquivo_local') ? 'Fixada' : 'Fixar'}</span>
            </button>

            {/* Botão de Recolher / Expandir */}
            <button
              type="button"
              onClick={() => toggleSectionOpen('arquivo_local')}
              className="p-1.5 rounded-xl border border-slate-700/80 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer flex items-center justify-center"
              title={isSectionOpen('arquivo_local') ? "Recolher seção" : "Expandir seção"}
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isSectionOpen('arquivo_local') ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Conteúdo Expansível da Seção 1 */}
        {isSectionOpen('arquivo_local') && (
          <div className="mt-5 space-y-5 animate-in fade-in duration-200">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-300">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>
                <strong>Armazenamento local:</strong> os dados ficam neste navegador. Limpar os dados do site ou trocar de navegador pode removê-los; use o Drive ou exporte um JSON para guardar uma cópia.
              </span>
            </div>

            <GoogleDriveBackup appData={appData} onUpdateAppData={onUpdateAppData} />

            {/* Exportação e importação de cópias JSON */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => exportBackup(appData)}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 border border-slate-700 cursor-pointer shadow-sm active:scale-98"
              >
                <Download className="w-4 h-4 text-sky-400" />
                <span>Exportar JSON</span>
              </button>

              <label className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 border border-slate-700 cursor-pointer shadow-sm active:scale-98">
                <Upload className="w-4 h-4 text-teal-400" />
                <span>Importar JSON</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(true)}
                className="py-2.5 px-3 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 border border-rose-800/60 cursor-pointer shadow-sm active:scale-98"
              >
                <RotateCcw className="w-4 h-4 text-rose-400" />
                <span>Zerar Todas as Tabelas</span>
              </button>
            </div>

          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 2: PERSONALIZAR CORES E TEMAS (Item 3)                              */}
      {/* ========================================================================= */}
      <div 
        className="border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl transition-all"
        style={{ backgroundColor: currentPanelColor }}
      >
        <div 
          onClick={() => toggleSectionOpen('tema_cores')}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80 cursor-pointer select-none group"
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-inner shrink-0"
              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
            >
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base group-hover:text-sky-300 transition-colors">
                  Personalizar Cores e Temas
                </h3>
                {isSectionPinned('tema_cores') && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                    <Pin className="w-2.5 h-2.5 fill-amber-300 rotate-45" /> Fixada aberta
                  </span>
                )}
                {!isSectionOpen('tema_cores') && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    Recolhida
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                4 cores independentes: Fundo Geral, Destaque, Painéis/Caixas e Letras/Legendas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={handleResetTheme}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition cursor-pointer shadow-sm"
              title="Restaurar cores e temas padrão"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Padrão</span>
            </button>

            <button
              type="button"
              onClick={() => togglePinSection('tema_cores')}
              className={`px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
                isSectionPinned('tema_cores')
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title={isSectionPinned('tema_cores') ? "Seção fixada como sempre aberta. Clique para desafixar." : "Fixar esta seção sempre aberta"}
            >
              <Pin className={`w-3.5 h-3.5 transition-transform ${isSectionPinned('tema_cores') ? 'rotate-45 fill-amber-400 text-amber-400' : ''}`} />
              <span className="hidden sm:inline">{isSectionPinned('tema_cores') ? 'Fixada' : 'Fixar'}</span>
            </button>

            <button
              type="button"
              onClick={() => toggleSectionOpen('tema_cores')}
              className="p-1.5 rounded-xl border border-slate-700/80 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer flex items-center justify-center"
              title={isSectionOpen('tema_cores') ? "Recolher seção" : "Expandir seção"}
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isSectionOpen('tema_cores') ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {isSectionOpen('tema_cores') && (
          <div className="mt-5 space-y-6 animate-in fade-in duration-200">
            {/* 1. AMOSTRA COMPACTA DAS CORES */}
            <div 
              className="p-4 rounded-2xl border transition-all relative overflow-hidden"
              style={{
                backgroundColor: currentBgColor,
                borderColor: currentBorderColor,
              }}
            >
              <div className="flex items-center justify-between mb-2.5">
                <span 
                  className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                  style={{ color: currentAccentColor }}
                >
                  <Sparkles className="w-4 h-4" /> Amostra das Cores
                </span>
                <span 
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
                  style={{ 
                    backgroundColor: `${currentAccentColor}18`, 
                    color: currentAccentColor,
                    borderColor: `${currentAccentColor}40`
                  }}
                >
                  {isLight ? 'Modo Claro' : 'Modo Escuro'}
                </span>
              </div>

              {/* Caixa Interna de Demonstração (Painel Compacto) */}
              <div 
                className="p-3.5 rounded-xl border transition-all shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                style={{
                  backgroundColor: currentPanelColor,
                  borderColor: currentBorderColor,
                }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: currentAccentColor }} />
                    <h4 
                      className="font-bold text-sm tracking-tight truncate"
                      style={{ color: currentTextColor }}
                    >
                      Visualização em Tempo Real
                    </h4>
                  </div>
                  <p 
                    className="text-xs mt-0.5 truncate"
                    style={{ color: currentMutedTextColor }}
                  >
                    Combinação das 4 cores aplicadas em todos os componentes
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                  <div 
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono" 
                    style={{ backgroundColor: `${currentAccentColor}10`, borderColor: currentBorderColor }}
                  >
                    <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: currentBgColor }} title="Fundo geral" />
                    <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: currentPanelColor }} title="Painéis" />
                    <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: currentAccentColor }} title="Destaque" />
                    <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: currentTextColor }} title="Letras" />
                  </div>

                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-default"
                    style={{
                      backgroundColor: currentAccentColor,
                      color: getContrastTextColor(currentAccentColor),
                    }}
                  >
                    <Check className="w-3.5 h-3.5" /> Destaque
                  </button>
                </div>
              </div>
            </div>

            {/* 2. ESCOLHA INDIVIDUAL DE CORES (4 SELETORES DIRETOS) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Palette className="w-4 h-4 text-sky-400" />
                  Escolha Individual de Cores
                </span>
                <button
                  type="button"
                  onClick={handleResetTheme}
                  className="text-[11px] text-slate-400 hover:text-amber-400 transition cursor-pointer flex items-center gap-1"
                  title="Restaurar padrão inicial do aplicativo"
                >
                  <RotateCcw className="w-3 h-3" /> Restaurar padrões
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Fundo Geral */}
                <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full border border-white/30" style={{ backgroundColor: currentBgColor }} />
                        Fundo Geral
                      </span>
                      {currentTheme.customBg && (
                        <button
                          type="button"
                          onClick={() => handleUpdateCustomBg('')}
                          className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                        >
                          Padrão
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Fundo principal atrás de todas as abas
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="color"
                      value={currentBgColor.startsWith('#') ? currentBgColor : '#071326'}
                      onChange={(e) => handleUpdateCustomBg(e.target.value)}
                      className="w-8 h-8 rounded-xl bg-transparent border-0 cursor-pointer shadow-sm shrink-0"
                      title="Escolher cor de fundo geral"
                    />
                    <input
                      type="text"
                      value={currentTheme.customBg || currentBgColor}
                      onChange={(e) => handleUpdateCustomBg(e.target.value)}
                      placeholder="#071326"
                      className="flex-1 min-w-0 px-2 py-1.5 text-xs font-mono font-bold rounded-lg border bg-slate-950/70 border-slate-700 text-sky-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 2. Destaque */}
                <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full border border-white/30" style={{ backgroundColor: currentAccentColor }} />
                        Destaque
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Botões, abas ativas, focos e ícones
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="color"
                      value={currentAccentColor.startsWith('#') ? currentAccentColor : '#38bdf8'}
                      onChange={(e) => handleUpdateAccentColor(e.target.value)}
                      className="w-8 h-8 rounded-xl bg-transparent border-0 cursor-pointer shadow-sm shrink-0"
                      title="Escolher cor de destaque"
                    />
                    <input
                      type="text"
                      value={currentAccentColor}
                      onChange={(e) => handleUpdateAccentColor(e.target.value)}
                      placeholder="#38bdf8"
                      className="flex-1 min-w-0 px-2 py-1.5 text-xs font-mono font-bold rounded-lg border bg-slate-950/70 border-slate-700 text-fuchsia-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 3. Painéis */}
                <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full border border-white/30" style={{ backgroundColor: currentPanelColor }} />
                        Painéis
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Cards, caixas, tabelas e modais
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="color"
                      value={currentPanelColor.startsWith('#') ? currentPanelColor : '#0f172a'}
                      onChange={(e) => handleUpdatePanelColor(e.target.value)}
                      className="w-8 h-8 rounded-xl bg-transparent border-0 cursor-pointer shadow-sm shrink-0"
                      title="Escolher cor dos painéis"
                    />
                    <input
                      type="text"
                      value={currentPanelColor}
                      onChange={(e) => handleUpdatePanelColor(e.target.value)}
                      placeholder="#0f172a"
                      className="flex-1 min-w-0 px-2 py-1.5 text-xs font-mono font-bold rounded-lg border bg-slate-950/70 border-slate-700 text-emerald-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 4. Letras */}
                <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full border border-white/30" style={{ backgroundColor: currentTextColor }} />
                        Letras
                      </span>
                      {currentTheme.customTextColor && (
                        <button
                          type="button"
                          onClick={() => handleUpdateTextColor('')}
                          className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                        >
                          Padrão
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Títulos, textos e rótulos da interface
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="color"
                      value={currentTextColor.startsWith('#') ? currentTextColor : '#f8fafc'}
                      onChange={(e) => handleUpdateTextColor(e.target.value)}
                      className="w-8 h-8 rounded-xl bg-transparent border-0 cursor-pointer shadow-sm shrink-0"
                      title="Escolher cor das letras"
                    />
                    <input
                      type="text"
                      value={currentTextColor}
                      onChange={(e) => handleUpdateTextColor(e.target.value)}
                      placeholder="#f8fafc"
                      className="flex-1 min-w-0 px-2 py-1.5 text-xs font-mono font-bold rounded-lg border bg-slate-950/70 border-slate-700 text-sky-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. TEMAS PRÉ-COORDENADOS RECOLHÍVEIS */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setIsThemesExpanded(!isThemesExpanded)}
                className="w-full p-3 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 transition cursor-pointer flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      Temas pré-coordenados
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        6 opções
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Aplica as quatro cores juntas em harmonia com um único clique
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="text-xs hidden sm:inline">
                    {isThemesExpanded ? 'Recolher temas' : 'Expandir temas'}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isThemesExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isThemesExpanded && (
                <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in duration-200">
                  {COMPLETE_THEME_PRESETS.map((preset) => {
                    const isThemeActive = 
                      currentBgColor.toLowerCase() === preset.bg.toLowerCase() &&
                      currentPanelColor.toLowerCase() === preset.panel.toLowerCase() &&
                      currentAccentColor.toLowerCase() === preset.accent.toLowerCase() &&
                      currentTextColor.toLowerCase() === preset.text.toLowerCase();

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyCompletePreset(preset)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                          isThemeActive 
                            ? 'ring-2 shadow-lg scale-[1.01]' 
                            : 'border-slate-800 hover:border-slate-700 opacity-90 hover:opacity-100'
                        }`}
                        style={{ 
                          backgroundColor: preset.panel,
                          borderColor: isThemeActive ? preset.accent : undefined,
                          boxShadow: isThemeActive ? `0 0 16px ${preset.accent}30` : undefined
                        }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: preset.bg }} title={`Fundo: ${preset.bg}`} />
                            <span className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: preset.panel }} title={`Painel: ${preset.panel}`} />
                            <span className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: preset.accent }} title={`Destaque: ${preset.accent}`} />
                            <span className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: preset.text }} title={`Texto: ${preset.text}`} />
                          </div>
                          {isThemeActive && (
                            <span 
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm"
                              style={{ 
                                backgroundColor: preset.accent, 
                                color: getContrastTextColor(preset.accent) 
                              }}
                            >
                              Ativo
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-xs truncate" style={{ color: preset.text }}>{preset.name}</h4>
                        <p className="text-[11px] line-clamp-1 mt-0.5 opacity-80" style={{ color: preset.text }}>{preset.description}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 3: PERSONALIZAR ABAS (VISIBILIDADE INDIVIDUAL)                      */}
      {/* ========================================================================= */}
      <div 
        className="border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl transition-all"
        style={{ backgroundColor: currentPanelColor }}
      >
        <div 
          onClick={() => toggleSectionOpen('visibilidade_abas')}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80 cursor-pointer select-none group"
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-inner shrink-0"
              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
            >
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base group-hover:text-sky-300 transition-colors">
                  Personalizar Abas (Visibilidade)
                </h3>
                {isSectionPinned('visibilidade_abas') && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                    <Pin className="w-2.5 h-2.5 fill-amber-300 rotate-45" /> Fixada aberta
                  </span>
                )}
                {!isSectionOpen('visibilidade_abas') && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    Recolhida
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Ative ou desative a exibição de abas opcionais na barra de navegação superior
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => togglePinSection('visibilidade_abas')}
              className={`px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
                isSectionPinned('visibilidade_abas')
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title={isSectionPinned('visibilidade_abas') ? "Seção fixada como sempre aberta. Clique para desafixar." : "Fixar esta seção sempre aberta"}
            >
              <Pin className={`w-3.5 h-3.5 transition-transform ${isSectionPinned('visibilidade_abas') ? 'rotate-45 fill-amber-400 text-amber-400' : ''}`} />
              <span className="hidden sm:inline">{isSectionPinned('visibilidade_abas') ? 'Fixada' : 'Fixar'}</span>
            </button>

            <button
              type="button"
              onClick={() => toggleSectionOpen('visibilidade_abas')}
              className="p-1.5 rounded-xl border border-slate-700/80 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer flex items-center justify-center"
              title={isSectionOpen('visibilidade_abas') ? "Recolher seção" : "Expandir seção"}
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isSectionOpen('visibilidade_abas') ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {isSectionOpen('visibilidade_abas') && (
          <div className="mt-5 space-y-3 animate-in fade-in duration-200">
            {/* Aba 1: Pesquisa de itens */}
            <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-4 transition-colors hover:border-slate-700">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Pesquisa de itens</h4>
                  <p className="text-xs text-slate-400">
                    Localizar compras, parcelas e históricos rapidamente em todos os cartões
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleTab('pesquisar')}
                className={`w-13 h-7 rounded-full p-1 transition-colors cursor-pointer shrink-0 relative flex items-center ${
                  tabPrefs.pesquisar ? 'bg-emerald-500' : 'bg-slate-800'
                }`}
                title={tabPrefs.pesquisar ? 'Desativar aba Pesquisa de itens' : 'Ativar aba Pesquisa de itens'}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                    tabPrefs.pesquisar ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Aba 2: Dívidas totais */}
            <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-4 transition-colors hover:border-slate-700">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Dívidas totais</h4>
                  <p className="text-xs text-slate-400">
                    Consulta de débitos agrupados e somatórios por responsável / pagador
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleTab('dividas')}
                className={`w-13 h-7 rounded-full p-1 transition-colors cursor-pointer shrink-0 relative flex items-center ${
                  tabPrefs.dividas ? 'bg-emerald-500' : 'bg-slate-800'
                }`}
                title={tabPrefs.dividas ? 'Desativar aba Dívidas totais' : 'Ativar aba Dívidas totais'}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                    tabPrefs.dividas ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Aba 3: Simulador de gastos */}
            <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-4 transition-colors hover:border-slate-700">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center shrink-0">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Simulador de gastos</h4>
                  <p className="text-xs text-slate-400">
                    Divisão orçamentária entre Blocos Comercial (Mensal) e Residencial (Quinzena)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleTab('simulador')}
                className={`w-13 h-7 rounded-full p-1 transition-colors cursor-pointer shrink-0 relative flex items-center ${
                  tabPrefs.simulador ? 'bg-emerald-500' : 'bg-slate-800'
                }`}
                title={tabPrefs.simulador ? 'Desativar aba Simulador de gastos' : 'Ativar aba Simulador de gastos'}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                    tabPrefs.simulador ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 4: PERSONALIZAR TÍTULO DO CABEÇALHO (Item 15)                       */}
      {/* ========================================================================= */}
      <div 
        className="border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl transition-all"
        style={{ backgroundColor: currentPanelColor }}
      >
        <div 
          onClick={() => toggleSectionOpen('titulo_cabecalho')}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80 cursor-pointer select-none group"
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-inner shrink-0"
              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
            >
              <Type className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base group-hover:text-sky-300 transition-colors">
                  Personalizar Título do Cabeçalho
                </h3>
                {isSectionPinned('titulo_cabecalho') && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                    <Pin className="w-2.5 h-2.5 fill-amber-300 rotate-45" /> Fixada aberta
                  </span>
                )}
                {!isSectionOpen('titulo_cabecalho') && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    Recolhida
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Altere o título principal exibido no cabeçalho superior do aplicativo (padrão: Cartões)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => togglePinSection('titulo_cabecalho')}
              className={`px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
                isSectionPinned('titulo_cabecalho')
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title={isSectionPinned('titulo_cabecalho') ? "Seção fixada como sempre aberta. Clique para desafixar." : "Fixar esta seção sempre aberta"}
            >
              <Pin className={`w-3.5 h-3.5 transition-transform ${isSectionPinned('titulo_cabecalho') ? 'rotate-45 fill-amber-400 text-amber-400' : ''}`} />
              <span className="hidden sm:inline">{isSectionPinned('titulo_cabecalho') ? 'Fixada' : 'Fixar'}</span>
            </button>

            <button
              type="button"
              onClick={() => toggleSectionOpen('titulo_cabecalho')}
              className="p-1.5 rounded-xl border border-slate-700/80 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer flex items-center justify-center"
              title={isSectionOpen('titulo_cabecalho') ? "Recolher seção" : "Expandir seção"}
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isSectionOpen('titulo_cabecalho') ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {isSectionOpen('titulo_cabecalho') && (
          <div className="mt-5 space-y-4 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={headerTitleInput}
                  onChange={(e) => setHeaderTitleInput(e.target.value)}
                  placeholder="Ex: Cartões, Minhas Finanças, Gestão Cartões..."
                  maxLength={40}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveHeaderTitle}
                  className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-sky-500/20"
                >
                  <Check className="w-4 h-4" />
                  Salvar Título
                </button>
                <button
                  type="button"
                  onClick={handleResetHeaderTitle}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                  title="Restaurar título padrão 'Cartões'"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restaurar Padrão
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/40 border border-slate-800/60 rounded-xl px-3.5 py-2">
              <span className="text-slate-500">Pré-visualização atual no cabeçalho:</span>
              <span className="font-bold text-white tracking-wide">{headerTitleInput.trim() || 'Cartões'}</span>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 5: PERSONALIZAR NOMES DAS ABAS (Item 14)                            */}
      {/* ========================================================================= */}
      <div 
        className="border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl transition-all"
        style={{ backgroundColor: currentPanelColor }}
      >
        <div 
          onClick={() => toggleSectionOpen('nomes_abas')}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80 cursor-pointer select-none group"
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-inner shrink-0"
              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
            >
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base group-hover:text-sky-300 transition-colors">
                  Personalizar Nomes das Abas
                </h3>
                {isSectionPinned('nomes_abas') && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                    <Pin className="w-2.5 h-2.5 fill-amber-300 rotate-45" /> Fixada aberta
                  </span>
                )}
                {!isSectionOpen('nomes_abas') && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    Recolhida
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Renomeie as abas do menu de navegação de acordo com sua preferência
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => togglePinSection('nomes_abas')}
              className={`px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
                isSectionPinned('nomes_abas')
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title={isSectionPinned('nomes_abas') ? "Seção fixada como sempre aberta. Clique para desafixar." : "Fixar esta seção sempre aberta"}
            >
              <Pin className={`w-3.5 h-3.5 transition-transform ${isSectionPinned('nomes_abas') ? 'rotate-45 fill-amber-400 text-amber-400' : ''}`} />
              <span className="hidden sm:inline">{isSectionPinned('nomes_abas') ? 'Fixada' : 'Fixar'}</span>
            </button>

            <button
              type="button"
              onClick={() => toggleSectionOpen('nomes_abas')}
              className="p-1.5 rounded-xl border border-slate-700/80 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer flex items-center justify-center"
              title={isSectionOpen('nomes_abas') ? "Recolher seção" : "Expandir seção"}
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isSectionOpen('nomes_abas') ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {isSectionOpen('nomes_abas') && (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
            {[
              { key: 'limites' as const, defaultName: 'Painel de Limites', icon: CreditCard, color: 'text-sky-400' },
              { key: 'matriz' as const, defaultName: 'Matriz de Gastos', icon: Table, color: 'text-indigo-400' },
              { key: 'cartoes' as const, defaultName: 'Cartões & Meses', icon: BarChart3, color: 'text-violet-400' },
              { key: 'dividas' as const, defaultName: 'Dívidas Totais', icon: Users, color: 'text-emerald-400' },
              { key: 'pesquisar' as const, defaultName: 'Pesquisar Itens', icon: Search, color: 'text-amber-400' },
              { key: 'simulador' as const, defaultName: 'Simulador de Gastos', icon: Calculator, color: 'text-fuchsia-400' },
            ].map((tab) => {
              const Icon = tab.icon;
              const currentVal = tabNamesInput[tab.key] || '';
              const isCustomized = currentVal.trim() !== '' && currentVal.trim() !== tab.defaultName;

              return (
                <div 
                  key={tab.key}
                  className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-2xl flex flex-col gap-2.5 transition-colors hover:border-slate-700"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${tab.color}`} />
                      <span className="text-xs font-semibold text-slate-300">
                        Padrão: <span className="text-slate-400 font-normal">{tab.defaultName}</span>
                      </span>
                    </div>
                    {isCustomized && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        Personalizado
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={currentVal}
                      onChange={(e) => setTabNamesInput(prev => ({ ...prev, [tab.key]: e.target.value }))}
                      placeholder={tab.defaultName}
                      maxLength={30}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveTabName(tab.key, tab.defaultName)}
                      className="px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer shrink-0"
                      title="Salvar nome para esta aba"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResetTabName(tab.key, tab.defaultName)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0 border border-slate-700"
                      title={`Restaurar padrão "${tab.defaultName}"`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 6: PAGADORES E FAVORITOS                                            */}
      {/* ========================================================================= */}
      <div 
        className="border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl transition-all"
        style={{ backgroundColor: currentPanelColor }}
      >
        <div 
          onClick={() => toggleSectionOpen('pagadores_favoritos')}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80 cursor-pointer select-none group"
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-inner shrink-0"
              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
            >
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base group-hover:text-sky-300 transition-colors">
                  Pagadores e Favoritos
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {visiblePersons.length} cadastrados
                </span>
                {isSectionPinned('pagadores_favoritos') && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                    <Pin className="w-2.5 h-2.5 fill-amber-300 rotate-45" /> Fixada aberta
                  </span>
                )}
                {!isSectionOpen('pagadores_favoritos') && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    Recolhida
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Gerencie as pessoas responsáveis pelos pagamentos e defina os favoritos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => togglePinSection('pagadores_favoritos')}
              className={`px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
                isSectionPinned('pagadores_favoritos')
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title={isSectionPinned('pagadores_favoritos') ? "Seção fixada como sempre aberta. Clique para desafixar." : "Fixar esta seção sempre aberta"}
            >
              <Pin className={`w-3.5 h-3.5 transition-transform ${isSectionPinned('pagadores_favoritos') ? 'rotate-45 fill-amber-400 text-amber-400' : ''}`} />
              <span className="hidden sm:inline">{isSectionPinned('pagadores_favoritos') ? 'Fixada' : 'Fixar'}</span>
            </button>

            <button
              type="button"
              onClick={() => toggleSectionOpen('pagadores_favoritos')}
              className="p-1.5 rounded-xl border border-slate-700/80 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer flex items-center justify-center"
              title={isSectionOpen('pagadores_favoritos') ? "Recolher seção" : "Expandir seção"}
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isSectionOpen('pagadores_favoritos') ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {isSectionOpen('pagadores_favoritos') && (
          <div className="mt-5 space-y-4 animate-in fade-in duration-200">
            {/* Formulário de Novo Pagador */}
            <form onSubmit={handleAddNewPayer} className="p-4 bg-slate-950/60 border border-slate-800/90 rounded-2xl">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={newPayerInput}
                    onChange={(e) => setNewPayerInput(e.target.value)}
                    placeholder="Nome do novo pagador (ex: Lucas, Casa, Trabalho...)"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 px-2 py-1 select-none">
                  <input
                    type="checkbox"
                    checked={newPayerMakeFavorite}
                    onChange={(e) => setNewPayerMakeFavorite(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
                  />
                  <span className="flex items-center gap-1">
                    <Star className={`w-3.5 h-3.5 ${newPayerMakeFavorite ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
                    <span>Fixar como favorito</span>
                  </span>
                </label>
                <button
                  type="submit"
                  className="py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition hover:opacity-95 shadow-md shrink-0"
                  style={{ backgroundColor: accentColor, color: accentTextColor }}
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Adicionar Pagador</span>
                </button>
              </div>
            </form>

            {/* Lista de Pagadores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {visiblePersons.map((person) => {
                const isFav = effectiveFavs.some((f) => f.toLowerCase().trim() === person.toLowerCase().trim());
                return (
                  <div
                    key={person}
                    className={`p-3 rounded-2xl border transition flex items-center justify-between gap-2.5 ${
                      isFav 
                        ? 'bg-amber-500/10 border-amber-500/30 text-white' 
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                        isFav ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {person.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-xs truncate block">{person}</span>
                        {isFav && (
                          <span className="text-[10px] text-amber-400/90 font-medium flex items-center gap-0.5">
                            <Pin className="w-2.5 h-2.5" /> Favorito
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleFavorite(person)}
                        title={isFav ? "Remover dos favoritos" : "Fixar como favorito no topo"}
                        className={`p-1.5 rounded-lg border transition cursor-pointer ${
                          isFav
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/30'
                            : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-amber-400 hover:border-amber-400/30'
                        }`}
                      >
                        <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemovePayer(person)}
                        title={`Remover ou ocultar ${person}`}
                        className="p-1.5 rounded-lg border border-slate-800 hover:border-rose-500/40 bg-slate-900/80 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Confirmação para Zerar Dados */}
      <ModalConfirmacao
        isOpen={isResetConfirmOpen}
        title="Limpar e Zerar Todos os Dados?"
        message="Esta ação irá apagar completamente todos os cartões cadastrados, faturas, lançamentos parcelados, despesas fixas e a matriz de gastos salvos no navegador (localStorage). O sistema ficará 100% zerado para você cadastrar tudo do zero. Deseja prosseguir?"
        confirmLabel="Sim, Zerar Tudo"
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={handleConfirmResetSeed}
        onClose={() => setIsResetConfirmOpen(false)}
      />

    </div>
  );
};
