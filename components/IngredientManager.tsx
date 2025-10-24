import React, { useState, useMemo, useRef } from 'react';
import type { Ingredient } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { PencilIcon } from './icons/PencilIcon';
import { TrashIcon } from './icons/TrashIcon';
import { SearchIcon } from './icons/SearchIcon';
import { InformationCircleIcon } from './icons/InformationCircleIcon';
import { ConfirmModal } from './ConfirmModal';
import { formatCurrency } from './utils';
import { ArrowDownTrayIcon } from './icons/ArrowDownTrayIcon';
import { ArrowUpTrayIcon } from './icons/ArrowUpTrayIcon';

interface IngredientManagerProps {
  ingredients: Ingredient[];
  onAddNew: () => void;
  onEdit: (ingredient: Ingredient) => void;
  onDelete: (ingredientId: string) => void;
  onViewDetails: (ingredient: Ingredient) => void;
  onImport: (newIngredients: Ingredient[]) => void;
}

export const IngredientManager: React.FC<IngredientManagerProps> = ({ ingredients, onAddNew, onEdit, onDelete, onViewDetails, onImport }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [ingredientIdToDelete, setIngredientIdToDelete] = useState<string | null>(null);
  const [dataToImport, setDataToImport] = useState<Ingredient[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const triggerDelete = (id: string) => {
    setIngredientIdToDelete(id);
  };

  const confirmDelete = () => {
    if (ingredientIdToDelete) {
        onDelete(ingredientIdToDelete);
        setIngredientIdToDelete(null);
    }
  };
  
  const filteredIngredients = useMemo(() => {
    return ingredients.filter(ingredient => 
      ingredient.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [ingredients, searchTerm]);
  
  const ingredientToDelete = useMemo(() => {
    if (!ingredientIdToDelete) return null;
    return ingredients.find(i => i.id === ingredientIdToDelete);
  }, [ingredientIdToDelete, ingredients]);

  const handleExport = () => {
    const dataStr = JSON.stringify(ingredients, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'precify_ingredientes.json';
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
            
            // Basic validation
            if (!Array.isArray(parsedData) || (parsedData.length > 0 && (!parsedData[0].id || !parsedData[0].name || !parsedData[0].history))) {
                throw new Error("Formato de arquivo inválido para ingredientes.");
            }
            
            setDataToImport(parsedData as Ingredient[]);
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
            <h1 className="font-display text-4xl text-brand-text dark:text-rose-100">Meus Ingredientes</h1>
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
                  <span>Novo Ingrediente</span>
              </button>
            </div>
        </div>
        
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
              <h2 className="font-display text-2xl text-brand-text dark:text-rose-100">Lista de Ingredientes</h2>
              <div className="relative">
                  <input 
                      type="search"
                      placeholder="Buscar ingrediente..."
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
            {filteredIngredients.length > 0 ? (
              <ul className="space-y-3">
                {filteredIngredients.map(ing => (
                  <li key={ing.id} className="flex justify-between items-center bg-rose-50 dark:bg-gray-700/50 p-3 rounded-lg border border-rose-200 dark:border-gray-600">
                    <div>
                      <p className="font-semibold text-brand-text dark:text-gray-200">{ing.name}</p>
                      <p className="text-sm text-brand-light-text dark:text-gray-400">
                        {formatCurrency(ing.packagePrice)} / {ing.packageAmount}{ing.unit}
                        {ing.supplier && <span className="italic"> - {ing.supplier}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => onViewDetails(ing)} aria-label="Ver detalhes" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                        <InformationCircleIcon className="w-5 h-5" />
                      </button>
                      <button onClick={() => onEdit(ing)} aria-label="Editar ingrediente" className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-gray-600 transition-colors">
                        <PencilIcon className="w-5 h-5" />
                      </button>
                      <button onClick={() => triggerDelete(ing.id)} aria-label="Excluir ingrediente" className="text-rose-400 hover:text-brand-primary dark:text-gray-400 dark:hover:text-rose-400 p-1 rounded-full hover:bg-rose-100 dark:hover:bg-gray-600 transition-colors">
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-16">
                  <h3 className="text-lg font-semibold text-brand-text dark:text-gray-300">
                      {searchTerm ? 'Nenhum ingrediente encontrado' : 'Nenhum ingrediente cadastrado'}
                  </h3>
                  <p className="text-brand-light-text dark:text-gray-400 mt-2">
                      {searchTerm ? 'Tente buscar por outro termo.' : 'Clique em "Novo Ingrediente" para começar!'}
                  </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".json" />
      <ConfirmModal
        isOpen={!!ingredientIdToDelete}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir o ingrediente "${ingredientToDelete?.name || ''}"? Esta ação não pode ser desfeita.`}
        onConfirm={confirmDelete}
        onCancel={() => setIngredientIdToDelete(null)}
      />
       <ConfirmModal
        isOpen={!!dataToImport}
        title="Confirmar Importação"
        message="A importação substituirá TODOS os seus ingredientes atuais. Esta ação não pode ser desfeita. Deseja continuar?"
        onConfirm={confirmImport}
        onCancel={() => setDataToImport(null)}
      />
    </>
  );
};