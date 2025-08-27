import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageStrip from "sap/m/MessageStrip";
import BusyIndicator from "sap/m/BusyIndicator";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/ui/core/routing/Router";
import CheckBox from "sap/m/CheckBox";
import ProgressIndicator from "sap/m/ProgressIndicator";

// Interfaces para el registro
interface RegisterData {
    username: string;
    email: string;
    password: string;
    nombre: string;
    apellido: string;
    telefono?: string;
    direccion?: string;
}

export default class Register extends Controller {

    public onInit(): void {
        // Modelo para los datos del formulario
        const oModel = new JSONModel({
            username: "",
            email: "",
            password: "",
            confirmPassword: "",
            nombre: "",
            apellido: "",
            telefono: "",
            direccion: "",
            acceptTerms: false,
            registerEnabled: false,
            passwordStrength: 0,
            passwordStrengthState: "Error",
            passwordStrengthText: "Muy débil",
            // Estados de validación
            usernameState: "None",
            usernameStateText: "",
            emailState: "None",
            emailStateText: "",
            passwordState: "None",
            passwordStateText: "",
            confirmPasswordState: "None",
            confirmPasswordStateText: "",
            nombreState: "None",
            nombreStateText: "",
            apellidoState: "None",
            apellidoStateText: ""
        });

        this.getView()?.setModel(oModel);
    }

