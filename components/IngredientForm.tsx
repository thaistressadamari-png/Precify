import React, { useState, useEffect } from 'react';
import type { Ingredient, Purchase, Unit } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { PencilIcon } from './icons/PencilIcon';

type IngredientFormData = {
  name: string;
  supplier: string;
  packagePrice: string;
  packageAmount: string;
  unit: Unit;
  purchaseDate: string;
}

const getTodaysDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const emptyPurchaseData: Omit<IngredientFormData, 'name'> = {
  supplier: '',
  packagePrice: '',
  packageAmount: '',
  unit: 'g',
  purchaseDate: getTodaysDateString(),
};

interface IngredientFormProps {
    onSave: (ingredient: Ingredient) => void;
    onCancel: () => void;
    ingredientToEdit?: Ingredient | null;
    mode: 'create' | 'edit' | 'addPurchase';
}

export const IngredientForm: React.FC<IngredientFormProps> = ({ onSave, onCancel, ingredientToEdit, mode }) => {
    const [formData, setFormData] = useState<IngredientFormData>({
        name: '',
        ...emptyPurchaseData
    });
    
    useEffect(() => {
        if (mode === 'edit' && ingredientToEdit) {
            const latestPurchase = ingredientToEdit.history.length > 0
                ? [...ingredientToEdit.history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
                : null;
            
            setFormData({
                name: ingredientToEdit.name,
                supplier: latestPurchase?.supplier || '',
                packagePrice: latestPurchase?.packagePrice.toString().replace('.', ',') || '',
                packageAmount: latestPurchase?.packageAmount.toString().replace('.', ',') || '',
                unit: latestPurchase?.unit || 'g',
                purchaseDate: latestPurchase?.date || getTodaysDateString(),
            });
        } else if (mode === 'addPurchase' && ingredientToEdit) {
            setFormData({
                name: ingredientToEdit.name,
                ...emptyPurchaseData,
                unit: ingredientToEdit.unit, // Default to last known unit
            });
        } else { // create mode
            setFormData({ name: '', ...emptyPurchaseData });
        }
    }, [ingredientToEdit, mode]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if ((name === 'packagePrice' || name === 'packageAmount') && value) {
            // Allow comma and dot for decimals, but only one
            if (!/^\d*([.,]?\d*)?$/.test(value)) {
                return;
            }
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const packagePrice = parseFloat(formData.packagePrice.replace(',', '.')) || 0;
        const packageAmount = parseFloat(formData.packageAmount.replace(',', '.')) || 0;

        if (!formData.name || !formData.purchaseDate || packagePrice <= 0 || packageAmount <= 0) {
            alert("Por favor, preencha nome, data, preço e quantidade corretamente.");
            return;
        }

        const purchaseDataFromForm = {
            date: formData.purchaseDate,
            supplier: formData.supplier,
            packagePrice,
            packageAmount,
            unit: formData.unit,
        };
        
        const updateIngredientFromHistory = (ingredient: Omit<Ingredient, 'id'>, newHistory: Purchase[]): Ingredient => {
            const sorted = newHistory.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            if (sorted.length === 0) {
                 return { ...ingredient, id: (ingredient as Ingredient).id || '', history: [], purchaseDate: undefined, supplier: undefined, packagePrice: 0, packageAmount: 0, unit: 'g' };
            }
            const latest = sorted[0];
            return {
                ...ingredient,
                id: (ingredient as Ingredient).id || '',
                supplier: latest.supplier,
                packagePrice: latest.packagePrice,
                packageAmount: latest.packageAmount,
                unit: latest.unit,
                purchaseDate: latest.date,
                history: sorted,
            };
        }


        if (mode === 'edit' && ingredientToEdit) {
            const sortedHistory = [...ingredientToEdit.history].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const latestPurchaseId = sortedHistory.length > 0 ? sortedHistory[0].id : null;
            
            if (!latestPurchaseId) {
                alert("Erro: não foi possível encontrar a compra mais recente para editar.");
                return;
            }

            const updatedHistory = ingredientToEdit.history.map(p =>
                p.id === latestPurchaseId ? { ...p, ...purchaseDataFromForm } : p
            );
            
            const ingredientShell = { ...ingredientToEdit, name: formData.name };
            onSave(updateIngredientFromHistory(ingredientShell, updatedHistory));

        } else if (mode === 'addPurchase' && ingredientToEdit) {
            const newPurchase: Purchase = {
                id: new Date().toISOString() + Math.random(),
                ...purchaseDataFromForm,
            };
            const updatedHistory = [...ingredientToEdit.history, newPurchase];
            onSave(updateIngredientFromHistory(ingredientToEdit, updatedHistory));

        } else { // mode === 'create'
            const newPurchase: Purchase = {
                id: new Date().toISOString() + Math.random(),
                ...purchaseDataFromForm,
            };

            // FIX: Add missing properties to satisfy the Omit<Ingredient, 'id'> type.
            // These are temporary values that will be overwritten by updateIngredientFromHistory.
            const ingredientShell: Omit<Ingredient, 'id'> = {
                name: formData.name,
                packagePrice: 0,
                packageAmount: 0,
                unit: 'g', // temporary
                history: [newPurchase],
            };
            const newIngredient = updateIngredientFromHistory(ingredientShell, [newPurchase]);
            
            onSave({
                ...newIngredient,
                id: new Date().toISOString() + Math.random(),
            });
        }
    };
    
    const titles = {
        create: 'Novo Ingrediente',
        edit: 'Editar Ingrediente',
        addPurchase: 'Registrar Nova Compra'
    };
    
    const buttonLabels = {
        create: 'Salvar Ingrediente',
        edit: 'Salvar Alterações',
        addPurchase: 'Salvar Compra'
    };
    
    const ButtonIcon = mode === 'edit' ? PencilIcon : PlusIcon;


    return (
        <div className="space-y-8 animate-fade-in">
            <form onSubmit={handleSubmit}>
                <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
                    <h1 className="font-display text-4xl text-brand-text dark:text-rose-100">
                        {titles[mode]}
                    </h1>
                    <div className="flex gap-2">
                        <button type="button" onClick={onCancel} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
                            Cancelar
                        </button>
                        <button type="submit" className="flex items-center justify-center gap-2 bg-brand-primary hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
                            <ButtonIcon className="w-5 h-5" />
                            <span>{buttonLabels[mode]}</span>
                        </button>
                    </div>
                </div>

                {mode === 'addPurchase' && ingredientToEdit && (
                  <div className="bg-rose-50 dark:bg-gray-700/50 p-4 rounded-lg mb-6 border border-rose-200 dark:border-gray-600">
                    <p className="text-brand-text dark:text-gray-200">
                      Você está adicionando uma nova compra para o ingrediente: <strong className="font-semibold">{ingredientToEdit.name}</strong>.
                    </p>
                    <p className="text-sm text-brand-light-text dark:text-gray-400">
                      Preencha os detalhes da nova aquisição abaixo. O nome não pode ser alterado aqui.
                    </p>
                  </div>
                )}
                 {mode === 'edit' && ingredientToEdit && (
                  <div className="bg-blue-50 dark:bg-gray-700/50 p-4 rounded-lg mb-6 border border-blue-200 dark:border-gray-600">
                    <p className="text-brand-text dark:text-gray-200">
                      Você está editando <strong className="font-semibold">{ingredientToEdit.name}</strong> e sua compra mais recente.
                    </p>
                    <p className="text-sm text-brand-light-text dark:text-gray-400">
                      Alterações nos dados da compra (preço, quantidade, etc.) irão sobrescrever o último registro.
                    </p>
                  </div>
                )}


                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="lg:col-span-2">
                            <label htmlFor="name" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Nome do Ingrediente</label>
                            <input type="text" name="name" id="name" value={formData.name} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary disabled:bg-gray-100 dark:disabled:bg-gray-600" placeholder="Farinha de Trigo" required disabled={mode === 'addPurchase'} />
                        </div>
                         <div>
                            <label htmlFor="purchaseDate" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Data da Compra</label>
                            <input type="date" name="purchaseDate" id="purchaseDate" value={formData.purchaseDate || ''} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary" required />
                        </div>
                        <div>
                            <label htmlFor="supplier" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Fornecedor (Opcional)</label>
                            <input type="text" name="supplier" id="supplier" value={formData.supplier || ''} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary" placeholder="Mercado local"/>
                        </div>
                        <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <div>
                                <label htmlFor="packagePrice" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Preço Embalagem (R$)</label>
                                <input type="text" inputMode="decimal" name="packagePrice" id="packagePrice" value={formData.packagePrice} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary" placeholder="5,00" required />
                            </div>
                            <div className="flex items-end gap-2">
                                <div className="flex-grow">
                                    <label htmlFor="packageAmount" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Qtd. Embalagem</label>
                                    <input type="text" inputMode="decimal" name="packageAmount" id="packageAmount" value={formData.packageAmount} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary" placeholder="1000" required />
                                </div>
                                <div>
                                    <label htmlFor="unit" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Unid.</label>
                                    <select name="unit" id="unit" value={formData.unit} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary pr-8">
                                        <option value="g">g</option>
                                        <option value="kg">kg</option>
                                        <option value="ml">ml</option>
                                        <option value="l">l</option>
                                        <option value="un">un</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};