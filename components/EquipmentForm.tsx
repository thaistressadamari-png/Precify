import React, { useState, useEffect } from 'react';
import type { Equipment } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { safeParseFloat } from './utils';

interface EquipmentFormProps {
  onSave: (equipment: Equipment) => void;
  onCancel: () => void;
  equipmentToEdit?: Equipment | null;
}

const emptyEquipmentData: Omit<Equipment, 'id'> = {
  name: '',
  price: 0,
  quantity: 1,
  supplier: '',
  purchaseDate: new Date().toISOString().split('T')[0],
  notes: '',
};

export const EquipmentForm: React.FC<EquipmentFormProps> = ({ onSave, onCancel, equipmentToEdit }) => {
  const [equipment, setEquipment] = useState(emptyEquipmentData);

  useEffect(() => {
    if (equipmentToEdit) {
      setEquipment({
        name: equipmentToEdit.name,
        price: equipmentToEdit.price,
        quantity: equipmentToEdit.quantity || 1,
        supplier: equipmentToEdit.supplier || '',
        purchaseDate: equipmentToEdit.purchaseDate || new Date().toISOString().split('T')[0],
        notes: equipmentToEdit.notes || '',
      });
    } else {
      setEquipment({
        ...emptyEquipmentData,
        purchaseDate: new Date().toISOString().split('T')[0],
      });
    }
  }, [equipmentToEdit]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const isNumber = ['price', 'quantity'].includes(name);
    setEquipment((prev) => ({
      ...prev,
      [name]: isNumber ? (name === 'quantity' ? Math.max(1, parseInt(value) || 1) : safeParseFloat(value)) : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipment.name.trim() || equipment.price <= 0) {
      alert('Por favor, preencha o nome do equipamento e o valor pago.');
      return;
    }

    const equipmentToSave: Equipment = {
      id: equipmentToEdit?.id || `equip-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: equipment.name.trim(),
      price: equipment.price,
      quantity: equipment.quantity || 1,
      supplier: equipment.supplier?.trim() || undefined,
      purchaseDate: equipment.purchaseDate || undefined,
      notes: equipment.notes?.trim() || undefined,
    };
    onSave(equipmentToSave);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <form onSubmit={handleSubmit}>
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl text-brand-text dark:text-rose-100">
              {equipmentToEdit ? 'Editar Equipamento' : 'Novo Equipamento'}
            </h1>
            <p className="text-sm text-brand-light-text dark:text-gray-400 mt-1">
              Registre formas, utensílios, assadeiras, bicos e eletros adquiridos para seu ateliê.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2.5 px-4 rounded-xl shadow-sm transition-transform transform hover:scale-105"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center justify-center gap-2 bg-brand-primary hover:bg-rose-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-md transition-transform transform hover:scale-105"
            >
              <PlusIcon className="w-5 h-5" />
              <span>{equipmentToEdit ? 'Salvar Alterações' : 'Salvar Equipamento'}</span>
            </button>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 sm:p-8 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Nome do Equipamento */}
            <div className="md:col-span-2">
              <label htmlFor="name" className="block text-sm font-semibold text-brand-light-text dark:text-gray-300 mb-1">
                Nome do Equipamento / Utensílio *
              </label>
              <input
                type="text"
                name="name"
                id="name"
                value={equipment.name}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-700 dark:text-gray-100 border border-rose-200 dark:border-gray-600 rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary text-sm"
                placeholder="Ex: Forma Redonda 20x10cm, Espátula Inox, Batedeira..."
                required
              />
            </div>

            {/* Preço Pago */}
            <div>
              <label htmlFor="price" className="block text-sm font-semibold text-brand-light-text dark:text-gray-300 mb-1">
                Valor Pago (R$) *
              </label>
              <input
                type="number"
                name="price"
                id="price"
                value={equipment.price || ''}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-700 dark:text-gray-100 border border-rose-200 dark:border-gray-600 rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary text-sm"
                placeholder="35,90"
                step="0.01"
                min="0"
                required
              />
            </div>

            {/* Quantidade */}
            <div>
              <label htmlFor="quantity" className="block text-sm font-semibold text-brand-light-text dark:text-gray-300 mb-1">
                Quantidade
              </label>
              <input
                type="number"
                name="quantity"
                id="quantity"
                value={equipment.quantity || 1}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-700 dark:text-gray-100 border border-rose-200 dark:border-gray-600 rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary text-sm"
                placeholder="1"
                min="1"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Fornecedor / Loja */}
            <div>
              <label htmlFor="supplier" className="block text-sm font-semibold text-brand-light-text dark:text-gray-300 mb-1">
                Fornecedor / Loja onde comprou
              </label>
              <input
                type="text"
                name="supplier"
                id="supplier"
                value={equipment.supplier || ''}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-700 dark:text-gray-100 border border-rose-200 dark:border-gray-600 rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary text-sm"
                placeholder="Ex: Mercado Livre, Loja Santo Antonio, Atacadão..."
              />
            </div>

            {/* Data da Compra */}
            <div>
              <label htmlFor="purchaseDate" className="block text-sm font-semibold text-brand-light-text dark:text-gray-300 mb-1">
                Data da Compra
              </label>
              <input
                type="date"
                name="purchaseDate"
                id="purchaseDate"
                value={equipment.purchaseDate || ''}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-700 dark:text-gray-100 border border-rose-200 dark:border-gray-600 rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary text-sm"
              />
            </div>
          </div>

          {/* Observações / Dimensões / Detalhes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-semibold text-brand-light-text dark:text-gray-300 mb-1">
              Observações / Detalhes (Opcional)
            </label>
            <textarea
              name="notes"
              id="notes"
              rows={3}
              value={equipment.notes || ''}
              onChange={handleInputChange}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-700 dark:text-gray-100 border border-rose-200 dark:border-gray-600 rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary text-sm"
              placeholder="Ex: Alumínio reforçado, voltagem 110V, 30cm diâmetro..."
            />
          </div>
        </div>
      </form>
    </div>
  );
};
