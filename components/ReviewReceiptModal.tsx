import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Ingredient, Packaging, Equipment, InvoiceReceipt, InvoicePurchaseItem, Unit, PackagingUnit } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { LinkIcon } from './icons/LinkIcon';
import { SearchIcon } from './icons/SearchIcon';
import { CameraIcon } from './icons/CameraIcon';
import { ArrowUpTrayIcon } from './icons/ArrowUpTrayIcon';
import { formatCurrency, safeParseFloat } from './utils';
import { findBestMatch, parseReceiptImageWithGemini, parseNfceTextContent, compressImageForOcr } from '../services/receiptScanner';

interface ReviewReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialReceipt: Partial<InvoiceReceipt> & { warning?: string; isCaptchaRequired?: boolean };
  existingIngredients: Ingredient[];
  existingPackaging: Packaging[];
  existingEquipment?: Equipment[];
  onConfirm: (
    receipt: InvoiceReceipt,
    newIngredients: Ingredient[],
    updatedIngredients: Ingredient[],
    newPackaging: Packaging[],
    updatedPackaging: Packaging[],
    newEquipment?: Equipment[],
    updatedEquipment?: Equipment[]
  ) => void;
}

// Helper Combobox component for interactive search & selection when linking existing products
interface LinkItemComboboxProps {
  item: InvoicePurchaseItem;
  existingIngredients: Ingredient[];
  existingPackaging: Packaging[];
  existingEquipment: Equipment[];
  onSelect: (targetId: string, name: string, unit?: string, packageAmount?: number) => void;
}

