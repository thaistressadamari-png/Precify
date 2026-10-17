
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
import { DocumentDuplicateIcon } from './icons/DocumentDuplicateIcon';
import { ClipboardListIcon } from './icons/ClipboardListIcon';

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
  onDuplicate: (recipe: Recipe) => void;
  onGeneratePurchaseOrder?: (selections: { recipe: Recipe; batches: number }[]) => void;
}

export const Recipes: React.FC<RecipesProps> = ({
  recipes,
  onAddNew,
  onEdit,
  onDelete,
  onViewDetails,
  ingredients,
  packagingItems,
  settings,
  onImport,
  type,
  onDuplicate,
  onGeneratePurchaseOrder,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [recipeToDelete, setRecipeToDelete] = useState<Recipe | null>(null);
    const [dataToImport, setDataToImport] = useState<Recipe[] | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Modo de seleção para Ordem de Compra
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedRecipesMap, setSelectedRecipesMap] = useState<Record<string, number>>({});


    const categories = useMemo(() => {
        const cats = new Set<string>();
        recipes.forEach(r => {
            if (r.category) cats.add(r.category);
        });
        return Array.from(cats).sort();
    }, [recipes]);

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
        return recipesWithStatus.filter(recipe => {
          const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesCategory = selectedCategory === 'all' || recipe.category === selectedCategory;
          return matchesSearch && matchesCategory;
        });
    }, [recipesWithStatus, searchTerm, selectedCategory]);
    
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

    const handleToggleRecipeSelection = (recipeId: string) => {
      setSelectedRecipesMap(prev => {
        const next = { ...prev };
        if (next[recipeId] !== undefined) {
          delete next[recipeId];
        } else {
          next[recipeId] = 1;
        }
        return next;
      });
    };

    const handleBatchChange = (recipeId: string, batches: number) => {
      setSelectedRecipesMap(prev => ({
        ...prev,
        [recipeId]: Math.max(0.1, batches),
      }));
    };

    const handleTriggerGenerateOrder = () => {
      if (!onGeneratePurchaseOrder) return;
      const selections = Object.entries(selectedRecipesMap)
        .map(([recipeId, batches]) => {
          const recipe = recipes.find(r => r.id === recipeId);
          if (!recipe) return null;
          return { recipe, batches };
        })
        .filter((s): s is { recipe: Recipe; batches: number } => s !== null);

      if (selections.length === 0) {
        alert('Selecione pelo menos uma receita para gerar a ordem de compra.');
        return;
      }

      onGeneratePurchaseOrder(selections);
      setIsSelectionMode(false);
      setSelectedRecipesMap({});
    };

    const selectedCount = Object.keys(selectedRecipesMap).length;
    const totalBatchesCount = Object.values(selectedRecipesMap).reduce<number>((acc, count) => acc + Number(count || 0), 0);

    const title = type === 'recipe' ? 'Minhas Receitas' : 'Meus Recheios';
    const newButtonLabel = type === 'recipe' ? 'Nova Receita' : 'Novo Recheio';

  return (
    <>
    <div className="space-y-8 animate-fade-in relative pb-16">
        <div className="flex justify-between items-center flex-wrap gap-4">
            <h1 className="font-display text-4xl text-brand-text dark:text-rose-100">{title}</h1>
             <div className="flex items-center gap-2 flex-wrap">
              {type === 'recipe' && onGeneratePurchaseOrder && (
                <button
                  onClick={() => {
                    setIsSelectionMode(!isSelectionMode);
                    if (isSelectionMode) setSelectedRecipesMap({});
                  }}
                  className={`flex items-center justify-center gap-2 font-bold py-2.5 px-4 rounded-xl shadow-sm text-sm transition-all ${
                    isSelectionMode
                      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-md'
                      : 'bg-rose-100 hover:bg-rose-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-brand-primary dark:text-rose-200'
                  }`}
                  title="Selecionar receitas e gerar lista de compras com cálculo de pacotes"
                >
                  <ClipboardListIcon className="w-5 h-5"/>
                  <span>{isSelectionMode ? 'Sair da Seleção' : 'Gerar Ordem de Compra'}</span>
                </button>
              )}
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

        {/* Banner de instrução do modo de seleção */}
        {isSelectionMode && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700 p-4 rounded-2xl flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <ClipboardListIcon className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div>
                <span className="font-bold text-sm text-amber-900 dark:text-amber-200 block">
                  Modo de Seleção para Ordem de Compra Ativo
                </span>
                <span className="text-xs text-amber-700 dark:text-amber-300">
                  Marque as receitas que vai produzir e ajuste a quantidade de fornadas. Os ingredientes serão consolidados e arredondados em pacotes comerciais inteiros.
                </span>
              </div>
            </div>
            {selectedCount > 0 && (
              <button
                onClick={handleTriggerGenerateOrder}
                className="bg-brand-primary hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-xl shadow-md text-sm transition"
              >
                Gerar Lista ({selectedCount})
              </button>
            )}
          </div>
        )}

        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <span className="text-sm font-medium text-brand-light-text dark:text-gray-400">Filtrar por Categoria:</span>
                    <select 
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="px-3 py-2 border border-rose-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-brand-secondary focus:border-brand-secondary text-sm"
                    >
                        <option value="all">Todas as Categorias</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
                <div className="relative w-full md:w-80">
                    <input 
                        type="search"
                        placeholder="Buscar por nome..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 w-full border border-rose-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-brand-secondary focus:border-brand-secondary"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <SearchIcon className="w-5 h-5 text-gray-400" />
                    </div>
                </div>
            </div>
            {filteredRecipes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRecipes.map(recipe => {
                      const isSelected = selectedRecipesMap[recipe.id] !== undefined;
                      const batchCount = selectedRecipesMap[recipe.id] || 1;

                      return (
                        <div
                          key={recipe.id}
                          className={`bg-rose-50 dark:bg-gray-700/50 rounded-2xl shadow-md border flex flex-col justify-between overflow-hidden transition-all ${
                            isSelected
                              ? 'border-brand-primary ring-2 ring-brand-primary/50 dark:border-rose-400 dark:ring-rose-400/40 bg-rose-100/40 dark:bg-gray-700'
                              : 'border-rose-200 dark:border-gray-600'
                          }`}
                        >
                            <div className="p-5">
                                {/* Barra de Seleção no topo do Card */}
                                {isSelectionMode && (
                                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-rose-200/80 dark:border-gray-600 bg-white/60 dark:bg-gray-800/60 p-2.5 rounded-xl">
                                    <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-brand-primary dark:text-rose-200">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleToggleRecipeSelection(recipe.id)}
                                        className="w-4 h-4 text-brand-primary rounded focus:ring-brand-primary cursor-pointer"
                                      />
                                      <span>{isSelected ? 'Incluída na lista' : 'Marcar para lista'}</span>
                                    </label>
                                    {isSelected && (
                                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                        <span className="text-[11px] font-semibold text-brand-light-text dark:text-gray-400">Fornadas:</span>
                                        <input
                                          type="number"
                                          min="0.1"
                                          step="0.5"
                                          value={batchCount}
                                          onChange={(e) => handleBatchChange(recipe.id, parseFloat(e.target.value) || 1)}
                                          className="w-14 px-1.5 py-0.5 text-xs border border-rose-300 dark:border-gray-500 rounded bg-white dark:bg-gray-700 text-center font-bold"
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="flex justify-between items-start gap-2 mb-1">
                                    <h3 className="font-display text-xl text-brand-text dark:text-rose-100 truncate">{recipe.name}</h3>
                                    {recipe.category && (
                                        <span className="px-2 py-0.5 bg-rose-100 dark:bg-gray-600 text-brand-primary dark:text-rose-200 text-[10px] font-bold rounded-full uppercase tracking-wider whitespace-nowrap">
                                            {recipe.category}
                                        </span>
                                    )}
                                </div>
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
                            <div className="bg-rose-100 dark:bg-gray-700 p-2 grid grid-cols-4 gap-1">
                                <button onClick={() => onViewDetails(recipe)} className="text-sm py-2 px-2 text-center rounded-md text-brand-text dark:text-gray-200 hover:bg-white dark:hover:bg-gray-600 transition-colors col-span-1">Ver</button>
                                <button onClick={() => onDuplicate(recipe)} title="Duplicar" className="text-emerald-600 dark:text-emerald-400 p-2 rounded-md hover:bg-emerald-100 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-1 col-span-1">
                                    <DocumentDuplicateIcon className="w-4 h-4" />
                                </button>
                                <button onClick={() => onEdit(recipe)} className="text-blue-600 dark:text-blue-400 p-2 rounded-md hover:bg-blue-100 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-1 col-span-1">
                                    <PencilIcon className="w-4 h-4" />
                                    <span className="text-sm hidden sm:inline">Editar</span>
                                </button>
                                <button onClick={() => setRecipeToDelete(recipe)} className="text-rose-500 dark:text-rose-400 p-2 rounded-md hover:bg-rose-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-1 col-span-1">
                                    <TrashIcon className="w-4 h-4"/>
                                    <span className="text-sm hidden sm:inline">Excluir</span>
                                </button>
                            </div>
                        </div>
                      );
                    })}
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

        {/* Barra Flutuante de Confirmação da Seleção */}
        {isSelectionMode && selectedCount > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-gray-800 border-2 border-brand-primary dark:border-rose-400 shadow-2xl rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4 max-w-lg w-[92%] animate-fade-in">
            <div>
              <span className="font-bold text-sm text-brand-text dark:text-rose-100 block">
                {selectedCount} {selectedCount === 1 ? 'receita selecionada' : 'receitas selecionadas'}
              </span>
              <span className="text-xs text-brand-light-text dark:text-gray-400">
                {totalBatchesCount} fornada(s) no total
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedRecipesMap({});
                }}
                className="text-xs font-semibold px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleTriggerGenerateOrder}
                className="text-xs font-bold px-4 py-2 bg-brand-primary hover:bg-rose-700 text-white rounded-xl shadow-md transition whitespace-nowrap"
              >
                Gerar Lista de Compras
              </button>
            </div>
          </div>
        )}
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
        confirmText="Confirmar Importação"
    />
    </>
  );
};
