import { useAuth } from '../../context/AuthContext';
import { Navigate, Outlet } from 'react-router-dom';
import type { Module } from '../../types';
import Navigation from '../feature/Navigation';

interface ProtectedRouteProps {
  requiredPermission?: Module;
  isModuleRoute?: boolean; // Indica se esta é uma rota de módulo (que precisa de Navigation)
  allowedRoles?: string[]; // Lista de nomes de função permitidos (RBAC)
}

export default function ProtectedRoute({ requiredPermission, isModuleRoute = false, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, hasPermission, role } = useAuth();

  if (!isAuthenticated) {
    // Se não estiver autenticado, redireciona para o login
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    // Se não tiver a permissão necessária, redireciona para seleção de módulos
    return <Navigate to="/module-selector" replace />;
  }

  if (allowedRoles && allowedRoles.length) {
    const currentRoleName = role?.name ?? ''
    if (!allowedRoles.includes(currentRoleName)) {
      // RBAC: função atual não está na lista permitida
      return <Navigate to="/module-selector" replace />
    }
  }

  // Se for uma rota de módulo, renderiza a navegação e o conteúdo
  if (isModuleRoute) {
    // Usando h-screen e overflow-hidden para garantir que o módulo preencha a tela e não role
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <Navigation />
        <Outlet />
      </div>
    );
  }

  // Caso contrário, apenas renderiza o conteúdo (ex: Dashboard, MasterConfig)
  // Mantemos min-h-screen aqui para que páginas como Dashboard possam rolar se necessário
  return <Outlet />;
}
