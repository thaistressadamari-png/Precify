import React, { useState, useEffect } from 'react';
import type { Ingredient, Purchase, Unit } from '../types';
import { PlusIcon } from './icons/PlusIcon';

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
}

export const IngredientForm: React.FC<IngredientFormProps> = ({ onSave, onCancel, ingredientToEdit }) => {
    const [formData, setFormData] = useState<IngredientFormData>({
        name: '',
        ...emptyPurchaseData
    });
    
    useEffect(() => {
        if (ingredientToEdit) {
            setFormData({
                name: ingredientToEdit.name,
                supplier: '', // Reset for new purchase
                packagePrice: '', // Reset for new purchase
                packageAmount: '', // Reset for new purchase
                unit: ingredientToEdit.unit, // Default to last unit
                purchaseDate: getTodaysDateString(),
            });
        } else {
            setFormData({ name: '', ...emptyPurchaseData });
        }
    }, [ingredientToEdit]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if ((name === 'packagePrice' || name === 'packageAmount') && value) {
            if (!/^\d*([.,]\d*)?$/.test(value)) {
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

        const newPurchase: Purchase = {
            id: new Date().toISOString() + Math.random(),
            date: formData.purchaseDate,
            supplier: formData.supplier,
            packagePrice: packagePrice,
            packageAmount: packageAmount,
            unit: formData.unit,
        };

        if (ingredientToEdit) {
             const updatedHistory = [...ingredientToEdit.history, newPurchase]
                .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            const latestPurchase = updatedHistory[0];

            const ingredientToSave: Ingredient = {
                ...ingredientToEdit,
                // Name is not editable when adding a new purchase
                // Update top-level props to reflect the latest purchase
                supplier: latestPurchase.supplier,
                packagePrice: latestPurchase.packagePrice,
                packageAmount: latestPurchase.packageAmount,
                unit: latestPurchase.unit,
                purchaseDate: latestPurchase.date,
                history: updatedHistory,
            };
            onSave(ingredientToSave);

        } else {
            const ingredientToSave: Ingredient = {
                id: new Date().toISOString() + Math.random(),
                name: formData.name,
                supplier: newPurchase.supplier,
                packagePrice: newPurchase.packagePrice,
                packageAmount: newPurchase.packageAmount,
                unit: newPurchase.unit,
                purchaseDate: newPurchase.date,
                history: [newPurchase],
            };
            onSave(ingredientToSave);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <form onSubmit={handleSubmit}>
                <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
                    <h1 className="font-display text-4xl text-brand-text dark:text-rose-100">
                        {ingredientToEdit ? 'Registrar Nova Compra' : 'Novo Ingrediente'}
                    </h1>
                    <div className="flex gap-2">
                        <button type="button" onClick={onCancel} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
                            Cancelar
                        </button>
                        <button type="submit" className="flex items-center justify-center gap-2 bg-brand-primary hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
                            <PlusIcon className="w-5 h-5" />
                            <span>{ingredientToEdit ? 'Salvar Compra' : 'Salvar Ingrediente'}</span>
                        </button>
                    </div>
                </div>

                {ingredientToEdit && (
                  <div className="bg-rose-50 dark:bg-gray-700/50 p-4 rounded-lg mb-6 border border-rose-200 dark:border-gray-600">
                    <p className="text-brand-text dark:text-gray-200">
                      Você está adicionando uma nova compra para o ingrediente: <strong className="font-semibold">{ingredientToEdit.name}</strong>.
                    </p>
                    <p className="text-sm text-brand-light-text dark:text-gray-400">
                      Preencha os detalhes da nova aquisição abaixo.
                    </p>
                  </div>
                )}


                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="lg:col-span-2">
                            <label htmlFor="name" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Nome do Ingrediente</label>
                            <input type="text" name="name" id="name" value={formData.name} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary disabled:bg-gray-100 dark:disabled:bg-gray-600" placeholder="Farinha de Trigo" required disabled={!!ingredientToEdit} />
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