import React, { useState, useMemo, useRef } from 'react';
import type { Ingredient, Packaging, InvoiceReceipt, InvoicePurchaseItem, Unit, PackagingUnit } from '../types';
import { CameraIcon } from './icons/CameraIcon';
import { QrCodeIcon } from './icons/QrCodeIcon';
import { ArrowUpTrayIcon } from './icons/ArrowUpTrayIcon';
import { PlusIcon } from './icons/PlusIcon';
import { DocumentArrowDownIcon } from './icons/DocumentArrowDownIcon';
import { SearchIcon } from './icons/SearchIcon';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { ShoppingBagIcon } from './icons/ShoppingBagIcon';
import { BoxIcon } from './icons/BoxIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { SparklesIcon } from './icons/LinkIcon';
import { formatCurrency } from './utils';
import { CameraReceiptModal } from './CameraReceiptModal';
import { ReviewReceiptModal } from './ReviewReceiptModal';
import { ReceiptDetailsModal } from './ReceiptDetailsModal';
import {
  parseReceiptImageWithGemini,
  parseNfceQrCode,
  parseNfeXml,
  fetchNfceFromUrl,
  fileToBase64,
  scanQrFromImage,
  compressImageForOcr
} from '../services/receiptScanner';

interface PurchasesManagerProps {
  receipts: InvoiceReceipt[];
  ingredients: Ingredient[];
  packaging: Packaging[];
  onSaveReceipt: (receipt: InvoiceReceipt) => void;
  onDeleteReceipt: (receiptId: string) => void;
  onBatchUpdateCatalog: (
    newIngredients: Ingredient[],
    updatedIngredients: Ingredient[],
    newPackaging: Packaging[],
    updatedPackaging: Packaging[]
  ) => void;
}

