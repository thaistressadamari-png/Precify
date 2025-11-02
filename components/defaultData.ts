
import type { Ingredient, Packaging, AppSettings, Recipe } from '../types';

export const defaultIngredients: Ingredient[] = [];

export const defaultPackaging: Packaging[] = [
  {
    id: 'pkg-bolo-padrao-1',
    name: 'Caixa para Bolo Padrão (25cm)',
    price: 3.50,
    amount: 1,
    unit: 'un'
  },
  {
    id: 'pkg-fatia-torta-1',
    name: 'Embalagem para Fatia de Torta',
    price: 15.00,
    amount: 50,
    unit: 'un'
  }
];

export const defaultSettings: AppSettings = {
  laborCostPerHour: 20.00,
  kwhPrice: 0.92,
  gasCanisterPrice: 110.00,
  taxPercentage: 6,
  ingredientOutdatedDays: 45,
};

export const defaultRecipes: Recipe[] = [];