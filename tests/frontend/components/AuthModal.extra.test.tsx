import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import AuthModal from '../../../frontend/src/components/AuthModal';
import { CLAVE_RESULTADO_OAUTH } from '../../../frontend/src/utils/oauthResultado';

/**
 * EXTRA de AuthModal: profundiza lo que la suite base no cubre — login real
 * contra /api/auth/login (éxito con panel de bienvenida compartido, roles
 * admin/vendedor que navegan, credenciales erradas, verificación pendiente y
 * error de red), registro con validaciones EN ORDEN, verificación de código,
 * recuperación de contraseña completa, portales de políticas y el flujo
 * OAuth (popup + postMessage + respaldo storage).
 *
 * localStorage se reemplaza por un Map funcional para que los temporizadores
 * (token_expira_*) existan de verdad.
 */

const loginMock = vi.fn();
const refreshPerfilMock = vi.fn().mockResolvedValue(undefined);
const navegarMock = vi.fn();
const onCloseMock = vi.fn();

vi.mock('../../../frontend/src/context/AuthContext.tsx', () => ({
  useAuth: () => ({
    login: loginMock,
    refreshPerfil: refreshPerfilMock,
    usuarioLogueado: false,
    usuario: null,
    esAdmin: false,
    esVendedor: false,
    logout: vi.fn(),
    register: vi.fn(),
    fetchPerfil: vi.fn(),
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navegarMock };
});

const almacen = new Map<string, string>();
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (k: string) => almacen.get(k) ?? null,
    setItem: (k: string, v: string) => { almacen.set(k, String(v)); },
    removeItem: (k: string) => { almacen.delete(k); },
    clear: () => { almacen.clear(); },
  },
  writable: true,
});

const montar = (modo: 'login' | 'register' = 'login') =>
  render(
    <BrowserRouter>
      <AuthModal mode={modo} onClose={onCloseMock} />
    </BrowserRouter>,
  );

const llenarLogin = (correo: string, password: string) => {
  fireEvent.change(screen.getByPlaceholderText('correo@ejemplo.com'), { target: { value: correo } });
  fireEvent.change(screen.getByPlaceholderText('Tu contraseña'), { target: { value: password } });
};

const llenarRegistro = () => {
  fireEvent.change(screen.getByPlaceholderText('Nombre'), { target: { name: 'nombre', value: 'Juan Nav-Test' } });
  fireEvent.change(screen.getByPlaceholderText('Apellido'), { target: { name: 'apellido', value: 'Pérez' } });
  fireEvent.change(screen.getByPlaceholderText('correo@ejemplo.com'), { target: { name: 'email', value: 'nuevo@test.com' } });
  fireEvent.change(screen.getByPlaceholderText('Ej: 3001234567'), { target: { name: 'telefono', value: '3001234567' } });
  fireEvent.change(screen.getByPlaceholderText('Calle, Carrera, Barrio'), { target: { name: 'direccion', value: 'Calle 123' } });
  fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), { target: { name: 'password', value: 'Password1' } });
  fireEvent.change(screen.getByPlaceholderText('Repite tu contraseña'), { target: { name: 'confirmar', value: 'Password1' } });
};

const aceptarTodo = () => {
  fireEvent.click(screen.getByRole('checkbox', { name: /Términos y Condiciones/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: /Política de Privacidad/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: /Política de Devoluciones/ }));
};

