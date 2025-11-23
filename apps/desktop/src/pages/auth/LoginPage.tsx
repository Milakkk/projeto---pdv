import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { mockStores } from '../../mocks/auth';
import Input from '../../components/base/Input';
import Button from '../../components/base/Button';
import AlertModal from '../../components/base/AlertModal';
import { useNavigate } from 'react-router-dom'; // Importação explícita

export default function LoginPage() {
  const { login, preferredModule } = useAuth();
  const navigate = useNavigate(); // Usando useNavigate
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setAlertMessage('Preencha todos os campos.');
      setShowAlert(true);
      return;
    }

    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const success = login(username, password);
      if (success) {
        navigate('/dashboard', { replace: true });
      } else {
        setAlertMessage('Credenciais inválidas.');
        setShowAlert(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-2xl border border-gray-200">
        <div className="text-center">
          <i className="ri-store-line text-5xl text-amber-600 mb-2"></i>
          <h1 className="text-2xl font-bold text-gray-900">Acesso ao Sistema</h1>
          <p className="text-sm text-gray-500">Faça login para acessar os módulos</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <Input
            label="Usuário:"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nome de usuário"
            required
            autoFocus
          />

          <Input
            label="Senha:"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            required
          />

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <i className="ri-loader-4-line mr-2 animate-spin"></i>
                Entrar
              </>
            ) : (
              <>
                <i className="ri-login-circle-line mr-2"></i>
                Entrar
              </>
            )}
          </Button>
        </form>
        
        {/* Removido o bloco de credenciais de teste */}
      </div>
      
      <AlertModal
        isOpen={showAlert}
        onClose={() => setShowAlert(false)}
        title="Erro de Login"
        message={alertMessage}
        variant="error"
      />
    </div>
  );
}
