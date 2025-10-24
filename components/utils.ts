
export const formatCurrency = (value: number) => {
    if (value === null || !isFinite(value)) {
        return 'N/A';
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};
