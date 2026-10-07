import { execSync } from 'node:child_process';

export default async function globalSetup() {
  console.log('🚀 Iniciando setup global de Playwright...');
  
  // Verificar si ya hay servicios corriendo
  try {
    const response = await fetch('http://localhost:5173', { method: 'HEAD' });
    if (response.ok) {
      console.log('✅ Frontend ya está corriendo en puerto 5173');
      return;
    }
  } catch {
    console.log('ℹ️ No hay frontend corriendo, se levantará con webServer');
  }
}