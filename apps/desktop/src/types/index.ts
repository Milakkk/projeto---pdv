export interface Category {
  id: string;
  name: string;
  icon: string;
  order: number;
  active: boolean;
  // Código de integração opcional (numérico, pode ficar vazio)
  integrationCode?: string;
  kitchenIds?: string[];
  isPromo?: boolean;
}

// NOVO: Interface para grupos de modificadores obrigatórios (seleção única)
export interface RequiredModifierGroup {
  id: string;
  name: string; // Ex: Ponto da Carne
  options: string[]; // Ex: Mal Passada, Ao Ponto, Bem Passada
  active: boolean; // NOVO: Se o grupo está ativo
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  sla: number;
  categoryId: string;
  observations?: string[];
  requiredModifierGroups?: RequiredModifierGroup[]; // NOVO: Grupos de modificadores obrigatórios
  image?: string;
  active: boolean;
  code?: string; // Código do item para busca rápida
  // Código de integração opcional (numérico, pode ficar vazio)
  integrationCode?: string;
  // NOVO: Itens que pulam a cozinha (entrega direta)
  skipKitchen?: boolean;
  // NOVO: Permitir entrega parcial de unidades do item
  allowPartialDelivery?: boolean;
  // NOVO: Quantidade total de unidades por item para conferência de entrega
  unitDeliveryCount?: number;
  isPromo?: boolean;
  comboItemIds?: string[];
}

// Novo tipo para rastrear o status de cada unidade de produção
export interface ProductionUnit {
  unitId: string; // ID único para esta unidade (mesmo que o item original tenha quantity > 1)
  operatorName?: string;
  unitStatus: 'PENDING' | 'READY';
  completedObservations?: string[]; // NOVO: Checklist de observações concluídas
  completedAt?: Date; // NOVO: Tempo em que a unidade foi marcada como READY
  deliveredAt?: Date; // NOVO: Tempo em que a unidade foi entregue (por unidade)
}

export interface OrderItem {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  unitPrice: number;
  observations?: string;
  
  // NOVO: Array de unidades de produção para rastreamento individual
  productionUnits: ProductionUnit[];
  // NOVO: Flag derivada para facilitar lógica na Cozinha/Caixa
  skipKitchen?: boolean;
  // NOVO: Permitir entrega parcial deste item (derivado ou sobrescrito)
  allowPartialDelivery?: boolean;
  // NOVO: Quantidade de unidades já entregues para itens de entrega direta (pula cozinha)
  directDeliveredUnitCount?: number;
  // NOVO: Timestamps de entrega por unidade (ordem do checklist)
  directDeliveredUnitTimes?: Date[];
  discountPercentage?: number;
}

export interface Order {
  id: string;
  pin: string;
  password: string;
  items: OrderItem[];
  total: number;
  customerWhatsApp?: string;
  paymentMethod: string;
  status: 'NEW' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
  createdAt: Date;
  slaMinutes: number;
  createdBy: string;
  amountPaid?: number;
  changeAmount?: number;
  updatedAt?: Date; // Adicionado para rastrear atualizações
  readyAt?: Date; // NOVO: Adicionado para rastrear quando o pedido ficou pronto
  deliveredAt?: Date; // NOVO: Adicionado para rastrear quando o pedido foi entregue
  cancelReason?: string; // Adicionado para motivo de cancelamento
  paymentBreakdown?: { [key: string]: number }; // Adicionado para pagamentos múltiplos
  operationalSessionId?: string; // NOVO: ID da sessão operacional
}

export interface SavedCart {
  id: string;
  name: string;
  items: OrderItem[];
  total: number;
  createdAt: Date;
}

export interface PendingAction {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
}

// Novo tipo para operadores da cozinha
export interface KitchenOperator {
  id: string;
  name: string;
}

// Novo tipo para Status de Tarefas
export type TaskStatusKey = 'pending' | 'in_progress' | 'completed' | string;

export interface TaskStatus {
  key: TaskStatusKey;
  label: string;
  color: string; // Tailwind color class (e.g., 'bg-blue-500')
  isDefault: boolean; // Se é um status padrão (não pode ser excluído)
  isFinal: boolean; // Se é um status final (concluído)
}

// Novo tipo para Comentários de Tarefas
export interface TaskComment {
  id: string;
  userId: string;
  userName: string;
  timestamp: Date;
  content: string;
}

// Novo tipo para Tarefas
export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate: string; // YYYY-MM-DD
  priority: 'low' | 'medium' | 'high';
  status: TaskStatusKey; // Usando a chave do status
  assignedToId?: string; // ID do usuário atribuído
  assignedToName?: string; // Nome do usuário atribuído (para exibição)
  storeId: string; // Loja à qual a tarefa pertence
  createdAt: Date;
  completedAt?: Date;
  comments?: TaskComment[]; // Novo campo para comentários
}

// --- Tipos para Módulo Checklist ---

export interface ChecklistItem {
  id: string;
  description: string;
  requiredPhoto: boolean; // Requer foto para conclusão
}

export interface ChecklistMaster {
  id: string;
  name: string;
  description?: string;
  items: ChecklistItem[];
  storeId: string; // Loja à qual o checklist se aplica
  active: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'on_demand';
  assignedRoleIds: string[]; // Perfis que podem executar
}

export interface ChecklistExecutionItem extends ChecklistItem {
  isCompleted: boolean;
  completedAt?: Date;
  completedByUserId: string;
  completedByUserName: string;
  photoUrl?: string;
  notes?: string;
}

export interface ChecklistExecution {
  id: string;
  masterId: string;
  name: string;
  storeId: string;
  startedAt: Date;
  startedByUserId: string;
  startedByUserName: string;
  items: ChecklistExecutionItem[];
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
  completedAt?: Date;
  completionPercentage: number;
}

// Agendamentos de Checklist
export interface ChecklistSchedule {
  id: string;
  masterId: string; // Checklist mestre a ser executado
  storeId: string; // Loja alvo
  roleIds: string[]; // Perfis que devem ser notificados/executar
  frequency: 'daily' | 'weekly' | 'monthly';
  timeOfDay: string; // HH:mm (24h)
  daysOfWeek?: number[]; // 0-6 (domingo=0) para semanal
  dayOfMonth?: number; // 1-31 para mensal
  enabled: boolean;
  lastTriggeredAt?: Date; // Controle para evitar repetição excessiva
}

// --- Tipos para Gerenciamento de Loja e Usuários ---

export type Module = 'CAIXA' | 'COZINHA' | 'GESTAO' | 'MASTER' | 'TAREFAS' | 'CHECKLIST' | 'PROCEDIMENTOS' | 'RH' | 'ESTOQUE';

export interface Store {
  id: string;
  name: string;
  address: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: Module[]; // Quais módulos este perfil pode acessar
}

export interface User {
  id: string;
  username: string;
  name: string;
  passwordHash: string; // Simulação de hash
  storeId: string; // Loja principal do usuário
  roleId: string; // Perfil de permissão
}

export interface AuthContextType {
  user: User | null;
  store: Store | null;
  role: Role | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean; // CORRIGIDO: Removido storeId
  logout: () => void;
  hasPermission: (module: Module) => boolean;
  preferredModule: string | null;
  setPreferredModule: (path: string | null) => void;
}

// NOVO: Tipos para Sessão Operacional
export interface OperationalSession {
  id: string;
  pin: string; // SMMYYXXX
  storeId: string;
  storeName: string;
  openedByUserId: string;
  openedByUserName: string;
  openingTime: Date;
  closingTime?: Date;
  status: 'OPEN' | 'CLOSED';
}
