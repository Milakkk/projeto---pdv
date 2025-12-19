import { createContext, useState, useMemo, useCallback, useContext } from 'react';
import { AuthContextType, User, Store, Role, Module } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage'; // Alterado para localStorage
import { mockUsers, mockRoles, mockStores } from '../mocks/auth';

// Definindo o contexto com valores iniciais
const defaultAuthContext: AuthContextType = {
  user: null,
  store: null,
  role: null,
  isAuthenticated: false,
  login: () => false,
  logout: () => {},
  hasPermission: () => false,
};

export const AuthContext = createContext<AuthContextType>(defaultAuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // MUDANÇA: Usando useLocalStorage para persistir login entre janelas/abas
  const [storedUser, setStoredUser] = useLocalStorage<User | null>('auth_user', null);
  const [storedStoreId, setStoredStoreId] = useLocalStorage<string | null>('auth_store_id', null);

  const isAuthenticated = useMemo(() => !!storedUser && !!storedStoreId, [storedUser, storedStoreId]);

  const role = useMemo(() => {
    if (!storedUser) return null;
    return mockRoles.find(r => r.id === storedUser.roleId) || null;
  }, [storedUser]);

  const store = useMemo(() => {
    if (!storedStoreId) return null;
    return mockStores.find(s => s.id === storedStoreId) || null;
  }, [storedStoreId]);

  // A função login agora só aceita username e password
  const login = useCallback((username: string, password: string): boolean => {
    const user = mockUsers.find(u => u.username === username && u.passwordHash === password);
    
    if (user) {
      const userRole = mockRoles.find(r => r.id === user.roleId);
      const selectedStore = mockStores.find(s => s.id === user.storeId); // Usa a storeId do usuário

      if (selectedStore && userRole) {
        setStoredUser(user);
        setStoredStoreId(user.storeId); // Define a storeId com base no usuário
        return true;
      }
    }
    
    return false;
  }, [setStoredUser, setStoredStoreId]);

  const logout = useCallback(() => {
    setStoredUser(null);
    setStoredStoreId(null);
  }, [setStoredUser, setStoredStoreId]);

  const hasPermission = useCallback((module: Module): boolean => {
    if (!role) return false;
    return role.permissions.includes(module);
  }, [role]);

  const contextValue = useMemo(() => ({
    user: storedUser,
    store,
    role,
    isAuthenticated,
    login,
    logout,
    hasPermission,
  }), [storedUser, store, role, isAuthenticated, login, logout, hasPermission]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
