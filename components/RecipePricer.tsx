import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Ingredient, Packaging, Recipe, RecipeIngredient, RecipePackaging, Unit, AppSettings, IngredientSection } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ConfirmModal } from './ConfirmModal';
import { calculateCosts, convertToBaseUnitAmount } from './costCalculator';
import { formatCurrency, safeParseFloat } from './utils';
import { InformationCircleIcon } from './icons/InformationCircleIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';

interface RecipePricerProps {
  ingredients: Ingredient[];
  packagingItems: Packaging[];
  settings: AppSettings;
  onSave: (recipe: Recipe) => void;
  onCancel: () => void;
  recipeToEdit?: Recipe | null;
  type: 'recipe' | 'filling';
}

type ItemToDelete = {
    type: 'section' | 'ingredient' | 'packaging';
    id: string;
    sectionId?: string;
    name?: string;
};

const createNewSection = (name = "Ingredientes"): IngredientSection => ({
  id: new Date().toISOString() + Math.random(),
  name,
  ingredients: []
});

const createEmptyRecipe = (): Omit<Recipe, 'id'>=> ({
  name: '',
  ingredientSections: [createNewSection()],
  packaging: [],
  yieldAmount: 0,
  yieldUnit: 'g',
  laborMinutes: 0,
  energyUsageMinutes: 0,
  gasUsageMinutes: 0,
  evaporationPercentage: 0,
  variableCostsPercentage: 10,
  profitMargin: 30,
  taxPercentage: undefined,
  preparationMethod: [''],
  observationsTitle: 'Observações',
  observations: [''],
});

const inputFieldClasses = "mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary";
const selectFieldClasses = `${inputFieldClasses} pr-8`;

const SearchableIngredientSelect: React.FC<{
    ingredients: Ingredient[];
    currentIngredientId: string;
    onSelect: (id: string) => void;
}> = ({ ingredients, currentIngredientId, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const selectedIngredient = useMemo(() => ingredients.find(i => i.id === currentIngredientId), [currentIngredientId, ingredients]);

    const filteredIngredients = useMemo(() => {
        if (!searchTerm) return ingredients;
        return ingredients.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm, ingredients]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const handleSelect = (id: string) => {
        onSelect(id);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <input
                type="text"
                value={isOpen ? searchTerm : selectedIngredient?.name || ''}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setIsOpen(true)}
                placeholder="Digite para buscar..."
                className={inputFieldClasses}
            />
            {isOpen && (
                <ul className="absolute z-10 w-full bg-white dark:bg-gray-800 border border-rose-200 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                    {filteredIngredients.length > 0 ? (
                        filteredIngredients.map(ing => (
                            <li
                                key={ing.id}
                                onClick={() => handleSelect(ing.id)}
                                className="px-3 py-2 hover:bg-rose-100 dark:hover:bg-gray-700 cursor-pointer"
                            >
                                {ing.name}
                            </li>
                        ))
                    ) : (
                        <li className="px-3 py-2 text-gray-500 italic">Nenhum ingrediente encontrado</li>
                    )}
                </ul>
            )}
        </div>
    );
};

const TimeInput: React.FC<{
    label: string;
    totalMinutes: number;
    onMinutesChange: (minutes: number) => void;
    cost: number;
}> = ({ label, totalMinutes, onMinutesChange, cost }) => {
    const [timeValue, setTimeValue] = useState<string>('0');
    const [timeUnit, setTimeUnit] = useState<'minutos' | 'horas'>('minutos');

    useEffect(() => {
        const currentMinutesInState = (safeParseFloat(timeValue)) * (timeUnit === 'horas' ? 60 : 1);
        if (Math.abs(currentMinutesInState - totalMinutes) < 1e-9) {
            return;
        }

        const isHoursSuitable = totalMinutes >= 60 && totalMinutes % 60 === 0;
        const currentUnit = isHoursSuitable ? 'horas' : 'minutos';
        const currentValue = isHoursSuitable ? totalMinutes / 60 : totalMinutes;
        setTimeUnit(currentUnit);
        setTimeValue(String(currentValue));
    }, [totalMinutes]);

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setTimeValue(value);
        const numericValue = safeParseFloat(value);
        onMinutesChange(timeUnit === 'horas' ? numericValue * 60 : numericValue);
    };

    const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newUnit = e.target.value as 'minutos' | 'horas';
        const oldUnit = timeUnit;
        
        const currentMinutes = (safeParseFloat(timeValue)) * (oldUnit === 'horas' ? 60 : 1);
        
        setTimeUnit(newUnit);
        
        if (newUnit === 'horas') {
            setTimeValue(String(currentMinutes / 60));
        } else {
            setTimeValue(String(currentMinutes));
        }
        onMinutesChange(currentMinutes);
    };

    return (
        <div className="flex items-end gap-2">
            <div className="flex-grow">
                <label className="block text-sm font-medium text-brand-light-text dark:text-gray-400">{label}</label>
                <div className="flex items-center">
                    <input type="number" value={timeValue} onChange={handleValueChange} className={inputFieldClasses} placeholder="0" step="any" min="0"/>
                    <select value={timeUnit} onChange={handleUnitChange} className={`${selectFieldClasses} w-auto ml-2`}>
                        <option value="minutos">minutos</option>
                        <option value="horas">horas</option>
                    </select>
                </div>
            </div>
            <div className="w-24 text-center pb-2">
                 <span className="text-sm font-semibold text-brand-text dark:text-gray-300">{formatCurrency(cost)}</span>
            </div>
        </div>
    );
};