    public onRegister = async (): Promise<void> => {
        const oModel = this.getView()?.getModel() as JSONModel;
        
        if (!this.validateForm()) {
            return;
        }

        const registerData: RegisterData = {
            username: oModel.getProperty("/username"),
            email: oModel.getProperty("/email"),
            password: oModel.getProperty("/password"),
            nombre: oModel.getProperty("/nombre"),
            apellido: oModel.getProperty("/apellido"),
            telefono: oModel.getProperty("/telefono") || undefined,
            direccion: oModel.getProperty("/direccion") || undefined
        };

        this.setRegisterBusy(true);
        oModel.setProperty("/registerEnabled", false);

        try {
            const response = await fetch('http://localhost:3000/api/auth/registrar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(registerData)
            });

            const result = await response.json();

            if (result.success) {
                MessageToast.show("¡Cuenta creada exitosamente! Bienvenido " + result.data?.usuario.nombre);
                this.navigateToMain();
            } else {
                this.showError(result.error || "Error creando la cuenta");
            }

        } catch (error) {
            console.error("Error en registro:", error);
            this.showError("Error de conexión. Verifica tu conexión a internet.");
        } finally {
            this.setRegisterBusy(false);
            this.updateRegisterButtonState();
        }
    };

    public onGoToLogin = (): void => {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteLogin");
    };

    public onNavBack = (): void => {
        this.onGoToLogin();
    };

    // Validaciones en tiempo real
    public onUsernameChange = (): void => {
        const oModel = this.getView()?.getModel() as JSONModel;
        const username = oModel.getProperty("/username");

        if (!username) {
            oModel.setProperty("/usernameState", "Error");
            oModel.setProperty("/usernameStateText", "El nombre de usuario es requerido");
        } else if (username.length < 3) {
            oModel.setProperty("/usernameState", "Warning");
            oModel.setProperty("/usernameStateText", "Mínimo 3 caracteres");
        } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            oModel.setProperty("/usernameState", "Error");
            oModel.setProperty("/usernameStateText", "Solo letras, números y guiones bajos");
        } else {
            oModel.setProperty("/usernameState", "Success");
            oModel.setProperty("/usernameStateText", "Disponible");
        }

        this.updateRegisterButtonState();
    };

    public onEmailChange = (): void => {
        const oModel = this.getView()?.getModel() as JSONModel;
        const email = oModel.getProperty("/email");

        if (!email) {
            oModel.setProperty("/emailState", "Error");
            oModel.setProperty("/emailStateText", "El email es requerido");
        } else if (!this.isValidEmail(email)) {
            oModel.setProperty("/emailState", "Error");
            oModel.setProperty("/emailStateText", "Formato de email inválido");
        } else {
            oModel.setProperty("/emailState", "Success");
            oModel.setProperty("/emailStateText", "Email válido");
        }

        this.updateRegisterButtonState();
    };

    public onPasswordChange = (): void => {
        const oModel = this.getView()?.getModel() as JSONModel;
        const password = oModel.getProperty("/password");

        this.validatePassword(password);
        this.onConfirmPasswordChange(); // Revalidar confirmación
        this.updateRegisterButtonState();
    };

    public onConfirmPasswordChange = (): void => {
        const oModel = this.getView()?.getModel() as JSONModel;
        const password = oModel.getProperty("/password");
        const confirmPassword = oModel.getProperty("/confirmPassword");

        if (!confirmPassword) {
            oModel.setProperty("/confirmPasswordState", "Error");
            oModel.setProperty("/confirmPasswordStateText", "Confirma tu contraseña");
        } else if (password !== confirmPassword) {
            oModel.setProperty("/confirmPasswordState", "Error");
            oModel.setProperty("/confirmPasswordStateText", "Las contraseñas no coinciden");
        } else {
            oModel.setProperty("/confirmPasswordState", "Success");
            oModel.setProperty("/confirmPasswordStateText", "Las contraseñas coinciden");
        }

        this.updateRegisterButtonState();
    };

    private validatePassword(password: string): void {
        const oModel = this.getView()?.getModel() as JSONModel;
        let strength = 0;
        let strengthText = "Muy débil";
        let strengthState = "Error";

        if (!password) {
            oModel.setProperty("/passwordState", "Error");
            oModel.setProperty("/passwordStateText", "La contraseña es requerida");
        } else {
            // Calcular fortaleza
            if (password.length >= 8) strength += 20;
            if (password.length >= 12) strength += 10;
            if (/[a-z]/.test(password)) strength += 20;
            if (/[A-Z]/.test(password)) strength += 20;
            if (/[0-9]/.test(password)) strength += 20;
            if (/[^A-Za-z0-9]/.test(password)) strength += 10;

            // Determinar texto y estado
            if (strength < 40) {
                strengthText = "Muy débil";
                strengthState = "Error";
                oModel.setProperty("/passwordState", "Error");
                oModel.setProperty("/passwordStateText", "Contraseña muy débil");
            } else if (strength < 60) {
                strengthText = "Débil";
                strengthState = "Warning";
                oModel.setProperty("/passwordState", "Warning");
                oModel.setProperty("/passwordStateText", "Contraseña débil");
            } else if (strength < 80) {
                strengthText = "Media";
                strengthState = "Information";
                oModel.setProperty("/passwordState", "Information");
                oModel.setProperty("/passwordStateText", "Contraseña aceptable");
            } else {
                strengthText = "Fuerte";
                strengthState = "Success";
                oModel.setProperty("/passwordState", "Success");
                oModel.setProperty("/passwordStateText", "Contraseña fuerte");
            }
        }

        oModel.setProperty("/passwordStrength", strength);
        oModel.setProperty("/passwordStrengthText", strengthText);
        oModel.setProperty("/passwordStrengthState", strengthState);
    }

    private validateForm(): boolean {
        const oModel = this.getView()?.getModel() as JSONModel;
        
        // Validar campos requeridos
        const requiredFields = [
            { field: "username", state: "usernameState" },
            { field: "email", state: "emailState" },
            { field: "password", state: "passwordState" },
            { field: "confirmPassword", state: "confirmPasswordState" },
            { field: "nombre", state: "nombreState" },
            { field: "apellido", state: "apellidoState" }
        ];

        let isValid = true;

        requiredFields.forEach(({ field, state }) => {
            const value = oModel.getProperty(`/${field}`);
            if (!value) {
                oModel.setProperty(`/${state}`, "Error");
                oModel.setProperty(`/${state}Text`, "Este campo es requerido");
                isValid = false;
            }
        });

        // Validar términos y condiciones
        if (!oModel.getProperty("/acceptTerms")) {
            this.showError("Debes aceptar los términos y condiciones");
            isValid = false;
        }

        // Validar que no haya errores en los estados
        requiredFields.forEach(({ state }) => {
            if (oModel.getProperty(`/${state}`) === "Error") {
                isValid = false;
            }
        });

        return isValid;
    }

    private updateRegisterButtonState(): void {
        const oModel = this.getView()?.getModel() as JSONModel;
        
        const allFieldsValid = [
            "usernameState", "emailState", "passwordState", 
            "confirmPasswordState", "nombreState", "apellidoState"
        ].every(state => {
            const stateValue = oModel.getProperty(`/${state}`);
            return stateValue === "Success" || stateValue === "Information";
        });

        const hasRequiredData = [
            "username", "email", "password", "confirmPassword", "nombre", "apellido"
        ].every(field => {
            return !!oModel.getProperty(`/${field}`);
        });

        const acceptedTerms = oModel.getProperty("/acceptTerms");

        oModel.setProperty("/registerEnabled", allFieldsValid && hasRequiredData && acceptedTerms);
    }

    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    private showError(message: string): void {
        const oMessageStrip = this.byId("registerErrorMessage") as MessageStrip;
        oMessageStrip.setText(message);
        oMessageStrip.setVisible(true);

        setTimeout(() => {
            oMessageStrip.setVisible(false);
        }, 8000);
    }

    private setRegisterBusy(busy: boolean): void {
        const oBusyIndicator = this.byId("registerBusyIndicator") as BusyIndicator;
        oBusyIndicator.setVisible(busy);
    }

    private navigateToMain(): void {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteWelcome");
    }
}