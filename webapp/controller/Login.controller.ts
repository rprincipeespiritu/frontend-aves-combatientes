import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import MessageStrip from "sap/m/MessageStrip";
import BusyIndicator from "sap/m/BusyIndicator";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/ui/core/routing/Router";
import { AuthService, LoginData } from "../services/AuthService";
import Button from "sap/m/Button";

export default class Login extends Controller {
    private authService: AuthService;

    public onInit(): void {
        this.authService = AuthService.getInstance();

        // Modelo para los datos del formulario
        const oModel = new JSONModel({
            email: "",
            password: "",
            rememberMe: false,
            loginEnabled: true,
            emailState: "None",
            emailStateText: "",
            passwordState: "None",
            passwordStateText: ""
        });

        this.getView()?.setModel(oModel);

        // Escuchar el TARGET, no la ruta
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        const oTarget = oRouter?.getTarget("TargetLogin") as any;
        oTarget?.attachDisplay(this.onTargetDisplay, this);
    }

    // Se ejecuta CADA VEZ que navegas al login
    private onTargetDisplay = (): void => {
        // Verificar si ya está autenticado
        if (this.authService.isAuthenticated()) {
            this.navigateToMain();
            return;
        }

        const oModel = this.getView()?.getModel() as JSONModel;
        oModel?.setData({
            email: "",
            password: "",
            rememberMe: false,
            loginEnabled: true,
            emailState: "None",
            emailStateText: "",
            passwordState: "None",
            passwordStateText: ""
        });
        // Forzar habilitación directa del botón
        const oButton = this.byId("loginButton") as Button;
        oButton?.setEnabled(true);

        // Resetear BusyIndicator
        this.setLoginBusy(false);

        // Ocultar mensaje de error
        const oMessageStrip = this.byId("loginErrorMessage") as MessageStrip;
        oMessageStrip?.setVisible(false);

        // Cargar credenciales recordadas
        this.loadRememberedCredentials();
    }

    public onTogglePassword(): void {
        const oInput = this.getView()?.byId("passwordInput") as any;

        if (oInput.getType() === "Password") {
            oInput.setType("Text");
            oInput.setValueHelpIconSrc("sap-icon://hide");
        } else {
            oInput.setType("Password");
            oInput.setValueHelpIconSrc("sap-icon://show");
        }
    }

    public onLogin = async (): Promise<void> => {
        const oThat = this;
        const oModel = this.getView()?.getModel() as JSONModel;
        let sEmail = oModel.getProperty("/email");
        const loginData: LoginData = {
            email: oModel.getProperty("/email"),
            password: oModel.getProperty("/password")
        };

        // Validar campos
        if (!this.validateLoginForm(loginData)) {
            return;
        }

        // Mostrar loading
        this.setLoginBusy(true);
        oModel.setProperty("/loginEnabled", false);

        try {
            const result = await this.authService.login(loginData);

            if (result.success) {
                // Guardar credenciales si está marcado "recordar"
                const rememberMe = oModel.getProperty("/rememberMe");
                if (rememberMe) {
                    this.saveCredentials(loginData.email);
                } else {
                    this.clearSavedCredentials();
                }

                MessageBox.success("Bienvenido " + result.nombre + " " + result.apellido, {
                    actions: [MessageBox.Action.OK],
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function (sAction : any) : void {
                        // Navegar a la página principal
                        oThat.navigateToMain();
                    },
                    dependentOn: this.getView()
                });
             
            } else {
                if (result.error?.code === "403") {
                    this._mostrarDialogoCuentaPendiente(sEmail);
                    return;
                }
                throw new Error(result.error?.message || result.message || "Credenciales inválidas");
            }

        } catch (error) {
            console.error("Error en login:", error);
            this.showError("Error de conexión. Verifica tu conexión a internet.");
        } finally {
            this.setLoginBusy(false);
            oModel.setProperty("/loginEnabled", true);
        }
    };

