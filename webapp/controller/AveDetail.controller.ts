import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/ui/core/routing/Router";
import { AuthService } from "../services/AuthService";
import Fragment from "sap/ui/core/Fragment";
import Event from "sap/ui/base/Event";
import Control from "sap/ui/mdc/Control";
import Device from "sap/ui/Device";
import ActionSheet from "sap/m/ActionSheet";
import Popover from "sap/m/Popover";
import {CategoriaAve, EstadoAve, IAve, SexoAve} from "com/rprincipees/registroavescombate/types/Models";
import formatter from "../model/formatter";

export default class AveDetail extends Controller {
    private authService: AuthService;
    private baseUrl: string = "http://localhost:4004/api/avecombatiente";
    private aveId: string = "";
    private _oUserMenuPopover: any;
    private _oUserMenuSheet: any;
    private _oEvaluacionDialog: any;
    public formatter = formatter;

    public onInit(): void {
        this.authService = AuthService.getInstance();
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        oRouter?.getRoute("RouteAveDetail")?.attachPatternMatched(this.onRouteMatched, this);
    }

    private onRouteMatched = (oEvent: any): void => {
        if (!this.authService.isAuthenticated()) {
            const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
            oRouter?.navTo("RouteLogin");
            return;
        }
        const sUserData = localStorage.getItem("auth_user");

        if (sUserData) {
            const oUser = JSON.parse(sUserData);
            const oUserModel = new JSONModel(oUser);
            this.getView()?.setModel(oUserModel, "user");
        }

        this.aveId = oEvent.getParameter("arguments").aveId;

        this.getView()?.setModel(new JSONModel({
            editMode: false,
            placa: "", nombre: "", apodo: "", sexo: "",
            estado: "", ubicacion: "", razaNombre: "", colorNombre: "",
            fechaNacimiento: "", procedencia: "", criador: "",
            valorCompra: 0, valorActual: 0, observaciones: "",
            totalPeleas: 0, peleasGanadas: 0, porcentajeVictorias: "0%",
            pesoActual: 0, edad: 0, pesajes: [], peleas: [],
            padreNombre: "", madreNombre: "", padre_ID: "", madre_ID: "",
            raza_ID: "", color_ID: "", fotoPrincipal: "",
            evaluaciones: [],
            evaluacionDialogTitle: "Registrar evaluacion",
            evaluacionEditId: "",
            nuevaEvaluacion: {
                vigor: "",
                saludGeneral: "",
                fertilidad: "",
                desarrollo: "BUENO",
                aptoReproduccion: true,
                defectosObservados: "",
                recomendacion: ""
            }
        }), "detail");
    
        this.cargarAve();
        this.cargarCatalogos();
        void this.cargarSuscripcionResumen();
    }

    private getDashboardModel(): JSONModel {
        let oModel = this.getOwnerComponent()?.getModel("dashboard") as JSONModel;

        if (!oModel) {
            oModel = new JSONModel({
                plan: "",
                estadoSuscripcion: "",
                accesoSuscripcion: false
            });
            this.getOwnerComponent()?.setModel(oModel, "dashboard");
        }

        return oModel;
    }