export const PurchasesManager: React.FC<PurchasesManagerProps> = ({
  receipts,
  ingredients,
  packaging,
  onSaveReceipt,
  onDeleteReceipt,
  onBatchUpdateCatalog
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');

  // Modals state
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [activeReceiptForDetails, setActiveReceiptForDetails] = useState<InvoiceReceipt | null>(null);

  const [currentParsedReceipt, setCurrentParsedReceipt] = useState<Partial<InvoiceReceipt> | null>(null);
  const [isLoadingOCR, setIsLoadingOCR] = useState(false);
  const [ocrStatusText, setOcrStatusText] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const xmlInputRef = useRef<HTMLInputElement | null>(null);

  // Current month string in YYYY-MM
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Process & group receipts by month for dashboard
  const monthlyStats = useMemo(() => {
    const monthsMap: Record<string, { total: number; count: number; itemsCount: number; ingredientCount: number; packagingCount: number }> = {};

    receipts.forEach((r) => {
      const monthKey = r.date ? r.date.substring(0, 7) : '2026-08';
      if (!monthsMap[monthKey]) {
        monthsMap[monthKey] = { total: 0, count: 0, itemsCount: 0, ingredientCount: 0, packagingCount: 0 };
      }
      monthsMap[monthKey].total += r.totalAmount || 0;
      monthsMap[monthKey].count += 1;
      monthsMap[monthKey].itemsCount += r.items.length;
      r.items.forEach((item) => {
        if (item.category === 'packaging') {
          monthsMap[monthKey].packagingCount += item.quantity || 1;
        } else if (item.category === 'ingredient') {
          monthsMap[monthKey].ingredientCount += item.quantity || 1;
        }
      });
    });

    return monthsMap;
  }, [receipts]);

  // Current month and previous month values
  const currentMonthTotal = monthlyStats[currentMonthKey]?.total || 0;
  const currentMonthItemsCount = monthlyStats[currentMonthKey]?.itemsCount || 0;
  const currentMonthReceiptsCount = monthlyStats[currentMonthKey]?.count || 0;

  // Previous month calculation
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthTotal = monthlyStats[prevMonthKey]?.total || 0;

  const monthGrowthPercent = prevMonthTotal > 0 
    ? ((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100 
    : 0;

  // Total all-time stats
  const totalAllTime = useMemo(() => {
    return receipts.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  }, [receipts]);

  const totalAllItems = useMemo(() => {
    return receipts.reduce((sum, r) => sum + r.items.length, 0);
  }, [receipts]);

  const averageTicket = receipts.length > 0 ? totalAllTime / receipts.length : 0;

  // Top suppliers
  const topSuppliers = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    receipts.forEach((r) => {
      const name = r.supplier || 'Outros';
      if (!map[name]) map[name] = { total: 0, count: 0 };
      map[name].total += r.totalAmount || 0;
      map[name].count += 1;
    });

    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [receipts]);

  // Last 6 months trend for the chart
  const last6Months = useMemo(() => {
    const list: Array<{ key: string; label: string; total: number; itemsCount: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthName = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const year = d.getFullYear().toString().substring(2);
      list.push({
        key,
        label: `${monthName}/${year}`,
        total: monthlyStats[key]?.total || 0,
        itemsCount: monthlyStats[key]?.itemsCount || 0
      });
    }
    return list;
  }, [monthlyStats, now]);

  const maxMonthValue = Math.max(...last6Months.map((m) => m.total), 100);

  // Filtered receipts list
  const filteredReceipts = useMemo(() => {
    return receipts
      .filter((r) => {
        const matchesSearch =
          r.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (r.accessKey && r.accessKey.includes(searchTerm)) ||
          r.items.some((i) => (i.targetName || i.rawName).toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesMonth = selectedMonth === 'all' || r.date.startsWith(selectedMonth);
        const matchesSupplier = selectedSupplier === 'all' || r.supplier === selectedSupplier;

        return matchesSearch && matchesMonth && matchesSupplier;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [receipts, searchTerm, selectedMonth, selectedSupplier]);

  // Handlers for Receipt Ingestion
  const handleScanQrSuccess = async (decodedText: string) => {
    const rawInput = decodedText.trim();
    console.log('📱 [PURCHASES] QR Code recebido do leitor / input:', rawInput);
    setIsCameraModalOpen(false);

    // Normalize URL if it starts with www or http
    let targetUrl = '';
    if (rawInput.startsWith('http://') || rawInput.startsWith('https://')) {
      targetUrl = rawInput;
    } else if (rawInput.startsWith('www.')) {
      targetUrl = `https://${rawInput}`;
    } else if (rawInput.includes('nfce') && rawInput.includes('http')) {
      const match = rawInput.match(/https?:\/\/[^\s]+/i);
      if (match) targetUrl = match[0];
    }

    if (targetUrl) {
      console.log('🌐 [PURCHASES] URL de consulta identificada:', targetUrl);
      setIsLoadingOCR(true);
      setOcrStatusText('Consultando cupom fiscal diretamente na SEFAZ...');

      try {
        const parsed = await fetchNfceFromUrl(targetUrl);
        console.log('🎉 [PURCHASES] Itens extraídos com sucesso da SEFAZ:', parsed);
        setCurrentParsedReceipt(parsed);
        setIsReviewModalOpen(true);
        return;
      } catch (err: any) {
        console.error('⚠️ [PURCHASES] Falha na consulta automática da URL da SEFAZ:', err);
        alert(`Aviso ao consultar SEFAZ: ${err.message || 'Não foi possível buscar os itens online'}. Abrindo formulário para conferência.`);
      } finally {
        setIsLoadingOCR(false);
        setOcrStatusText('');
      }
    }

    // Fallback if not URL or if direct fetch failed
    try {
      console.log('🔍 [PURCHASES] Processando texto/chave via parser local de metadados...');
      const parsed = parseNfceQrCode(rawInput);
      console.log('📋 [PURCHASES] Metadados obtidos:', parsed);
      setCurrentParsedReceipt({
        ...parsed,
        supplier: parsed.supplier || 'Supermercado (NFC-e QR Code)',
        date: parsed.date || new Date().toISOString().substring(0, 10),
        items: parsed.items || []
      });
      setIsReviewModalOpen(true);
    } catch (err) {
      console.error('❌ [PURCHASES] Erro no parser de QR Code:', err);
      alert('QR Code lido, mas não foi possível extrair dados automaticamente. Você pode preencher os itens manualmente.');
    }
  };

  const handleCapturePhotoFromCamera = async (base64Image: string) => {
    setIsCameraModalOpen(false);
    setIsLoadingOCR(true);
    setOcrStatusText('Processando imagem com Inteligência Artificial...');

    try {
      const parsed = await parseReceiptImageWithGemini(base64Image, 'image/jpeg');
      setCurrentParsedReceipt(parsed);
      setIsReviewModalOpen(true);
    } catch (err: any) {
      console.error('Falha no OCR:', err);
      alert(`Não foi possível ler todos os itens automaticamente: ${err.message || 'Tente tirar uma foto mais nítida ou aproximada.'}`);
    } finally {
      setIsLoadingOCR(false);
      setOcrStatusText('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingOCR(true);
    setOcrStatusText(`Analisando imagem: ${file.name}...`);

    try {
      console.log('🖼️ [PURCHASES] Verificando se há QR Code na imagem enviada...');
      const qrData = await scanQrFromImage(file);
      if (qrData) {
        console.log('✅ [PURCHASES] QR Code identificado na foto:', qrData);
        await handleScanQrSuccess(qrData);
        return;
      }

      console.log('🤖 [PURCHASES] Nenhum QR Code detectado na foto. Acionando IA para extrair itens do cupom...');
      setOcrStatusText('Extraindo itens e preços com Inteligência Artificial...');
      const compressed = await compressImageForOcr(file, 1600, 0.82);
      const parsed = await parseReceiptImageWithGemini(compressed, 'image/jpeg');
      setCurrentParsedReceipt(parsed);
      setIsReviewModalOpen(true);
    } catch (err: any) {
      console.error('Erro ao processar arquivo:', err);
      alert(`Erro na leitura do cupom: ${err.message || 'Verifique o formato da imagem.'}`);
    } finally {
      setIsLoadingOCR(false);
      setOcrStatusText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleXmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseNfeXml(text);
      setCurrentParsedReceipt(parsed);
      setIsReviewModalOpen(true);
    } catch (err: any) {
      console.error('Erro ao ler XML de NF-e:', err);
      alert('Erro ao interpretar o arquivo XML da NF-e. Certifique-se de que é um XML válido.');
    } finally {
      if (xmlInputRef.current) xmlInputRef.current.value = '';
    }
  };

  const handleCreateManualReceipt = () => {
    setCurrentParsedReceipt({
      supplier: '',
      date: new Date().toISOString().substring(0, 10),
      totalAmount: 0,
      items: [
        {
          id: `item-${Date.now()}`,
          rawName: '',
          quantity: 1,
          unit: 'UN',
          unitPrice: 0,
          totalPrice: 0,
          category: 'ingredient',
          linkType: 'new',
          targetName: '',
          packageAmount: 1000,
          targetUnit: 'g',
          packagePrice: 0
        }
      ]
    });
    setIsReviewModalOpen(true);
  };

  const handleConfirmReview = (
    finalReceipt: InvoiceReceipt,
    newIngs: Ingredient[],
    updatedIngs: Ingredient[],
    newPkgs: Packaging[],
    updatedPkgs: Packaging[]
  ) => {
    onSaveReceipt(finalReceipt);
    onBatchUpdateCatalog(newIngs, updatedIngs, newPkgs, updatedPkgs);
    setIsReviewModalOpen(false);
    setCurrentParsedReceipt(null);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hidden file inputs for document and XML upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*,application/pdf"
        className="hidden"
      />
      <input
        type="file"
        ref={xmlInputRef}
        onChange={handleXmlUpload}
        accept=".xml,text/xml"
        className="hidden"
      />

      {/* Header with Title and Quick Actions */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-4xl font-bold text-brand-text dark:text-rose-100">
            Compras & Notas Fiscais
          </h1>
          <p className="text-xs sm:text-sm text-brand-light-text dark:text-gray-400 mt-1">
            Escaneie cupons fiscais, suba fotos de notas e cadastre/vincule insumos automaticamente.
          </p>
        </div>

        {/* Action Buttons: 2-column grid on mobile, flex on desktop */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <button
            type="button"
            onClick={() => setIsCameraModalOpen(true)}
            className="py-3 px-4 bg-brand-primary hover:bg-rose-600 text-white font-bold text-sm rounded-2xl shadow-lg shadow-rose-500/25 transition flex items-center justify-center gap-2"
          >
            <CameraIcon className="w-5 h-5 flex-shrink-0" />
            <span className="truncate">Escanear Cupom</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="py-3 px-4 bg-white dark:bg-gray-800 hover:bg-rose-50 dark:hover:bg-gray-700 text-brand-text dark:text-rose-100 border border-rose-200 dark:border-gray-700 font-semibold text-sm rounded-2xl shadow-sm transition flex items-center justify-center gap-2"
          >
            <ArrowUpTrayIcon className="w-5 h-5 text-brand-primary flex-shrink-0" />
            <span className="truncate">Subir Foto</span>
          </button>

          <button
            type="button"
            onClick={() => xmlInputRef.current?.click()}
            className="py-3 px-4 bg-white dark:bg-gray-800 hover:bg-rose-50 dark:hover:bg-gray-700 text-brand-text dark:text-rose-100 border border-rose-200 dark:border-gray-700 font-semibold text-sm rounded-2xl shadow-sm transition flex items-center justify-center gap-2"
            title="Importar arquivo XML oficial da NF-e / NFC-e"
          >
            <DocumentArrowDownIcon className="w-5 h-5 text-purple-500 flex-shrink-0" />
            <span className="truncate">XML Nota</span>
          </button>

          <button
            type="button"
            onClick={handleCreateManualReceipt}
            className="py-3 px-4 bg-rose-100 dark:bg-gray-700 hover:bg-rose-200 dark:hover:bg-gray-600 text-brand-primary dark:text-rose-200 font-semibold text-sm rounded-2xl transition flex items-center justify-center gap-2"
            title="Lançamento Manual de Compra"
          >
            <PlusIcon className="w-5 h-5 flex-shrink-0" />
            <span className="truncate">Manual</span>
          </button>
        </div>
      </div>

      {/* Loading OCR State Banner */}
      {isLoadingOCR && (
        <div className="p-6 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-3xl shadow-xl flex items-center gap-4 animate-pulse">
          <div className="p-3 bg-white/20 rounded-2xl">
            <SparklesIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Lendo Cupom Fiscal com Inteligência Artificial</h3>
            <p className="text-xs text-rose-100">{ocrStatusText || 'Extraindo itens, preços, CNPJ e quantidades...'}</p>
          </div>
        </div>
      )}

      {/* Dashboard KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Compras no Mês */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-light-text dark:text-gray-400">
              Compras no Mês
            </span>
            <div className="p-2.5 bg-brand-primary/10 text-brand-primary rounded-xl">
              <ShoppingBagIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold text-brand-text dark:text-white">
              {formatCurrency(currentMonthTotal)}
            </p>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              {prevMonthTotal > 0 ? (
                <span
                  className={`font-semibold ${
                    monthGrowthPercent <= 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {monthGrowthPercent > 0 ? `+${monthGrowthPercent.toFixed(1)}%` : `${monthGrowthPercent.toFixed(1)}%`}
                </span>
              ) : (
                <span className="text-gray-400">Mês base</span>
              )}
              <span className="text-brand-light-text dark:text-gray-400">vs mês anterior</span>
            </div>
          </div>
        </div>

        {/* Card 2: Insumos Comprados */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-light-text dark:text-gray-400">
              Insumos no Mês
            </span>
            <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
              <BoxIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold text-brand-text dark:text-white">
              {currentMonthItemsCount}
            </p>
            <p className="text-xs text-brand-light-text dark:text-gray-400 mt-1">
              produtos adquiridos em {currentMonthReceiptsCount} notas
            </p>
          </div>
        </div>

        {/* Card 3: Total Geral Acumulado */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-light-text dark:text-gray-400">
              Total Histórico
            </span>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <ChartBarIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold text-brand-text dark:text-white">
              {formatCurrency(totalAllTime)}
            </p>
            <p className="text-xs text-brand-light-text dark:text-gray-400 mt-1">
              {receipts.length} cupons / {totalAllItems} itens no total
            </p>
          </div>
        </div>

        {/* Card 4: Ticket Médio */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-light-text dark:text-gray-400">
              Ticket Médio
            </span>
            <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <SparklesIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold text-brand-text dark:text-white">
              {formatCurrency(averageTicket)}
            </p>
            <p className="text-xs text-brand-light-text dark:text-gray-400 mt-1">
              gasto médio por compra realizada
            </p>
          </div>
        </div>
      </div>

      {/* Analytics Row: Monthly Evolution Chart + Top Suppliers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0 max-w-full">
        {/* Monthly Purchases Evolution Chart */}
        <div className="lg:col-span-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-4 sm:p-6 rounded-3xl shadow-lg border border-rose-100 dark:border-gray-700 flex flex-col justify-between min-w-0 max-w-full overflow-hidden">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="font-display text-lg sm:text-xl font-bold text-brand-text dark:text-rose-100 flex items-center gap-2">
                <ChartBarIcon className="w-5 h-5 text-brand-primary flex-shrink-0" />
                <span className="truncate">Evolução Mensal (6 Meses)</span>
              </h2>
              <span className="text-xs text-brand-light-text dark:text-gray-400">Valores em R$</span>
            </div>

            {/* Custom Tailwind Bar Chart */}
            <div className="w-full overflow-x-auto no-scrollbar pb-1">
              <div className="h-44 sm:h-48 min-w-[280px] w-full flex items-end justify-between gap-2 sm:gap-3 pt-4 pb-2 px-1 border-b border-rose-100 dark:border-gray-700">
                {last6Months.map((m) => {
                  const heightPercent = maxMonthValue > 0 ? (m.total / maxMonthValue) * 100 : 0;
                  const isCurrent = m.key === currentMonthKey;

                  return (
                    <div key={m.key} className="flex-1 min-w-0 flex flex-col items-center gap-1.5 group h-full justify-end">
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] py-0.5 px-1.5 rounded font-bold whitespace-nowrap shadow-lg pointer-events-none mb-1">
                        {formatCurrency(m.total)}
                      </div>

                      {/* Bar */}
                      <div className="w-full max-w-[42px] bg-rose-100 dark:bg-gray-700 rounded-t-lg overflow-hidden h-full flex items-end">
                        <div
                          style={{ height: `${Math.max(heightPercent, 4)}%` }}
                          className={`w-full rounded-t-lg transition-all duration-500 ${
                            isCurrent
                              ? 'bg-gradient-to-t from-brand-primary to-rose-400 shadow-sm'
                              : 'bg-rose-300 dark:bg-rose-900/60 hover:bg-brand-primary/80'
                          }`}
                        />
                      </div>

                      {/* X-axis label */}
                      <span
                        className={`text-[10px] sm:text-[11px] font-semibold uppercase truncate text-center w-full ${
                          isCurrent ? 'text-brand-primary font-bold' : 'text-gray-400'
                        }`}
                      >
                        {m.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-brand-light-text dark:text-gray-400">
            <span className="text-[11px]">💡 Atualizado a cada cupom importado</span>
            <span className="font-semibold text-brand-text dark:text-gray-300 text-[11px]">
              Média mensal: {formatCurrency(totalAllTime / Math.max(last6Months.filter(m => m.total > 0).length, 1))}
            </span>
          </div>
        </div>

        {/* Top Suppliers Breakdown */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-4 sm:p-6 rounded-3xl shadow-lg border border-rose-100 dark:border-gray-700 flex flex-col justify-between min-w-0 max-w-full overflow-hidden">
          <div className="min-w-0">
            <h2 className="font-display text-lg sm:text-xl font-bold text-brand-text dark:text-rose-100 mb-4 flex items-center gap-2">
              <ShoppingBagIcon className="w-5 h-5 text-brand-primary flex-shrink-0" />
              <span className="truncate">Principais Fornecedores</span>
            </h2>

            {topSuppliers.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                Nenhum fornecedor registrado ainda. Escaneie seu primeiro cupom fiscal para ver a distribuição!
              </div>
            ) : (
              <div className="space-y-4">
                {topSuppliers.map((supplier, idx) => {
                  const share = totalAllTime > 0 ? (supplier.total / totalAllTime) * 100 : 0;
                  return (
                    <div key={supplier.name} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-brand-text dark:text-gray-200 truncate max-w-[170px]">
                          {idx + 1}. {supplier.name}
                        </span>
                        <span className="text-brand-primary font-bold">{formatCurrency(supplier.total)}</span>
                      </div>
                      <div className="w-full bg-rose-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${share}%` }}
                          className="bg-brand-primary h-full rounded-full transition-all duration-500"
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400">
                        <span>{supplier.count} cupons</span>
                        <span>{share.toFixed(0)}% do total</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-rose-100 dark:border-gray-700 text-xs text-center text-brand-light-text dark:text-gray-400">
            Total de {new Set(receipts.map((r) => r.supplier)).size} estabelecimentos cadastrados
          </div>
        </div>
      </div>

      {/* Receipts History Section */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-rose-100 dark:border-gray-700 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-brand-text dark:text-rose-100">
              Histórico de Cupons Fiscais
            </h2>
            <p className="text-xs text-brand-light-text dark:text-gray-400">
              Consulte notas fiscais salvas, confira itens adquiridos e vincule produtos a cadastros existentes.
            </p>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar fornecedor ou item..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-rose-50/60 dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none"
              />
              <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            </div>

            {/* Month Filter */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 text-xs bg-rose-50/60 dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-xl font-medium focus:ring-2 focus:ring-brand-primary outline-none"
            >
              <option value="all">Todos os Meses</option>
              {Object.keys(monthlyStats)
                .sort((a, b) => b.localeCompare(a))
                .map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Empty State */}
        {filteredReceipts.length === 0 ? (
          <div className="py-12 border-2 border-dashed border-rose-200 dark:border-gray-700 rounded-3xl flex flex-col items-center justify-center text-center p-6 bg-rose-50/20 dark:bg-gray-900/20">
            <div className="p-4 bg-rose-100 dark:bg-gray-700 rounded-full text-brand-primary mb-4">
              <QrCodeIcon className="w-10 h-10" />
            </div>
            <h3 className="font-display text-xl font-bold text-brand-text dark:text-rose-100">
              Nenhum cupom fiscal encontrado
            </h3>
            <p className="text-xs text-brand-light-text dark:text-gray-400 max-w-md mt-1 mb-6">
              Comece agora mesmo escaneando o QR Code da nota fiscal com a câmera do celular ou subindo uma foto/arquivo do cupom.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsCameraModalOpen(true)}
                className="py-2.5 px-5 bg-brand-primary hover:bg-rose-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition flex items-center gap-2"
              >
                <CameraIcon className="w-4 h-4" />
                Escanear com Câmera
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2.5 px-5 bg-white dark:bg-gray-700 border border-rose-200 dark:border-gray-600 text-brand-text dark:text-gray-200 font-semibold text-xs sm:text-sm rounded-xl shadow-sm transition flex items-center gap-2"
              >
                <ArrowUpTrayIcon className="w-4 h-4 text-brand-primary" />
                Subir Foto de Cupom
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Cards View (< md) */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filteredReceipts.map((receipt) => {
                const formattedDate = new Date(receipt.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                });

                return (
                  <div
                    key={receipt.id}
                    onClick={() => {
                      setActiveReceiptForDetails(receipt);
                      setIsDetailsModalOpen(true);
                    }}
                    className="p-4 bg-rose-50/40 dark:bg-gray-700/50 rounded-2xl border border-rose-100 dark:border-gray-700 space-y-3 cursor-pointer active:scale-[0.99] transition"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-base text-brand-text dark:text-white leading-tight">
                          {receipt.supplier}
                        </h4>
                        <div className="text-xs text-brand-light-text dark:text-gray-400 mt-0.5">
                          {formattedDate} • {receipt.paymentMethod || 'Cupom Fiscal'}
                        </div>
                      </div>
                      <span className="font-bold text-lg text-brand-primary">
                        {formatCurrency(receipt.totalAmount)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-rose-100 dark:border-gray-600">
                      <span className="px-2.5 py-1 bg-white dark:bg-gray-800 text-brand-primary dark:text-rose-200 rounded-lg text-xs font-bold border border-rose-100 dark:border-gray-700">
                        {receipt.items.length} {receipt.items.length === 1 ? 'item' : 'itens'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveReceiptForDetails(receipt);
                          setIsDetailsModalOpen(true);
                        }}
                        className="py-1.5 px-3 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary dark:text-rose-200 text-xs font-bold rounded-xl transition"
                      >
                        Ver Detalhes →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-rose-100 dark:border-gray-700">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-rose-50/60 dark:bg-gray-700/60 text-brand-light-text dark:text-gray-300 font-semibold border-b border-rose-100 dark:border-gray-700">
                  <tr>
                    <th className="p-3.5">Data</th>
                    <th className="p-3.5">Fornecedor / Loja</th>
                    <th className="p-3.5">Insumos</th>
                    <th className="p-3.5">Pagamento</th>
                    <th className="p-3.5 text-right">Valor Total</th>
                    <th className="p-3.5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-100/60 dark:divide-gray-700/60">
                  {filteredReceipts.map((receipt) => {
                    const formattedDate = new Date(receipt.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    });

                    return (
                      <tr
                        key={receipt.id}
                        className="hover:bg-rose-50/40 dark:hover:bg-gray-700/40 transition cursor-pointer"
                        onClick={() => {
                          setActiveReceiptForDetails(receipt);
                          setIsDetailsModalOpen(true);
                        }}
                      >
                        <td className="p-3.5 font-mono text-xs text-brand-light-text dark:text-gray-400">
                          {formattedDate}
                        </td>
                        <td className="p-3.5 font-semibold text-brand-text dark:text-white">
                          <div>{receipt.supplier}</div>
                          {receipt.cnpj && (
                            <div className="text-[11px] text-gray-400 font-mono">{receipt.cnpj}</div>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-1 bg-rose-100/70 dark:bg-gray-700 text-brand-primary dark:text-rose-200 rounded-lg text-xs font-bold">
                            {receipt.items.length} itens
                          </span>
                        </td>
                        <td className="p-3.5 text-gray-600 dark:text-gray-300 text-xs">
                          {receipt.paymentMethod || 'Cupom Fiscal'}
                        </td>
                        <td className="p-3.5 text-right font-bold text-brand-primary text-sm sm:text-base">
                          {formatCurrency(receipt.totalAmount)}
                        </td>
                        <td
                          className="p-3.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setActiveReceiptForDetails(receipt);
                              setIsDetailsModalOpen(true);
                            }}
                            className="py-1 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-brand-primary dark:text-rose-200 text-xs font-semibold rounded-lg transition mr-1.5"
                          >
                            Ver Detalhes
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Camera Scanning & Snapshot Modal */}
      <CameraReceiptModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onScanSuccess={handleScanQrSuccess}
        onCapturePhoto={handleCapturePhotoFromCamera}
        onParsedReceipt={(parsed) => {
          setIsCameraModalOpen(false);
          setCurrentParsedReceipt(parsed);
          setIsReviewModalOpen(true);
        }}
      />

      {/* Review & Link Products Modal */}
      {isReviewModalOpen && currentParsedReceipt && (
        <ReviewReceiptModal
          isOpen={isReviewModalOpen}
          onClose={() => {
            setIsReviewModalOpen(false);
            setCurrentParsedReceipt(null);
          }}
          initialReceipt={currentParsedReceipt}
          existingIngredients={ingredients}
          existingPackaging={packaging}
          onConfirm={handleConfirmReview}
        />
      )}

      {/* Receipt Details Modal */}
      {isDetailsModalOpen && activeReceiptForDetails && (
        <ReceiptDetailsModal
          receipt={activeReceiptForDetails}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setActiveReceiptForDetails(null);
          }}
          onDelete={(id) => {
            onDeleteReceipt(id);
            setIsDetailsModalOpen(false);
            setActiveReceiptForDetails(null);
          }}
        />
      )}
    </div>
  );
};
