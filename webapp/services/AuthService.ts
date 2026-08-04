import EventBus from "sap/ui/core/EventBus";
import JSONModel from "sap/ui/model/json/JSONModel";
import View from "sap/ui/core/mvc/View";

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
    fotoUrl?: string;
    foto?: string;
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
    fotoUrl?: string;
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
    private onSessionEnded?: () => void;
    private lastActivityAt = 0;
    private lastActivityPersistAt = 0;
    private lastTimerResetAt = 0;
    private static readonly ACTIVITY_PERSIST_MS = 30_000;
    private static readonly ACTIVITY_TIMER_RESET_MS = 5_000;
    private _token: string = "";    
    private token: string | null = null;
    private usuario: Usuario | null = null;
    private fotoDisplayCache: { fotoUrl: string; displayUrl: string; expiresAt: number } | null = null;

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
                let user: Usuario = {
                    _id: result.userId || "",
                    username: result.username || "",
                    nombre: result.nombre || "",
                    apellido: result.apellido || "",
                    email: result.email || "",
                    rol: result.rol || "",
                    activo: result.activo ?? true,
                    fotoUrl: result.fotoUrl || "",
                };

                user = await this.aplicarFotoDisplayAlUsuario(user);
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
            this.fotoDisplayCache = null;
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
                    await this.cerrarSesionExpirada();
                }
                return null;
            }

            const result = await response.json();
            if (result.success) {
                this.usuario = await this.aplicarFotoDisplayAlUsuario(this.mapPerfilToUsuario(result));
                this.guardarUsuarioEnStorage();
                this.notificarActualizacionPerfil(this.usuario);
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
                this.usuario = await this.aplicarFotoDisplayAlUsuario(this.mapPerfilToUsuario(result));
                this.guardarUsuarioEnStorage();
                this.notificarActualizacionPerfil(this.usuario);
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

    public async subirFotoPerfil(file: File): Promise<AuthResponse> {
        if (!this.token) {
            return {
                success: false,
                error: 'No hay sesión activa'
            };
        }

        if (!file.type.startsWith("image/")) {
            return {
                success: false,
                error: "El archivo seleccionado no es una imagen valida"
            };
        }

        try {
            const preparacion = await this.prepararCargaFotoUsuario(file);
            if (!preparacion.success || !preparacion.uploadUrl || !preparacion.fileUrl) {
                return {
                    success: false,
                    error: preparacion.error || preparacion.message || "No se pudo preparar la carga de la foto"
                };
            }

            await this.subirArchivoAS3(preparacion.uploadUrl, file, file.type);

            const response = await fetch(`${this.baseUrl}/actualizarFotoPerfil`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ fotoUrl: preparacion.fileUrl })
            });

            const result: AuthResponse = await response.json();
            if (!result.success) {
                return {
                    success: false,
                    error: result.error || result.message || "No se pudo actualizar la foto de perfil"
                };
            }

            this.fotoDisplayCache = null;
            this.usuario = await this.aplicarFotoDisplayAlUsuario(this.mapPerfilToUsuario(result));
            this.guardarUsuarioEnStorage();
            this.notificarActualizacionPerfil(this.usuario);
            return result;
        } catch (error: any) {
            console.error('Error subiendo foto de perfil:', error);
            return {
                success: false,
                error: error.message || 'Error de conexión'
            };
        }
    }

    public async eliminarFotoPerfil(): Promise<AuthResponse> {
        if (!this.token) {
            return {
                success: false,
                error: 'No hay sesión activa'
            };
        }

        try {
            const response = await fetch(`${this.baseUrl}/eliminarFotoPerfil`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({})
            });

            const result: AuthResponse = await response.json();
            if (!result.success) {
                return {
                    success: false,
                    error: result.error || result.message || "No se pudo eliminar la foto de perfil"
                };
            }

            this.fotoDisplayCache = null;
            this.usuario = this.mapPerfilToUsuario(result);
            this.usuario.foto = "";
            this.guardarUsuarioEnStorage();
            this.notificarActualizacionPerfil(this.usuario);
            return result;
        } catch (error: any) {
            console.error('Error eliminando foto de perfil:', error);
            return {
                success: false,
                error: error.message || 'Error de conexión'
            };
        }
    }

    public async aplicarFotoDisplayAlUsuario(usuario: Usuario): Promise<Usuario> {
        const enriched = { ...usuario };
        enriched.foto = await this.resolverFotoDisplayUrl(enriched.fotoUrl);
        return enriched;
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

    public setCurrentUser(user: Usuario): void {
        this.usuario = user;
        this.guardarUsuarioEnStorage();
    }

    public async ensureUserPhotoDisplay(): Promise<Usuario | null> {
        if (!this.token) {
            return null;
        }

        if (this.usuario?.fotoUrl) {
            const enriched = await this.aplicarFotoDisplayAlUsuario(this.usuario);
            this.setCurrentUser(enriched);
            return enriched;
        }

        if (this.usuario) {
            return { ...this.usuario, foto: this.usuario.foto || "" };
        }

        return this.obtenerPerfil();
    }

    public bindUserModelToView(view: View | null | undefined): void {
        if (!view) {
            return;
        }

        void this.ensureUserPhotoDisplay().then((user) => {
            if (!user) {
                return;
            }

            const userModel = view.getModel("user") as JSONModel | undefined;
            if (!userModel) {
                view.setModel(new JSONModel({ ...user }), "user");
                return;
            }

            userModel.setData({ ...user });
        });
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
            await this.cerrarSesionExpirada();
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
            const { foto, ...persistible } = this.usuario;
            localStorage.setItem("auth_user", JSON.stringify(persistible));
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
            fotoUrl: result.fotoUrl || this.usuario?.fotoUrl || "",
            rol: result.rol || "",
            activo: result.estado ? result.estado === "ACTIVO" : this.usuario?.activo ?? true
        };
    }

    private async prepararCargaFotoUsuario(file: File): Promise<AuthResponse & {
        uploadUrl?: string;
        fileUrl?: string;
    }> {
        const response = await fetch(`${this.baseUrl}/prepararCargaFotoUsuario`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.token}`,
            },
            body: JSON.stringify({
                nombreArchivo: file.name,
                mimeType: file.type,
                tamanioBytes: file.size,
            }),
        });

        const data = await response.json();
        if (!response.ok) {
            return {
                success: false,
                error: data.error?.message || data.message || "No se pudo preparar la carga de la foto",
            };
        }

        return data;
    }

    private async subirArchivoAS3(uploadUrl: string, file: File, mimeType: string): Promise<void> {
        const response = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
                "Content-Type": mimeType,
            },
            body: file,
        });

        if (!response.ok) {
            throw new Error("No se pudo subir la foto a AWS S3.");
        }
    }

    private async resolverFotoDisplayUrl(fotoUrl?: string): Promise<string> {
        if (!fotoUrl) return "";

        if (
            this.fotoDisplayCache
            && this.fotoDisplayCache.fotoUrl === fotoUrl
            && Date.now() < this.fotoDisplayCache.expiresAt
        ) {
            return this.fotoDisplayCache.displayUrl;
        }

        if (!String(fotoUrl).includes(".s3.")) {
            return fotoUrl;
        }

        if (!this.token) return "";

        try {
            const response = await fetch(`${this.baseUrl}/obtenerUrlLecturaS3`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.token}`,
                },
                body: JSON.stringify({ fileUrl: fotoUrl }),
            });
            const data = await response.json();

            if (!response.ok) {
                return "";
            }

            const displayUrl = data.downloadUrl || fotoUrl;
            this.fotoDisplayCache = {
                fotoUrl,
                displayUrl,
                expiresAt: Date.now() + 14 * 60 * 1000,
            };
            return displayUrl;
        } catch {
            return "";
        }
    }

    private notificarActualizacionPerfil(usuario: Usuario | null): void {
        if (typeof window === "undefined" || !usuario) return;

        EventBus.getInstance().publish("app", "userProfileUpdated", { user: usuario });
    }

    public setOnSessionEnded(callback?: () => void): void {
        this.onSessionEnded = callback;
    }

    public iniciarTimeoutInactividad(onTimeout?: () => void): void {
        this.onInactivityTimeout = onTimeout;

        if (this.inactivityStarted || typeof window === "undefined") {
            this.resetInactivityTimer();
            return;
        }

        this.inactivityStarted = true;
        // Evitar mousemove: genera jank al escribir localStorage en cada movimiento.
        const eventos = ["click", "keydown", "pointerdown", "touchstart", "scroll"];
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
        const now = Date.now();
        if (now - this.lastTimerResetAt >= AuthService.ACTIVITY_TIMER_RESET_MS) {
            this.lastTimerResetAt = now;
            this.resetInactivityTimer();
        }
    };

    private marcarActividad(): void {
        const now = Date.now();
        this.lastActivityAt = now;
        if (typeof Storage === "undefined") {
            return;
        }
        if (now - this.lastActivityPersistAt < AuthService.ACTIVITY_PERSIST_MS) {
            return;
        }
        this.lastActivityPersistAt = now;
        localStorage.setItem("auth_last_activity", String(now));
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

        if (!this.lastActivityAt && !localStorage.getItem("auth_last_activity")) {
            this.marcarActividad();
        }

        const lastActivity =
            Math.max(this.lastActivityAt, Number(localStorage.getItem("auth_last_activity") || 0)) ||
            Date.now();
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

        const lastActivity = Math.max(
            this.lastActivityAt,
            Number(localStorage.getItem("auth_last_activity") || 0),
        );
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

    private async cerrarSesionExpirada(): Promise<void> {
        if (this.inactivityClosing) return;
        this.inactivityClosing = true;
        await this.logout();
        this.onSessionEnded?.();
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
