
import { useState, useEffect } from 'react';

export function useTimer(startTime?: Date, slaMinutes?: number, isActive: boolean = true) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;

    const updateElapsed = () => {
      const now = new Date();
      const start = new Date(startTime);
      const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
      setElapsed(diff);
    };

    // Atualizar imediatamente
    updateElapsed();

    // Só continuar atualizando se estiver ativo
    if (!isActive) return;

    // Atualizar a cada segundo
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [startTime, isActive]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const timeElapsed = elapsed; // em segundos
  const isOverdue = slaMinutes ? elapsed > (slaMinutes * 60) : false;

  return { elapsed, formatTime, timeElapsed, isOverdue };
}
