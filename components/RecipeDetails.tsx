import React, { useMemo, useState } from 'react';
import type { Recipe, Ingredient, Packaging, AppSettings } from '../types';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { PencilIcon } from './icons/PencilIcon';
import { TrashIcon } from './icons/TrashIcon';
import { calculateCosts, convertToBaseUnitAmount } from './costCalculator';
import { formatCurrency } from './utils';
import { DocumentArrowDownIcon } from './icons/DocumentArrowDownIcon';
import { ConfirmModal } from './ConfirmModal';

declare global {
  interface Window {
    html2pdf: any;
  }
}

interface RecipeDetailsProps {
  recipe: Recipe;
  ingredients: Ingredient[];
  packagingItems: Packaging[];
  settings: AppSettings;
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipeId: string) => void;
  onClose: () => void;
}

const PieChart: React.FC<{ data: { name: string; value: number; color: string }[] }> = ({ data }) => {
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return null;

  let cumulativeAngle = 0;

  const slices = data.map((item, index) => {
    const angle = (item.value / total) * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    const endAngle = cumulativeAngle;

    const startX = 50 + 40 * Math.cos((startAngle - 90) * (Math.PI / 180));
    const startY = 50 + 40 * Math.sin((startAngle - 90) * (Math.PI / 180));
    const endX = 50 + 40 * Math.cos((endAngle - 90) * (Math.PI / 180));
    const endY = 50 + 40 * Math.sin((endAngle - 90) * (Math.PI / 180));
    const largeArcFlag = angle > 180 ? 1 : 0;

    const pathData = `M 50,50 L ${startX},${startY} A 40,40 0 ${largeArcFlag},1 ${endX},${endY} Z`;

    return { ...item, pathData, startAngle, endAngle };
  });

  return (
    <div className="relative w-full max-w-sm mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {slices.map((slice) => (
          <g 
            key={slice.name} 
            onMouseEnter={() => setHoveredSlice(slice.name)} 
            onMouseLeave={() => setHoveredSlice(null)}
          >
            <path d={slice.pathData} fill={slice.color} className="transition-transform duration-200" style={{ transformOrigin: '50% 50%', transform: hoveredSlice === slice.name ? 'scale(1.05)' : 'scale(1)' }}/>
          </g>
        ))}
      </svg>
      {hoveredSlice && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-gray-800/80 text-white text-center p-2 rounded-md shadow-lg">
            <p className="font-bold text-sm">{hoveredSlice}</p>
            <p className="text-xs">{formatCurrency(slices.find(s => s.name === hoveredSlice)?.value || 0)}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export const RecipeDetails: React.FC<RecipeDetailsProps> = ({ recipe, ingredients, packagingItems, settings, onEdit, onDelete, onClose }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const costBreakdown = useMemo(() => {
    return calculateCosts(recipe, ingredients, packagingItems, settings);
  }, [recipe, ingredients, packagingItems, settings]);

  const chartData = useMemo(() => {
    const data = [
      { name: 'Ingredientes', value: costBreakdown.ingredientsCost, color: '#F472B6' },
      { name: 'Embalagens', value: costBreakdown.packagingCost, color: '#FB923C' },
      { name: 'Mão de Obra', value: costBreakdown.laborCost, color: '#60A5FA' },
      { name: 'Energia', value: costBreakdown.energyCost, color: '#FACC15' },
      { name: 'Gás', value: costBreakdown.gasCost, color: '#A78BFA' },
      { name: 'Custos Adicionais', value: costBreakdown.variableCostsValue, color: '#4ADE80' },
      { name: 'Impostos', value: costBreakdown.taxValue, color: '#9CA3AF' },
    ];
    return data.filter(item => item.value > 0).sort((a, b) => b.value - a.value);
  }, [costBreakdown]);
  
  const hasPreparationMethod = recipe.preparationMethod && recipe.preparationMethod.length > 0;
  const hasObservations = recipe.observations && recipe.observations.length > 0;
  
  const confirmDelete = () => {
    onDelete(recipe.id);
    setShowDeleteConfirm(false);
  };

  const handleGeneratePdf = () => {
    if (typeof window.html2pdf !== 'function') {
      alert("Erro: A biblioteca de geração de PDF não foi carregada. Tente recarregar a página.");
      return;
    }
    
    // --- GERAR CONTEÚDO HTML DINÂMICO ---
    let ingredientesList = '';
    recipe.ingredientSections.forEach(section => {
      ingredientesList += `<li style="list-style-type: none; font-weight: bold; margin-top: 10px; margin-bottom: 5px; margin-left: -20px; text-transform: uppercase;">${section.name}</li>`;
      section.ingredients.forEach(ing => {
        const ingData = ingredients.find(i => i.id === ing.ingredientId);
        ingredientesList += `<li>${ing.amount}${ing.unit} de ${ingData ? ingData.name : 'ingrediente desconhecido'}</li>`;
      });
    });

    const preparoList = recipe.preparationMethod?.map(step => `<li>${step}</li>`).join('') || '<li>Nenhum passo adicionado.</li>';
    const observacoesTitle = recipe.observationsTitle || 'Observações';
    const observacoesList = recipe.observations?.map(obs => `<li>${obs}</li>`).join('') || '';

    // --- TEMPLATE HTML DO PDF ---
    const htmlContent = `
      <div id="ficha-tecnica" style="width: 210mm; height: 297mm; box-sizing: border-box; background-color: #E1E1E1; position: relative; font-family: 'Antonio', sans-serif; page-break-inside: avoid; padding: 1cm 0;">
        <h1 style="position: absolute; top: 1.5cm; left: 50%; transform: translateX(-50%); font-weight: 400; font-size: 58pt; color: #000; margin: 0; text-align: center; white-space: nowrap;">FICHA TÉCNICA</h1>
        <div style="position: absolute; top: 5.5cm; left: 1.2cm; background-color: #000; color: #FFF; font-weight: 700; font-size: 18pt; padding: 10px 25px; border-radius: 12px; z-index: 10; box-shadow: 2px 2px 6px rgba(0,0,0,0.25); white-space: nowrap; max-width: calc(100% - 2.4cm); overflow: hidden; text-overflow: ellipsis;">
          ${recipe.name.toUpperCase()}
        </div>
        <div style="position: absolute; top: 6cm; left: 1.82cm; right: 1.82cm; background-color: #FFFFFF; border-radius: 20px; padding: 1.5cm; box-sizing: border-box; z-index: 1; padding-top: 2cm;">
          <div style="display: flex; justify-content: space-between; gap: 1.5cm; width: 100%;">
            <div style="width: 48%;">
              <h3 style="font-weight: 700; font-size: 16pt; margin: 0 0 10px 0; border-bottom: 2px solid #E1E1E1; padding-bottom: 5px;">INGREDIENTES</h3>
              <ul style="font-family: Arial, sans-serif; font-size: 11pt; color: #333; list-style-type: disc; margin: 0; padding-left: 20px;">
                ${ingredientesList}
              </ul>
            </div>
            <div style="width: 48%;">
              <h3 style="font-weight: 700; font-size: 16pt; margin: 0 0 10px 0; border-bottom: 2px solid #E1E1E1; padding-bottom: 5px;">MODO DE PREPARO</h3>
              <ul style="font-family: Arial, sans-serif; font-size: 11pt; color: #333; list-style-type: disc; margin: 0; padding-left: 20px; line-height: 1.4;">
                ${preparoList}
              </ul>
            </div>
          </div>
          ${observacoesList ? `
          <div style="margin-top: 1.5cm; display: flex; flex-direction: column; align-items: center;">
            <h3 style="font-weight: 700; font-size: 16pt; margin: 0 0 8px 0; border-bottom: 2px solid #E1E1E1; padding-bottom: 5px;">
              ${observacoesTitle.toUpperCase()}
            </h3>
            <ul style="font-family: Arial, sans-serif; font-size: 11pt; color: #333; list-style-type: disc; margin: 0; padding-left: 20px; line-height: 1.4; text-align: left; width: fit-content;">
              ${observacoesList}
            </ul>
          </div>` : ''}
        </div>
      </div>`;

    // --- RENDERIZAR E SALVAR PDF ---
    const element = document.createElement('div');
    element.innerHTML = htmlContent;
    element.style.position = 'fixed';
    element.style.left = '-9999px'; // Mantém o elemento fora da tela
    document.body.appendChild(element);

    const pdfElement = element.querySelector('#ficha-tecnica');
    if (pdfElement) {
      const filename = `Ficha_Tecnica_${recipe.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const opt = {
        margin: 0,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };
      
      window.html2pdf().from(pdfElement).set(opt).save()
        .then(() => {
            document.body.removeChild(element);
        })
        .catch((err: Error) => {
            console.error("Erro ao gerar o PDF:", err);
            alert("Ocorreu um erro ao tentar gerar o PDF.");
            document.body.removeChild(element);
        });
    } else {
      document.body.removeChild(element);
    }
  };

  return (
    <>
    <div className="animate-fade-in space-y-8">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
            <h1 className="font-display text-4xl text-brand-text dark:text-rose-100">{recipe.name}</h1>
            <p className="text-brand-light-text dark:text-gray-400">Rendimento: {recipe.yieldAmount} {recipe.yieldUnit}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={onClose} className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
              <ArrowLeftIcon className="w-5 h-5"/> Voltar
          </button>
          <button onClick={() => onEdit(recipe)} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
            <PencilIcon className="w-5 h-5"/> Editar
          </button>
          <button onClick={handleGeneratePdf} className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
            <DocumentArrowDownIcon className="w-5 h-5"/> Gerar PDF
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2 bg-brand-primary hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
            <TrashIcon className="w-5 h-5"/> Excluir
          </button>
        </div>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 text-center">
                <p className="text-sm text-brand-light-text dark:text-gray-400">Custo Total Final</p>
                <p className="font-display text-4xl font-bold text-brand-text dark:text-rose-100">{formatCurrency(costBreakdown.totalCost)}</p>
            </div>
             <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 text-center">
                <p className="text-sm text-blue-700 dark:text-blue-300">Preço / {recipe.yieldUnit.replace(/s$/, '')}</p>
                <p className="font-display text-4xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(costBreakdown.pricePerYieldUnit)}</p>
            </div>
             <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 text-center">
                <p className="text-sm text-green-700 dark:text-green-300">Preço de Venda Sugerido</p>
                <p className="font-display text-4xl font-bold text-green-600 dark:text-green-400">{formatCurrency(costBreakdown.finalPrice)}</p>
            </div>
      </div>
      
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
        <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Análise de Custos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <PieChart data={chartData} />
          </div>
          <div>
            <ul className="space-y-3">
              {chartData.map(item => (
                <li key={item.name} className="flex justify-between items-center text-base">
                    <div className="flex items-center gap-3">
                        <span className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }}></span>
                        <span className="text-brand-light-text dark:text-gray-400">{item.name}</span>
                    </div>
                    <div className="text-right">
                        <span className="font-semibold text-brand-text dark:text-gray-200">{formatCurrency(item.value)}</span>
                        <span className="ml-2 text-sm font-mono text-gray-500 dark:text-gray-500">
                          {costBreakdown.totalCost > 0 ? `(${(item.value / costBreakdown.totalCost * 100).toFixed(1)}%)` : '(0.0%)'}
                        </span>
                    </div>
                </li>
              ))}
              <li className="flex justify-between items-center text-lg pt-2 border-t border-rose-200 dark:border-gray-600">
                <span className="font-bold text-brand-text dark:text-rose-100">Custo Total</span>
                <span className="font-bold text-brand-text dark:text-rose-100">{formatCurrency(costBreakdown.totalCost)}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
          <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Lista de Ingredientes</h2>
           <div className="space-y-4 max-h-96 overflow-y-auto pr-2 text-base">
              {recipe.ingredientSections.map(section => (
                <div key={section.id}>
                  <h3 className="font-semibold text-brand-primary dark:text-brand-secondary mb-1">{section.name}</h3>
                  <ul className="space-y-1 pl-2 border-l-2 border-rose-100 dark:border-gray-700">
                    {section.ingredients.map(ing => {
                      const ingData = ingredients.find(i => i.id === ing.ingredientId);
                      if (!ingData) return <li key={ing.id} className="text-rose-500 italic">Ingrediente não encontrado</li>;
                       const cost = (ingData.packagePrice / convertToBaseUnitAmount(ingData.packageAmount, ingData.unit)) * convertToBaseUnitAmount(ing.amount, ing.unit);
                      return (
                        <li key={ing.id} className="flex justify-between">
                            <span className="text-brand-light-text dark:text-gray-400">{ingData.name} ({ing.amount}{ing.unit})</span>
                            <span className="font-mono text-brand-text dark:text-gray-300">{formatCurrency(cost)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
        </div>
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
          <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Lista de Embalagens</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2 text-base">
              {recipe.packaging.length > 0 ? (
                <ul className="space-y-1">
                    {recipe.packaging.map(pkg => {
                        const pkgData = packagingItems.find(p => p.id === pkg.packagingId);
                        if(!pkgData) return <li key={pkg.id} className="text-rose-500 italic">Embalagem não encontrada</li>;
                        const cost = (pkgData.price / pkgData.amount) * pkg.amount;
                        return (
                            <li key={pkg.id} className="flex justify-between">
                                <span className="text-brand-light-text dark:text-gray-400">{pkgData.name} (x{pkg.amount})</span>
                                <span className="font-mono text-brand-text dark:text-gray-300">{formatCurrency(cost)}</span>
                            </li>
                        );
                    })}
                </ul>
              ) : <p className="text-brand-light-text dark:text-gray-400 italic">Nenhuma embalagem adicionada.</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {hasPreparationMethod && (
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
                  <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Modo de Preparo</h2>
                  <ol className="list-decimal list-inside space-y-2 text-brand-light-text dark:text-gray-300">
                      {recipe.preparationMethod!.map((step, index) => (
                          <li key={index} className="pl-2 whitespace-pre-wrap">{step}</li>
                      ))}
                  </ol>
              </div>
          )}

          {hasObservations && (
              <div className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 ${!hasPreparationMethod && 'md:col-start-1'}`}>
                  <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">{recipe.observationsTitle || 'Observações'}</h2>
                  <ul className="list-disc list-inside space-y-2 text-brand-light-text dark:text-gray-300">
                      {recipe.observations!.map((obs, index) => (
                          <li key={index} className="pl-2 whitespace-pre-wrap">{obs}</li>
                      ))}
                  </ul>
              </div>
          )}
      </div>

    </div>
    <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir a receita "${recipe.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
    />
    </>
  );
};