/** Va del login a la vista verify (por reenvío) — pasa por el panel de correo. */
const irAverificarPorReenvio = async (correo: string) => {
  fireEvent.click(screen.getByText('¿No verificaste tu correo? Reenviar código'));
  const input = await screen.findByPlaceholderText('tu@correo.com');
  fireEvent.change(input, { target: { value: correo } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
  await screen.findByText('Enviado a:', {}, { timeout: 3000 });
};

/** Va del registro a la vista verify. */
const irAverificarPorRegistro = async () => {
  llenarRegistro();
  aceptarTodo();
  fireEvent.click(montarForm().querySelector('form .btn-login-submit') as HTMLButtonElement);
  await screen.findByText('Enviado a:', {}, { timeout: 3000 });
};

/** El botón submit del formulario activo (registro/login comparten clase). */
const montarForm = () => document.querySelector('.auth-modal-card') as HTMLElement;

const cuadritos = () => Array.from(document.querySelectorAll('.auth-cuadrito-input')) as HTMLInputElement[];

/** El título de la vista de nueva clave vive partido por el <span> dentro del h1. */
const esperaNuevaClave = () => screen.findByText('CLAVE', { selector: 'h1 span' });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  almacen.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AuthModal.extra — login con contraseña', () => {
  it('éxito: login con el payload, perfil refrescado y panel de bienvenida sin cerrar de inmediato', async () => {
    server.use(http.post('*/api/auth/login', async ({ request }) => {
      const b = (await request.json()) as { email: string };
      if (b.email === 'cliente@test.com') {
        return HttpResponse.json({
          ok: true,
          id: 9,
          usuario: { ID_USUARIO: 9, NOMBRE_USUARIO: 'Cliente Regular', foto_url: 'https://test.local/foto.png' },
        });
      }
      return HttpResponse.json({ ok: false, error: 'no' }, { status: 401 });
    }));
    montar();
    llenarLogin('cliente@test.com', 'Password1');
    fireEvent.click(screen.getByRole('button', { name: 'ENTRAR' }));

    expect(await screen.findByTestId('oauth-exito', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('Bienvenido, Cliente Regular')).toBeInTheDocument();
    expect(screen.getByText('Cargando tu cuenta…')).toBeInTheDocument();
    expect(loginMock).toHaveBeenCalledWith(expect.objectContaining({
      ID_USUARIO: 9, NOMBRE_USUARIO: 'Cliente Regular', foto_url: 'https://test.local/foto.png',
    }));
    expect(refreshPerfilMock).toHaveBeenCalledTimes(1);
    // El cierre va por TIMER de 2 s, no por awaits de red.
    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it('admin (ID_ROL 1) navega a /admin al terminar la bienvenida de 2 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    montar();
    llenarLogin('admin@jadda.test', 'clave-admin-mock');
    fireEvent.click(screen.getByRole('button', { name: 'ENTRAR' }));

    await screen.findByTestId('oauth-exito', {}, { timeout: 3000 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(navegarMock).toHaveBeenCalledWith('/admin');
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('vendedor (ID_ROL 6) navega a /vendedor al terminar la bienvenida', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    montar();
    llenarLogin('vendedor@jadda.test', 'clave-vendedor-mock');
    fireEvent.click(screen.getByRole('button', { name: 'ENTRAR' }));

    await screen.findByTestId('oauth-exito', {}, { timeout: 3000 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(navegarMock).toHaveBeenCalledWith('/vendedor');
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('credenciales erradas: badge de error y sacudida de la tarjeta', async () => {
    montar();
    llenarLogin('cliente@test.com', 'mal-password');
    fireEvent.click(screen.getByRole('button', { name: 'ENTRAR' }));

    expect(await screen.findByText('Credenciales incorrectas', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(document.querySelector('.auth-modal-card')).toHaveClass('shake-animation');
  });

  it('verificación pendiente: abre el panel de reenvío y de ahí la vista verify', async () => {
    server.use(http.post('*/api/auth/login', () =>
      HttpResponse.json({ ok: false, requiereVerificacion: true }, { status: 401 })));
    montar();
    llenarLogin('no-verificado@test.com', 'Password1');
    fireEvent.click(screen.getByRole('button', { name: 'ENTRAR' }));

    expect(await screen.findByText('Introduce tu correo para enviarte un nuevo código de verificación:')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('tu@correo.com')).toHaveValue('no-verificado@test.com');

    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
    await screen.findByText('Enviado a:', {}, { timeout: 3000 });
    expect(screen.getByText('no-verificado@test.com')).toBeInTheDocument();
    expect(screen.getByText('Podrás reenviar en')).toBeInTheDocument();
    // El origen del "volver" es el login.
    expect(screen.getByText('VOLVER A LOGIN')).toBeInTheDocument();
  });

  it('el panel de reenvío se cancela sin perder la vista de login', async () => {
    server.use(http.post('*/api/auth/login', () =>
      HttpResponse.json({ ok: false, requiereVerificacion: true }, { status: 401 })));
    montar();
    llenarLogin('no-verificado@test.com', 'Password1');
    fireEvent.click(screen.getByRole('button', { name: 'ENTRAR' }));
    await screen.findByText('Introduce tu correo para enviarte un nuevo código de verificación:');

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByPlaceholderText('tu@correo.com')).not.toBeInTheDocument();
    expect(screen.getByText('Iniciar Sesión')).toBeInTheDocument();
  });

  it('respuesta ilegible del servidor cae en error de conexión', async () => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.text('gateway-timeout')));
    montar();
    llenarLogin('cliente@test.com', 'Password1');
    fireEvent.click(screen.getByRole('button', { name: 'ENTRAR' }));

    expect(await screen.findByText('Error de conexión con el servidor.', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });
});

describe('AuthModal.extra — registro', () => {
  it('valida EN ORDEN y muestra el primer campo fallido', async () => {
    montar('register');
    const submit = () => fireEvent.click(document.querySelector('form .btn-login-submit') as HTMLButtonElement);

    submit();
    expect(await screen.findByText('El nombre es obligatorio.')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Nombre'), { target: { name: 'nombre', value: 'Juan' } });
    submit();
    expect(await screen.findByText('El apellido es obligatorio.')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Apellido'), { target: { name: 'apellido', value: 'Pérez' } });
    submit();
    expect(await screen.findByText('El correo electrónico es obligatorio.')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('correo@ejemplo.com'), { target: { name: 'email', value: 'nuevo@test.com' } });
    submit();
    expect(await screen.findByText('El teléfono es obligatorio (10 dígitos).')).toBeInTheDocument();

    // Teléfono con 9 dígitos → mensaje de formato.
    fireEvent.change(screen.getByPlaceholderText('Ej: 3001234567'), { target: { name: 'telefono', value: '300123456' } });
    submit();
    expect(await screen.findByText('El teléfono debe tener exactamente 10 dígitos.')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Ej: 3001234567'), { target: { name: 'telefono', value: '3001234567' } });
    submit();
    expect(await screen.findByText('La dirección es obligatoria.')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Calle, Carrera, Barrio'), { target: { name: 'direccion', value: 'Calle 123' } });
    submit();
    expect(await screen.findByText('La contraseña es obligatoria.')).toBeInTheDocument();

    // Contraseña débil (sin mayúscula).
    fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), { target: { name: 'password', value: 'password1' } });
    submit();
    expect(await screen.findByText('La contraseña debe tener mínimo 8 caracteres, una mayúscula y un número.')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), { target: { name: 'password', value: 'Password1' } });
    submit();
    expect(await screen.findByText('Debes confirmar tu contraseña.')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Repite tu contraseña'), { target: { name: 'confirmar', value: 'Otra1234' } });
    submit();
    expect(await screen.findByText('Las contraseñas ingresadas no coinciden.')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Repite tu contraseña'), { target: { name: 'confirmar', value: 'Password1' } });
    submit();
    expect(await screen.findByText('Debes aceptar los Términos y Condiciones para continuar.')).toBeInTheDocument();

    aceptarTodo();
    // Solo la privacidad apagada: el orden de validación es Términos → Privacidad → Devoluciones.
    fireEvent.click(screen.getByRole('checkbox', { name: /Política de Privacidad/ }));
    submit();
    expect(await screen.findByText('Debes aceptar la Política de Privacidad para continuar.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /Política de Privacidad/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Política de Devoluciones/ }));
    submit();
    expect(await screen.findByText('Debes aceptar la Política de Devoluciones y Garantías para continuar.')).toBeInTheDocument();
  });

  it('registro exitoso lleva a la vista verify con temporizador de reenvío', async () => {
    montar('register');
    llenarRegistro();
    aceptarTodo();
    fireEvent.click(document.querySelector('form .btn-login-submit') as HTMLButtonElement);

    await screen.findByText('Enviado a:', {}, { timeout: 3000 });
    expect(screen.getByText('nuevo@test.com')).toBeInTheDocument();
    expect(screen.getByText('Podrás reenviar en')).toBeInTheDocument();
    expect(screen.getByText('VOLVER A REGISTRO')).toBeInTheDocument();
    // La expiración del código quedó guardada (15 minutos).
    expect(almacen.get('token_expira_nuevo@test.com')).not.toBeNull();
  });

  it('error del backend de registro se muestra tal cual llega', async () => {
    server.use(http.post('*/api/auth/registro', () =>
      HttpResponse.json({ message: 'El correo ya está registrado ADMIN-TEST' }, { status: 400 })));
    montar('register');
    llenarRegistro();
    aceptarTodo();
    fireEvent.click(document.querySelector('form .btn-login-submit') as HTMLButtonElement);

    expect(await screen.findByText('El correo ya está registrado ADMIN-TEST', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(document.querySelector('.auth-modal-card')).toHaveClass('shake-animation');
  });
});

describe('AuthModal.extra — verificación de código', () => {
  it('los cuadritos aceptan un dígito, avanzan el foco y retroceden con Backspace', async () => {
    montar('register');
    llenarRegistro();
    aceptarTodo();
    fireEvent.click(document.querySelector('form .btn-login-submit') as HTMLButtonElement);
    await screen.findByText('Enviado a:', {}, { timeout: 3000 });

    const inputs = cuadritos();
    expect(inputs).toHaveLength(6);
    fireEvent.change(inputs[0], { target: { value: '1' } });
    expect(document.activeElement).toBe(inputs[1]);
    // Una letra no entra.
    fireEvent.change(inputs[1], { target: { value: 'a' } });
    expect(inputs[1]).toHaveValue('');
    // Backspace en cuadrito vacío (3) devuelve el foco al anterior (2).
    fireEvent.change(inputs[2], { target: { value: '3' } });
    fireEvent.keyDown(inputs[3], { key: 'Backspace' });
    expect(document.activeElement).toBe(inputs[2]);
  });

  it('código correcto: ¡LISTO! y a los 2 s vuelve al login con el correo lleno', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    montar('register');
    llenarRegistro();
    aceptarTodo();
    fireEvent.click(document.querySelector('form .btn-login-submit') as HTMLButtonElement);
    await screen.findByText('Enviado a:', {}, { timeout: 3000 });

    const inputs = cuadritos();
    '123456'.split('').forEach((d, i) => fireEvent.change(inputs[i], { target: { value: d } }));
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRMAR' }));

    expect(await screen.findByText('¡LISTO!')).toBeInTheDocument();
    expect(screen.getByText('Cuenta verificada en JADDA SPORTS. Ya puedes iniciar sesión.')).toBeInTheDocument();
    // El temporizador de 2 s puede registrarse con el reloj ya avanzado por el
    // auto-advance: avanzar y esperar con tolerancia.
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(2000);
    await waitFor(() => expect(screen.getByText('Iniciar Sesión')).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByPlaceholderText('correo@ejemplo.com')).toHaveValue('nuevo@test.com');
  });

  it('código incorrecto: mensaje EXACTO del backend y cuadritos limpios', async () => {
    server.use(http.post('*/api/auth/confirmar', () =>
      HttpResponse.json({ message: 'Código incorrecto o ya utilizado.' }, { status: 400 })));
    montar('register');
    llenarRegistro();
    aceptarTodo();
    fireEvent.click(document.querySelector('form .btn-login-submit') as HTMLButtonElement);
    await screen.findByText('Enviado a:', {}, { timeout: 3000 });

    const inputs = cuadritos();
    '999999'.split('').forEach((d, i) => fireEvent.change(inputs[i], { target: { value: d } }));
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRMAR' }));

    expect(await screen.findByText('Código incorrecto o ya utilizado.', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(cuadritos().every((i) => i.value === '')).toBe(true);
  });

  it('REENVIAR CÓDIGO (tras expirar el cooldown) reenvía y vuelve a bloquear 100 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    montar('register');
    llenarRegistro();
    aceptarTodo();
    fireEvent.click(document.querySelector('form .btn-login-submit') as HTMLButtonElement);
    await screen.findByText('Enviado a:', {}, { timeout: 3000 });

    // Expirar el cooldown de 100 s con el reloj falso (margen: el intervalo
    // arranca ~1 s después de montar la vista).
    await vi.advanceTimersByTimeAsync(110000);
    const botonReenviar = screen.getByRole('button', { name: 'REENVIAR CÓDIGO' });
    fireEvent.click(botonReenviar);

    await screen.findByText('Podrás reenviar en', {}, { timeout: 3000 });
    expect(screen.queryByRole('button', { name: 'REENVIAR CÓDIGO' })).not.toBeInTheDocument();
  });

  it('límite de reenvíos (429) bloquea el botón con el aviso', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    server.use(http.post('*/api/auth/reenviar-codigo', () =>
      HttpResponse.json({ message: 'Límite diario ADMIN-TEST' }, { status: 429 })));
    montar('register');
    llenarRegistro();
    aceptarTodo();
    fireEvent.click(document.querySelector('form .btn-login-submit') as HTMLButtonElement);
    await screen.findByText('Enviado a:', {}, { timeout: 3000 });

    await vi.advanceTimersByTimeAsync(101000);
    fireEvent.click(screen.getByRole('button', { name: 'REENVIAR CÓDIGO' }));

    expect(await screen.findByText('Límite de reenvíos alcanzado. Intenta más tarde.', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'REENVIAR CÓDIGO' })).not.toBeInTheDocument();
  });

  it('VOLVER A REGISTRO regresa a la vista de registro', async () => {
    montar('register');
    await irAverificarPorRegistro();
    fireEvent.click(screen.getByText('VOLVER A REGISTRO'));
    expect(screen.getByText('Crear Cuenta')).toBeInTheDocument();
  });
});

describe('AuthModal.extra — recuperación de contraseña', () => {
  const irAforgotCode = async (correo = 'olvidado@test.com') => {
    montar();
    fireEvent.click(screen.getByText('¿Olvidaste tu contraseña?'));
    await screen.findByText('RECUPERACIÓN DE CUENTA');
    fireEvent.change(screen.getByPlaceholderText('tu@correo.com'), { target: { value: correo } });
    fireEvent.click(screen.getByRole('button', { name: 'ENVIAR CÓDIGO' }));
    await screen.findByText('Introduce los 6 dígitos enviados a', {}, { timeout: 3000 });
  };

  it('correo vacío en forgot-email muestra el error y marca el campo', async () => {
    montar();
    fireEvent.click(screen.getByText('¿Olvidaste tu contraseña?'));
    await screen.findByText('RECUPERACIÓN DE CUENTA');
    fireEvent.click(screen.getByRole('button', { name: 'ENVIAR CÓDIGO' }));

    expect(await screen.findByText('Ingresa tu correo electrónico.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('tu@correo.com')).toHaveClass('input-error');
  });

  it('forgot-code: foco entre cuadritos, código incompleto valida y completo avanza', async () => {
    await irAforgotCode();
    // Sin cooldown al llegar: el reenvío está disponible de entrada.
    expect(await screen.findByRole('button', { name: 'Reenviar nuevo código' })).toBeEnabled();
    // La expiración del código está visible.
    expect(screen.getByText(/El código expira en/)).toBeInTheDocument();

    const fcode = (i: number) => document.getElementById(`fcode-${i}`) as HTMLInputElement;
    fireEvent.change(fcode(0), { target: { value: '1' } });
    expect(document.activeElement).toBe(fcode(1));
    // No numérico no entra.
    fireEvent.change(fcode(1), { target: { value: 'x' } });
    expect(fcode(1)).toHaveValue('');
    fireEvent.keyDown(fcode(2), { key: 'Backspace' });
    expect(document.activeElement).toBe(fcode(1));

    // Incompleto → error.
    fireEvent.click(screen.getByRole('button', { name: 'CONTINUAR' }));
    expect(await screen.findByText('Completa el código de 6 dígitos.')).toBeInTheDocument();

    '123456'.split('').forEach((d, i) => fireEvent.change(fcode(i), { target: { value: d } }));
    fireEvent.click(screen.getByRole('button', { name: 'CONTINUAR' }));
    await esperaNuevaClave();
  });

  it('código inválido en forgot-code muestra el error del backend', async () => {
    server.use(http.post('*/api/auth/verificar-codigo', () =>
      HttpResponse.json({ message: 'Código inválido o expirado ADMIN-TEST' }, { status: 400 })));
    await irAforgotCode();
    const fcode = (i: number) => document.getElementById(`fcode-${i}`) as HTMLInputElement;
    '654321'.split('').forEach((d, i) => fireEvent.change(fcode(i), { target: { value: d } }));
    fireEvent.click(screen.getByRole('button', { name: 'CONTINUAR' }));

    expect(await screen.findByText('Código inválido o expirado ADMIN-TEST', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('nueva contraseña: checker, botón bloqueado hasta validar y ¡CAMBIO EXITO!', async () => {
    await irAforgotCode();
    const fcode = (i: number) => document.getElementById(`fcode-${i}`) as HTMLInputElement;
    '123456'.split('').forEach((d, i) => fireEvent.change(fcode(i), { target: { value: d } }));
    fireEvent.click(screen.getByRole('button', { name: 'CONTINUAR' }));
    await esperaNuevaClave();

    const nueva = screen.getByPlaceholderText('Mínimo 8 caracteres');
    const confirmar = screen.getByPlaceholderText('Repite tu contraseña');
    const boton = screen.getByRole('button', { name: 'ACTUALIZAR CONTRASEÑA' });
    // Débil y sin coincidir: deshabilitado.
    fireEvent.change(nueva, { target: { value: 'corta' } });
    fireEvent.change(confirmar, { target: { value: 'otra' } });
    expect(boton).toBeDisabled();
    expect(screen.getByText('✔ Mayúscula')).not.toHaveClass('valid');

    fireEvent.change(nueva, { target: { value: 'Nueva1234' } });
    fireEvent.change(confirmar, { target: { value: 'Nueva1234' } });
    expect(screen.getByText('✔ Mayúscula')).toHaveClass('valid');
    expect(screen.getByText('✔ Número')).toHaveClass('valid');
    expect(screen.getByText('✔ +8 Caracteres')).toHaveClass('valid');
    expect(boton).toBeEnabled();
    fireEvent.click(boton);

    expect(await screen.findByText('¡CAMBIO EXITOSO!')).toBeInTheDocument();
    expect(screen.getByText('Tu cuenta está protegida. Ya puedes iniciar sesión.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'IR AL LOGIN' }));
    expect(screen.getByText('Iniciar Sesión')).toBeInTheDocument();
  });

  it('reenviar en forgot-code: tras el cooldown reinicia el timer y limpia los cuadritos', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    await irAforgotCode();
    await vi.advanceTimersByTimeAsync(101000);

    const botonReenviar = screen.getByRole('button', { name: 'Reenviar nuevo código' });
    expect(botonReenviar).toBeEnabled();
    fireEvent.click(botonReenviar);

    await screen.findByText('Reenviar en 100s', {}, { timeout: 3000 });
    expect(cuadritos().every((i) => i.value === '')).toBe(true);
  });
});

describe('AuthModal.extra — portales de políticas', () => {
  it('Términos: ACEPTO marca el checkbox y cierra; NO ACEPTO lo desmarca', async () => {
    montar('register');
    fireEvent.click(screen.getByText('Términos y Condiciones'));
    expect(await screen.findByText('Términos y Condiciones de Uso')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ACEPTO' }));
    expect(screen.getByRole('checkbox', { name: /Términos/ })).toBeChecked();
    expect(screen.queryByText('Términos y Condiciones de Uso')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Términos y Condiciones'));
    expect(await screen.findByText('Términos y Condiciones de Uso')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'NO ACEPTO' }));
    expect(screen.getByRole('checkbox', { name: /Términos/ })).not.toBeChecked();
  });

  it('Privacidad: el portal abre, acepta y cierra', async () => {
    montar('register');
    fireEvent.click(screen.getByText('Política de Privacidad'));
    // El h3 del portal repite el texto del span del formulario → anclar al h3.
    expect(await screen.findByText('Política de Privacidad', { selector: 'h3' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ACEPTO' }));
    expect(screen.getByRole('checkbox', { name: /Privacidad/ })).toBeChecked();
  });

  it('Devoluciones: el portal abre, acepta y cierra', async () => {
    montar('register');
    fireEvent.click(screen.getByText('Política de Devoluciones y Garantías'));
    expect(await screen.findByText('Política de Devoluciones y Garantías', { selector: 'h3' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ACEPTO' }));
    expect(screen.getByRole('checkbox', { name: /Devoluciones/ })).toBeChecked();
  });
});

describe('AuthModal.extra — OAuth con Google', () => {
  it('el botón Google abre el popup con la URL y dimensiones fijas', () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Google' }));

    expect(abrir).toHaveBeenCalledWith(
      '/api/auth/google?from=/oauth-popup-callback',
      'oauth-google',
      expect.stringContaining('width=600'),
    );
    abrir.mockRestore();
  });

  it('postMessage de éxito: login provisional, perfil y bienvenida que cierra a los 2 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    montar();
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: { type: 'oauth-success', user: 'Yeison OAuth', photo: 'https://test.local/g.png' },
    }));

    expect(await screen.findByTestId('oauth-exito')).toBeInTheDocument();
    expect(screen.getByText('Bienvenido, Yeison OAuth')).toBeInTheDocument();
    expect(loginMock).toHaveBeenCalledWith({ NOMBRE_USUARIO: 'Yeison OAuth', foto_url: 'https://test.local/g.png' });
    expect(refreshPerfilMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('postMessage de un origen distinto se ignora', () => {
    montar();
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://malicioso.example',
      data: { type: 'oauth-success', user: 'Intruso', photo: null },
    }));

    expect(screen.queryByTestId('oauth-exito')).not.toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('postMessage de fallo muestra el motivo en un banner con cierre', async () => {
    montar();
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: { type: 'oauth-error', motivo: 'Google rechazó el acceso ADMIN-TEST' },
    }));

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Google rechazó el acceso ADMIN-TEST');
    expect(screen.queryByTestId('oauth-exito')).not.toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sin motivo el banner usa el mensaje genérico', async () => {
    montar();
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: { type: 'oauth-error', motivo: '' },
    }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar el inicio de sesión con Google');
  });

  it('respaldo por storage (COOP): el evento storage produce la misma bienvenida', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    montar();
    window.dispatchEvent(new StorageEvent('storage', {
      key: CLAVE_RESULTADO_OAUTH,
      newValue: JSON.stringify({ type: 'oauth-success', user: 'Desde Storage', photo: null }),
    }));

    expect(await screen.findByTestId('oauth-exito')).toBeInTheDocument();
    expect(screen.getByText('Bienvenido, Desde Storage')).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(2000);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('un evento storage con JSON corrupto se ignora', () => {
    montar();
    window.dispatchEvent(new StorageEvent('storage', {
      key: CLAVE_RESULTADO_OAUTH,
      newValue: '{no-es-json',
    }));

    expect(screen.queryByTestId('oauth-exito')).not.toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });
});
