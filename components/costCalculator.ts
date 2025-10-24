
import type { Recipe, Ingredient, Packaging, AppSettings, Unit } from '../types';

export const convertToBaseUnitAmount = (amount: number, unit: string) => {
    if (unit === 'kg' || unit === 'l') return amount * 1000;
    return amount;
};

export const getBaseUnit = (unit: string) => {
    if (unit === 'kg') return 'g';
    if (unit === 'l') return 'ml';
    return unit;
};

const GAS_CANISTER_HOURS = 60;

export const calculateCosts = (
    recipe: Omit<Recipe, 'id' | 'totalCost' | 'finalPrice' | 'pricePerYieldUnit'>,
    ingredients: Ingredient[],
    packagingItems: Packaging[],
    settings: AppSettings
) => {
    const allRecipeIngredients = recipe.ingredientSections.flatMap(section => section.ingredients);
    
    const ingredientsCost = allRecipeIngredients.reduce((total, recipeIng) => {
      const ingData = ingredients.find(i => i.id === recipeIng.ingredientId);
      if (!ingData) return total;

      const recipeIngBaseAmount = convertToBaseUnitAmount(recipeIng.amount, recipeIng.unit);
      const ingDataBaseAmount = convertToBaseUnitAmount(ingData.packageAmount, ingData.unit);
      
      if (getBaseUnit(recipeIng.unit) !== getBaseUnit(ingData.unit)) return total;
      
      const cost = (ingData.packagePrice / ingDataBaseAmount) * recipeIngBaseAmount;
      return total + (isNaN(cost) ? 0 : cost);
    }, 0);

    const packagingCost = recipe.packaging.reduce((total, recipePkg) => {
        const pkgData = packagingItems.find(p => p.id === recipePkg.packagingId);
        if(!pkgData) return total;
        const cost = (pkgData.price / pkgData.amount) * recipePkg.amount;
        return total + (isNaN(cost) ? 0 : cost);
    }, 0);
    
    const laborCost = (recipe.laborMinutes / 60) * (settings.laborCostPerHour || 0);
    const energyCost = (recipe.energyUsageMinutes / 60) * (settings.kwhPrice || 0);
    const gasCost = (recipe.gasUsageMinutes / 60) * ((settings.gasCanisterPrice || 0) / GAS_CANISTER_HOURS);
    
    const operationalCosts = laborCost + energyCost + gasCost;
    const baseCost = ingredientsCost + packagingCost + operationalCosts;

    const taxRate = (settings.taxPercentage || 0) / 100;
    const variableCostsRate = (recipe.variableCostsPercentage || 0) / 100;
    const markupPercentage = variableCostsRate + taxRate;
    const divisor = 1 - markupPercentage;

    const totalCost = divisor > 0 && isFinite(baseCost) ? baseCost / divisor : Infinity;
    
    const finalPrice = totalCost * (1 + ((recipe.profitMargin || 0) / 100));
    const pricePerYieldUnit = recipe.yieldAmount > 0 ? finalPrice / recipe.yieldAmount : 0;
    
    const totalProfit = finalPrice - totalCost;
    
    const variableCostsValue = totalCost * variableCostsRate;
    const taxValue = totalCost * taxRate;

    return { 
        ingredientsCost, 
        packagingCost, 
        laborCost, 
        energyCost, 
        gasCost, 
        baseCost,
        variableCostsValue,
        taxValue,
        totalCost, 
        finalPrice, 
        pricePerYieldUnit,
        totalProfit
    };
}

export const getPricePerBaseUnit = (price: number, amount: number, unit: Unit): { pricePerUnit: number, baseUnitLabel: string } => {
    const baseAmount = convertToBaseUnitAmount(amount, unit);
    const baseUnit = getBaseUnit(unit);
    if (baseAmount === 0) return { pricePerUnit: 0, baseUnitLabel: unit };

    const pricePerBaseAmount = price / baseAmount;
    
    if (baseUnit === 'g') {
        return { pricePerUnit: pricePerBaseAmount * 1000, baseUnitLabel: 'kg' };
    }
     if (baseUnit === 'ml') {
        return { pricePerUnit: pricePerBaseAmount * 1000, baseUnitLabel: 'l' };
    }
    
    return { pricePerUnit: pricePerBaseAmount, baseUnitLabel: baseUnit };
};