export const RecipePricer: React.FC<RecipePricerProps> = ({ ingredients, packagingItems, settings, onSave, onCancel, recipeToEdit, type }) => {
  const [recipe, setRecipe] = useState<Omit<Recipe, 'id'>>(createEmptyRecipe());
  const [itemToDelete, setItemToDelete] = useState<ItemToDelete | null>(null);
  
  // Scaling states
  const [showScalingInput, setShowScalingInput] = useState(false);
  const [scalingPercentage, setScalingPercentage] = useState('');
  const [showPackagingWarning, setShowPackagingWarning] = useState(false);
  
  // Individual adjustment state
  const [individualAdjustment, setIndividualAdjustment] = useState<{sectionId: string, ingId: string, percent: string} | null>(null);
  
  const [initialRecipe, setInitialRecipe] = useState<Omit<Recipe, 'id'> | null>(null);
  const [lastRecipe, setLastRecipe] = useState<Omit<Recipe, 'id'> | null>(null);

  useEffect(() => {
    const initialData = recipeToEdit 
        ? JSON.parse(JSON.stringify(recipeToEdit))
        : createEmptyRecipe();
    
    if (initialData.evaporationPercentage === undefined) {
      initialData.evaporationPercentage = 0;
    }
    
    if (type === 'recipe' && !recipeToEdit) {
        initialData.yieldUnit = 'un';
    }


    if (type === 'recipe') {
      if (initialData.variableCostsPercentage === undefined) {
          initialData.variableCostsPercentage = 10;
      }
      if (initialData.profitMargin === undefined) {
          initialData.profitMargin = 30;
      }
      if (initialData.taxPercentage === undefined) {
          initialData.taxPercentage = settings.taxPercentage;
      }
      if (!initialData.preparationMethod || initialData.preparationMethod.length === 0) {
          initialData.preparationMethod = [''];
      }
      if (!initialData.observations || initialData.observations.length === 0) {
          initialData.observations = [''];
      }
      if (!initialData.observationsTitle) {
          initialData.observationsTitle = 'Observações';
      }
    }

    setRecipe(initialData);
    setInitialRecipe(JSON.parse(JSON.stringify(initialData)));
  }, [recipeToEdit, type]);
  
  const calculatedGrossYield = useMemo(() => {
    if (type !== 'filling') return 0;
    
    return recipe.ingredientSections.flatMap(section => section.ingredients).reduce((total, ing) => {
        if (ing.unit === 'un') {
            return total; // Cannot sum units
        }
        return total + convertToBaseUnitAmount(ing.amount, ing.unit);
    }, 0);
  }, [recipe.ingredientSections, type]);
  
  useEffect(() => {
    if (type === 'filling') {
        let newYieldAmount = calculatedGrossYield;
        if (recipe.yieldUnit === 'kg' || recipe.yieldUnit === 'l') {
            newYieldAmount /= 1000;
        }
        // Only update if it's different to avoid loops and floating point issues
        if (Math.abs((recipe.yieldAmount || 0) - newYieldAmount) > 1e-9) {
            setRecipe(prev => ({
                ...prev,
                yieldAmount: newYieldAmount
            }));
        }
    }
  }, [calculatedGrossYield, recipe.yieldUnit, type]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const isNumber = ['yieldAmount', 'evaporationPercentage', 'variableCostsPercentage', 'profitMargin', 'taxPercentage'].includes(name);
    
    setRecipe(prev => ({ ...prev, [name]: isNumber ? safeParseFloat(value) : value } as any));
  };
  
  const handleMinutesChange = useCallback((field: keyof Omit<Recipe, 'id'>, minutes: number) => {
    setRecipe(prev => ({...prev, [field]: minutes}));
  }, []);

  // Section handlers
  const addSection = () => {
    setRecipe(prev => ({...prev, ingredientSections: [...prev.ingredientSections, createNewSection('Nova Seção')]}));
  };
  
  const updateSectionName = (sectionId: string, name: string) => {
    setRecipe(prev => ({
        ...prev,
        ingredientSections: prev.ingredientSections.map(section => 
            section.id === sectionId ? { ...section, name } : section
        )
    }));
  };
  
  const triggerRemoveSection = (section: IngredientSection) => {
    if (recipe.ingredientSections.length <= 1) {
      alert("A receita deve ter pelo menos uma seção de ingredientes.");
      return;
    }
    setItemToDelete({ type: 'section', id: section.id, name: section.name });
  };

  // Scaling Logic
  const applyGlobalScale = (factor: number) => {
    setLastRecipe(JSON.parse(JSON.stringify(recipe)));
    setRecipe(prev => ({
      ...prev,
      ingredientSections: prev.ingredientSections.map(section => ({
        ...section,
        ingredients: section.ingredients.map(ing => ({
          ...ing,
          amount: parseFloat((ing.amount * factor).toFixed(4))
        }))
      })),
      yieldAmount: parseFloat((prev.yieldAmount * factor).toFixed(4)),
      laborMinutes: Math.round(prev.laborMinutes * factor),
      energyUsageMinutes: Math.round(prev.energyUsageMinutes * factor),
      gasUsageMinutes: Math.round(prev.gasUsageMinutes * factor),
      packaging: [] // Clear packaging on scale change
    }));
    setShowPackagingWarning(true);
  };

  const applyIndividualAdjustment = (applyToAll: boolean) => {
    if (!individualAdjustment) return;
    const percent = safeParseFloat(individualAdjustment.percent);
    const factor = 1 + (percent / 100);

    setLastRecipe(JSON.parse(JSON.stringify(recipe)));
    setRecipe(prev => {
      const updatedSections = prev.ingredientSections.map(section => ({
        ...section,
        ingredients: section.ingredients.map(ing => {
          const isTarget = section.id === individualAdjustment.sectionId && ing.id === individualAdjustment.ingId;
          if (isTarget || applyToAll) {
            return { ...ing, amount: parseFloat((ing.amount * factor).toFixed(4)) };
          }
          return ing;
        })
      }));

      // If applying to all, also scale yields and labor, and reset packaging
      if (applyToAll) {
        setShowPackagingWarning(true);
        return {
          ...prev,
          ingredientSections: updatedSections,
          yieldAmount: parseFloat((prev.yieldAmount * factor).toFixed(4)),
          laborMinutes: Math.round(prev.laborMinutes * factor),
          energyUsageMinutes: Math.round(prev.energyUsageMinutes * factor),
          gasUsageMinutes: Math.round(prev.gasUsageMinutes * factor),
          packaging: []
        };
      }

      return { ...prev, ingredientSections: updatedSections };
    });

    setIndividualAdjustment(null);
  };

  const handleReset = () => {
    if (initialRecipe) {
      setRecipe(JSON.parse(JSON.stringify(initialRecipe)));
      setLastRecipe(null);
      setShowPackagingWarning(false);
    }
  };

  const handleUndo = () => {
    if (lastRecipe) {
      setRecipe(JSON.parse(JSON.stringify(lastRecipe)));
      setLastRecipe(null);
    }
  };

  // Ingredient handlers
  const addIngredient = (sectionId: string) => {
    if(ingredients.length === 0) return;
    const newIngredient: RecipeIngredient = {
      id: new Date().toISOString() + Math.random(),
      ingredientId: ingredients[0].id,
      amount: 0,
      unit: 'g'
    };
    setRecipe(prev => ({
        ...prev,
        ingredientSections: prev.ingredientSections.map(section => 
            section.id === sectionId 
                ? { ...section, ingredients: [...section.ingredients, newIngredient] } 
                : section
        )
    }));
  }

  const updateIngredient = (sectionId: string, ingredientId: string, field: keyof RecipeIngredient, value: any) => {
    setRecipe(prev => ({
        ...prev,
        ingredientSections: prev.ingredientSections.map(section => {
            if (section.id !== sectionId) return section;
            return {
                ...section,
                ingredients: section.ingredients.map(ing => 
                    ing.id === ingredientId ? { ...ing, [field]: value } : ing
                )
            };
        })
    }));
  }
  
  const triggerRemoveIngredient = (sectionId: string, ingredient: RecipeIngredient) => {
    const ingData = ingredients.find(i => i.id === ingredient.ingredientId);
    setItemToDelete({ type: 'ingredient', id: ingredient.id, sectionId, name: ingData?.name || 'Ingrediente' });
  };

  const addPackaging = () => {
    if(packagingItems.length === 0) return;
    const newPackaging: RecipePackaging = {
      id: new Date().toISOString() + Math.random(),
      packagingId: packagingItems[0].id,
      amount: 1,
    };
    setRecipe(prev => ({ ...prev, packaging: [...prev.packaging, newPackaging]}));
  }

  const updatePackaging = (packagingId: string, field: keyof RecipePackaging, value: any) => {
    setRecipe(prev => ({
        ...prev,
        packaging: prev.packaging.map(pkg => pkg.id === packagingId ? { ...pkg, [field]: value } : pkg)
    }));
  }
  
  const triggerRemovePackaging = (packagingItem: RecipePackaging) => {
    const pkgData = packagingItems.find(p => p.id === packagingItem.packagingId);
    setItemToDelete({ type: 'packaging', id: packagingItem.id, name: pkgData?.name || 'Embalagem' });
  };
  
    const handleListChange = (field: 'preparationMethod' | 'observations', index: number, value: string) => {
        setRecipe(prev => {
            const list = prev[field] ?? [];
            const newList = [...list];
            newList[index] = value;
            return { ...prev, [field]: newList };
        });
    };

    const addListItem = (field: 'preparationMethod' | 'observations') => {
        setRecipe(prev => ({
            ...prev,
            [field]: [...(prev[field] ?? []), '']
        }));
    };

    const removeListItem = (field: 'preparationMethod' | 'observations', index: number) => {
        setRecipe(prev => {
            const list = prev[field] ?? [];
            const newList = [...list];
            newList.splice(index, 1);
            if (newList.length === 0) {
                newList.push('');
            }
            return { ...prev, [field]: newList };
        });
    };

  const confirmDelete = () => {
    if (!itemToDelete) return;

    switch (itemToDelete.type) {
        case 'section':
            setRecipe(prev => ({
                ...prev,
                ingredientSections: prev.ingredientSections.filter(s => s.id !== itemToDelete.id)
            }));
            break;
        case 'ingredient':
            setRecipe(prev => ({
                ...prev,
                ingredientSections: prev.ingredientSections.map(s => 
                    s.id === itemToDelete.sectionId
                        ? { ...s, ingredients: s.ingredients.filter(i => i.id !== itemToDelete.id) }
                        : s
                )
            }));
            break;
        case 'packaging':
            setRecipe(prev => ({
                ...prev,
                packaging: prev.packaging.filter(p => p.id !== itemToDelete.id)
            }));
            break;
    }
    setItemToDelete(null);
  };

  const calculatedCosts = useMemo(() => {
    return calculateCosts(recipe, ingredients, packagingItems, settings, type);
  }, [recipe, ingredients, packagingItems, settings, type]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipe.name) {
        alert("Por favor, preencha o nome.");
        return;
    }
    if (type === 'recipe' && recipe.yieldAmount <= 0) {
        alert("O rendimento da receita deve ser maior que zero.");
        return;
    }
    if (type === 'filling' && calculatedGrossYield <= 0) {
        alert("Um recheio precisa de ingredientes para ter um rendimento. Adicione ingredientes à lista.");
        return;
    }

    // Create a mutable copy to work with. Using 'any' to allow property deletion.
    const recipeToSave: any = {
      ...(recipeToEdit ? { id: recipeToEdit.id } : { id: new Date().toISOString() }),
      ...recipe,
    };

    if (type === 'recipe') {
        // For recipes, clean up empty steps/observations but ensure the fields exist as empty arrays.
        recipeToSave.preparationMethod = recipe.preparationMethod?.filter(item => item.trim() !== '') || [];
        recipeToSave.observations = recipe.observations?.filter(item => item.trim() !== '') || [];
        // As per original logic for recipes
        recipeToSave.evaporationPercentage = 0;
    } else { // type === 'filling'
        // For fillings, remove recipe-specific fields to avoid storing them as undefined.
        // These fields are not applicable to fillings.
        delete recipeToSave.variableCostsPercentage;
        delete recipeToSave.profitMargin;
        delete recipeToSave.preparationMethod;
        delete recipeToSave.observations;
        delete recipeToSave.observationsTitle;
    }

    onSave(recipeToSave as Recipe);
  };
  
  const getModalMessage = () => {
    if (!itemToDelete) return "";
    switch (itemToDelete.type) {
        case 'section':
            return `Tem certeza que deseja remover a seção "${itemToDelete.name}" e todos os seus ingredientes?`;
        case 'ingredient':
            return `Tem certeza que deseja remover o ingrediente "${itemToDelete.name}"?`;
        case 'packaging':
            return `Tem certeza que deseja remover a embalagem "${itemToDelete.name}"?`;
        default:
            return "Tem certeza?";
    }
  };

  const title = type === 'recipe' 
    ? (recipeToEdit ? 'Editar Receita' : 'Nova Receita')
    : (recipeToEdit ? 'Editar Recheio' : 'Novo Recheio');
  
  const saveButtonLabel = type === 'recipe' ? 'Salvar Receita' : 'Salvar Recheio';


  return (
    <>
    <div className="space-y-8 animate-fade-in">
        <form onSubmit={handleSubmit}>
            <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
                <h1 className="font-display text-4xl text-brand-text dark:text-rose-100">{title}</h1>
                <div className="flex gap-2">
                    <button type="button" onClick={onCancel} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
                        Cancelar
                    </button>
                    <button type="submit" className="bg-brand-primary hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
                        {saveButtonLabel}
                    </button>
                </div>
            </div>

            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 mb-8 relative z-50">
                <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Informações Gerais</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <label htmlFor="name" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Nome</label>
                        <input type="text" name="name" id="name" value={recipe.name} onChange={handleInputChange} className={inputFieldClasses} placeholder="Bolo de Chocolate"/>
                    </div>
                    <div>
                        <label htmlFor="category" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Categoria (Ex: Páscoa, Natal)</label>
                        <input type="text" name="category" id="category" value={recipe.category || ''} onChange={handleInputChange} className={inputFieldClasses} placeholder="Páscoa"/>
                    </div>
                    {type === 'recipe' ? (
                        <div className="flex gap-2">
                            <div className="flex-grow">
                                <label htmlFor="yieldAmount" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Rendimento</label>
                                <input type="number" name="yieldAmount" id="yieldAmount" value={recipe.yieldAmount || ''} onChange={handleInputChange} className={inputFieldClasses} placeholder="10" min="0" step="any"/>
                            </div>
                            <div>
                                <label htmlFor="yieldUnit" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Unidade</label>
                                <input type="text" name="yieldUnit" id="yieldUnit" value={recipe.yieldUnit} onChange={handleInputChange} className={inputFieldClasses} placeholder="Fatias"/>
                            </div>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <div className="flex-grow">
                                <label htmlFor="yieldAmount" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Rendimento</label>
                                <input 
                                    type="number" 
                                    name="yieldAmount" 
                                    id="yieldAmount" 
                                    value={recipe.yieldAmount || ''} 
                                    onChange={handleInputChange}
                                    className={inputFieldClasses} 
                                    placeholder="0"
                                    step="any"
                                />
                            </div>
                            <div>
                                <label htmlFor="yieldUnit" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Unidade</label>
                                <select name="yieldUnit" id="yieldUnit" value={recipe.yieldUnit} onChange={handleInputChange} className={selectFieldClasses}>
                                    <option value="g">g</option>
                                    <option value="kg">kg</option>
                                    <option value="ml">ml</option>
                                    <option value="l">l</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Ingredients Sections */}
            <div className="space-y-6 mb-8 relative z-40">
              {recipe.ingredientSections.map((section, index) => (
                <div 
                  key={section.id} 
                  className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 relative" 
                  style={{ zIndex: recipe.ingredientSections.length - index }}
                >
                    <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                        <input 
                          type="text"
                          value={section.name}
                          onChange={(e) => updateSectionName(section.id, e.target.value)}
                          className="font-display text-2xl text-brand-text dark:text-rose-100 bg-transparent border-b-2 border-transparent focus:border-brand-secondary focus:outline-none transition-colors flex-grow min-w-0"
                          placeholder="Nome da Seção"
                        />
                        <div className="flex items-center gap-2">
                           <button type="button" onClick={() => addIngredient(section.id)} disabled={ingredients.length === 0} className="flex items-center justify-center gap-2 bg-brand-secondary hover:bg-pink-500 text-white font-bold py-2 px-3 rounded-lg shadow-md transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm">
                                <PlusIcon className="w-4 h-4"/> <span className="hidden sm:inline">Ingrediente</span>
                            </button>
                            <button type="button" onClick={() => triggerRemoveSection(section)} className="text-rose-400 hover:text-brand-primary p-2 rounded-full hover:bg-rose-100 dark:hover:bg-gray-600 disabled:opacity-50" disabled={recipe.ingredientSections.length <= 1}>
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {section.ingredients.map(ing => (
                            <div key={ing.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                                <div className="md:col-span-4">
                                    <label className="text-xs text-brand-light-text dark:text-gray-400">Ingrediente</label>
                                    <SearchableIngredientSelect
                                        ingredients={ingredients}
                                        currentIngredientId={ing.ingredientId}
                                        onSelect={(id) => updateIngredient(section.id, ing.id, 'ingredientId', id)}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs text-brand-light-text dark:text-gray-400">Qtd.</label>
                                    <input type="number" value={ing.amount || ''} onChange={(e) => updateIngredient(section.id, ing.id, 'amount', safeParseFloat(e.target.value))} className={inputFieldClasses} min="0" step="any" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs text-brand-light-text dark:text-gray-400">Unid.</label>
                                    <select value={ing.unit} onChange={(e) => updateIngredient(section.id, ing.id, 'unit', e.target.value as Unit)} className={selectFieldClasses}>
                                        <option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="l">l</option><option value="un">un</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs text-brand-light-text dark:text-gray-400 opacity-0">Ajustar</label>
                                    <button 
                                        type="button" 
                                        onClick={() => setIndividualAdjustment({ sectionId: section.id, ingId: ing.id, percent: '' })}
                                        className="w-full text-xs bg-rose-50 dark:bg-gray-700 text-brand-primary dark:text-brand-secondary border border-rose-200 dark:border-gray-600 px-2 py-2 rounded-md hover:bg-rose-100 transition-colors font-bold"
                                    >
                                        % Ajustar
                                    </button>
                                </div>
                                <div className="md:col-span-2 flex items-center justify-end">
                                    <button type="button" onClick={() => triggerRemoveIngredient(section.id, ing)} className="text-rose-400 hover:text-brand-primary p-2 rounded-full hover:bg-rose-100 dark:hover:bg-gray-600"><TrashIcon className="w-5 h-5" /></button>
                                </div>
                            </div>
                        ))}
                        {ingredients.length === 0 && section.ingredients.length === 0 && <p className="text-center text-brand-light-text dark:text-gray-400 italic py-2">Cadastre um ingrediente primeiro.</p>}
                    </div>
                </div>
              ))}
              <button type="button" onClick={addSection} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-rose-300 dark:border-gray-600 text-brand-light-text dark:text-gray-400 hover:bg-rose-50 dark:hover:bg-gray-700/50 hover:border-brand-secondary hover:text-brand-primary dark:hover:text-rose-200 font-bold py-3 px-4 rounded-lg transition-colors">
                  <PlusIcon className="w-5 h-5"/> <span>Adicionar Seção (Ex: Recheio, Cobertura)</span>
              </button>
            </div>

            {/* Undo/Reset Controls */}
            {(lastRecipe || (initialRecipe && JSON.stringify(recipe) !== JSON.stringify(initialRecipe))) && (
              <div className="flex gap-2 mb-8 animate-fade-in">
                {lastRecipe && (
                  <button 
                    type="button" 
                    onClick={handleUndo}
                    className="flex-grow bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 py-2 rounded-xl font-bold hover:bg-blue-100 transition-colors text-sm"
                  >
                    Desfazer Último Ajuste
                  </button>
                )}
                <button 
                  type="button" 
                  onClick={handleReset}
                  className="flex-grow bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 py-2 rounded-xl font-bold hover:bg-gray-100 transition-colors text-sm"
                >
                  Resetar para o Original
                </button>
              </div>
            )}

            {showPackagingWarning && (
              <div className="mb-8 flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded-2xl text-yellow-800 dark:text-yellow-200 text-sm animate-fade-in">
                <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
                <p className="flex-grow">Escala alterada! Revise as embalagens para este novo volume.</p>
                <button type="button" onClick={() => setShowPackagingWarning(false)} className="font-bold underline">Ok</button>
              </div>
            )}

            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 mb-8 relative z-30">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-display text-2xl text-brand-text dark:text-rose-100">Embalagens</h2>
                    <button type="button" onClick={addPackaging} disabled={packagingItems.length === 0} className="flex items-center justify-center gap-2 bg-brand-secondary hover:bg-pink-500 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed">
                        <PlusIcon className="w-5 h-5"/> <span className="hidden sm:inline">Adicionar</span>
                    </button>
                </div>
                <div className="space-y-2">
                    {recipe.packaging.map(pkg => (
                        <div key={pkg.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                            <div className="md:col-span-2">
                                <label className="text-xs text-brand-light-text dark:text-gray-400">Embalagem</label>
                                <select value={pkg.packagingId} onChange={(e) => updatePackaging(pkg.id, 'packagingId', e.target.value)} className={selectFieldClasses}>
                                    {packagingItems.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="flex items-end gap-2">
                                <div className="flex-grow">
                                    <label className="text-xs text-brand-light-text dark:text-gray-400">Qtd.</label>
                                    <input type="number" value={pkg.amount || ''} onChange={(e) => updatePackaging(pkg.id, 'amount', safeParseFloat(e.target.value))} className={inputFieldClasses} min="0" step="any" />
                                </div>
                                <button type="button" onClick={() => triggerRemovePackaging(pkg)} className="text-rose-400 hover:text-brand-primary p-2 rounded-full hover:bg-rose-100 dark:hover:bg-gray-600"><TrashIcon className="w-5 h-5" /></button>
                            </div>
                        </div>
                    ))}
                    {packagingItems.length === 0 && recipe.packaging.length === 0 && <p className="text-center text-brand-light-text dark:text-gray-400 italic py-2">Cadastre uma embalagem primeiro.</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 relative z-20">
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 space-y-4">
                    <h2 className="font-display text-2xl text-brand-text dark:text-rose-100">{type === 'recipe' ? 'Custos de Produção e Venda' : 'Ajustes de Produção'}</h2>
                     <TimeInput 
                        label="Horas de Trabalho"
                        totalMinutes={recipe.laborMinutes}
                        onMinutesChange={(m) => handleMinutesChange('laborMinutes', m)}
                        cost={calculatedCosts.laborCost}
                     />
                     <TimeInput 
                        label="Uso de Energia (Ex: Forno Elétrico)"
                        totalMinutes={recipe.energyUsageMinutes}
                        onMinutesChange={(m) => handleMinutesChange('energyUsageMinutes', m)}
                        cost={calculatedCosts.energyCost}
                     />
                      <TimeInput 
                        label="Tempo de Uso de Gás"
                        totalMinutes={recipe.gasUsageMinutes}
                        onMinutesChange={(m) => handleMinutesChange('gasUsageMinutes', m)}
                        cost={calculatedCosts.gasCost}
                     />
                    {type === 'filling' && (
                        <div>
                            <label className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Porcentagem de Evaporação (%)</label>
                            <input type="number" name="evaporationPercentage" value={recipe.evaporationPercentage || ''} onChange={handleInputChange} className={inputFieldClasses} placeholder="10" min="0" step="any" />
                            <p className="text-xs text-brand-light-text dark:text-gray-500 mt-1">Percentual de perda de peso durante o cozimento/preparo.</p>
                        </div>
                    )}
                    {type === 'recipe' && (
                      <>
                        <div>
                            <label className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Custos Variáveis (%)</label>
                            <input type="number" name="variableCostsPercentage" value={recipe.variableCostsPercentage || ''} onChange={handleInputChange} className={inputFieldClasses} placeholder="10" min="0" step="any" />
                            <p className="text-xs text-brand-light-text dark:text-gray-500 mt-1">Soma das taxas percentuais (ex: cartão, delivery) que incidem sobre o PREÇO DE VENDA FINAL.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Imposto (%)</label>
                            <input type="number" name="taxPercentage" value={recipe.taxPercentage ?? ''} onChange={handleInputChange} className={inputFieldClasses} placeholder="8" min="0" step="any" />
                            <p className="text-xs text-brand-light-text dark:text-gray-500 mt-1">Alíquota de imposto que incide sobre o PREÇO DE VENDA FINAL.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Lucro Desejado (%)</label>
                            <input type="number" name="profitMargin" value={recipe.profitMargin || ''} onChange={handleInputChange} className={inputFieldClasses} placeholder="100" min="0" step="any" />
                            <p className="text-xs text-brand-light-text dark:text-gray-500 mt-1">Percentual de lucro calculado sobre o custo de produção (ingredientes, mão de obra, etc).</p>
                        </div>
                      </>
                    )}
                </div>
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 space-y-3 text-center">
                    <h2 className="font-display text-2xl text-brand-text dark:text-rose-100">Resultado Final</h2>
                    {type === 'recipe' ? (
                        <div className="space-y-3">
                            <div className="p-4 bg-rose-50 dark:bg-gray-700/50 rounded-lg">
                                <p className="text-sm text-brand-light-text dark:text-gray-400">Custo Total da Receita</p>
                                <p className="text-3xl font-bold text-brand-text dark:text-rose-100">{formatCurrency(calculatedCosts.totalCost)}</p>
                            </div>
                            <div className="p-4 bg-green-50 dark:bg-green-900/50 rounded-lg">
                                <p className="text-sm text-green-700 dark:text-green-300">Preço de Venda Sugerido</p>
                                <p className="text-4xl font-bold text-green-600 dark:text-green-400">{formatCurrency(calculatedCosts.finalSalePrice)}</p>
                            </div>
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/50 rounded-lg">
                                <p className="text-sm text-blue-700 dark:text-blue-300">Preço por {recipe.yieldUnit}</p>
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(calculatedCosts.salePricePerUnit)}</p>
                            </div>
                            <div className="p-4 bg-purple-50 dark:bg-purple-900/50 rounded-lg">
                                <p className="text-sm text-purple-700 dark:text-purple-300">Lucro Bruto (Total)</p>
                                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatCurrency(calculatedCosts.profitValue)}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="p-4 bg-rose-50 dark:bg-gray-700/50 rounded-lg">
                                <p className="text-sm text-brand-light-text dark:text-gray-400">Custo Total do Recheio</p>
                                <p className="text-3xl font-bold text-brand-text dark:text-rose-100">{formatCurrency(calculatedCosts.totalCost)}</p>
                            </div>
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/50 rounded-lg">
                                <p className="text-sm text-blue-700 dark:text-blue-300">Rendimento Líquido (com perdas)</p>
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{calculatedCosts.netYieldAmount.toFixed(2)} {recipe.yieldUnit}</p>
                            </div>
                            <div className="p-4 bg-green-50 dark:bg-green-900/50 rounded-lg">
                                <p className="text-sm text-green-700 dark:text-green-300">Preço por Kg</p>
                                <p className="text-4xl font-bold text-green-600 dark:text-green-400">
                                  { (recipe.yieldUnit.toLowerCase().includes('g') || recipe.yieldUnit.toLowerCase().includes('kg'))
                                    ? formatCurrency(calculatedCosts.pricePerKg)
                                    : <span className="text-lg italic text-gray-500 flex items-center justify-center gap-2"><InformationCircleIcon className="w-5 h-5"/> Mude a unidade do rendimento para 'g' ou 'kg'</span>
                                  }
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {type === 'recipe' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 space-y-4">
                      <h2 className="font-display text-2xl text-brand-text dark:text-rose-100">Modo de Preparo</h2>
                      <div className="space-y-2">
                          {recipe.preparationMethod?.map((step, index) => (
                              <div key={index} className="flex items-start gap-2">
                                  <span className="pt-3 text-brand-light-text dark:text-gray-400 font-semibold">{index + 1}.</span>
                                  <textarea 
                                      value={step} 
                                      onChange={(e) => handleListChange('preparationMethod', index, e.target.value)}
                                      className={`${inputFieldClasses} resize-y min-h-[42px]`}
                                      placeholder="Ex: Misture os ingredientes secos..."
                                      rows={1}
                                  />
                                  <button 
                                      type="button" 
                                      onClick={() => removeListItem('preparationMethod', index)} 
                                      className="text-rose-400 hover:text-brand-primary p-2 mt-1 rounded-full hover:bg-rose-100 dark:hover:bg-gray-600 disabled:opacity-50"
                                      disabled={recipe.preparationMethod!.length <= 1 && step === ''}
                                  >
                                      <TrashIcon className="w-5 h-5" />
                                  </button>
                              </div>
                          ))}
                      </div>
                      <button 
                          type="button" 
                          onClick={() => addListItem('preparationMethod')}
                          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-rose-200 dark:border-gray-500 text-brand-light-text dark:text-gray-400 hover:bg-rose-50 dark:hover:bg-gray-700/50 hover:border-brand-secondary text-sm py-2 px-3 rounded-lg transition-colors"
                      >
                          <PlusIcon className="w-4 h-4" /> Adicionar Passo
                      </button>
                  </div>
                  
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 space-y-4">
                      <input 
                          type="text"
                          value={recipe.observationsTitle || ''}
                          onChange={e => setRecipe(prev => ({...prev, observationsTitle: e.target.value}))}
                          className="font-display text-2xl text-brand-text dark:text-rose-100 bg-transparent border-b-2 border-transparent focus:border-brand-secondary focus:outline-none transition-colors w-full"
                          placeholder="Título da Seção"
                      />
                      <div className="space-y-2">
                          {recipe.observations?.map((obs, index) => (
                              <div key={index} className="flex items-start gap-2">
                                  <span className="pt-3 text-brand-light-text dark:text-gray-400 font-semibold">•</span>
                                  <textarea 
                                      value={obs} 
                                      onChange={(e) => handleListChange('observations', index, e.target.value)}
                                      className={`${inputFieldClasses} resize-y min-h-[42px]`}
                                      placeholder="Ex: Pode ser congelado por até 3 meses."
                                      rows={1}
                                  />
                                  <button 
                                      type="button" 
                                      onClick={() => removeListItem('observations', index)} 
                                      className="text-rose-400 hover:text-brand-primary p-2 mt-1 rounded-full hover:bg-rose-100 dark:hover:bg-gray-600 disabled:opacity-50"
                                      disabled={recipe.observations!.length <= 1 && obs === ''}
                                  >
                                      <TrashIcon className="w-5 h-5" />
                                  </button>
                              </div>
                          ))}
                      </div>
                      <button 
                          type="button" 
                          onClick={() => addListItem('observations')}
                          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-rose-200 dark:border-gray-500 text-brand-light-text dark:text-gray-400 hover:bg-rose-50 dark:hover:bg-gray-700/50 hover:border-brand-secondary text-sm py-2 px-3 rounded-lg transition-colors"
                      >
                          <PlusIcon className="w-4 h-4" /> Adicionar Observação
                      </button>
                  </div>
              </div>
            )}

        </form>
    </div>

    {/* Adjustment Modal for Individual Ingredients */}
    {individualAdjustment && (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-2xl border border-rose-100 dark:border-gray-700 w-full max-w-md text-center">
          <h3 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-2">Ajustar Quantidade</h3>
          <p className="text-sm text-brand-light-text dark:text-gray-400 mb-6">
            Ajustar {ingredients.find(i => i.id === recipe.ingredientSections.find(s => s.id === individualAdjustment.sectionId)?.ingredients.find(ing => ing.id === individualAdjustment.ingId)?.ingredientId)?.name}
          </p>
          
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {[0.5, 1.5, 2, 3].map(factor => (
                <button 
                  key={factor}
                  type="button"
                  onClick={() => setIndividualAdjustment({ ...individualAdjustment, percent: String((factor - 1) * 100) })}
                  className="py-2 bg-rose-50 dark:bg-gray-700 text-brand-primary dark:text-rose-200 rounded-xl font-bold text-sm border border-rose-100 dark:border-gray-600 hover:bg-rose-100 transition-colors"
                >
                  {factor}x
                </button>
              ))}
            </div>

            <div className="relative">
              <input 
                type="text" 
                inputMode="text"
                autoFocus
                value={individualAdjustment.percent}
                onChange={(e) => setIndividualAdjustment({ ...individualAdjustment, percent: e.target.value })}
                placeholder="Ex: 50 para +50% ou -20 para -20%"
                className={`${inputFieldClasses} text-center text-lg font-bold`}
              />
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <span className="text-gray-400 font-bold">%</span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <button 
              onClick={() => applyIndividualAdjustment(true)}
              className="bg-brand-primary text-white py-4 rounded-2xl font-bold hover:bg-rose-700 shadow-lg transition-transform active:scale-95"
            >
              Aplicar a TODA a receita
            </button>
            <button 
              onClick={() => applyIndividualAdjustment(false)}
              className="bg-brand-secondary text-white py-4 rounded-2xl font-bold hover:bg-pink-500 shadow-md transition-transform active:scale-95"
            >
              Ajustar APENAS este item
            </button>
            <button 
              onClick={() => setIndividualAdjustment(null)}
              className="mt-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-medium py-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )}

    <ConfirmModal
        isOpen={!!itemToDelete}
        title="Confirmar Exclusão"
        message={getModalMessage()}
        onConfirm={confirmDelete}
        onCancel={() => setItemToDelete(null)}
    />
    </>
  )
}