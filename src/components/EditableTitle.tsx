import React, { useState, useEffect } from 'react';
import { Pencil, Check, X } from 'lucide-react';

interface EditableTitleProps {
  titleKey: string;
  defaultTitle: string;
  customTitles?: Record<string, string>;
  onSaveTitle?: (key: string, newTitle: string) => void;
  onSaveCustomTitle?: (key: string, newTitle: string) => void;
  className?: string;
  icon?: React.ReactNode;
  tag?: 'h1' | 'h2' | 'h3' | 'span';
}

export const EditableTitle: React.FC<EditableTitleProps> = ({
  titleKey,
  defaultTitle,
  customTitles,
  onSaveTitle,
  onSaveCustomTitle,
  className = 'text-base font-bold text-white',
  icon,
  tag = 'h2',
}) => {
  const currentTitle = customTitles?.[titleKey] || defaultTitle;
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState(currentTitle);

  useEffect(() => {
    setTempTitle(currentTitle);
  }, [currentTitle]);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = tempTitle.trim() || defaultTitle;
    setTempTitle(clean);
    setIsEditing(false);
    (onSaveCustomTitle || onSaveTitle)?.(titleKey, clean);
  };

  const handleCancel = () => {
    setTempTitle(currentTitle);
    setIsEditing(false);
  };

  const Tag = tag;

  if (isEditing) {
    return (
      <form onSubmit={handleSave} className="flex items-center gap-1.5 inline-flex py-0.5">
        {icon}
        <input
          type="text"
          autoFocus
          value={tempTitle}
          onChange={(e) => setTempTitle(e.target.value)}
          placeholder={defaultTitle}
          className="bg-slate-900 border border-sky-500 text-white rounded-lg px-2.5 py-1 text-xs sm:text-sm font-bold focus:outline-none focus:ring-1 focus:ring-sky-400"
        />
        <button
          type="submit"
          title="Salvar título"
          className="p-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer transition-colors"
        >
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          title="Cancelar edição"
          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2 group/edit-title">
      {icon}
      <Tag className={`${className} flex items-center gap-1.5`}>
        <span>{currentTitle}</span>
      </Tag>
      <button
        type="button"
        onClick={() => {
          setTempTitle(currentTitle);
          setIsEditing(true);
        }}
        title={`Editar título "${currentTitle}"`}
        className="opacity-60 group-hover/edit-title:opacity-100 p-1 rounded-md text-slate-400 hover:text-sky-400 hover:bg-slate-800/80 transition-all cursor-pointer"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
