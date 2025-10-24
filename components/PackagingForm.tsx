
import React, { useState, useEffect } from 'react';
import type { Packaging } from '../types';
import { PlusIcon } from './icons/PlusIcon';

interface PackagingFormProps {
    onSave: (packaging: Packaging) => void;
    onCancel: () => void;
    packagingToEdit?: Packaging | null;
}

const emptyPackagingData: Omit<Packaging, 'id'> = {
  name: '',
  price: 0,
  amount: 0,
  unit: 'un'
};

export const PackagingForm: React.FC<PackagingFormProps> = ({ onSave, onCancel, packagingToEdit }) => {
    const [packaging, setPackaging] = useState(emptyPackagingData);
    
    useEffect(() => {
        if (packagingToEdit) {
            setPackaging({
                name: packagingToEdit.name,
                price: packagingToEdit.price,
                amount: packagingToEdit.amount,
                unit: packagingToEdit.unit,
            });
        } else {
            setPackaging(emptyPackagingData);
        }
    }, [packagingToEdit]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isNumber = ['price', 'amount'].includes(name);
        setPackaging(prev => ({ ...prev, [name]: isNumber ? parseFloat(value) || 0 : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!packaging.name || packaging.price <= 0 || packaging.amount <= 0) {
            alert("Por favor, preencha nome, preço e quantidade corretamente.");
            return;
        }

        const packagingToSave: Packaging = {
            id: packagingToEdit?.id || new Date().toISOString() + Math.random(),
            ...packaging,
        };
        onSave(packagingToSave);
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <form onSubmit={handleSubmit}>
                <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
                    <h1 className="font-display text-4xl text-brand-text dark:text-rose-100">
                        {packagingToEdit ? 'Editar Embalagem' : 'Nova Embalagem'}
                    </h1>
                    <div className="flex gap-2">
                        <button type="button" onClick={onCancel} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
                            Cancelar
                        </button>
                        <button type="submit" className="flex items-center justify-center gap-2 bg-brand-primary hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
                            <PlusIcon className="w-5 h-5" />
                            <span>{packagingToEdit ? 'Salvar Alterações' : 'Salvar Embalagem'}</span>
                        </button>
                    </div>
                </div>

                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                         <div className="lg:col-span-2">
                            <label htmlFor="name" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Nome da Embalagem</label>
                            <input type="text" name="name" id="name" value={packaging.name} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary" placeholder="Caixa para Bolo" required />
                        </div>
                        <div>
                            <label htmlFor="price" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Preço (R$)</label>
                            <input type="number" name="price" id="price" value={packaging.price || ''} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary" placeholder="25,00" step="0.01" min="0" required />
                        </div>
                        <div className="flex items-end gap-2">
                            <div className="flex-grow">
                            <label htmlFor="amount" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Qtd.</label>
                            <input type="number" name="amount" id="amount" value={packaging.amount || ''} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary" placeholder="10" min="0" required />
                            </div>
                            <div>
                            <label htmlFor="unit" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Unid.</label>
                            <select name="unit" id="unit" value={packaging.unit} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary pr-8">
                                <option value="un">un</option>
                                <option value="pacote">pacote</option>
                                <option value="rolo">rolo</option>
                                <option value="m">m</option>
                            </select>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};