    private _mostrarDialogoCuentaPendiente(email: string): void {
        MessageBox.warning(
            "Tu cuenta aún no ha sido activada. Revisa tu correo. Si no recibiste el mensaje, puedes reenviar el enlace.",
            {
                title: "Cuenta pendiente",
                actions: ["Reenviar correo", MessageBox.Action.CLOSE],
                emphasizedAction: "Reenviar correo",
                onClose: async (sAction: string) => {
                    if (sAction === "Reenviar correo") {
                        await this.reenviarActivacion(email);
                    }
                }
            }
        );
    }

    public async onReenviarActivacionDirecto(): Promise<void> {
        const oEmailInput = this.byId("inputEmail") as Input;
        const email = oEmailInput.getValue().trim().toLowerCase();

        if (!email) {
            MessageBox.warning("Ingresa tu correo electrónico");
            return;
        }

        await this.reenviarActivacion(email);
    }

    private async reenviarActivacion(email: string): Promise<void> {
        try {

            const response = await this.authService.reenviarActivacion(email);

            if (!response.success) {
                MessageBox.error(response?.error?.message || response?.message || "No se pudo reenviar el correo");
                return;
            }

            MessageBox.success(response?.message || "Se ha reenviado el correo de activación.");
        } catch (error) {
            MessageBox.error("No se pudo conectar con el servidor");
        }
    }

    public onLoginSubmit = (): void => {
        // Llamar login cuando presione Enter
        this.onLogin();
    };

    public onGoToRegister = (): void => {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteRegister");
    };

    public onForgotPassword = (): void => {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteForgotPassword");
    };

    // Validación del formulario
    private validateLoginForm(loginData: LoginData): boolean {
        const oModel = this.getView()?.getModel() as JSONModel;
        let isValid = true;

        // Validar email
        if (!loginData.email) {
            oModel.setProperty("/emailState", "Error");
            oModel.setProperty("/emailStateText", "El email es requerido");
            isValid = false;
        } else if (!this.isValidEmail(loginData.email)) {
            oModel.setProperty("/emailState", "Error");
            oModel.setProperty("/emailStateText", "Formato de email inválido");
            isValid = false;
        } else {
            oModel.setProperty("/emailState", "None");
            oModel.setProperty("/emailStateText", "");
        }

        // Validar contraseña
        if (!loginData.password) {
            oModel.setProperty("/passwordState", "Error");
            oModel.setProperty("/passwordStateText", "La contraseña es requerida");
            isValid = false;
        } else {
            oModel.setProperty("/passwordState", "None");
            oModel.setProperty("/passwordStateText", "");
        }

        return isValid;
    }

    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    private showError(message: string): void {
        const oMessageStrip = this.byId("loginErrorMessage") as MessageStrip;
        oMessageStrip.setText(message);
        oMessageStrip.setVisible(true);

        // Ocultar mensaje después de 5 segundos
        setTimeout(() => {
            oMessageStrip.setVisible(false);
        }, 5000);
    }

    private setLoginBusy(busy: boolean): void {
        const oBusyIndicator = this.byId("loginBusyIndicator") as BusyIndicator;
        oBusyIndicator.setVisible(busy);
    }

    private navigateToMain(): void {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteWelcome");
    }

    // Funciones para recordar credenciales
    private saveCredentials(email: string): void {
        if (typeof Storage !== "undefined") {
            localStorage.setItem("remembered_email", email);
            localStorage.setItem("remember_credentials", "true");
        }
    }

    private loadRememberedCredentials(): void {
        if (typeof Storage !== "undefined") {
            const rememberCredentials = localStorage.getItem("remember_credentials");
            const rememberedEmail = localStorage.getItem("remembered_email");

            if (rememberCredentials === "true" && rememberedEmail) {
                const oModel = this.getView()?.getModel() as JSONModel;
                oModel.setProperty("/email", rememberedEmail);
                oModel.setProperty("/rememberMe", true);
            }
        }
    }

    private clearSavedCredentials(): void {
        if (typeof Storage !== "undefined") {
            localStorage.removeItem("remembered_email");
            localStorage.removeItem("remember_credentials");
        }
    }
}