const LinkItemCombobox: React.FC<LinkItemComboboxProps> = ({
  item,
  existingIngredients,
  existingPackaging,
  existingEquipment,
  onSelect
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const category = item.category || 'ingredient';

  const options = React.useMemo(() => {
    if (category === 'ingredient') {
      return existingIngredients.map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        amount: i.packageAmount,
        price: i.packagePrice
      }));
    }
    if (category === 'packaging') {
      return existingPackaging.map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        amount: p.amount,
        price: p.price
      }));
    }
    if (category === 'equipment') {
      return existingEquipment.map((e) => ({
        id: e.id,
        name: e.name,
        unit: 'un',
        amount: e.quantity || 1,
        price: e.price
      }));
    }
    return [];
  }, [category, existingIngredients, existingPackaging, existingEquipment]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.name.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 320 });

  const updateCoords = React.useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 320)
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
      return () => {
        window.removeEventListener('scroll', updateCoords, true);
        window.removeEventListener('resize', updateCoords);
      };
    }
  }, [isOpen, updateCoords]);

  const selectedOpt = options.find((o) => o.id === item.existingTargetId);

  const dropdownPortal = isOpen ? createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: `${coords.width}px`,
        maxHeight: '260px'
      }}
      className="z-[999999] bg-white dark:bg-gray-800 border-2 border-blue-400 dark:border-blue-600 rounded-2xl shadow-2xl overflow-hidden overflow-y-auto p-1.5 animate-fade-in"
    >
      <div className="px-3 py-1.5 text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider border-b border-blue-100 dark:border-gray-700 mb-1 flex items-center justify-between bg-blue-50/80 dark:bg-gray-900/50 rounded-lg">
        <span>Produtos Cadastrados ({filtered.length})</span>
        {query && <span className="text-[9px] text-gray-500 font-normal">Filtro: "{query}"</span>}
      </div>

      {filtered.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-gray-500 dark:text-gray-400 font-medium">
          Nenhum produto cadastrado com "{query}"
        </div>
      ) : (
        filtered.map((opt) => {
          const isSelected = opt.id === item.existingTargetId;
          return (
            <button
              type="button"
              key={opt.id}
              onClick={() => {
                onSelect(opt.id, opt.name, opt.unit, opt.amount);
                setIsOpen(false);
                setQuery('');
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition cursor-pointer my-0.5 ${
                isSelected
                  ? 'bg-blue-100 dark:bg-blue-900/80 font-bold text-blue-950 dark:text-blue-100'
                  : 'hover:bg-blue-50 dark:hover:bg-gray-700/80 text-gray-800 dark:text-gray-100'
              }`}
            >
              <div className="truncate font-semibold flex-1">
                {opt.name}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-gray-700 border border-blue-300 dark:border-gray-600 text-blue-900 dark:text-blue-200">
                  {opt.amount} {opt.unit}
                </span>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(opt.price)}
                </span>
                {isSelected && (
                  <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
            </button>
          );
        })
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <SearchIcon className="w-3.5 h-3.5 text-blue-500 absolute left-2.5 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? query : (selectedOpt ? selectedOpt.name : item.targetName || '')}
          onFocus={() => {
            updateCoords();
            setIsOpen(true);
            setQuery('');
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            updateCoords();
            if (!isOpen) setIsOpen(true);
          }}
          placeholder="Pesquisar produto pelo nome..."
          className="w-full h-8 pl-8 pr-7 text-xs bg-white dark:bg-gray-700 border border-blue-300 dark:border-blue-600 rounded-lg font-medium text-blue-950 dark:text-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none truncate shadow-xs cursor-pointer"
        />
        {item.existingTargetId ? (
          <button
            type="button"
            onClick={() => {
              updateCoords();
              setQuery('');
              setIsOpen(!isOpen);
            }}
            title="Escolher outro produto"
            className="absolute right-2 p-0.5 text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 rounded cursor-pointer"
          >
            <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
          </button>
        ) : (
          <div className="absolute right-2 pointer-events-none text-gray-400 text-[10px]">
            ▼
          </div>
        )}
      </div>

      {dropdownPortal}
    </div>
  );
};

export const ReviewReceiptModal: React.FC<ReviewReceiptModalProps> = ({
  isOpen,
  onClose,
  initialReceipt,
  existingIngredients,
  existingPackaging,
  existingEquipment = [],
  onConfirm
}) => {
  const [supplier, setSupplier] = useState<string>(initialReceipt.supplier || 'Supermercado / Loja');
  const [date, setDate] = useState<string>(initialReceipt.date || new Date().toISOString().substring(0, 10));
  const [accessKey, setAccessKey] = useState<string>(initialReceipt.accessKey || '');
  const [cnpj, setCnpj] = useState<string>(initialReceipt.cnpj || '');
  const [notes, setNotes] = useState<string>(initialReceipt.notes || '');

  // Lock body scroll when modal is active
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Helper map item specs
  const mapInitialItem = (item: any, index: number): InvoicePurchaseItem => {
    let isLinkExisting = false;
    let existingTargetId: string | undefined = undefined;
    let targetName = item.targetName || item.rawName;
    let category = item.category || 'ingredient';

    let matchedUnit: string | undefined;
    let matchedAmount: number | undefined;

    if (category === 'equipment') {
      const equipMatch = existingEquipment.find(
        (e) => e.name.toLowerCase().trim() === item.rawName.toLowerCase().trim()
      );
      if (equipMatch) {
        isLinkExisting = true;
        existingTargetId = equipMatch.id;
        targetName = equipMatch.name;
        matchedUnit = 'un';
        matchedAmount = equipMatch.quantity || 1;
      }
    } else if (category === 'packaging') {
      const bestMatch = findBestMatch(item.rawName, 'packaging', existingIngredients, existingPackaging);
      if (bestMatch) {
        const pkgObj = existingPackaging.find((p) => p.id === bestMatch.id);
        isLinkExisting = true;
        existingTargetId = bestMatch.id;
        targetName = bestMatch.name;
        if (pkgObj) {
          matchedUnit = pkgObj.unit;
          matchedAmount = pkgObj.amount;
        }
      }
    } else {
      const bestMatch = findBestMatch(item.rawName, 'ingredient', existingIngredients, existingPackaging);
      if (bestMatch) {
        const ingObj = existingIngredients.find((i) => i.id === bestMatch.id);
        isLinkExisting = true;
        existingTargetId = bestMatch.id;
        targetName = bestMatch.name;
        if (ingObj) {
          matchedUnit = ingObj.unit;
          matchedAmount = ingObj.packageAmount;
        }
      }
    }

    const targetUnit = (
      matchedUnit ||
      item.targetUnit ||
      item.suggestedUnit ||
      (category === 'packaging' || category === 'equipment' ? 'un' : 'un')
    ) as Unit | PackagingUnit | 'un';

    const packageAmount =
      matchedAmount ||
      item.packageAmount ||
      item.suggestedPackageAmount ||
      (category === 'equipment' ? (item.quantity || 1) : 1);

    return {
      id: item.id || `item-${Date.now()}-${index}`,
      rawName: item.rawName,
      code: item.code || '',
      quantity: item.quantity || 1,
      unit: item.unit || 'UN',
      unitPrice: item.unitPrice || item.packagePrice || 0,
      totalPrice: item.totalPrice || item.packagePrice || 0,
      category: category,
      linkType: isLinkExisting ? 'existing' : 'new',
      existingTargetId: existingTargetId,
      targetName: targetName,
      packageAmount: packageAmount,
      targetUnit: targetUnit,
      packagePrice: item.packagePrice || item.totalPrice || item.unitPrice || 0
    };
  };

  // Initialize review items
  const [items, setItems] = useState<InvoicePurchaseItem[]>(() => {
    const rawItems = initialReceipt.items || [];
    return rawItems.map((item, index) => mapInitialItem(item, index));
  });

  if (!isOpen) return null;

  // Filter state for searching existing items per item card
  const [searchFilter, setSearchFilter] = useState<{ [itemId: string]: string }>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedText, setPastedText] = useState('');

  const handleImageFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingOcr(true);
    setOcrError('');
    try {
      const compressedBase64 = await compressImageForOcr(file);
      const parsed = await parseReceiptImageWithGemini(compressedBase64);
      if (parsed && parsed.items && parsed.items.length > 0) {
        const newMappedItems = parsed.items.map((item, index) => mapInitialItem(item, index));

        setItems(newMappedItems);
        if (parsed.supplier) setSupplier(parsed.supplier);
        if (parsed.cnpj) setCnpj(parsed.cnpj);
        if (parsed.date) setDate(parsed.date);
      } else {
        setOcrError('Não foi possível identificar os produtos na foto. Tente enviar uma foto mais nítida do cupom.');
      }
    } catch (err: any) {
      console.error('Erro no OCR em modal:', err);
      setOcrError('Falha ao processar foto com IA: ' + (err.message || 'Tente novamente'));
    } finally {
      setIsProcessingOcr(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleProcessPastedText = async () => {
    if (!pastedText.trim()) return;
    setIsProcessingOcr(true);
    setOcrError('');
    setShowPasteModal(false);

    try {
      let parsed = parseNfceTextContent(pastedText);

      // Fallback to Gemini AI if local regex didn't extract items
      if (!parsed || !parsed.items || parsed.items.length === 0) {
        try {
          const res = await fetch('/api/parse-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ textContent: pastedText })
          });
          if (res.ok) {
            parsed = await res.json();
          }
        } catch (aiErr) {
          console.warn('Fallback AI em texto falhou:', aiErr);
        }
      }

      if (parsed && parsed.items && parsed.items.length > 0) {
        const newMappedItems = parsed.items.map((item, index) => mapInitialItem(item, index));

        setItems(newMappedItems);
        if (parsed.supplier && parsed.supplier !== 'Fornecedor / NFC-e') setSupplier(parsed.supplier);
        if (parsed.cnpj) setCnpj(parsed.cnpj);
        if (parsed.date) setDate(parsed.date);
        setPastedText('');
      } else {
        setOcrError('Não foi possível identificar produtos no texto colado. Tente enviar uma foto do cupom.');
      }
    } catch (err: any) {
      setOcrError('Erro ao processar texto: ' + (err.message || 'Tente novamente'));
    } finally {
      setIsProcessingOcr(false);
    }
  };

  const handleItemChange = (id: string, updates: Partial<InvoicePurchaseItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, ...updates };

        // If category changes, reset or re-evaluate link
        if (updates.category && updates.category !== item.category) {
          if (updated.category === 'packaging') {
            updated.targetUnit = 'un';
            const match = findBestMatch(updated.rawName, 'packaging', existingIngredients, existingPackaging);
            if (match) {
              updated.linkType = 'existing';
              updated.existingTargetId = match.id;
              updated.targetName = match.name;
            } else {
              updated.linkType = 'new';
              updated.existingTargetId = undefined;
            }
          } else if (updated.category === 'equipment') {
            updated.targetUnit = 'un';
            updated.packageAmount = item.quantity || 1;
            const equipMatch = existingEquipment.find(
              (e) => e.name.toLowerCase().trim() === updated.rawName.toLowerCase().trim()
            );
            if (equipMatch) {
              updated.linkType = 'existing';
              updated.existingTargetId = equipMatch.id;
              updated.targetName = equipMatch.name;
            } else {
              updated.linkType = 'new';
              updated.existingTargetId = undefined;
            }
          } else if (updated.category === 'ingredient') {
            updated.targetUnit = 'g';
            const match = findBestMatch(updated.rawName, 'ingredient', existingIngredients, existingPackaging);
            if (match) {
              updated.linkType = 'existing';
              updated.existingTargetId = match.id;
              updated.targetName = match.name;
            } else {
              updated.linkType = 'new';
              updated.existingTargetId = undefined;
            }
          }
        }

        // If existingTargetId changes, update targetName and unit
        if (updates.existingTargetId) {
          if (updated.category === 'ingredient') {
            const found = existingIngredients.find((i) => i.id === updates.existingTargetId);
            if (found) {
              updated.targetName = found.name;
              updated.targetUnit = found.unit;
              if (!updates.packageAmount) {
                updated.packageAmount = found.packageAmount;
              }
            }
          } else if (updated.category === 'packaging') {
            const found = existingPackaging.find((p) => p.id === updates.existingTargetId);
            if (found) {
              updated.targetName = found.name;
              updated.targetUnit = found.unit;
              if (!updates.packageAmount) {
                updated.packageAmount = found.amount;
              }
            }
          } else if (updated.category === 'equipment') {
            const found = existingEquipment.find((e) => e.id === updates.existingTargetId);
            if (found) {
              updated.targetName = found.name;
              updated.targetUnit = 'un';
              if (!updates.packageAmount) {
                updated.packageAmount = found.quantity || 1;
              }
            }
          }
        }

        return updated;
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddNewManualItem = () => {
    const newItem: InvoicePurchaseItem = {
      id: `manual-${Date.now()}`,
      rawName: 'Novo Item',
      quantity: 1,
      unit: 'UN',
      unitPrice: 0,
      totalPrice: 0,
      category: 'ingredient',
      linkType: 'new',
      targetName: 'Novo Ingrediente',
      packageAmount: 1000,
      targetUnit: 'g',
      packagePrice: 0
    };
    setItems((prev) => [...prev, newItem]);
  };

  const calculateTotalReceipt = items
    .filter((i) => i.category !== 'ignore')
    .reduce((sum, item) => sum + (item.totalPrice > 0 ? item.totalPrice : item.packagePrice), 0);

  const newIngredientsCount = items.filter((i) => i.category === 'ingredient' && i.linkType === 'new').length;
  const linkedIngredientsCount = items.filter((i) => i.category === 'ingredient' && i.linkType === 'existing').length;
  const newPackagingCount = items.filter((i) => i.category === 'packaging' && i.linkType === 'new').length;
  const linkedPackagingCount = items.filter((i) => i.category === 'packaging' && i.linkType === 'existing').length;
  const newEquipmentCount = items.filter((i) => i.category === 'equipment' && i.linkType === 'new').length;
  const linkedEquipmentCount = items.filter((i) => i.category === 'equipment' && i.linkType === 'existing').length;

  const handleConfirmAll = () => {
    const validItems = items.filter((i) => i.category !== 'ignore');

    if (validItems.length === 0) {
      alert('Nenhum item válido para importar.');
      return;
    }

    const newIngredients: Ingredient[] = [];
    const updatedIngredients: Ingredient[] = [];
    const newPackaging: Packaging[] = [];
    const updatedPackaging: Packaging[] = [];
    const newEquipment: Equipment[] = [];
    const updatedEquipment: Equipment[] = [];

    // Clone current lists
    const currentIngredientsMap = new Map<string, Ingredient>(existingIngredients.map((i) => [i.id, { ...i }]));
    const currentPackagingMap = new Map<string, Packaging>(existingPackaging.map((p) => [p.id, { ...p }]));
    const currentEquipmentMap = new Map<string, Equipment>(existingEquipment.map((e) => [e.id, { ...e }]));

    validItems.forEach((item) => {
      const packagePrice = item.packagePrice > 0 ? item.packagePrice : item.totalPrice;
      const packageAmount = item.packageAmount > 0 ? item.packageAmount : 1;

      if (item.category === 'ingredient') {
        if (item.linkType === 'existing' && item.existingTargetId && currentIngredientsMap.has(item.existingTargetId)) {
          const ing = currentIngredientsMap.get(item.existingTargetId)!;
          const newPurchase = {
            id: `purch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            date: date,
            supplier: supplier || ing.supplier || '',
            packagePrice: packagePrice,
            packageAmount: packageAmount,
            unit: (item.targetUnit as Unit) || ing.unit
          };
          const updatedHistory = [...(ing.history || []), newPurchase];
          const sortedHistory = updatedHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const latestPurchase = sortedHistory[0];

          const updatedIng: Ingredient = {
            ...ing,
            supplier: latestPurchase.supplier,
            packagePrice: latestPurchase.packagePrice,
            packageAmount: latestPurchase.packageAmount,
            unit: latestPurchase.unit,
            purchaseDate: latestPurchase.date,
            history: sortedHistory
          };
          currentIngredientsMap.set(item.existingTargetId, updatedIng);
          updatedIngredients.push(updatedIng);
        } else {
          // New Ingredient
          const newId = `ing-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const initialPurchase = {
            id: `purch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            date: date,
            supplier: supplier,
            packagePrice: packagePrice,
            packageAmount: packageAmount,
            unit: (item.targetUnit as Unit) || 'g'
          };
          const createdIng: Ingredient = {
            id: newId,
            name: item.targetName || item.rawName,
            supplier: supplier,
            packagePrice: packagePrice,
            packageAmount: packageAmount,
            unit: (item.targetUnit as Unit) || 'g',
            purchaseDate: date,
            history: [initialPurchase]
          };
          currentIngredientsMap.set(newId, createdIng);
          newIngredients.push(createdIng);
        }
      } else if (item.category === 'packaging') {
        if (item.linkType === 'existing' && item.existingTargetId && currentPackagingMap.has(item.existingTargetId)) {
          const pkg = currentPackagingMap.get(item.existingTargetId)!;
          const updatedPkg: Packaging = {
            ...pkg,
            price: packagePrice,
            amount: packageAmount,
            unit: (item.targetUnit as PackagingUnit) || pkg.unit
          };
          currentPackagingMap.set(item.existingTargetId, updatedPkg);
          updatedPackaging.push(updatedPkg);
        } else {
          // New Packaging
          const newId = `pkg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const createdPkg: Packaging = {
            id: newId,
            name: item.targetName || item.rawName,
            price: packagePrice,
            amount: packageAmount,
            unit: (item.targetUnit as PackagingUnit) || 'un'
          };
          currentPackagingMap.set(newId, createdPkg);
          newPackaging.push(createdPkg);
        }
      } else if (item.category === 'equipment') {
        if (item.linkType === 'existing' && item.existingTargetId && currentEquipmentMap.has(item.existingTargetId)) {
          const equip = currentEquipmentMap.get(item.existingTargetId)!;
          const updatedEquip: Equipment = {
            ...equip,
            price: packagePrice,
            quantity: packageAmount,
            supplier: supplier || equip.supplier,
            purchaseDate: date || equip.purchaseDate
          };
          currentEquipmentMap.set(item.existingTargetId, updatedEquip);
          updatedEquipment.push(updatedEquip);
        } else {
          // New Equipment
          const newId = `equip-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const createdEquip: Equipment = {
            id: newId,
            name: item.targetName || item.rawName,
            price: packagePrice,
            quantity: packageAmount,
            supplier: supplier,
            purchaseDate: date
          };
          currentEquipmentMap.set(newId, createdEquip);
          newEquipment.push(createdEquip);
        }
      }
    });

    const finalReceipt: InvoiceReceipt = {
      id: initialReceipt.id || `receipt-${Date.now()}`,
      supplier: supplier || 'Supermercado',
      date: date,
      cnpj: cnpj || '',
      accessKey: accessKey || '',
      nfcNumber: initialReceipt.nfcNumber || '',
      series: initialReceipt.series || '',
      totalAmount: calculateTotalReceipt,
      paymentMethod: initialReceipt.paymentMethod || 'Cupom Fiscal',
      items: validItems.map((it) => ({
        id: it.id,
        rawName: it.rawName || '',
        code: it.code || '',
        quantity: Number(it.quantity) || 1,
        unit: it.unit || 'UN',
        unitPrice: Number(it.unitPrice) || 0,
        totalPrice: Number(it.totalPrice) || 0,
        category: it.category || 'ingredient',
        linkType: it.linkType || 'new',
        existingTargetId: it.existingTargetId || '',
        targetName: it.targetName || it.rawName || '',
        packageAmount: Number(it.packageAmount) || 1,
        targetUnit: it.targetUnit || 'g',
        packagePrice: Number(it.packagePrice) || 0
      })),
      notes: notes || '',
      createdAt: new Date().toISOString()
    };

    onConfirm(finalReceipt, newIngredients, updatedIngredients, newPackaging, updatedPackaging, newEquipment, updatedEquipment);
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-md p-0 sm:p-4 overflow-hidden animate-fade-in">
      <div className="bg-[#FAF3F5] dark:bg-gray-900 rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border border-rose-200/80 dark:border-gray-700 w-full h-full sm:h-[95vh] sm:max-h-[920px] sm:max-w-4xl flex flex-col overflow-hidden">
        
        {/* =========================================================================
            HEADER (Compatível com Dynamic Island / iPhone Safe Area)
           ========================================================================= */}
        <div 
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.625rem)' }}
          className="bg-white dark:bg-gray-800 border-b border-rose-100 dark:border-gray-700 px-3.5 pb-2.5 sm:py-3 sm:px-4 flex items-center justify-between gap-2 flex-shrink-0 shadow-xs"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-brand-primary text-white tracking-wider shadow-2xs">
                Conferência Fiscal
              </span>
              <h2 className="font-display text-xs sm:text-sm font-bold text-brand-text dark:text-rose-100 truncate">
                Revisar Itens do Cupom
              </h2>
            </div>
            {accessKey ? (
              <p className="text-[10px] text-brand-light-text dark:text-gray-400 font-mono truncate mt-0.5">
                NFC-e: {accessKey}
              </p>
            ) : (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 italic mt-0.5">
                Cupom sem chave digital
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-brand-light-text hover:text-brand-text dark:hover:text-rose-100 rounded-lg hover:bg-rose-50 dark:hover:bg-gray-700 transition flex-shrink-0"
            title="Fechar"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* =========================================================================
            SCROLLABLE CONTENT (Metadados + Cards dos Itens + Botão Adicionar Item)
           ========================================================================= */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-3.5 space-y-3 bg-rose-50/50 dark:bg-gray-900/90">
          
          {/* Top Metadata Fields (Fornecedor, Data, CNPJ, Total) */}
          <div className="bg-white dark:bg-gray-800 border border-rose-100 dark:border-gray-700 rounded-xl p-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 shadow-xs">
            {/* Fornecedor */}
            <div className="bg-rose-50/40 dark:bg-gray-750 border border-rose-100/80 dark:border-gray-600 rounded-lg px-2 py-1 flex flex-col justify-center">
              <span className="block text-[9px] uppercase font-bold text-brand-light-text dark:text-gray-400 leading-tight">
                Fornecedor
              </span>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="bg-transparent text-xs font-semibold text-brand-text dark:text-gray-100 outline-none w-full truncate h-5 placeholder:text-gray-400"
                placeholder="Supermercado / Loja..."
              />
            </div>

            {/* Data da Compra */}
            <div className="bg-rose-50/40 dark:bg-gray-750 border border-rose-100/80 dark:border-gray-600 rounded-lg px-2 py-1 flex flex-col justify-center">
              <span className="block text-[9px] uppercase font-bold text-brand-light-text dark:text-gray-400 leading-tight">
                Data Compra
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-brand-text dark:text-gray-100 outline-none w-full h-5"
              />
            </div>

            {/* CNPJ */}
            <div className="bg-rose-50/40 dark:bg-gray-750 border border-rose-100/80 dark:border-gray-600 rounded-lg px-2 py-1 flex flex-col justify-center">
              <span className="block text-[9px] uppercase font-bold text-brand-light-text dark:text-gray-400 leading-tight">
                CNPJ (Opcional)
              </span>
              <input
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                className="bg-transparent text-xs font-mono font-medium text-brand-text dark:text-gray-100 outline-none w-full truncate h-5 placeholder:text-gray-400"
                placeholder="00.000.000/0000-00"
              />
            </div>

            {/* Total do Cupom */}
            <div className="bg-rose-100/60 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg px-2 py-1 flex flex-col justify-center">
              <span className="block text-[9px] uppercase font-bold text-brand-primary dark:text-rose-300 leading-tight">
                Total do Cupom
              </span>
              <span className="text-xs sm:text-sm font-bold text-brand-primary dark:text-rose-300 truncate h-5 flex items-center">
                {formatCurrency(calculateTotalReceipt)}
              </span>
            </div>
          </div>

          {/* Hidden File Input for Receipt Photo */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleImageFileSelected}
          />

          {/* Processing Banner */}
          {isProcessingOcr && (
            <div className="flex items-center justify-center gap-3 py-6 px-4 bg-brand-primary/10 border border-brand-primary/30 rounded-xl my-2 text-brand-primary animate-pulse">
              <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold">Processando foto do cupom com Inteligência Artificial...</span>
            </div>
          )}

          {ocrError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-300 font-medium my-2">
              {ocrError}
            </div>
          )}

          {/* SEFAZ CAPTCHA / Zero items helpful guidance banner */}
          {items.length === 0 && !isProcessingOcr && (
            <div className="p-4 bg-amber-50/90 dark:bg-amber-950/40 border-2 border-dashed border-amber-300 dark:border-amber-700/80 rounded-2xl my-3 text-left">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/60 rounded-xl text-amber-700 dark:text-amber-300 shrink-0">
                  <CameraIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Nenhum produto importado automaticamente da SEFAZ
                  </h4>
                  <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 mt-1 leading-relaxed">
                    A SEFAZ do estado (como a de SP) exige verificação de CAPTCHA no site para liberar os itens quando pesquisado apenas pela chave digitada.
                  </p>
                  <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-100 mt-1">
                    Como você deseja carregar os produtos deste cupom?
                  </p>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="py-2 px-3.5 bg-brand-primary hover:bg-rose-600 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <CameraIcon className="w-4 h-4" />
                      📸 Ler Foto / Print do Cupom (IA)
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowPasteModal(true)}
                      className="py-2 px-3.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowUpTrayIcon className="w-4 h-4" />
                      📋 Colar Texto da SEFAZ
                    </button>

                    <button
                      type="button"
                      onClick={handleAddNewManualItem}
                      className="py-2 px-3.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                    >
                      + Digitar Manualmente
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal for pasting text copied from SEFAZ */}
          {showPasteModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <span>📋</span> Colar Texto da SEFAZ
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowPasteModal(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Abra a consulta da SEFAZ no seu navegador, selecione todo o texto da nota (Ctrl+A), copie (Ctrl+C) e cole abaixo:
                </p>
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Cole aqui o texto copiado da página da SEFAZ..."
                  className="w-full p-3 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none font-mono text-gray-800 dark:text-gray-200"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPasteModal(false)}
                    className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleProcessPastedText}
                    className="px-4 py-2 text-xs font-bold bg-brand-primary hover:bg-rose-600 text-white rounded-xl shadow-xs"
                  >
                    Extrair Produtos do Texto
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Product Cards com Alto Contraste, Cores do Sistema e Linha Fiscal Detalhada */}
          {items.map((item, idx) => {
            const isIgnore = item.category === 'ignore';
            const isPackaging = item.category === 'packaging';
            const isIngredient = item.category === 'ingredient';
            const isEquipment = item.category === 'equipment';
            const searchVal = (searchFilter[item.id] || '').toLowerCase().trim();

            const filteredIngredients = existingIngredients.filter((ing) =>
              !searchVal || ing.name.toLowerCase().includes(searchVal)
            );
            const filteredPackaging = existingPackaging.filter((pkg) =>
              !searchVal || pkg.name.toLowerCase().includes(searchVal)
            );
            const filteredEquipment = existingEquipment.filter((equip) =>
              !searchVal || equip.name.toLowerCase().includes(searchVal)
            );

            return (
              <div
                key={item.id}
                className={`rounded-xl border shadow-xs transition-all ${
                  isIgnore
                    ? 'bg-gray-50/70 dark:bg-gray-900/60 border-gray-200 dark:border-gray-800 opacity-60'
                    : item.linkType === 'existing'
                    ? 'bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-800 ring-1 ring-blue-200/60'
                    : 'bg-white dark:bg-gray-800 border-rose-100 dark:border-gray-700'
                }`}
              >
                {/* Linha 1: Número, Nome Completo do Item no Cupom e Lixeira */}
                <div className="bg-rose-50/70 dark:bg-gray-750/80 px-3 py-2 border-b border-rose-100 dark:border-gray-700 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-5 h-5 rounded-full bg-brand-primary text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 shadow-2xs">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-xs sm:text-sm text-brand-text dark:text-white truncate" title={item.rawName}>
                      {item.rawName || 'Item sem nome'}
                    </span>
                    {item.code && (
                      <span className="text-[9px] text-brand-light-text dark:text-gray-400 font-mono bg-rose-100/60 dark:bg-gray-700 px-1.5 py-0.5 rounded hidden sm:inline flex-shrink-0">
                        #{item.code}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition flex-shrink-0"
                    title="Excluir item deste cupom"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Linha 2: Especificações Fiscais do Cupom (Qtde, UN, Vl. Unitário, Vl. Total) */}
                <div className="px-3 py-1.5 bg-rose-50/30 dark:bg-gray-800/80 border-b border-rose-100/70 dark:border-gray-700/70 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 text-brand-light-text dark:text-gray-300">
                    <span className="inline-flex items-center gap-1 bg-white dark:bg-gray-700 px-2 py-0.5 rounded-md border border-rose-100 dark:border-gray-600 font-medium text-[11px] shadow-2xs">
                      <span className="text-brand-light-text dark:text-gray-400 text-[10px]">Qtde:</span>
                      <strong className="text-brand-text dark:text-white font-bold">{item.quantity}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 bg-white dark:bg-gray-700 px-2 py-0.5 rounded-md border border-rose-100 dark:border-gray-600 font-medium text-[11px] shadow-2xs">
                      <span className="text-brand-light-text dark:text-gray-400 text-[10px]">UN:</span>
                      <strong className="text-brand-text dark:text-white font-bold">{item.unit || 'UN'}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 bg-white dark:bg-gray-700 px-2 py-0.5 rounded-md border border-rose-100 dark:border-gray-600 font-medium text-[11px] shadow-2xs">
                      <span className="text-brand-light-text dark:text-gray-400 text-[10px]">Vl. Unit.:</span>
                      <strong className="text-brand-text dark:text-white font-bold">{formatCurrency(item.unitPrice)}</strong>
                    </span>
                  </div>
                  
                  <div className="inline-flex items-center gap-1.5 bg-rose-100/70 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-brand-primary dark:text-rose-300 px-2.5 py-0.5 rounded-md font-medium text-xs shadow-2xs">
                    <span className="text-[10px] font-semibold text-rose-700/80 dark:text-rose-300">Vl. Total:</span>
                    <strong className="font-bold">{formatCurrency(item.totalPrice)}</strong>
                  </div>
                </div>

                {/* Linha 3: Form fields com DESTINO e AÇÃO LADO A LADO no mobile e desktop */}
                <div className="p-2.5 sm:p-3 grid grid-cols-12 gap-2 sm:gap-2.5 items-end">
                  
                  {/* Destino (col-span-6 no mobile, col-span-3 no desktop) */}
                  <div className={isIgnore ? 'col-span-12' : 'col-span-6 sm:col-span-3'}>
                    <label className="block text-[10px] font-bold uppercase text-brand-light-text dark:text-gray-400 tracking-wider mb-1">
                      Destino
                    </label>
                    <select
                      value={item.category}
                      onChange={(e) => handleItemChange(item.id, { category: e.target.value as any })}
                      className="w-full h-8 px-2 text-xs bg-rose-50/40 dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-lg font-medium text-brand-text dark:text-gray-100 focus:bg-white focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition"
                    >
                      <option value="ingredient">🥣 Ingrediente</option>
                      <option value="packaging">📦 Embalagem</option>
                      <option value="equipment">🍳 Equipamento</option>
                      <option value="ignore">❌ Ignorar</option>
                    </select>
                  </div>

                  {!isIgnore && (
                    <>
                      {/* Ação (col-span-6 no mobile, col-span-2 no desktop) - LADO A LADO COM DESTINO */}
                      <div className="col-span-6 sm:col-span-2">
                        <label className="block text-[10px] font-bold uppercase text-brand-light-text dark:text-gray-400 tracking-wider mb-1">
                          Ação
                        </label>
                        <select
                          value={item.linkType}
                          onChange={(e) => {
                            const newLinkType = e.target.value as 'new' | 'existing';
                            let targetId: string | undefined = undefined;
                            let targetName = item.targetName;

                            if (newLinkType === 'existing') {
                              if (isIngredient && existingIngredients.length > 0) {
                                targetId = existingIngredients[0].id;
                                targetName = existingIngredients[0].name;
                              } else if (isPackaging && existingPackaging.length > 0) {
                                targetId = existingPackaging[0].id;
                                targetName = existingPackaging[0].name;
                              } else if (isEquipment && existingEquipment.length > 0) {
                                targetId = existingEquipment[0].id;
                                targetName = existingEquipment[0].name;
                              }
                            }

                            handleItemChange(item.id, {
                              linkType: newLinkType,
                              existingTargetId: targetId,
                              targetName
                            });
                          }}
                          className={`w-full h-8 px-2 text-xs rounded-lg font-medium outline-none border transition ${
                            item.linkType === 'existing'
                              ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-900 dark:text-blue-200'
                              : 'bg-rose-50/40 dark:bg-gray-700 border-rose-200 dark:border-gray-600 text-brand-text dark:text-gray-100 focus:bg-white focus:border-brand-primary'
                          }`}
                        >
                          <option value="new">✨ Novo</option>
                          <option value="existing">🔗 Vincular</option>
                        </select>
                      </div>

                      {/* Nome no Sistema ou Seleção com Pesquisa (col-span-12 no mobile, col-span-4 no desktop) */}
                      <div className="col-span-12 sm:col-span-4">
                        <div className="text-[10px] font-bold uppercase text-brand-light-text dark:text-gray-400 tracking-wider mb-1 flex items-center justify-between">
                          <span>{item.linkType === 'new' ? 'Nome no Sistema' : 'Vincular Existente'}</span>
                          {item.linkType === 'existing' && item.existingTargetId && (
                            <span className="text-[9px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-0.5">
                              <LinkIcon className="w-2.5 h-2.5" /> Vinculado
                            </span>
                          )}
                        </div>

                        {item.linkType === 'new' ? (
                          <input
                            type="text"
                            value={item.targetName}
                            onChange={(e) => handleItemChange(item.id, { targetName: e.target.value })}
                            className="w-full h-8 px-2.5 text-xs bg-rose-50/40 dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-lg font-medium text-brand-text dark:text-gray-100 focus:bg-white focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition placeholder:text-gray-400"
                            placeholder="Nome para cadastrar..."
                          />
                        ) : (
                          <LinkItemCombobox
                            item={item}
                            existingIngredients={existingIngredients}
                            existingPackaging={existingPackaging}
                            existingEquipment={existingEquipment}
                            onSelect={(targetId, name, unit, packageAmount) => {
                              handleItemChange(item.id, {
                                existingTargetId: targetId,
                                targetName: name,
                                targetUnit: (unit as any) || item.targetUnit,
                                packageAmount: packageAmount || item.packageAmount
                              });
                            }}
                          />
                        )}
                      </div>

                      {/* Qtd. Embalagem & Unidade (col-span-12 no mobile, col-span-3 no desktop) */}
                      <div className="col-span-12 sm:col-span-3">
                        <label className="block text-[10px] font-bold uppercase text-brand-light-text dark:text-gray-400 tracking-wider mb-1">
                          {isEquipment ? 'Quantidade' : 'Qtd. Emb. & Unid.'}
                        </label>
                        <div className={isEquipment ? 'w-full' : 'grid grid-cols-2 gap-1.5'}>
                          <input
                            type="number"
                            step="any"
                            value={item.packageAmount}
                            onChange={(e) =>
                              handleItemChange(item.id, { packageAmount: safeParseFloat(e.target.value) })
                            }
                            className="w-full h-8 px-2 text-xs text-center bg-rose-50/40 dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-lg font-semibold text-brand-text dark:text-gray-100 focus:bg-white focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition"
                            placeholder="Qtd"
                          />
                          {!isEquipment && (
                            <select
                              value={item.targetUnit}
                              onChange={(e) => handleItemChange(item.id, { targetUnit: e.target.value as any })}
                              className="w-full h-8 px-2 text-xs bg-rose-50/40 dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-lg font-semibold text-brand-text dark:text-gray-100 focus:bg-white focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition"
                            >
                              {isIngredient ? (
                                <>
                                  <option value="g">g</option>
                                  <option value="kg">kg</option>
                                  <option value="ml">ml</option>
                                  <option value="l">l</option>
                                  <option value="un">un</option>
                                </>
                              ) : (
                                <>
                                  <option value="un">un</option>
                                  <option value="pacote">pct</option>
                                  <option value="rolo">rolo</option>
                                  <option value="m">m</option>
                                </>
                              )}
                            </select>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Botão de Adicionar Item no final da rolagem */}
          <div className="pt-2 pb-4 flex justify-center">
            <button
              type="button"
              onClick={handleAddNewManualItem}
              className="py-2 px-4 bg-white dark:bg-gray-800 border-2 border-dashed border-rose-200 dark:border-gray-600 hover:border-brand-primary hover:bg-rose-50/70 dark:hover:bg-gray-700 text-brand-primary dark:text-rose-300 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs"
            >
              <PlusIcon className="w-4 h-4" />
              <span>+ Adicionar Outro Item ao Cupom</span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            FOOTER BAR (Compatível com Barra Inferior do iPhone / Home Bar)
           ========================================================================= */}
        <div 
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.75rem)' }}
          className="p-3 sm:p-3.5 bg-white dark:bg-gray-800 border-t border-rose-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 flex-shrink-0 shadow-xs"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2 py-1 bg-rose-50 dark:bg-rose-950/40 text-brand-primary dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-md font-bold text-[11px]">
              ✨ Novos: {newIngredientsCount + newPackagingCount + newEquipmentCount}
            </span>
            <span className="px-2 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-md font-bold text-[11px]">
              🔗 Vincular: {linkedIngredientsCount + linkedPackagingCount + linkedEquipmentCount}
            </span>
            <span className="font-bold text-brand-text dark:text-white text-xs sm:text-sm ml-1">
              Total: {formatCurrency(calculateTotalReceipt)}
            </span>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-3 text-xs sm:text-sm font-semibold text-brand-light-text dark:text-gray-300 hover:text-brand-text transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmAll}
              className="py-2 px-4 bg-brand-primary hover:bg-rose-600 text-white font-bold rounded-xl shadow-md shadow-rose-500/25 transition flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <CheckCircleIcon className="w-4 h-4" />
              <span>Confirmar & Atualizar</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
