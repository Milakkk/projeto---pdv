import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';

export default function Home() {
  const { isAuthenticated } = useAuth();

  // A rota raiz agora redireciona para o login se não estiver autenticado,
  // ou para o dashboard se estiver. O ProtectedRoute já lida com isso,
  // mas este componente garante o fluxo inicial.
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <Navigate to="/dashboard" replace />;
}