import type { Ingredient, Packaging, Equipment, AppSettings, Recipe } from '../types';

export const defaultIngredients: Ingredient[] = [];

export const defaultPackaging: Packaging[] = [];

export const defaultEquipment: Equipment[] = [];

export const defaultSettings: AppSettings = {
  laborCostPerHour: 20.00,
  kwhPrice: 1.07,
  gasCanisterPrice: 120.00,
  taxPercentage: 6,
  ingredientOutdatedDays: 45,
};

export const defaultRecipes: Recipe[] = [];
