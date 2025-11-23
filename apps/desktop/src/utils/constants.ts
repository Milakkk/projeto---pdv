export const CASH_NOTES = [200, 100, 50, 20, 10, 5, 2];
export const CASH_COINS = [1, 0.50, 0.25, 0.10, 0.05, 0.01];

export const DEFAULT_PAYMENT_SHORTCUTS: Record<string, string> = {
  'PIX': 'P',
  'Dinheiro': 'D',
  'Cartão de Débito': 'B',
  'Cartão de Crédito': 'C'
};

export const DEFAULT_TASK_STATUSES = [
  { key: 'pending', label: 'Pendente', color: 'bg-gray-500', isDefault: true, isFinal: false },
  { key: 'in_progress', label: 'Em Andamento', color: 'bg-blue-500', isDefault: true, isFinal: false },
  { key: 'completed', label: 'Concluída', color: 'bg-green-500', isDefault: true, isFinal: true },
];

export const DEFAULT_GLOBAL_OBSERVATIONS: string[] = [
  'Sem cebola',
  'Sem tomate',
  'Sem maionese',
  'Bem passado',
  'Mal passado',
  'Extra queijo',
  'Sem pimenta',
];