    private async cargarSuscripcionResumen(): Promise<void> {
        const oModel = this.getDashboardModel();
        oModel.setProperty("/accesoSuscripcion", false);

        try {
            const response = await fetch(`${this.baseUrl}/obtenerSuscripcionActual`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            });

            const data = await response.json();
            if (!response.ok) return;

            const tieneAcceso =
                data.tieneSuscripcion !== false &&
                ["ACTIVA", "CANCELADA"].includes(data.estado) &&
                Number(data.diasRestantes || 0) >= 0;

            oModel.setProperty("/plan", data.plan || "");
            oModel.setProperty("/estadoSuscripcion", data.estado || "");
            oModel.setProperty("/accesoSuscripcion", tieneAcceso);
            oModel.refresh(true);
        } catch (error) {
            // El detalle del ave puede mostrarse aunque falle el resumen de suscripcion.
        }
    }

    public async onUserMenuPress(oEvent: Event): Promise<void> {
        const oSource = oEvent.getSource() as Control;

        if (Device.system.phone) {
            if (!this._oUserMenuSheet) {
                const oFragment = await Fragment.load({
                    id: this.getView()?.getId(),
                    name: "com.rprincipees.registroavescombate.view.fragments.UserMenuMobile",
                    controller: this
                });

                this._oUserMenuSheet = oFragment as ActionSheet;
                this.getView()?.addDependent(this._oUserMenuSheet);
            }

            // TOGGLE
            if (this._oUserMenuSheet.isOpen()) {
                this._oUserMenuSheet.close();
            } else {
                this._oUserMenuSheet.openBy(oSource);
            }

            return;
        }

        if (!this._oUserMenuPopover) {
            const oFragment = await Fragment.load({
                id: this.getView()?.getId(),
                name: "com.rprincipees.registroavescombate.view.fragments.UserMenu",
                controller: this
            });

            this._oUserMenuPopover = oFragment as Popover;
            this.getView()?.addDependent(this._oUserMenuPopover);
        }

        // TOGGLE
        if (this._oUserMenuPopover.isOpen()) {
            this._oUserMenuPopover.close();
        } else {
            this._oUserMenuPopover.openBy(oSource);
        }

    }

    private async cargarAve(): Promise<void> {
        const token = this.authService.getToken();
        try {
            const response = await fetch(
                `${this.baseUrl}/Aves('${this.aveId}')?$expand=pesajes,peleas,padre,madre`,
                { headers: { "Authorization": `Bearer ${token}` } }
            );

            if (!response.ok) {
                MessageBox.error("Ave no encontrada");
                this.onNavBack();
                return;
            }

            const ave = await response.json();
            const oModel = this.getView()?.getModel("detail") as JSONModel;

            oModel.setData({
                ...oModel.getData(),
                ...ave,
                razaNombre: ave.raza?.nombre || "",
                colorNombre: ave.color?.nombre || "",
                padreNombre: ave.padre ? `${ave.padre.placa} - ${ave.padre.nombre || ""}` : "Sin registro",
                madreNombre: ave.madre ? `${ave.madre.placa} - ${ave.madre.nombre || ""}` : "Sin registro",
                fotoPrincipal: ave.fotos?.find((f: any) => f.esPrincipal)?.thumbnailUrl || "",
                pesajes: ave.pesajes || [],
                peleas: ave.peleas || [],
                editMode: false
            });

            await this.cargarEvaluaciones();

        } catch (error) {
            MessageBox.error("Error cargando el ave");
        }
    }

    private async cargarEvaluaciones(): Promise<void> {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        const response = await fetch(
            `${this.baseUrl}/EvaluacionesAves?$filter=ave_ID eq ${this.aveId}&$orderby=fecha desc`,
            { headers: { "Authorization": `Bearer ${this.authService.getToken()}` } }
        );

        const data = await response.json();
        oModel.setProperty("/evaluaciones", data.value || []);
    }

    private async cargarCatalogos(): Promise<void> {
        const token = this.authService.getToken();
        const headers = { "Authorization": `Bearer ${token}` };
        try {
            const [razas, colores] = await Promise.all([
                fetch(`${this.baseUrl}/Razas`, { headers }).then(r => r.json()),
                fetch(`${this.baseUrl}/Colores`, { headers }).then(r => r.json()),
            ]);
            this.getView()?.setModel(new JSONModel(razas.value || []), "razas");
            this.getView()?.setModel(new JSONModel(colores.value || []), "colores");
        } catch (error) {
            console.error("Error cargando catálogos:", error);
        }
    }

    public onEditar(oEvent: Event): void {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        const oAve = oModel.getData();
        if (oAve?.ID) {
            const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
            oRouter?.navTo("RouteAveUpdate", { aveId: oAve.ID });
        }
    }

    public onCancelarEdicion(): void {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        oModel.setProperty("/editMode", false);
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteList");
    }

    // public async onGuardar(): Promise<void> {
    //     const oModel = this.getView()?.getModel("detail") as JSONModel;
    //     const data = oModel.getData();

    //     const payload = {
    //         placa: data.placa,
    //         nombre: data.nombre,
    //         apodo: data.apodo,
    //         sexo: data.sexo,
    //         estado: data.estado,
    //         ubicacion: data.ubicacion,
    //         procedencia: data.procedencia,
    //         criador: data.criador,
    //         observaciones: data.observaciones,
    //         fechaNacimiento: data.fechaNacimiento || null,
    //         valorCompra: data.valorCompra || null,
    //         valorActual: data.valorActual || null,
    //         raza_ID: data.raza_ID || null,
    //         color_ID: data.color_ID || null,
    //     };

    //     try {
    //         const response = await fetch(`${this.baseUrl}/Aves('${this.aveId}')`, {
    //             method: "PATCH",
    //             headers: {
    //                 "Content-Type": "application/json",
    //                 "Authorization": `Bearer ${this.authService.getToken()}`
    //             },
    //             body: JSON.stringify(payload)
    //         });

    //         if (response.ok) {
    //             MessageToast.show("Ave actualizada exitosamente");
    //             oModel.setProperty("/editMode", false);
    //             this.cargarAve();
    //         } else {
    //             const error = await response.json();
    //             MessageBox.error(error.error?.message || "Error al actualizar");
    //         }
    //     } catch (error) {
    //         MessageBox.error("Error de conexión");
    //     }
    // }


    private eliminarAve(oEvent: Event): void {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        const oAve = oModel.getData();
        const sNombreAve = oAve.nombre ? oAve.nombre : oAve.placa;

        MessageBox.confirm(
            `¿Estás seguro que quieres eliminar el ave '${sNombreAve}'?`,
            {
                title: "Eliminar Ave",
                onClose: (oAction: string) => {
                    if (oAction === MessageBox.Action.OK) {
                        this.performEliminar(oAve);
                    }
                },
            }
        );
    }

    private async performEliminar(ave: IAve): Promise<void> {
        try {
            const oRouter = (this.getOwnerComponent() as any).getRouter();
            const response = await fetch(`${this.baseUrl}/eliminarAve`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authService.getToken()}`
                },
                body: JSON.stringify({
                    aveId: ave.ID
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const oResult = await response.json();

            if (oResult?.success) {
                MessageBox.success("¡Ave eliminada exitosamente!", {
                    actions: [MessageBox.Action.OK],
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function (sAction) {
                        oRouter.navTo("RouteList");
                    },
                    dependentOn: this.getView()
                });

            } else {
                MessageToast.show(oResult?.message || "No se pudo eliminar");
            }


        } catch (error) {
            console.error("Error eliminando ave:", error);
            MessageBox.error("Error al eliminar el ave");
        }
    }

    public onVerPadre(): void {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        let sNombreAve = oModel.getProperty("/padre/nombre");
        MessageBox.confirm(
            `¿Estás seguro que deseas navegar a los detalles del Padre '${sNombreAve}'?`,
            {
                title: "Navegar detalle Padre",
                onClose: (oAction: string) => {
                    if (oAction === MessageBox.Action.OK) {
                        const padreId: any = oModel.getProperty("/padre/ID");

                        if (padreId) {
                            const oRouter = (this.getOwnerComponent() as UIComponent).getRouter();

                            const sHash = oRouter.getURL("RouteAveDetail", {
                                aveId: padreId
                            });

                            window.open("#" + sHash, "_blank"); //abre en nueva pestaña
                        }
                    }
                },
            }
        );

    }

    public onVerMadre(): void {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        let sNombreAve = oModel.getProperty("/madre/nombre");
        MessageBox.confirm(
            `¿Estás seguro que deseas navegar a los detalles de la Madre '${sNombreAve}'?`,
            {
                title: "Navegar detalle Madre",
                onClose: (oAction: string) => {
                    if (oAction === MessageBox.Action.OK) {
                        const madreId: any = oModel.getProperty("/madre/ID");

                        if (madreId) {
                            const oRouter = (this.getOwnerComponent() as UIComponent).getRouter();

                            const sHash = oRouter.getURL("RouteAveDetail", {
                                aveId: madreId
                            });

                            window.open("#" + sHash, "_blank"); //abre en nueva pestaña
                        }
                    }
                },
            }
        );
    }

    public onVerArbGen(): void {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        const oAve = oModel?.getData();
        const aveId = oAve?.ID || this.aveId;

        if (!aveId) {
            MessageToast.show("No se pudo obtener el ave seleccionada");
            return;
        }

        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteGenealogia", {
            "?query": {
                aveId
            }
        });
    }

    public onAgregarPesaje(): void {
        MessageToast.show("Próximamente: agregar pesaje");
    }

    private resetEvaluacionForm(): void {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        oModel.setProperty("/evaluacionDialogTitle", "Registrar evaluacion");
        oModel.setProperty("/evaluacionEditId", "");
        oModel.setProperty("/nuevaEvaluacion", {
            vigor: "",
            saludGeneral: "",
            fertilidad: "",
            desarrollo: "BUENO",
            aptoReproduccion: true,
            defectosObservados: "",
            recomendacion: ""
        });
    }

    public async onAbrirEvaluacionDialog(): Promise<void> {
        this.resetEvaluacionForm();

        if (!this._oEvaluacionDialog) {
            this._oEvaluacionDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "com.rprincipees.registroavescombate.view.fragments.EvaluacionAveDialog",
                controller: this
            });
            this.getView()?.addDependent(this._oEvaluacionDialog);
        }

        this._oEvaluacionDialog.open();
    }

    public async onEditarEvaluacion(oEvent: Event): Promise<void> {
        const oContext = oEvent.getSource().getBindingContext("detail");
        if (!oContext) {
            MessageBox.warning("No se pudo obtener la evaluacion seleccionada.");
            return;
        }

        const evaluacion = oContext.getObject();
        const oModel = this.getView()?.getModel("detail") as JSONModel;

        oModel.setProperty("/evaluacionDialogTitle", "Editar evaluacion");
        oModel.setProperty("/evaluacionEditId", evaluacion.ID || "");
        oModel.setProperty("/nuevaEvaluacion", {
            vigor: evaluacion.vigor ?? "",
            saludGeneral: evaluacion.saludGeneral ?? "",
            fertilidad: evaluacion.fertilidad ?? "",
            desarrollo: evaluacion.desarrollo || "BUENO",
            aptoReproduccion: evaluacion.aptoReproduccion !== false,
            defectosObservados: evaluacion.defectosObservados || "",
            recomendacion: evaluacion.recomendacion || ""
        });

        if (!this._oEvaluacionDialog) {
            this._oEvaluacionDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "com.rprincipees.registroavescombate.view.fragments.EvaluacionAveDialog",
                controller: this
            });
            this.getView()?.addDependent(this._oEvaluacionDialog);
        }

        this._oEvaluacionDialog.open();
    }

    public onCerrarEvaluacionDialog(): void {
        this._oEvaluacionDialog?.close();
    }

    public async onRegistrarEvaluacion(): Promise<void> {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        const evaluacion = oModel.getProperty("/nuevaEvaluacion");
        const evaluacionEditId = oModel.getProperty("/evaluacionEditId");
        const authUser = localStorage.getItem("auth_user");

        if (!authUser) {
            MessageToast.show("No se encontró la sesión del usuario");
            return;
        }

        const usuario = JSON.parse(authUser);
        const payload = {
            ave_ID: this.aveId,
            fecha: new Date().toISOString().split("T")[0],
            vigor: evaluacion.vigor ? Number(evaluacion.vigor) : null,
            saludGeneral: evaluacion.saludGeneral ? Number(evaluacion.saludGeneral) : null,
            fertilidad: evaluacion.fertilidad ? Number(evaluacion.fertilidad) : null,
            desarrollo: evaluacion.desarrollo || "BUENO",
            defectosObservados: evaluacion.defectosObservados || null,
            aptoReproduccion: evaluacion.aptoReproduccion,
            recomendacion: evaluacion.recomendacion || null,
            usuario_ID: usuario._id
        };

        try {
            const response = await fetch(evaluacionEditId
                ? `${this.baseUrl}/EvaluacionesAves('${evaluacionEditId}')`
                : `${this.baseUrl}/EvaluacionesAves`, {
                method: evaluacionEditId ? "PATCH" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authService.getToken()}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error("No se pudo registrar la evaluación");
            }

            MessageToast.show(evaluacionEditId ? "Evaluacion actualizada" : "Evaluacion registrada");
            this.resetEvaluacionForm();
            this._oEvaluacionDialog?.close();
            await this.cargarEvaluaciones();
        } catch (error) {
            MessageBox.error("No se pudo registrar la evaluación");
        }
    }

    public onNavBack(): void {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteList");
    }

    public onLogout = async (): Promise<void> => {
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

    public onNavWelcome(): void {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteWelcome");
    }

    public formatearSexo(sexo: SexoAve): string {
        const estados = {
            [SexoAve.Hembra]: "Hembra",
            [SexoAve.Macho]: "Macho",
        };

        return estados[sexo] || sexo;
    }

    public formatearEstado(estado: EstadoAve): string {
        const estados = {
            [EstadoAve.Activo]: "Activo",
            [EstadoAve.Inactivo]: "Inactivo",
            [EstadoAve.Entrenamiento]: "En Entrenamiento",
            [EstadoAve.Competencia]: "En Competencia",
            [EstadoAve.Retirado]: "Retirado",
        };

        return estados[estado] || estado;
    }

    public formatearCategoria(categoria: CategoriaAve): string {
        const categorias = {
            [CategoriaAve.Bueno]: "Bueno",
            [CategoriaAve.Excelente]: "Excelente",
            [CategoriaAve.Extraordinario]: "Extraordinario",
        };

        return categorias[categoria] || categoria;
    }

    public formatearFecha(fecha: string | Date): string {
        if (!fecha) {
          return "";
        }
    
        if (typeof fecha === "string") {
          const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (match) {
            return `${match[3]}/${match[2]}/${match[1]}`;
          }
        }
    
        const date = fecha instanceof Date ? fecha : new Date(fecha);
        if (isNaN(date.getTime())) {
          return "";
        }
    
        return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
      }

}
