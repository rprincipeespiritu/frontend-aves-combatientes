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
    rol: string;
    activo: boolean;
}

export interface AuthResponse {
    success: boolean;
    token?: string;
    userId?: string;
    username?: string;
    nombre?: string;
    apellido?: string;
    email?: string;
    rol?: string;
    activo?: boolean;
    estado?: string;
    telefono?: string;
    direccion?: string;
    message?: string;
    error?: string;
    data?: any;
}

export class AuthService {
    private baseUrl: string = window.APP_CONFIG?.API_BASE_URL || "";
    private static instance: AuthService;
    private readonly inactivityTimeoutMs: number = 10 * 60 * 1000;
    private readonly inactivityCheckIntervalMs: number = 30 * 1000;
    private inactivityTimer: number | null = null;
    private inactivityCheckTimer: number | null = null;
    private inactivityStarted: boolean = false;
    private inactivityClosing: boolean = false;
    private onInactivityTimeout?: () => void;
    private _token: string = "";    
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

            if (result.success && result.nombre) {
                this.token = result.token;
                let user = {
                    _id: result.userId,
                    username: result.username,
                    nombre: result.nombre,
                    apellido: result.apellido,
                    email: result.email,
                    rol: result.rol,
                    activo: result.activo
                };

                this.usuario = user;
                this.guardarTokenEnStorage();
                this.guardarUsuarioEnStorage();
                this.marcarActividad();
                this.resetInactivityTimer();
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
    public async registrarUsuario(registerData: RegisterData): Promise<AuthResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/registrarUsuario`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(registerData)
            });

            const result: AuthResponse = await response.json();

            if (result.success && result.nombre) {
                this.token = result.token;

                let user = {
                    _id: result.userId,
                    username: result.username,
                    nombre: result.nombre,
                    apellido: result.apellido,
                    email: result.email,
                    rol: result.rol,
                    activo: result.activo
                };

                this.usuario = user;
                this.guardarTokenEnStorage();
                this.guardarUsuarioEnStorage();
                this.marcarActividad();
                this.resetInactivityTimer();
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

    // resetPassword
    public async resetPassword(token: String, newPassword: String): Promise<AuthResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/restablecerPassword`, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    token: token,
                    newPassword
                })
            });

            return await response.json();

        } catch (error) {
            console.error('Error en restablecerPassword:', error);
            return {
                success: false,
                error: 'Error de conexión'
            };
        }
    }

    // ForgotPassword
    public async forgotPassword(email: String): Promise<AuthResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/solicitarRecuperacionPassword`, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email })
            });

            return await response.json();

        } catch (error) {
            console.error('Error en solicitarRecuperacionPassword:', error);
            return {
                success: false,
                error: 'Error de conexión'
            };
        }
    }

    // reenviarActivacion
    public async reenviarActivacion(email: String): Promise<AuthResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/reenviarActivacion`, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email })
            });

            return await response.json();

        } catch (error) {
            console.error('Error en reenviarActivacion:', error);
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
            this.stopInactivityTimer();
            this.limpiarStorage();
        }
    }

    // Obtener perfil del usuario
    public async obtenerPerfil(): Promise<Usuario | null> {
        if (!this.token) return null;

        try {
            const response = await fetch(`${this.baseUrl}/obtenerPerfil`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({})
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
                this.usuario = this.mapPerfilToUsuario(result);
                this.guardarUsuarioEnStorage();
                return this.usuario;
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
            const response = await fetch(`${this.baseUrl}/actualizarPerfil`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(datosActualizacion)
            });

            const result: AuthResponse = await response.json();

            if (result.success) {
                this.usuario = this.mapPerfilToUsuario(result);
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
            const response = await fetch(`${this.baseUrl}/cambiarPassword`, {
                method: 'POST',
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
                this.stopInactivityTimer();
                this.limpiarStorage();
                return false;
            }
        } catch (error) {
            // Token malformado
            this.token = null;
            this.usuario = null;
            this.stopInactivityTimer();
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
            localStorage.removeItem('auth_last_activity');
        }
    }

    private mapPerfilToUsuario(result: AuthResponse): Usuario {
        return {
            _id: result.userId || this.usuario?._id || "",
            username: result.username || "",
            email: result.email || "",
            nombre: result.nombre || "",
            apellido: result.apellido || "",
            telefono: result.telefono || "",
            direccion: result.direccion || "",
            rol: result.rol || "",
            activo: result.estado ? result.estado === "ACTIVO" : this.usuario?.activo ?? true
        };
    }

    public iniciarTimeoutInactividad(onTimeout?: () => void): void {
        this.onInactivityTimeout = onTimeout;

        if (this.inactivityStarted || typeof window === "undefined") {
            this.resetInactivityTimer();
            return;
        }

        this.inactivityStarted = true;
        const eventos = ["click", "keydown", "mousemove", "mousedown", "scroll", "touchstart"];
        eventos.forEach((evento) => {
            window.addEventListener(evento, this.registrarActividad, { passive: true });
        });
        window.addEventListener("focus", this.verificarInactividad);
        window.addEventListener("visibilitychange", this.verificarInactividad);
        window.addEventListener("storage", this.sincronizarInactividadEntrePestanas);

        this.resetInactivityTimer();
    }

    private registrarActividad = (): void => {
        if (!this.isAuthenticated()) {
            this.stopInactivityTimer();
            return;
        }

        this.marcarActividad();
        this.resetInactivityTimer();
    };

    private marcarActividad(): void {
        if (typeof Storage !== "undefined") {
            localStorage.setItem("auth_last_activity", String(Date.now()));
        }
    }

    private resetInactivityTimer(): void {
        if (this.inactivityTimer) {
            window.clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
        this.stopInactivityCheckTimer();

        if (!this.isAuthenticated() || typeof window === "undefined") {
            return;
        }

        const lastActivityStored = localStorage.getItem("auth_last_activity");
        if (!lastActivityStored) {
            this.marcarActividad();
        }

        const lastActivity = Number(localStorage.getItem("auth_last_activity") || Date.now());
        const elapsed = Date.now() - lastActivity;
        const remaining = Math.max(this.inactivityTimeoutMs - elapsed, 0);

        if (remaining === 0) {
            void this.cerrarPorInactividad();
            return;
        }

        this.inactivityTimer = window.setTimeout(() => {
            void this.cerrarPorInactividad();
        }, remaining);
        this.startInactivityCheckTimer();
    }

    private startInactivityCheckTimer(): void {
        this.stopInactivityCheckTimer();
        this.inactivityCheckTimer = window.setInterval(this.verificarInactividad, this.inactivityCheckIntervalMs);
    }

    private stopInactivityCheckTimer(): void {
        if (this.inactivityCheckTimer && typeof window !== "undefined") {
            window.clearInterval(this.inactivityCheckTimer);
        }
        this.inactivityCheckTimer = null;
    }

    private stopInactivityTimer(): void {
        if (this.inactivityTimer && typeof window !== "undefined") {
            window.clearTimeout(this.inactivityTimer);
        }
        this.inactivityTimer = null;
        this.stopInactivityCheckTimer();
    }

    private verificarInactividad = (): void => {
        if (!this.isAuthenticated()) {
            this.stopInactivityTimer();
            return;
        }

        const lastActivity = Number(localStorage.getItem("auth_last_activity") || 0);
        if (!lastActivity) {
            this.marcarActividad();
            this.resetInactivityTimer();
            return;
        }

        if (Date.now() - lastActivity >= this.inactivityTimeoutMs) {
            void this.cerrarPorInactividad();
        }
    };

    private sincronizarInactividadEntrePestanas = (event: StorageEvent): void => {
        if (event.key === "auth_last_activity") {
            this.resetInactivityTimer();
        }

        if (event.key === "auth_token" && !event.newValue) {
            this.stopInactivityTimer();
            this.onInactivityTimeout?.();
        }
    };

    private async cerrarPorInactividad(): Promise<void> {
        if (this.inactivityClosing) return;
        this.inactivityClosing = true;
        await this.logout();
        this.onInactivityTimeout?.();
        this.inactivityClosing = false;
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
