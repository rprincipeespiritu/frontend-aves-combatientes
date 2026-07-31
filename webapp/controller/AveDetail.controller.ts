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
import BusyDialog from "sap/m/BusyDialog";
import {CategoriaAve, EstadoAve, IAve, SexoAve} from "com/rprincipees/registroavescombate/types/Models";
import formatter from "../model/formatter";
import ConfirmationService from "../services/ConfirmationService";
import { resolverPlanesCruceTexto } from "../services/PlanCruceLookupService";

export default class AveDetail extends Controller {
    private authService: AuthService;
    private baseUrl: string = "http://localhost:4004/api/avecombatiente";
    private aveId: string = "";
    private _oUserMenuPopover: any;
    private _oUserMenuSheet: any;
    private _oEvaluacionDialog: any;
    private _oEvaluacionPleitoDialog: any;
    private _oArchivoAveViewerDialog: any;
    private _oUploadBusyDialog?: BusyDialog;
    private readonly maxArchivosAve: number = 3;
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
    this.bindUserModel();

        this.aveId = oEvent.getParameter("arguments").aveId;

        this.getView()?.setModel(new JSONModel({
            editMode: false,
            placa: "", nombre: "", apodo: "", sexo: "",
            estado: "", ubicacion: "", razaNombre: "", colorNombre: "",
            fechaNacimiento: "", fechaFallecimiento: "", procedencia: "", criador: "",
            valorCompra: 0, valorActual: 0, observaciones: "",
            totalPeleas: 0, peleasGanadas: 0, porcentajeVictorias: "0%",
            pesoActual: 0, edad: 0, pesajes: [], peleas: [],
            padreNombre: "", madreNombre: "", padre_ID: "", madre_ID: "",
            raza_ID: "", color_ID: "", fotoPrincipal: "",
            evaluaciones: [],
            evaluacionesPleito: [],
            archivosAve: [],
            composicionLineas: [],
            archivosRestantes: this.maxArchivosAve,
            archivoViewer: {
                title: "",
                nombreArchivo: "",
                fotoId: "",
                puedeUsarComoPrincipal: false,
                tipo: "",
                url: "",
                urlOriginal: "",
                html: ""
            },
            evaluacionDialogTitle: "Registrar evaluacion",
            evaluacionEditId: "",
            evaluacionPleitoDialogTitle: "Registrar evaluacion de pleito",
            evaluacionPleitoEditId: "",
            nuevaEvaluacion: {
                vigor: "",
                saludGeneral: "",
                fertilidad: "",
                desarrollo: "BUENO",
                aptoReproduccion: true,
                defectosObservados: "",
                recomendacion: ""
            },
            nuevaEvaluacionPleito: {
                fecha: new Date().toISOString().split("T")[0],
                calificacion: "BUENO",
                bravura: "",
                tecnica: "",
                resistencia: "",
                condicionFisica: "",
                observaciones: "",
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
                accesoSuscripcion: false,
                multimediaPremium: false
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
            const multimediaPremium =
                tieneAcceso && ["PRUEBA", "PREMIUM"].includes(String(data.plan || "").toUpperCase());

            oModel.setProperty("/plan", data.plan || "");
            oModel.setProperty("/estadoSuscripcion", data.estado || "");
            oModel.setProperty("/accesoSuscripcion", tieneAcceso);
            oModel.setProperty("/multimediaPremium", multimediaPremium);
            oModel.refresh(true);

            if (multimediaPremium) {
                await this.cargarArchivosAve();
            }
        } catch (error) {
            // El detalle del ave puede mostrarse aunque falle el resumen de suscripcion.
        }
    }

    public async onUserMenuPress(oEvent: Event): Promise<void> {
        const oSource = oEvent.getSource() as Control;
    this.bindUserModel();

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
                planesCruceTexto: "",
                fotoPrincipal: "",
                pesajes: ave.pesajes || [],
                peleas: ave.peleas || [],
                editMode: false
            });

            await this.cargarPlanesCruce(ave);
            await this.cargarEvaluaciones();
            await this.cargarEvaluacionesPleito();
            await this.cargarComposicionLineas();
            await this.cargarArchivosAve();

        } catch (error) {
            MessageBox.error("Error cargando el ave");
        }
    }

    private async cargarPlanesCruce(ave: any): Promise<void> {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        const texto = await resolverPlanesCruceTexto({
            baseUrl: this.baseUrl,
            token: this.authService.getToken(),
            padreId: ave?.padre_ID || ave?.padre?.ID,
            madreId: ave?.madre_ID || ave?.madre?.ID,
        });
        oModel.setProperty("/planesCruceTexto", texto || "-");
    }

    private async cargarComposicionLineas(): Promise<void> {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        const response = await fetch(
            `${this.baseUrl}/ComposicionesLineaAve?$filter=ave_ID eq '${this.aveId}'&$expand=linea&$orderby=porcentaje desc`,
            { headers: { "Authorization": `Bearer ${this.authService.getToken()}` } }
        );

        if (!response.ok) {
            oModel.setProperty("/composicionLineas", []);
            return;
        }

        const data = await response.json();
        oModel.setProperty("/composicionLineas", data.value || []);
    }

    public async onRecalcularComposicionLineas(): Promise<void> {
        try {
            const response = await fetch(
                `${this.baseUrl}/Aves('${this.aveId}')/AveCombatienteService.recalcularComposicionLineas`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${this.authService.getToken()}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({}),
                }
            );
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data?.error?.message || "No se pudo recalcular la composición de líneas");
            }

            await this.cargarComposicionLineas();
            MessageToast.show(data?.message || "Composición de líneas recalculada");
        } catch (error: any) {
            MessageBox.error(error.message || "No se pudo recalcular la composición de líneas");
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

    private async cargarEvaluacionesPleito(): Promise<void> {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        const response = await fetch(
            `${this.baseUrl}/EvaluacionesPleito?$filter=ave_ID eq ${this.aveId}&$orderby=fecha desc,modifiedAt desc`,
            { headers: { "Authorization": `Bearer ${this.authService.getToken()}` } }
        );

        const data = await response.json();
        const evaluaciones = data.value || [];
        oModel.setProperty("/evaluacionesPleito", evaluaciones);
        if (evaluaciones[0]?.calificacion) {
            oModel.setProperty("/categoria", evaluaciones[0].calificacion);
        }
    }

    private async cargarArchivosAve(): Promise<void> {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        const dashboard = this.getDashboardModel();

        if (!dashboard.getProperty("/multimediaPremium")) {
            oModel.setProperty("/archivosAve", []);
            oModel.setProperty("/archivosRestantes", this.maxArchivosAve);
            return;
        }

        const headers = { "Authorization": `Bearer ${this.authService.getToken()}` };

        const [fotosResponse, videosResponse] = await Promise.all([
            fetch(`${this.baseUrl}/FotosAve?$filter=ave_ID eq ${this.aveId}&$orderby=createdAt desc`, { headers }),
            fetch(`${this.baseUrl}/VideosAve?$filter=ave_ID eq ${this.aveId}&$orderby=createdAt desc`, { headers })
        ]);

        const fotosData = await fotosResponse.json();
        const videosData = await videosResponse.json();
        const fotos = (fotosData.value || []).map((item: any) => ({
            ...item,
            tipo: "IMAGEN",
            endpoint: "FotosAve",
            nombreArchivo: item.titulo || "Imagen del ave",
            nombreVisual: this.obtenerNombreSinExtension(item.titulo || "Imagen del ave"),
            urlArchivo: item.urlSharepoint,
            estadoArchivoTexto: this.obtenerEstadoArchivoTexto(item.urlSharepoint, "IMAGEN"),
            estadoArchivoState: this.obtenerEstadoArchivoState(item.urlSharepoint),
            estadoArchivoIcon: this.obtenerEstadoArchivoIcon(item.urlSharepoint)
        }));
        const videos = (videosData.value || []).map((item: any) => ({
            ...item,
            tipo: "VIDEO",
            endpoint: "VideosAve",
            nombreArchivo: item.titulo || "Video del ave",
            nombreVisual: this.obtenerNombreSinExtension(item.titulo || "Video del ave"),
            urlArchivo: item.urlSharepoint,
            estadoArchivoTexto: this.obtenerEstadoArchivoTexto(item.urlSharepoint, "VIDEO"),
            estadoArchivoState: this.obtenerEstadoArchivoState(item.urlSharepoint),
            estadoArchivoIcon: this.obtenerEstadoArchivoIcon(item.urlSharepoint)
        }));
        const archivos = [...fotos, ...videos].slice(0, this.maxArchivosAve);
        const fotoPrincipal = fotos.find((foto: any) => foto.esPrincipal);
        const fotoPrincipalUrl = fotoPrincipal
            ? await this.obtenerUrlVisualizacionArchivo(fotoPrincipal.thumbnailUrl || fotoPrincipal.urlArchivo || "")
            : "";

        oModel.setProperty("/archivosAve", archivos);
        oModel.setProperty("/archivosRestantes", this.maxArchivosAve - archivos.length);
        oModel.setProperty("/fotoPrincipal", fotoPrincipalUrl);
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

    private obtenerEstadoArchivoTexto(url?: string, tipo?: string): string {
        if (!url || String(url).startsWith("pending-upload://")) return "Pendiente";
        const esVideo = tipo === "VIDEO";
        if (String(url).includes(".s3.")) {
            return esVideo ? "Video registrado" : "Imagen registrada";
        }
        return esVideo ? "Video registrado" : tipo === "IMAGEN" ? "Imagen registrada" : "Registrado";
    }

    private obtenerEstadoArchivoState(url?: string): string {
        if (!url || String(url).startsWith("pending-upload://")) return "Warning";
        return "Success";
    }

    private obtenerEstadoArchivoIcon(url?: string): string {
        if (!url || String(url).startsWith("pending-upload://")) return "sap-icon://cloud";
        return "sap-icon://sys-enter-2";
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

        const confirmado = evaluacionEditId
            ? await ConfirmationService.confirmUpdate("la evaluacion reproductiva")
            : await ConfirmationService.confirmCreate("la evaluacion reproductiva");
        if (!confirmado) return;

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

    private resetEvaluacionPleitoForm(): void {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        oModel.setProperty("/evaluacionPleitoDialogTitle", "Registrar evaluacion de pleito");
        oModel.setProperty("/evaluacionPleitoEditId", "");
        oModel.setProperty("/nuevaEvaluacionPleito", {
            fecha: new Date().toISOString().split("T")[0],
            calificacion: "BUENO",
            bravura: "",
            tecnica: "",
            resistencia: "",
            condicionFisica: "",
            observaciones: "",
            recomendacion: ""
        });
    }

    public async onAbrirEvaluacionPleitoDialog(): Promise<void> {
        this.resetEvaluacionPleitoForm();

        if (!this._oEvaluacionPleitoDialog) {
            this._oEvaluacionPleitoDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "com.rprincipees.registroavescombate.view.fragments.EvaluacionPleitoDialog",
                controller: this
            });
            this.getView()?.addDependent(this._oEvaluacionPleitoDialog);
        }

        this._oEvaluacionPleitoDialog.open();
    }

    public async onEditarEvaluacionPleito(oEvent: Event): Promise<void> {
        const oContext = oEvent.getSource().getBindingContext("detail");
        if (!oContext) {
            MessageBox.warning("No se pudo obtener la evaluacion de pleito seleccionada.");
            return;
        }

        const evaluacion = oContext.getObject();
        const oModel = this.getView()?.getModel("detail") as JSONModel;

        oModel.setProperty("/evaluacionPleitoDialogTitle", "Editar evaluacion de pleito");
        oModel.setProperty("/evaluacionPleitoEditId", evaluacion.ID || "");
        oModel.setProperty("/nuevaEvaluacionPleito", {
            fecha: evaluacion.fecha || new Date().toISOString().split("T")[0],
            calificacion: evaluacion.calificacion || "BUENO",
            bravura: evaluacion.bravura ?? "",
            tecnica: evaluacion.tecnica ?? "",
            resistencia: evaluacion.resistencia ?? "",
            condicionFisica: evaluacion.condicionFisica ?? "",
            observaciones: evaluacion.observaciones || "",
            recomendacion: evaluacion.recomendacion || ""
        });

        if (!this._oEvaluacionPleitoDialog) {
            this._oEvaluacionPleitoDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "com.rprincipees.registroavescombate.view.fragments.EvaluacionPleitoDialog",
                controller: this
            });
            this.getView()?.addDependent(this._oEvaluacionPleitoDialog);
        }

        this._oEvaluacionPleitoDialog.open();
    }

    public onCerrarEvaluacionPleitoDialog(): void {
        this._oEvaluacionPleitoDialog?.close();
    }

    public async onRegistrarEvaluacionPleito(): Promise<void> {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        const evaluacion = oModel.getProperty("/nuevaEvaluacionPleito");
        const evaluacionEditId = oModel.getProperty("/evaluacionPleitoEditId");
        const authUser = localStorage.getItem("auth_user");

        if (!authUser) {
            MessageToast.show("No se encontro la sesion del usuario");
            return;
        }

        if (!evaluacion.fecha || !evaluacion.calificacion) {
            MessageBox.warning("Selecciona fecha y calificacion.");
            return;
        }

        const usuario = JSON.parse(authUser);
        const payload = {
            ave_ID: this.aveId,
            fecha: evaluacion.fecha,
            calificacion: evaluacion.calificacion,
            bravura: evaluacion.bravura ? Number(evaluacion.bravura) : null,
            tecnica: evaluacion.tecnica ? Number(evaluacion.tecnica) : null,
            resistencia: evaluacion.resistencia ? Number(evaluacion.resistencia) : null,
            condicionFisica: evaluacion.condicionFisica ? Number(evaluacion.condicionFisica) : null,
            observaciones: evaluacion.observaciones || null,
            recomendacion: evaluacion.recomendacion || null,
            usuario_ID: usuario._id
        };

        const confirmado = evaluacionEditId
            ? await ConfirmationService.confirmUpdate("la evaluacion de pleito", `Fecha: ${evaluacion.fecha}`)
            : await ConfirmationService.confirmCreate("la evaluacion de pleito", `Fecha: ${evaluacion.fecha}`);
        if (!confirmado) return;

        try {
            const response = await fetch(evaluacionEditId
                ? `${this.baseUrl}/EvaluacionesPleito('${evaluacionEditId}')`
                : `${this.baseUrl}/EvaluacionesPleito`, {
                method: evaluacionEditId ? "PATCH" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authService.getToken()}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data?.error?.message || "No se pudo registrar la evaluacion de pleito");
            }

            MessageToast.show(evaluacionEditId ? "Evaluacion de pleito actualizada" : "Evaluacion de pleito registrada");
            this.resetEvaluacionPleitoForm();
            this._oEvaluacionPleitoDialog?.close();
            await this.cargarEvaluacionesPleito();
        } catch (error: any) {
            MessageBox.error(error.message || "No se pudo registrar la evaluacion de pleito");
        }
    }

    public onEliminarEvaluacionPleito(oEvent: Event): void {
        const oContext = oEvent.getSource().getBindingContext("detail");
        if (!oContext) {
            MessageBox.warning("No se pudo obtener la evaluacion de pleito seleccionada.");
            return;
        }

        const evaluacion = oContext.getObject();
        MessageBox.confirm("Deseas eliminar esta evaluacion de pleito?", {
            title: "Eliminar evaluacion",
            onClose: async (action: string) => {
                if (action !== MessageBox.Action.OK) return;

                try {
                    const response = await fetch(`${this.baseUrl}/EvaluacionesPleito('${evaluacion.ID}')`, {
                        method: "DELETE",
                        headers: {
                            "Authorization": `Bearer ${this.authService.getToken()}`
                        }
                    });

                    if (!response.ok) {
                        throw new Error("No se pudo eliminar la evaluacion de pleito");
                    }

                    MessageToast.show("Evaluacion de pleito eliminada");
                    await this.cargarEvaluacionesPleito();
                } catch (error: any) {
                    MessageBox.error(error.message || "No se pudo eliminar la evaluacion de pleito");
                }
            }
        });
    }

    public async onArchivosAveDetailChange(oEvent: any): Promise<void> {
        if (!this.getDashboardModel().getProperty("/multimediaPremium")) {
            MessageBox.warning("Las fotos y videos solo estan disponibles para el plan Premium o Prueba.");
            this.limpiarUploaderArchivosAveDetail();
            return;
        }

        const oModel = this.getView()?.getModel("detail") as JSONModel;
        const actuales = oModel.getProperty("/archivosAve") || [];
        const files = Array.from(oEvent.getParameter("files") || []) as File[];
        const disponibles = this.maxArchivosAve - actuales.length;

        if (!files.length) return;

        if (disponibles <= 0) {
            MessageBox.warning(`No se registro ningun archivo porque el ave ya tiene el maximo permitido de ${this.maxArchivosAve} archivos.`);
            this.limpiarUploaderArchivosAveDetail();
            return;
        }

        if (files.length > disponibles) {
            MessageBox.warning(`Seleccionaste ${files.length} archivos, pero solo quedan ${disponibles} espacios disponibles. Se registraran solo los permitidos.`);
        }

        try {
            this.abrirBusySubidaArchivos(files.slice(0, Math.max(disponibles, 0)).length);

            const agregados = new Set(actuales.map((archivo: any) => this.normalizarNombreArchivo(archivo.nombreArchivo)));
            let archivosRegistrados = 0;
            let archivosOmitidos = 0;
            let huboDuplicados = false;

            for (const file of files.slice(0, Math.max(disponibles, 0))) {
                if (!file.type?.startsWith("image/") && !file.type?.startsWith("video/")) {
                    archivosOmitidos++;
                    MessageToast.show(`${file.name} no se registro porque solo se permiten imagenes o videos.`);
                    continue;
                }

                const nombreNormalizado = this.normalizarNombreArchivo(file.name);
                if (agregados.has(nombreNormalizado)) {
                    archivosOmitidos++;
                    huboDuplicados = true;
                    MessageBox.warning(`No se pueden guardar archivos duplicados. "${this.obtenerNombreSinExtension(file.name)}" ya existe en esta ave.`);
                    continue;
                }

                agregados.add(nombreNormalizado);
                await this.registrarArchivoAve(file);
                archivosRegistrados++;
            }

            this.limpiarUploaderArchivosAveDetail();
            await this.cargarArchivosAve();

            if (archivosRegistrados > 0) {
                MessageToast.show(`${archivosRegistrados} archivo(s) registrado(s). ${this.maxArchivosAve - (actuales.length + archivosRegistrados)} espacio(s) disponible(s).`);
            } else if ((archivosOmitidos > 0 || disponibles <= 0) && !huboDuplicados) {
                MessageToast.show("No se registraron archivos nuevos.");
            }
        } catch (error: any) {
            MessageBox.error(error.message || "No se pudo registrar el archivo.");
        } finally {
            this.cerrarBusySubidaArchivos();
        }
    }

    public onEliminarArchivoAve(oEvent: Event): void {
        const oContext = oEvent.getSource().getBindingContext("detail");
        const archivo = oContext?.getObject();
        if (!archivo?.ID || !archivo?.endpoint) return;

        MessageBox.confirm("Deseas quitar este archivo del ave?", {
            title: "Quitar archivo",
            onClose: async (action: string) => {
                if (action !== MessageBox.Action.OK) return;

                try {
                    const response = await fetch(`${this.baseUrl}/${archivo.endpoint}('${archivo.ID}')`, {
                        method: "DELETE",
                        headers: {
                            "Authorization": `Bearer ${this.authService.getToken()}`
                        }
                    });

                    if (!response.ok) {
                        const error = await response.json().catch(() => ({}));
                        throw new Error(error.error?.message || "No se pudo quitar el archivo.");
                    }

                    await this.cargarArchivosAve();
                    MessageToast.show("Archivo eliminado");
                } catch (error: any) {
                    MessageBox.error(error.message || "No se pudo quitar el archivo.");
                }
            }
        });
    }

    public async onVerArchivoAve(oEvent: Event): Promise<void> {
        if (!this.getDashboardModel().getProperty("/multimediaPremium")) {
            MessageBox.warning("Las fotos y videos solo estan disponibles para el plan Premium o Prueba.");
            return;
        }

        const oContext = oEvent.getSource().getBindingContext("detail");
        const archivo = oContext?.getObject();
        if (!archivo) return;

        const oModel = this.getView()?.getModel("detail") as JSONModel;
        const url = await this.obtenerUrlVisualizacionArchivo(archivo.urlArchivo || archivo.urlSharepoint || "");
        const esPendiente = !url || String(url).startsWith("pending-upload://");
        const nombreArchivo = archivo.nombreArchivo || archivo.titulo || "Archivo del ave";
        const tipo = archivo.tipo || "ARCHIVO";

        oModel.setProperty("/archivoViewer", {
            title: this.obtenerTituloAveVisorArchivo(oModel),
            nombreArchivo,
            fotoId: tipo === "IMAGEN" ? archivo.ID || "" : "",
            puedeUsarComoPrincipal: tipo === "IMAGEN" && !!archivo.ID && !esPendiente,
            tipo,
            url,
            urlOriginal: archivo.urlArchivo || archivo.urlSharepoint || "",
            html: this.crearHtmlVisorArchivo(tipo, url, nombreArchivo, esPendiente)
        });

        if (!this._oArchivoAveViewerDialog) {
            this._oArchivoAveViewerDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "com.rprincipees.registroavescombate.view.fragments.ArchivoAveViewerDialog",
                controller: this
            });
            this.getView()?.addDependent(this._oArchivoAveViewerDialog);
        }

        this._oArchivoAveViewerDialog.open();
    }

    public async onVerFotoPrincipal(): Promise<void> {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        const url = oModel.getProperty("/fotoPrincipal");

        if (!url) {
            return;
        }

        const titulo = this.obtenerTituloAveVisorArchivo(oModel);
        oModel.setProperty("/archivoViewer", {
            title: titulo,
            nombreArchivo: "Imagen principal",
            fotoId: "",
            puedeUsarComoPrincipal: false,
            tipo: "IMAGEN",
            url,
            urlOriginal: url,
            html: this.crearHtmlVisorArchivo("IMAGEN", url, titulo, false)
        });

        if (!this._oArchivoAveViewerDialog) {
            this._oArchivoAveViewerDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "com.rprincipees.registroavescombate.view.fragments.ArchivoAveViewerDialog",
                controller: this
            });
            this.getView()?.addDependent(this._oArchivoAveViewerDialog);
        }

        this._oArchivoAveViewerDialog.open();
    }

    public onCerrarVisorArchivoAve(): void {
        this.detenerMediaArchivoAve();
        this._oArchivoAveViewerDialog?.close();

        const oModel = this.getView()?.getModel("detail") as JSONModel;
        oModel.setProperty("/archivoViewer/html", "");
        oModel.setProperty("/archivoViewer/url", "");
        oModel.setProperty("/archivoViewer/urlOriginal", "");
        oModel.setProperty("/archivoViewer/fotoId", "");
        oModel.setProperty("/archivoViewer/puedeUsarComoPrincipal", false);
    }

    public async onUsarArchivoComoImagenPrincipal(): Promise<void> {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        const fotoId = oModel.getProperty("/archivoViewer/fotoId");
        const url = oModel.getProperty("/archivoViewer/url");
        const urlOriginal = oModel.getProperty("/archivoViewer/urlOriginal");

        if (!fotoId) {
            MessageBox.warning("Selecciona una imagen valida para usarla como principal.");
            return;
        }

        const confirmado = await ConfirmationService.confirmUpdate("la imagen principal del ave");
        if (!confirmado) return;

        try {
            const headers = {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.authService.getToken()}`
            };
            const fotos = (oModel.getProperty("/archivosAve") || [])
                .filter((archivo: any) => archivo.tipo === "IMAGEN" && archivo.ID);

            await Promise.all(
                fotos
                    .filter((foto: any) => foto.ID !== fotoId && foto.esPrincipal)
                    .map((foto: any) => fetch(`${this.baseUrl}/FotosAve('${foto.ID}')`, {
                        method: "PATCH",
                        headers,
                        body: JSON.stringify({ esPrincipal: false })
                    }))
            );

            const response = await fetch(`${this.baseUrl}/FotosAve('${fotoId}')`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ esPrincipal: true })
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data?.error?.message || "No se pudo establecer la imagen principal.");
            }

            oModel.setProperty("/fotoPrincipal", url || await this.obtenerUrlVisualizacionArchivo(urlOriginal || ""));
            MessageToast.show("Imagen principal actualizada");
            this._oArchivoAveViewerDialog?.close();
            await this.cargarArchivosAve();
        } catch (error: any) {
            MessageBox.error(error.message || "No se pudo establecer la imagen principal.");
        }
    }

    private detenerMediaArchivoAve(): void {
        const dialogDom = this._oArchivoAveViewerDialog?.getDomRef?.();
        const mediaElements = dialogDom?.querySelectorAll?.("video, audio") || [];

        mediaElements.forEach((media: HTMLMediaElement) => {
            media.pause();
            media.removeAttribute("src");
            media.querySelectorAll("source").forEach((source) => source.removeAttribute("src"));
            media.load();
        });
    }

    private crearHtmlVisorArchivo(tipo: string, url: string, nombreArchivo: string, esPendiente: boolean): string {
        const nombre = this.escapeHtml(nombreArchivo);
        const src = this.escapeHtml(url);

        if (esPendiente) {
            return `
                <div class="aveMediaPlaceholder">
                    <div class="aveMediaPlaceholderIcon">☁</div>
                    <div class="aveMediaPlaceholderTitle">Archivo pendiente de subida</div>
                    <div class="aveMediaPlaceholderText">${nombre}</div>
                </div>
            `;
        }

        if (tipo === "VIDEO") {
            return `
                <div class="aveMediaViewer">
                    <video controls preload="metadata" playsinline title="${nombre}">
                        <source src="${src}" />
                        Tu navegador no puede reproducir este video.
                    </video>
                </div>
            `;
        }

        return `
            <div class="aveMediaViewer">
                <img src="${src}" alt="${nombre}" />
            </div>
        `;
    }

    private async obtenerUrlVisualizacionArchivo(url: string): Promise<string> {
        if (!url || !String(url).includes(".s3.")) return url;

        const response = await fetch(`${this.baseUrl}/obtenerUrlLecturaS3`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.authService.getToken()}`
            },
            body: JSON.stringify({ fileUrl: url })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || "No se pudo preparar la visualizacion del archivo.");
        }

        return data.downloadUrl || url;
    }

    private obtenerTituloAveVisorArchivo(oModel: JSONModel): string {
        const placa = String(oModel.getProperty("/placa") || "").trim();
        const nombre = String(oModel.getProperty("/nombre") || "").trim();

        return [placa, nombre].filter(Boolean).join(" - ") || "Archivo del ave";
    }

    private escapeHtml(value: string): string {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    private obtenerNombreSinExtension(nombreArchivo: string): string {
        return String(nombreArchivo || "").replace(/\.[^/.]+$/, "");
    }

    private normalizarNombreArchivo(nombreArchivo: string): string {
        return String(nombreArchivo || "").trim().toLowerCase();
    }

    private async registrarArchivoAve(file: File): Promise<void> {
        const esImagen = file.type.startsWith("image/");
        const endpoint = esImagen ? "FotosAve" : "VideosAve";
        const tipo = esImagen ? "IMAGEN" : "VIDEO";
        const carga = await this.prepararCargaArchivoAve(file, tipo);
        await this.subirArchivoAS3(carga.uploadUrl, file, file.type);

        const payload: any = {
            ave_ID: this.aveId,
            titulo: carga.nombreArchivo || file.name,
            descripcion: "Archivo guardado correctamente",
            urlSharepoint: carga.fileUrl
        };

        if (esImagen) {
            payload.fechaFoto = new Date().toISOString().slice(0, 10);
            payload.thumbnailUrl = carga.fileUrl;
            payload.esPrincipal = false;
        } else {
            payload.fechaVideo = new Date().toISOString().slice(0, 10);
        }

        const response = await fetch(`${this.baseUrl}/${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.authService.getToken()}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `No se pudo registrar ${file.name}`);
        }
    }

    private async prepararCargaArchivoAve(file: File, tipo: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/prepararCargaArchivoAve`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.authService.getToken()}`
            },
            body: JSON.stringify({
                aveId: this.aveId,
                nombreArchivo: file.name,
                mimeType: file.type,
                tamanioBytes: file.size,
                tipo
            })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || data.message || `No se pudo preparar ${file.name}`);
        }

        if (!data.uploadUrl) {
            throw new Error("El backend no devolvio URL de carga. Configura AWS_S3_AVES_BUCKET o AWS_S3_BUCKET.");
        }

        return data;
    }

    private async subirArchivoAS3(uploadUrl: string, file: File, mimeType: string): Promise<void> {
        const response = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
                "Content-Type": mimeType
            },
            body: file
        });

        if (!response.ok) {
            throw new Error(`No se pudo subir ${file.name} a AWS S3.`);
        }
    }

    private abrirBusySubidaArchivos(totalArchivos: number): void {
        if (!this._oUploadBusyDialog) {
            this._oUploadBusyDialog = new BusyDialog({
                title: "Procesando ...",
                text: "Subiendo archivo al repositorio remoto",
                showCancelButton: false
            });
            this.getView()?.addDependent(this._oUploadBusyDialog);
        }

        this._oUploadBusyDialog.setTitle("Procesando ...");
        this._oUploadBusyDialog.setText("Subiendo archivo al repositorio remoto");
        this._oUploadBusyDialog.open();
    }

    private cerrarBusySubidaArchivos(): void {
        this._oUploadBusyDialog?.close();
    }

    private limpiarUploaderArchivosAveDetail(): void {
        const uploader = this.byId("archivosAveDetailUploader") as any;
        uploader?.clear?.();
        uploader?.setValue?.("");
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
            oRouter?.navTo("RouteLanding");

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
            [EstadoAve.Fallecido]: "Fallecido",
            [EstadoAve.Entrenamiento]: "En Entrenamiento",
            [EstadoAve.Competencia]: "En Competencia",
            [EstadoAve.Retirado]: "Retirado",
        };

        return estados[estado] || estado;
    }

    public formatearCategoria(categoria: CategoriaAve): string {
        const categorias = {
            [CategoriaAve.Pesimo]: "Pesimo",
            [CategoriaAve.Regular]: "Regular",
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
