
import type { Ingredient, Packaging, AppSettings, Recipe, Purchase } from '../types';

const createPurchase = (
  date: string,
  price: number,
  amount: number,
  unit: Ingredient['unit'],
  supplier?: string
): Purchase => ({
  id: `${date}-${price}-${Math.random()}`,
  date,
  packagePrice: price,
  packageAmount: amount,
  unit,
  supplier,
});

const createIngredientFromHistory = (
  id: string,
  name: string,
  history: Purchase[]
): Ingredient => {
  const sortedHistory = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latest = sortedHistory[0];
  return {
    id,
    name,
    packagePrice: latest.packagePrice,
    packageAmount: latest.packageAmount,
    unit: latest.unit,
    purchaseDate: latest.date,
    supplier: latest.supplier,
    history: sortedHistory,
  };
};

export const defaultIngredients: Ingredient[] = [
  createIngredientFromHistory('ing-1', 'Farinha de Trigo', [
    createPurchase('2023-10-15', 5.50, 1, 'kg', 'Atacadão Dia a Dia')
  ]),
  createIngredientFromHistory('ing-2', 'Açúcar Refinado', [
    createPurchase('2023-10-15', 4.80, 1, 'kg', 'Atacadão Dia a Dia')
  ]),
  createIngredientFromHistory('ing-3', 'Ovo (unidade)', [
    createPurchase('2023-11-01', 12.00, 30, 'un', 'Granja Feliz')
  ]),
  createIngredientFromHistory('ing-4', 'Óleo de Soja', [
    createPurchase('2023-10-20', 8.50, 900, 'ml', 'Atacadão Dia a Dia')
  ]),
  createIngredientFromHistory('ing-5', 'Cenoura', [
    createPurchase('2023-11-05', 3.99, 1, 'kg', 'Sacolão da Esquina')
  ]),
  createIngredientFromHistory('ing-6', 'Fermento em Pó Químico', [
    createPurchase('2023-09-01', 5.20, 100, 'g', 'Mercado Local')
  ]),
  createIngredientFromHistory('ing-7', 'Chocolate em Pó 50%', [
    createPurchase('2023-09-10', 18.90, 1, 'kg', 'Doce Sabor Embalagens')
  ]),
  createIngredientFromHistory('ing-8', 'Manteiga sem Sal', [
    createPurchase('2023-11-02', 9.80, 200, 'g', 'Mercado Local')
  ]),
  createIngredientFromHistory('ing-9', 'Leite Condensado (lata)', [
    createPurchase('2023-10-25', 5.99, 1, 'un', 'Atacadão Dia a Dia')
  ]),
];

export const defaultPackaging: Packaging[] = [
  {
    id: 'pkg-1',
    name: 'Forma de Bolo Inglês (18cm)',
    price: 15.00,
    amount: 10,
    unit: 'un',
  }
];

export const defaultSettings: AppSettings = {
  laborCostPerHour: 20.00,
  kwhPrice: 0.92,
  gasCanisterPrice: 110.00,
  taxPercentage: 6,
  ingredientOutdatedDays: 45,
};

export const defaultRecipes: Recipe[] = [
  {
    id: 'recipe-1',
    name: 'Bolo de Cenoura com Cobertura de Chocolate',
    ingredientSections: [
      {
        id: 'sec-1',
        name: 'Massa',
        ingredients: [
          { id: 'ri-1', ingredientId: 'ing-5', amount: 250, unit: 'g' },
          { id: 'ri-2', ingredientId: 'ing-3', amount: 3, unit: 'un' },
          { id: 'ri-3', ingredientId: 'ing-4', amount: 120, unit: 'ml' },
          { id: 'ri-4', ingredientId: 'ing-2', amount: 300, unit: 'g' },
          { id: 'ri-5', ingredientId: 'ing-1', amount: 280, unit: 'g' },
          { id: 'ri-6', ingredientId: 'ing-6', amount: 15, unit: 'g' },
        ],
      },
      {
        id: 'sec-2',
        name: 'Cobertura de Brigadeiro',
        ingredients: [
          { id: 'ri-7', ingredientId: 'ing-9', amount: 1, unit: 'un' },
          { id: 'ri-8', ingredientId: 'ing-8', amount: 20, unit: 'g' },
          { id: 'ri-9', ingredientId: 'ing-7', amount: 50, unit: 'g' },
        ],
      }
    ],
    packaging: [
      { id: 'rp-1', packagingId: 'pkg-1', amount: 1 }
    ],
    yieldAmount: 1,
    yieldUnit: 'unidade',
    laborMinutes: 45,
    energyUsageMinutes: 0,
    gasUsageMinutes: 40,
    variableCostsPercentage: 10,
    profitMargin: 150,
    evaporationPercentage: 0,
    preparationMethod: [
      "Pré-aqueça o forno a 180°C.",
      "No liquidificador, bata as cenouras, os ovos e o óleo até obter uma mistura homogênea.",
      "Em uma tigela, peneire a farinha, o açúcar e o fermento. Despeje a mistura do liquidificador e mexa delicadamente até incorporar.",
      "Despeje a massa na forma untada e enfarinhada.",
      "Asse por aproximadamente 40 minutos, ou até que, ao espetar um palito, ele saia limpo.",
      "Para a cobertura, leve todos os ingredientes ao fogo baixo, mexendo sempre, até atingir o ponto de brigadeiro mole.",
      "Desenforme o bolo e cubra com o brigadeiro."
    ],
    observationsTitle: 'Dicas da Chef',
    observations: [
      "Para um bolo mais fofinho, use ingredientes em temperatura ambiente.",
      "Pode ser decorado com granulado de chocolate.",
      "Validade: 5 dias em temperatura ambiente."
    ]
  }
];
