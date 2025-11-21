import { Store, Role, User } from '../types';

export const mockStores: Store[] = [
  { id: 'store_1', name: 'Matriz - Centro', address: 'Rua Principal, 100' },
  { id: 'store_2', name: 'Filial - Shopping', address: 'Av. Comercial, 500' },
];

export const mockRoles: Role[] = [
  { id: 'role_master', name: 'Administrador Master', permissions: ['CAIXA', 'COZINHA', 'GESTAO', 'MASTER', 'TAREFAS', 'CHECKLIST', 'PROCEDIMENTOS', 'RH'] },
  { id: 'role_cashier', name: 'Operador de Caixa', permissions: ['CAIXA'] },
  { id: 'role_kitchen', name: 'Cozinheiro', permissions: ['COZINHA'] },
  { id: 'role_manager', name: 'Gerente', permissions: ['CAIXA', 'COZINHA', 'GESTAO', 'TAREFAS', 'CHECKLIST', 'PROCEDIMENTOS', 'RH'] },
];

// Senhas mockadas:
// master: 123456
// caixa: 111
// cozinha: 222
export const mockUsers: User[] = [
  { 
    id: 'user_1', 
    username: 'master', 
    name: 'Admin Master', 
    passwordHash: '123456', 
    storeId: 'store_1', 
    roleId: 'role_master' 
  },
  { 
    id: 'user_2', 
    username: 'caixa', 
    name: 'Operador Caixa', 
    passwordHash: '111', 
    storeId: 'store_1', 
    roleId: 'role_cashier' 
  },
  { 
    id: 'user_3', 
    username: 'cozinha', 
    name: 'Chef Cozinha', 
    passwordHash: '222', 
    storeId: 'store_2', 
    roleId: 'role_kitchen' 
  },
  { 
    id: 'user_4', 
    username: 'gerente', 
    name: 'Gerente Geral', 
    passwordHash: '333', 
    storeId: 'store_1', 
    roleId: 'role_manager' 
  },
];
