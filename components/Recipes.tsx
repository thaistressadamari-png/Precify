
import React, { useState, useMemo, useRef } from 'react';
import type { Recipe, Ingredient, Packaging, AppSettings } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { PencilIcon } from './icons/PencilIcon';
import { TrashIcon } from './icons/TrashIcon';
import { SearchIcon } from './icons/SearchIcon';
import { InformationCircleIcon } from './icons/InformationCircleIcon';
import { calculateCosts } from './costCalculator';
import { formatCurrency } from './utils';
import { ConfirmModal } from './ConfirmModal';
import { ArrowDownTrayIcon } from './icons/ArrowDownTrayIcon';
import { ArrowUpTrayIcon } from './icons/ArrowUpTrayIcon';

interface RecipesProps {
  recipes: Recipe[];
  onAddNew: () => void;
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipeId: string) => void;
  onViewDetails: (recipe: Recipe) => void;
  ingredients: Ingredient[];
  packagingItems: Packaging[];
  settings: AppSettings;
  onImport: (newRecipes: Recipe[]) => void;
  type: 'recipe' | 'filling';
}

export const Recipes: React.FC<RecipesProps> = ({ recipes, onAddNew, onEdit, onDelete, onViewDetails, ingredients, packagingItems, settings, onImport, type }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [recipeToDelete, setRecipeToDelete] = useState<Recipe | null>(null);
    const [dataToImport, setDataToImport] = useState<Recipe[] | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const recipesWithStatus = useMemo(() => {
        return recipes.map(recipe => {
            const calculated = calculateCosts(recipe, ingredients, packagingItems, settings, type);
            const hasMissingIngredient = recipe.ingredientSections?.some(section =>
                section.ingredients.some(
                    recipeIng => !ingredients.find(ing => ing.id === recipeIng.ingredientId)
                )
            );
            const hasMissingPackaging = recipe.packaging.some(
                recipePkg => !packagingItems.find(pkg => pkg.id === recipePkg.packagingId)
            );
            
            let status: 'ok' | 'warning' | 'error' = 'ok';
            let statusMessage = '';
            
            if (hasMissingIngredient || hasMissingPackaging) {
                status = 'warning';
                statusMessage = 'Contém itens excluídos. O custo pode estar incorreto.';
            }

            return { ...recipe, ...calculated, status, statusMessage };
        });
    }, [recipes, ingredients, packagingItems, settings, type]);

    const filteredRecipes = useMemo(() => {
        return recipesWithStatus.filter(recipe =>
          recipe.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [recipesWithStatus, searchTerm]);
    
    const confirmDelete = () => {
        if (recipeToDelete) {
            onDelete(recipeToDelete.id);
            setRecipeToDelete(null);
        }
    };
    
    const handleExport = () => {
        const dataStr = JSON.stringify(recipes, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `precify_${type === 'recipe' ? 'receitas' : 'recheios'}.json`;
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
                
                if (!Array.isArray(parsedData) || (parsedData.length > 0 && (!parsedData[0].id || !parsedData[0].name || !parsedData[0].ingredientSections))) {
                    throw new Error("Formato de arquivo inválido.");
                }
                
                setDataToImport(parsedData as Recipe[]);
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

  const title = type === 'recipe' ? 'Minhas Receitas' : 'Meus Recheios';
  const newButtonLabel = type === 'recipe' ? 'Nova Receita' : 'Novo Recheio';

  return (
    <>
    <div className="space-y-8 animate-fade-in">
        <div className="flex justify-between items-center flex-wrap gap-4">
            <h1 className="font-display text-4xl text-brand-text dark:text-rose-100">{title}</h1>
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
                  <span>{newButtonLabel}</span>
              </button>
            </div>
        </div>

        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
            <div className="flex justify-end mb-4">
                <div className="relative">
                    <input 
                        type="search"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 w-full md:w-80 border border-rose-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-brand-secondary focus:border-brand-secondary"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <SearchIcon className="w-5 h-5 text-gray-400" />
                    </div>
                </div>
            </div>
            {filteredRecipes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRecipes.map(recipe => (
                        <div key={recipe.id} className="bg-rose-50 dark:bg-gray-700/50 rounded-2xl shadow-md border border-rose-200 dark:border-gray-600 flex flex-col justify-between overflow-hidden">
                            <div className="p-5">
                                <h3 className="font-display text-xl text-brand-text dark:text-rose-100 truncate mb-1">{recipe.name}</h3>
                                <p className="text-sm text-brand-light-text dark:text-gray-400 mb-4">Rendimento: {recipe.yieldAmount} {recipe.yieldUnit}</p>
                                
                                <div className="space-y-2 text-sm">
                                  {type === 'recipe' ? (
                                    <>
                                      <div className="flex justify-between">
                                          <span className="text-brand-light-text dark:text-gray-400">Custo Total:</span>
                                          <span className="font-mono font-semibold text-brand-text dark:text-gray-200">{formatCurrency(recipe.totalCost)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                          <span className="text-brand-light-text dark:text-gray-400">Venda Total:</span>
                                          <span className="font-mono font-semibold text-brand-text dark:text-gray-200">{formatCurrency(recipe.finalSalePrice)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                          <span className="font-bold text-green-600 dark:text-green-400">Preço / Unidade:</span>
                                          <span className="font-mono font-bold text-lg text-green-600 dark:text-green-400">{formatCurrency(recipe.salePricePerUnit)}</span>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="flex justify-between">
                                          <span className="text-brand-light-text dark:text-gray-400">Rendimento Líquido:</span>
                                          <span className="font-mono font-semibold text-brand-text dark:text-gray-200">{recipe.netYieldAmount.toFixed(2)} {recipe.yieldUnit}</span>
                                      </div>
                                      <div className="flex justify-between">
                                          <span className="text-brand-light-text dark:text-gray-400">Custo Total:</span>
                                          <span className="font-mono font-semibold text-brand-text dark:text-gray-200">{formatCurrency(recipe.totalCost)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                          <span className="font-bold text-green-600 dark:text-green-400">Preço / Kg:</span>
                                          <span className="font-mono font-bold text-lg text-green-600 dark:text-green-400">{formatCurrency(recipe.pricePerKg)}</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                                {recipe.status !== 'ok' && (
                                    <div className={`mt-4 p-2 rounded-lg flex items-start gap-2 text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300`}>
                                       <InformationCircleIcon className="w-4 h-4 flex-shrink-0 mt-px" />
                                       <span>{recipe.statusMessage}</span>
                                    </div>
                                )}
                            </div>
                            <div className="bg-rose-100 dark:bg-gray-700 p-2 grid grid-cols-3 gap-1">
                                <button onClick={() => onViewDetails(recipe)} className="text-sm py-2 px-2 text-center rounded-md text-brand-text dark:text-gray-200 hover:bg-white dark:hover:bg-gray-600 transition-colors">Ver Detalhes</button>
                                <button onClick={() => onEdit(recipe)} className="text-blue-600 dark:text-blue-400 p-2 rounded-md hover:bg-blue-100 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-1">
                                    <PencilIcon className="w-4 h-4" />
                                    <span className="text-sm">Editar</span>
                                </button>
                                <button onClick={() => setRecipeToDelete(recipe)} className="text-rose-500 dark:text-rose-400 p-2 rounded-md hover:bg-rose-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-1">
                                    <TrashIcon className="w-4 h-4"/>
                                    <span className="text-sm">Excluir</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16">
                    <h3 className="text-lg font-semibold text-brand-text dark:text-gray-300">
                        {searchTerm ? 'Nenhum item encontrado' : 'Nenhum item cadastrado'}
                    </h3>
                    <p className="text-brand-light-text dark:text-gray-400 mt-2">
                        {searchTerm ? 'Tente buscar por outro termo.' : `Clique em "${newButtonLabel}" para começar!`}
                    </p>
                </div>
            )}
        </div>
    </div>
    <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".json" />
    <ConfirmModal
        isOpen={!!recipeToDelete}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir "${recipeToDelete?.name || ''}"? Esta ação não pode ser desfeita.`}
        onConfirm={confirmDelete}
        onCancel={() => setRecipeToDelete(null)}
    />
     <ConfirmModal
        isOpen={!!dataToImport}
        title="Confirmar Importação"
        message={`A importação substituirá TODOS os seus itens atuais. Esta ação não pode ser desfeita. Deseja continuar?`}
        onConfirm={confirmImport}
        onCancel={() => setDataToImport(null)}
    />
    </>
  );
};
