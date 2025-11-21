import type { CashMovement } from '../pages/caixa/components/CashMovement';

interface CashSessionBase {
  id: string;
  initialAmount: number;
}

/**
 * Calcula o valor esperado em caixa somando o valor inicial e todos os movimentos (SALE, IN, OUT)
 * pertencentes à sessão especificada.
 * @param session A sessão de caixa ativa ou histórica.
 * @param movements Todos os movimentos de caixa registrados.
 * @returns O valor esperado em caixa.
 */
export const calculateExpectedAmount = (session: CashSessionBase, movements: CashMovement[]): number => {
  let expected = session.initialAmount;
  
  // Filtra movimentos APENAS para a sessão atual
  const sessionMovements = movements.filter(movement => movement.sessionId === session.id);

  sessionMovements.forEach(movement => {
    if (movement.type === 'SALE' || movement.type === 'IN') {
      expected += movement.amount;
    } else if (movement.type === 'OUT') {
      expected -= movement.amount;
    }
  });

  return expected;
};
