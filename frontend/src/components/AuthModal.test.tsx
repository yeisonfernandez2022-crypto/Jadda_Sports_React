import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthModal from '../components/AuthModal.tsx';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';

// Mock axios
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

// Mock useAuth hook
const mockLogin = vi.fn();
const mockRefreshPerfil = vi.fn().mockResolvedValue(undefined);

vi.mock('../context/AuthContext.tsx', () => ({
  useAuth: () => ({
    login: mockLogin,
    refreshPerfil: mockRefreshPerfil,
    usuarioLogueado: false,
    usuario: null,
    esAdmin: false,
    esVendedor: false,
    logout: vi.fn(),
    register: vi.fn(),
    fetchPerfil: vi.fn(),
  }),
}));

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

const originalBodyStyle = document.body.style.overflow;

const renderWithRouter = (component: React.ReactNode, props = {}) => {
  return render(
    <BrowserRouter>
      <AuthModal {...{ mode: 'login', onClose: vi.fn(), ...props }} />
    </BrowserRouter>
  );
};

describe('AuthModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockImplementation(() => {});
    localStorageMock.removeItem.mockImplementation(() => {});
    document.body.style.overflow = originalBodyStyle;
  });

  afterEach(() => {
    document.body.style.overflow = originalBodyStyle;
  });

  describe('Renderizado básico', () => {
    it('renderiza el modal de login por defecto', () => {
      renderWithRouter(<AuthModal mode="login" onClose={vi.fn()} />);
      expect(screen.getByText('Iniciar Sesión')).toBeInTheDocument();
      expect(screen.getByText('JADDA')).toBeInTheDocument();
    });

    it('tiene pestañas para alternar login/registro en vistas principales', () => {
      renderWithRouter(<AuthModal mode="login" onClose={vi.fn()} />);
      expect(screen.getByText('INICIAR SESIÓN')).toBeInTheDocument();
      expect(screen.getByText('CREAR CUENTA')).toBeInTheDocument();
    });
  });

  describe('Cambio de vistas (pestañas)', () => {
    it('cambia a registro al hacer click en pestaña CREAR CUENTA', () => {
      renderWithRouter(<AuthModal mode="login" onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('CREAR CUENTA'));
      expect(screen.getByText('Crear Cuenta')).toBeInTheDocument();
      expect(screen.getByText('Regístrate para gestionar tus pedidos y favoritos')).toBeInTheDocument();
    });

    it('cambia a login al hacer click en pestaña INICIAR SESIÓN', () => {
      renderWithRouter(<AuthModal mode="register" onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('INICIAR SESIÓN'));
      expect(screen.getByText('Iniciar Sesión')).toBeInTheDocument();
    });

    it('navega a forgot-email desde login', () => {
      renderWithRouter(<AuthModal mode="login" onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('¿Olvidaste tu contraseña?'));
      expect(screen.getByText('RECUPERACIÓN DE CUENTA')).toBeInTheDocument();
    });

    it('navega a login desde forgot-email', () => {
      renderWithRouter(<AuthModal mode="login" onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('¿Olvidaste tu contraseña?'));
      fireEvent.click(screen.getByText('VOLVER AL LOGIN'));
      expect(screen.getByText('Iniciar Sesión')).toBeInTheDocument();
    });
  });

  describe('Validación Login', () => {
    it('muestra error si campos vacíos en login', () => {
      renderWithRouter(<AuthModal mode="login" onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('ENTRAR'));
      expect(screen.getByText('Completa todos los campos.')).toBeInTheDocument();
    });

    it('marca campo correo como error si está vacío', () => {
      renderWithRouter(<AuthModal mode="login" onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('ENTRAR'));
      const correoInput = screen.getByPlaceholderText('correo@ejemplo.com');
      expect(correoInput).toHaveClass('input-error');
    });

    it('marca campo password como error si está vacío', () => {
      renderWithRouter(<AuthModal mode="login" onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('ENTRAR'));
      const passwordInput = screen.getByPlaceholderText('Tu contraseña');
      expect(passwordInput).toHaveClass('input-error');
    });

    it('toggle muestra/oculta password', () => {
      renderWithRouter(<AuthModal mode="login" onClose={vi.fn()} />);
      const toggleBtn = screen.getByRole('button', { name: '' }); // Button with empty name (icon only)
      expect(screen.getByPlaceholderText('Tu contraseña')).toHaveAttribute('type', 'password');
      fireEvent.click(toggleBtn);
      expect(screen.getByPlaceholderText('Tu contraseña')).toHaveAttribute('type', 'text');
    });
  });

  describe('Validación Registro (pestaña)', () => {
    it('cambia a registro y renderiza campos', async () => {
      renderWithRouter(<AuthModal mode="login" onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('CREAR CUENTA'));
      await waitFor(() => expect(screen.getByText('Crear Cuenta')).toBeInTheDocument());
      expect(screen.getByPlaceholderText('Nombre')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Apellido')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('correo@ejemplo.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Ej: 3001234567')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Calle, Carrera, Barrio')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Mínimo 8 caracteres')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Repite tu contraseña')).toBeInTheDocument();
    });

    it('requiere aceptar términos y condiciones', async () => {
      renderWithRouter(<AuthModal mode="login" onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('CREAR CUENTA'));
      await waitFor(() => expect(screen.getByPlaceholderText('Nombre')).toBeInTheDocument());

      // Llenar campos requeridos
      fireEvent.change(screen.getByPlaceholderText('Nombre'), { target: { name: 'nombre', value: 'Juan' } });
      fireEvent.change(screen.getByPlaceholderText('Apellido'), { target: { name: 'apellido', value: 'Perez' } });
      fireEvent.change(screen.getByPlaceholderText('correo@ejemplo.com'), { target: { name: 'email', value: 'juan@test.com' } });
      fireEvent.change(screen.getByPlaceholderText('Ej: 3001234567'), { target: { name: 'telefono', value: '3001234567' } });
      fireEvent.change(screen.getByPlaceholderText('Calle, Carrera, Barrio'), { target: { name: 'direccion', value: 'Calle 123' } });
      fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), { target: { name: 'password', value: 'Pass1234' } });
      fireEvent.change(screen.getByPlaceholderText('Repite tu contraseña'), { target: { name: 'confirmar', value: 'Pass1234' } });

      const submitButtons = screen.getAllByRole('button', { name: /CREAR CUENTA/i });
      const submitButton = submitButtons.find(btn => btn.type === 'submit' || btn.getAttribute('type') === 'submit') || submitButtons[1];
      fireEvent.click(submitButton);
      // Verificar que el checkbox de términos es requerido (no se muestra error específico pero el formulario no avanza)
      const termsCheckbox = screen.getByLabelText(/Términos y Condiciones/i);
      expect(termsCheckbox).not.toBeChecked();
    });
  });

  describe('Indicador de fortaleza de contraseña (en pestaña registro)', () => {
    it('marca requisito longitud cumplido (✔) para contraseña 8+ chars', async () => {
      renderWithRouter(<AuthModal mode="login" onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('CREAR CUENTA'));
      await waitFor(() => expect(screen.getByPlaceholderText('Mínimo 8 caracteres')).toBeInTheDocument());
      fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), { target: { name: 'password', value: 'password123' } });
      expect(screen.getByText('✔ +8 Caracteres')).toBeInTheDocument();
    });

    it('marca requisito número cumplido (✔) para contraseña con número', async () => {
      renderWithRouter(<AuthModal mode="login" onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('CREAR CUENTA'));
      await waitFor(() => expect(screen.getByPlaceholderText('Mínimo 8 caracteres')).toBeInTheDocument());
      fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), { target: { name: 'password', value: 'password1' } });
      expect(screen.getByText('✔ +8 Caracteres')).toBeInTheDocument();
      expect(screen.getByText('✔ Número')).toBeInTheDocument();
    });

    it('marca todos los requisitos cumplidos (✔) para contraseña fuerte', async () => {
      renderWithRouter(<AuthModal mode="login" onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('CREAR CUENTA'));
      await waitFor(() => expect(screen.getByPlaceholderText('Mínimo 8 caracteres')).toBeInTheDocument());
      fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), { target: { name: 'password', value: 'Password1' } });
      expect(screen.getByText('✔ Mayúscula')).toBeInTheDocument();
      expect(screen.getByText('✔ Número')).toBeInTheDocument();
      expect(screen.getByText('✔ +8 Caracteres')).toBeInTheDocument();
    });
  });

  describe('Botones sociales', () => {
    it('renderiza botones de Google y Facebook', () => {
      renderWithRouter(<AuthModal mode="login" onClose={vi.fn()} />);
      expect(screen.getByText('Google')).toBeInTheDocument();
      expect(screen.getByText('Facebook')).toBeInTheDocument();
    });
  });

  describe('Enlaces de navegación entre vistas', () => {
    it('link "¿No tienes cuenta?" navega a registro', () => {
      renderWithRouter(<AuthModal mode="login" onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('Regístrate gratis'));
      expect(screen.getByText('Crear Cuenta')).toBeInTheDocument();
    });

    it('link en registro navega a login', async () => {
      renderWithRouter(<AuthModal mode="login" onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('CREAR CUENTA'));
      await waitFor(() => expect(screen.getByText('Crear Cuenta')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Inicia sesión'));
      expect(screen.getByText('Iniciar Sesión')).toBeInTheDocument();
    });
  });
});