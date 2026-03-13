export interface LoginData {
    email: string;
    password: string;
}

export interface RegisterData {
    username: string;
    email: string;
    password: string;
    nombre: string;
    apellido: string;
    telefono?: string;
    direccion?: string;
}

export interface Usuario {
    _id: string;
    username: string;
    email: string;
    nombre: string;
    apellido: string;
    telefono?: string;
    direccion?: string;
    rol: 'Admin' | 'Usuario' | 'Veterinario';
    activo: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AuthResponse {
    success: boolean;
    token: string;
    user: Usuario;
    // message?: string;
    // error?: string;
}

export class AuthService {
    private static instance: AuthService;
    private baseUrl: string = window.APP_CONFIG?.API_BASE_URL || "";
    private token: string | null = null;
    private usuario: Usuario | null = null;

    private constructor() {
        // Cargar token del localStorage al inicializar
        this.cargarTokenDesdeStorage();
    }

    public static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    // Login
    public async login(loginData: LoginData): Promise<AuthResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(loginData)
            });

            const result: AuthResponse = await response.json();

            if (result.success && result.user) {
                this.token = result.token;
                this.usuario = result.user;
                this.guardarTokenEnStorage();
                this.guardarUsuarioEnStorage();
            }

            return result;

        } catch (error) {
            console.error('Error en login:', error);
            return {
                success: false,
                error: 'Error de conexión'
            };
        }
    }

    // Registro
    public async registrar(registerData: RegisterData): Promise<AuthResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/registrar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(registerData)
            });

            const result: AuthResponse = await response.json();

            if (result.success && result.user) {
                this.token = result.token;
                this.usuario = result.user;
                this.guardarTokenEnStorage();
                this.guardarUsuarioEnStorage();
            }

            return result;

        } catch (error) {
            console.error('Error en registro:', error);
            return {
                success: false,
                error: 'Error de conexión'
            };
        }
    }

    // Logout
    public async logout(): Promise<void> {
        try {
            if (this.token) {
                await fetch(`${this.baseUrl}/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });
            }
        } catch (error) {
            console.error('Error en logout:', error);
        } finally {
            this.token = null;
            this.usuario = null;
            this.limpiarStorage();
        }
    }

    // Obtener perfil del usuario
    public async obtenerPerfil(): Promise<Usuario | null> {
        if (!this.token) return null;

        try {
            const response = await fetch(`${this.baseUrl}/auth/perfil`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // Token expirado
                    this.logout();
                }
                return null;
            }

            const result = await response.json();
            if (result.success) {
                this.usuario = result.data;
                this.guardarUsuarioEnStorage();
                return result.data;
            }

            return null;

        } catch (error) {
            console.error('Error obteniendo perfil:', error);
            return null;
        }
    }

    // Actualizar perfil
    public async actualizarPerfil(datosActualizacion: Partial<Usuario>): Promise<AuthResponse> {
        if (!this.token) {
            return {
                success: false,
                error: 'No hay sesión activa'
            };
        }

        try {
            const response = await fetch(`${this.baseUrl}/auth/perfil`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(datosActualizacion)
            });

            const result: AuthResponse = await response.json();

            if (result.success && result.data) {
                this.usuario = result.data.usuario;
                this.guardarUsuarioEnStorage();
            }

            return result;

        } catch (error) {
            console.error('Error actualizando perfil:', error);
            return {
                success: false,
                error: 'Error de conexión'
            };
        }
    }

    // Cambiar contraseña
    public async cambiarPassword(passwordActual: string, passwordNuevo: string): Promise<AuthResponse> {
        if (!this.token) {
            return {
                success: false,
                error: 'No hay sesión activa'
            };
        }

        try {
            const response = await fetch(`${this.baseUrl}/auth/cambiar-password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    passwordActual,
                    passwordNuevo
                })
            });

            return await response.json();

        } catch (error) {
            console.error('Error cambiando contraseña:', error);
            return {
                success: false,
                error: 'Error de conexión'
            };
        }
    }

    // Verificar si está autenticado
    public isAuthenticated(): boolean {
        if (!this.token || !this.usuario) return false;

        // Verificar que el token no esté expirado
        try {
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            const ahora = Math.floor(Date.now() / 1000);
            if (payload.exp && payload.exp < ahora) {
                // Token expirado, limpiar
                this.token = null;
                this.usuario = null;
                this.limpiarStorage();
                return false;
            }
        } catch (error) {
            // Token malformado
            this.token = null;
            this.usuario = null;
            this.limpiarStorage();
            return false;
        }

        return true;
    }

    // Obtener token
    public getToken(): string | null {
        return this.token;
    }

    // Obtener usuario actual
    public getCurrentUser(): Usuario | null {
        return this.usuario;
    }

    // Verificar rol
    public hasRole(rol: string): boolean {
        return this.usuario?.rol === rol;
    }

    // Verificar si es admin
    public isAdmin(): boolean {
        return this.hasRole('Admin');
    }

    // Hacer petición autenticada
    public async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
        if (!this.token) {
            throw new Error('No hay token de autenticación');
        }

        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${this.token}`
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (response.status === 401) {
            // Token expirado, logout automático
            await this.logout();
            throw new Error('Sesión expirada');
        }

        return response;
    }

    // Métodos privados para manejo de localStorage
    private cargarTokenDesdeStorage(): void {
        if (typeof Storage !== "undefined") {
            this.token = localStorage.getItem('auth_token');
            const usuarioStr = localStorage.getItem('auth_user');
            if (usuarioStr) {
                try {
                    this.usuario = JSON.parse(usuarioStr);
                } catch (error) {
                    console.error('Error parseando usuario del localStorage:', error);
                    localStorage.removeItem('auth_user');
                }
            }
        }
    }

    private guardarTokenEnStorage(): void {
        if (typeof Storage !== "undefined" && this.token) {
            localStorage.setItem('auth_token', this.token);
        }
    }

    private guardarUsuarioEnStorage(): void {
        if (typeof Storage !== "undefined" && this.usuario) {
            localStorage.setItem('auth_user', JSON.stringify(this.usuario));
        }
    }

    private limpiarStorage(): void {
        if (typeof Storage !== "undefined") {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
        }
    }

    // Renovar token automáticamente
    public async renovarToken(): Promise<boolean> {
        if (!this.token) return false;

        try {
            const response = await fetch(`${this.baseUrl}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const result = await response.json();
            if (result.success && result.data.token) {
                this.token = result.data.token;
                this.guardarTokenEnStorage();
                return true;
            }

            return false;

        } catch (error) {
            console.error('Error renovando token:', error);
            return false;
        }
    }

    // Inicializar auto-renovación de token
    public iniciarAutoRenovacion(): void {
        // Renovar token cada 23 horas (asumiendo que expira en 24h)
        setInterval(async () => {
            if (this.isAuthenticated()) {
                await this.renovarToken();
            }
        }, 23 * 60 * 60 * 1000); // 23 horas
    }
}