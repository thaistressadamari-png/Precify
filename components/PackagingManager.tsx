import React, { useState, useMemo, useRef } from 'react';
import type { Packaging } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { PencilIcon } from './icons/PencilIcon';
import { TrashIcon } from './icons/TrashIcon';
import { SearchIcon } from './icons/SearchIcon';
import { ConfirmModal } from './ConfirmModal';
import { formatCurrency } from './utils';
import { ArrowDownTrayIcon } from './icons/ArrowDownTrayIcon';
import { ArrowUpTrayIcon } from './icons/ArrowUpTrayIcon';

interface PackagingManagerProps {
  packaging: Packaging[];
  onAddNew: () => void;
  onEdit: (pkg: Packaging) => void;
  onDelete: (packagingId: string) => void;
  onImport: (newPackaging: Packaging[]) => void;
}

export const PackagingManager: React.FC<PackagingManagerProps> = ({ packaging, onAddNew, onEdit, onDelete, onImport }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [packagingIdToDelete, setPackagingIdToDelete] = useState<string | null>(null);
  const [dataToImport, setDataToImport] = useState<Packaging[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerDelete = (id: string) => {
    setPackagingIdToDelete(id);
  };

  const confirmDelete = () => {
    if (packagingIdToDelete) {
        onDelete(packagingIdToDelete);
        setPackagingIdToDelete(null);
    }
  };

  const filteredPackaging = useMemo(() => {
    return packaging.filter(pkg =>
      pkg.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [packaging, searchTerm]);

  const packagingToDelete = useMemo(() => {
    if (!packagingIdToDelete) return null;
    return packaging.find(i => i.id === packagingIdToDelete);
  }, [packagingIdToDelete, packaging]);

  const handleExport = () => {
    const dataStr = JSON.stringify(packaging, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'precify_embalagens.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result;
            if (typeof text !== 'string') throw new Error("File content is not a string.");
            const parsedData = JSON.parse(text);
            
            if (!Array.isArray(parsedData) || (parsedData.length > 0 && (!parsedData[0].id || !parsedData[0].name || parsedData[0].price === undefined))) {
                throw new Error("Formato de arquivo inválido para embalagens.");
            }
            
            setDataToImport(parsedData as Packaging[]);
        } catch (error) {
            alert(`Erro ao importar arquivo: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            if(event.target) event.target.value = '';
        }
    };
    reader.onerror = () => {
         alert("Erro ao ler o arquivo.");
         if(event.target) event.target.value = '';
    }
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if(dataToImport) {
        onImport(dataToImport);
        setDataToImport(null);
    }
  };

  return (
    <>
    <div className="space-y-8 animate-fade-in">
        <div className="flex justify-between items-center flex-wrap gap-4">
            <h1 className="font-display text-4xl text-brand-text dark:text-rose-100">Minhas Embalagens</h1>
             <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleImportClick} className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105 text-sm">
                  <ArrowDownTrayIcon className="w-5 h-5"/>
                  <span>Importar</span>
              </button>
              <button onClick={handleExport} className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105 text-sm">
                  <ArrowUpTrayIcon className="w-5 h-5"/>
                  <span>Exportar</span>
              </button>
              <button onClick={onAddNew} className="flex items-center justify-center gap-2 bg-brand-primary hover:bg-rose-700 text-white font-bold py-3 px-5 rounded-lg shadow-md transition-transform transform hover:scale-105">
                  <PlusIcon className="w-6 h-6"/>
                  <span>Nova Embalagem</span>
              </button>
            </div>
        </div>
      
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
            <h2 className="font-display text-2xl text-brand-text dark:text-rose-100">Lista de Embalagens</h2>
            <div className="relative">
                <input 
                    type="search"
                    placeholder="Buscar embalagem..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full sm:w-64 border border-rose-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-brand-secondary focus:border-brand-secondary"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <SearchIcon className="w-5 h-5 text-gray-400" />
                </div>
            </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto pr-2">
          {filteredPackaging.length > 0 ? (
            <ul className="space-y-3">
              {filteredPackaging.map(pkg => (
                <li key={pkg.id} className="flex justify-between items-center bg-rose-50 dark:bg-gray-700/50 p-3 rounded-lg border border-rose-200 dark:border-gray-600">
                  <div>
                    <p className="font-semibold text-brand-text dark:text-gray-200">{pkg.name}</p>
                    <p className="text-sm text-brand-light-text dark:text-gray-400">
                      {formatCurrency(pkg.price)} / {pkg.amount} {pkg.unit}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onEdit(pkg)} className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-gray-600 transition-colors">
                      <PencilIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => triggerDelete(pkg.id)} className="text-rose-400 hover:text-brand-primary dark:text-gray-400 dark:hover:text-rose-400 p-1 rounded-full hover:bg-rose-100 dark:hover:bg-gray-600 transition-colors">
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-16">
                <h3 className="text-lg font-semibold text-brand-text dark:text-gray-300">
                    {searchTerm ? 'Nenhuma embalagem encontrada' : 'Nenhuma embalagem cadastrada'}
                </h3>
                <p className="text-brand-light-text dark:text-gray-400 mt-2">
                    {searchTerm ? 'Tente buscar por outro termo.' : 'Clique em "Nova Embalagem" para começar!'}
                </p>
            </div>
          )}
        </div>
      </div>
    </div>
    <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".json" />
    <ConfirmModal
        isOpen={!!packagingIdToDelete}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir a embalagem "${packagingToDelete?.name || ''}"?`}
        onConfirm={confirmDelete}
        onCancel={() => setPackagingIdToDelete(null)}
      />
      <ConfirmModal
        isOpen={!!dataToImport}
        title="Confirmar Importação"
        message="A importação substituirá TODAS as suas embalagens atuais. Esta ação não pode ser desfeita. Deseja continuar?"
        onConfirm={confirmImport}
        onCancel={() => setDataToImport(null)}
        confirmText="Confirmar Importação"
      />
    </>
  );
};
