import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/ui/core/routing/Router";
import { AuthService } from "../services/AuthService";

export default class AveCreate extends Controller {
    private authService: AuthService;
    private baseUrl: string = window.APP_CONFIG?.API_BASE_URL || "";

    public onInit(): void {
        this.authService = AuthService.getInstance();

        const oModel = new JSONModel({
            placa: "", nombre: "", apodo: "", sexo: "M",
            estado: "ACTIVO", ubicacion: "", raza_ID: "",
            color_ID: "", tipoAve_ID: "", fechaNacimiento: "",
            fechaCompra: "", padre_ID: "", madre_ID: "",
            procedencia: "", criador: "", valorCompra: "",
            valorActual: "", observaciones: "", placaState: "None"
        });
        this.getView()?.setModel(oModel, "create");

        this.cargarCatalogos();
    }

    public async onLogout(): Promise<void> {
        try {
            await this.authService.logout();
            MessageToast.show("Sesión cerrada exitosamente");

            const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
            oRouter?.navTo("RouteLogin");

            // Verificar que el método existe antes de llamarlo
            const oOwner = this.getOwnerComponent() as any;
            if (oOwner && typeof oOwner.updateUserModel === 'function') {
                oOwner.updateUserModel();
            }

        } catch (error) {
            console.error("Error en logout:", error);
            MessageToast.show("Error cerrando sesión");
        }
    }

    private async cargarCatalogos(): Promise<void> {
        const token = this.authService.getToken();
        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        };

        try {
            const [razas, colores, tiposAve, aves] = await Promise.all([
                fetch(`${this.baseUrl}/Razas`, { headers }).then(r => r.json()),
                fetch(`${this.baseUrl}/Colores`, { headers }).then(r => r.json()),
                fetch(`${this.baseUrl}/TiposAve`, { headers }).then(r => r.json()),
                fetch(`${this.baseUrl}/Aves?$select=ID,placa,nombre,sexo`, { headers }).then(r => r.json())
            ]);

            this.getView()?.setModel(new JSONModel(razas.value || []), "razas");
            this.getView()?.setModel(new JSONModel(colores.value || []), "colores");
            this.getView()?.setModel(new JSONModel(tiposAve.value || []), "tiposAve");

            const machos = (aves.value || []).filter((a: any) => a.sexo === "M");
            const hembras = (aves.value || []).filter((a: any) => a.sexo === "H");
            this.getView()?.setModel(new JSONModel(machos), "avesMachos");
            this.getView()?.setModel(new JSONModel(hembras), "avesHembras");
        } catch (error) {
            console.error("Error cargando catálogos:", error);
        }
    }

    public async onGuardar(): Promise<void> {
        const oModel = this.getView()?.getModel("create") as JSONModel;
        const data = oModel.getData();

        // Validar placa
        if (!data.placa) {
            oModel.setProperty("/placaState", "Error");
            MessageToast.show("La placa es requerida");
            return;
        }
        oModel.setProperty("/placaState", "None");

        // Construir payload
        const payload: any = {
            placa: data.placa,
            nombre: data.nombre || null,
            apodo: data.apodo || null,
            sexo: data.sexo,
            estado: data.estado,
            ubicacion: data.ubicacion || null,
            procedencia: data.procedencia || null,
            criador: data.criador || null,
            observaciones: data.observaciones || null,
            fechaNacimiento: data.fechaNacimiento || null,
            fechaCompra: data.fechaCompra || null,
            valorCompra: data.valorCompra ? parseFloat(data.valorCompra) : null,
            valorActual: data.valorActual ? parseFloat(data.valorActual) : null,
        };

        if (data.raza_ID) payload.raza_ID = data.raza_ID;
        if (data.color_ID) payload.color_ID = data.color_ID;
        if (data.tipoAve_ID) payload.tipoAve_ID = data.tipoAve_ID;
        if (data.padre_ID) payload.padre_ID = data.padre_ID;
        if (data.madre_ID) payload.madre_ID = data.madre_ID;

        try {
            const response = await fetch(`${this.baseUrl}/Aves`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authService.getToken()}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                MessageToast.show("Ave creada exitosamente");
                this.onNavBack();
            } else {
                const error = await response.json();
                MessageBox.error(error.error?.message || "Error al crear el ave");
            }
        } catch (error) {
            MessageBox.error("Error de conexión");
        }
    }

    public onNavBack(): void {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteList");
    }
}