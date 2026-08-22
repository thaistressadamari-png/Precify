import React, { useState, useMemo, useRef } from 'react';
import type { Equipment } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { PencilIcon } from './icons/PencilIcon';
import { TrashIcon } from './icons/TrashIcon';
import { SearchIcon } from './icons/SearchIcon';
import { ConfirmModal } from './ConfirmModal';
import { formatCurrency } from './utils';
import { ArrowDownTrayIcon } from './icons/ArrowDownTrayIcon';
import { ArrowUpTrayIcon } from './icons/ArrowUpTrayIcon';
import { DocumentDuplicateIcon } from './icons/DocumentDuplicateIcon';
import { EquipmentIcon } from './icons/EquipmentIcon';

interface EquipmentManagerProps {
  equipment: Equipment[];
  onAddNew: () => void;
  onEdit: (equipment: Equipment) => void;
  onDelete: (equipmentId: string) => void;
  onImport: (newEquipment: Equipment[]) => void;
  onDuplicate: (equipment: Equipment) => void;
}

export const EquipmentManager: React.FC<EquipmentManagerProps> = ({
  equipment,
  onAddNew,
  onEdit,
  onDelete,
  onImport,
  onDuplicate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [equipmentIdToDelete, setEquipmentIdToDelete] = useState<string | null>(null);
  const [dataToImport, setDataToImport] = useState<Equipment[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerDelete = (id: string) => {
    setEquipmentIdToDelete(id);
  };

  const confirmDelete = () => {
    if (equipmentIdToDelete) {
      onDelete(equipmentIdToDelete);
      setEquipmentIdToDelete(null);
    }
  };

  const filteredEquipment = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return equipment.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        (item.supplier && item.supplier.toLowerCase().includes(term)) ||
        (item.notes && item.notes.toLowerCase().includes(term))
    );
  }, [equipment, searchTerm]);

  const equipmentToDelete = useMemo(() => {
    if (!equipmentIdToDelete) return null;
    return equipment.find((i) => i.id === equipmentIdToDelete);
  }, [equipmentIdToDelete, equipment]);

  // Statistics
  const totalInvestment = useMemo(() => {
    return equipment.reduce((sum, item) => sum + (item.price || 0), 0);
  }, [equipment]);

  const totalUnits = useMemo(() => {
    return equipment.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }, [equipment]);

  const handleExport = () => {
    const dataStr = JSON.stringify(equipment, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'precify_equipamentos.json';
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
        if (typeof text !== 'string') throw new Error('Conteúdo do arquivo inválido.');
        const parsedData = JSON.parse(text);

        if (
          !Array.isArray(parsedData) ||
          (parsedData.length > 0 && (!parsedData[0].id || !parsedData[0].name || parsedData[0].price === undefined))
        ) {
          throw new Error('Formato de arquivo inválido para equipamentos.');
        }

        setDataToImport(parsedData as Equipment[]);
      } catch (error) {
        alert(`Erro ao importar arquivo: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.onerror = () => {
      alert('Erro ao ler o arquivo.');
      if (event.target) event.target.value = '';
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (dataToImport) {
      onImport(dataToImport);
      setDataToImport(null);
    }
  };

  return (
    <>
      <div className="space-y-6 sm:space-y-8 animate-fade-in">
        {/* Header com Ações */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl sm:text-4xl text-brand-text dark:text-rose-100 font-bold">
                Equipamentos & Utensílios
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-900/40 text-brand-primary dark:text-rose-200">
                {equipment.length} {equipment.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
            <p className="text-sm text-brand-light-text dark:text-gray-400 mt-1">
              Controle de compras de formas, assadeiras, bicos, batedeiras e ferramentas de confeitaria.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleImportClick}
              className="flex items-center justify-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3.5 rounded-xl shadow-sm transition-transform transform hover:scale-105 text-xs sm:text-sm"
              title="Importar equipamentos de arquivo JSON"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span>Importar</span>
            </button>
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3.5 rounded-xl shadow-sm transition-transform transform hover:scale-105 text-xs sm:text-sm"
              title="Exportar equipamentos para JSON"
            >
              <ArrowUpTrayIcon className="w-4 h-4" />
              <span>Exportar</span>
            </button>
            <button
              onClick={onAddNew}
              className="flex items-center justify-center gap-2 bg-brand-primary hover:bg-rose-700 text-white font-bold py-2.5 px-4 sm:px-5 rounded-xl shadow-md transition-transform transform hover:scale-105 text-xs sm:text-sm"
            >
              <PlusIcon className="w-5 h-5" />
              <span>Novo Equipamento</span>
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-4 sm:p-5 rounded-2xl shadow-sm border border-rose-100 dark:border-gray-700 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-light-text dark:text-gray-400">
                Total Investido
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-brand-primary dark:text-rose-300 mt-1">
                {formatCurrency(totalInvestment)}
              </p>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-gray-700 text-brand-primary rounded-xl">
              <EquipmentIcon className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-4 sm:p-5 rounded-2xl shadow-sm border border-rose-100 dark:border-gray-700 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-light-text dark:text-gray-400">
                Total de Modelos
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-brand-text dark:text-white mt-1">
                {equipment.length}
              </p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-500 rounded-xl">
              <span className="text-lg font-bold">#</span>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-4 sm:p-5 rounded-2xl shadow-sm border border-rose-100 dark:border-gray-700 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-light-text dark:text-gray-400">
                Total de Peças
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-brand-text dark:text-white mt-1">
                {totalUnits} un
              </p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 rounded-xl">
              <span className="text-lg font-bold">✓</span>
            </div>
          </div>
        </div>

        {/* Lista de Equipamentos */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-4 sm:p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
          <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-brand-text dark:text-rose-100">
              Itens Cadastrados
            </h2>
            <div className="relative w-full sm:w-72">
              <input
                type="search"
                placeholder="Buscar por forma, batedeira, loja..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full text-xs sm:text-sm border border-rose-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary outline-none"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          {filteredEquipment.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEquipment.map((item) => {
                const unitPrice = (item.quantity && item.quantity > 1) ? (item.price / item.quantity) : item.price;

                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-gray-750 p-4 rounded-xl border border-rose-100 dark:border-gray-600 shadow-xs hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm sm:text-base text-brand-text dark:text-white truncate" title={item.name}>
                            {item.name}
                          </h3>
                          <p className="text-xs text-brand-light-text dark:text-gray-400 mt-0.5">
                            Qtd: <strong className="text-brand-text dark:text-gray-200">{item.quantity || 1} un</strong>
                            {item.quantity && item.quantity > 1 && (
                              <span className="ml-1 text-[11px] text-gray-400">
                                ({formatCurrency(unitPrice)}/un)
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="text-base font-bold text-brand-primary dark:text-rose-300">
                            {formatCurrency(item.price)}
                          </span>
                        </div>
                      </div>

                      {/* Informações complementares */}
                      <div className="mt-3 pt-3 border-t border-rose-50 dark:border-gray-700 space-y-1 text-xs">
                        {item.supplier && (
                          <p className="text-brand-light-text dark:text-gray-400 truncate">
                            <span className="font-semibold text-gray-600 dark:text-gray-300">Loja:</span> {item.supplier}
                          </p>
                        )}
                        {item.purchaseDate && (
                          <p className="text-brand-light-text dark:text-gray-400">
                            <span className="font-semibold text-gray-600 dark:text-gray-300">Comprado em:</span> {item.purchaseDate.split('-').reverse().join('/')}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 italic line-clamp-2 mt-1 bg-rose-50/50 dark:bg-gray-700/50 p-1.5 rounded-lg">
                            "{item.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="mt-4 pt-3 border-t border-rose-100 dark:border-gray-700 flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onDuplicate(item)}
                        title="Duplicar Equipamento"
                        className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-gray-700 transition"
                      >
                        <DocumentDuplicateIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        title="Editar Equipamento"
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerDelete(item.id)}
                        title="Excluir Equipamento"
                        className="text-rose-500 hover:text-red-700 dark:text-rose-400 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-gray-700 transition"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 px-4 border-2 border-dashed border-rose-200 dark:border-gray-700 rounded-2xl">
              <div className="mx-auto w-12 h-12 bg-rose-100 dark:bg-gray-700 text-brand-primary rounded-2xl flex items-center justify-center mb-3">
                <EquipmentIcon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-brand-text dark:text-white">
                {searchTerm ? 'Nenhum equipamento encontrado' : 'Nenhum equipamento cadastrado ainda'}
              </h3>
              <p className="text-xs sm:text-sm text-brand-light-text dark:text-gray-400 mt-1 max-w-md mx-auto">
                {searchTerm
                  ? 'Tente buscar com outros termos.'
                  : 'Cadastre suas formas, batedeiras, espátulas e utensílios para manter o controle dos investimentos da sua confeitaria.'}
              </p>
              {!searchTerm && (
                <button
                  type="button"
                  onClick={onAddNew}
                  className="mt-4 px-4 py-2 bg-brand-primary hover:bg-rose-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition transform hover:scale-105"
                >
                  + Cadastrar Primeiro Equipamento
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hidden File Input for Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmModal
        isOpen={!!equipmentIdToDelete}
        onClose={() => setEquipmentIdToDelete(null)}
        onConfirm={confirmDelete}
        title="Excluir Equipamento"
        message={`Tem certeza que deseja excluir "${equipmentToDelete?.name}"? Esta ação não pode ser desfeita.`}
      />

      {/* Modal de Confirmação de Importação */}
      {dataToImport && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setDataToImport(null)}
          onConfirm={confirmImport}
          title="Importar Equipamentos"
          message={`Foram encontrados ${dataToImport.length} equipamento(s) no arquivo. Deseja substituir os atuais?`}
        />
      )}
    </>
  );
};
