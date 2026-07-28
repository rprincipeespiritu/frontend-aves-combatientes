import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/ui/core/routing/Router";
import { AuthService } from "../services/AuthService";
import Input from "sap/m/Input";
import Event from "sap/ui/base/Event";
import { IAve } from "../types/Models";
import Fragment from "sap/ui/core/Fragment";
import Control from "sap/ui/mdc/Control";
import Device from "sap/ui/Device";
import ActionSheet from "sap/m/ActionSheet";
import Popover from "sap/m/Popover";
import Dialog from "sap/m/Dialog";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import ConfirmationService from "../services/ConfirmationService";

export default class AveCreate extends Controller {
    private authService: AuthService;
    private baseUrl: string = "http://localhost:4004/api/avecombatiente";
    private _oUserMenuPopover: any;
    private _oUserMenuSheet: any;
    private _oPadresDialog: Dialog;
    private helpSelected: any;
    private oUploadPluginInstance: any;
    private readonly maxArchivosAve: number = 3;

    public onInit(): void {
        this.authService = AuthService.getInstance();

        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        oRouter?.getRoute("RouteAveCreate")?.attachPatternMatched(this.onRouteMatched, this);

    }

    private onRouteMatched = (oEvent: any): void => {
        if (!this.authService.isAuthenticated()) {
            const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
            oRouter?.navTo("RouteLogin");
            return;
        } else {
    this.bindUserModel();

            const oModel = new JSONModel({
                placa: "", nombre: "", apodo: "", sexo: "M",
                estado: "ACTIVO", ubicacion: "", raza: "",
                color: "", tipoAve: "", fechaNacimiento: "",
                fechaCompra: "", fechaFallecimiento: "",
                fechaFallecimientoState: "None",
                padre_ID: "", madre_ID: "",
                procedencia: "", criador: "", valorCompra: "",
                valorActual: "", observaciones: "", placaState: "None",
                categoria: "BUENO", placaPadre: "", placaMadre: "",
                archivosAve: [],
                archivosRestantes: this.maxArchivosAve
            });

            /*
            let datos = this.cargarDatosFotos();
            const oModelDocuments = new JSONModel(datos);
            this.byId("table-uploadSet").setModel(oModelDocuments, "documents");
            */
            this.getView()?.setModel(oModel, "create");
            this.cargarCatalogos();
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

    public onEstadoChange(): void {
        const oModel = this.getView()?.getModel("create") as JSONModel;
        if (oModel.getProperty("/estado") !== "FALLECIDO") {
            oModel.setProperty("/fechaFallecimiento", "");
            oModel.setProperty("/fechaFallecimientoState", "None");
        }
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
        try {

            const headers = {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                "Content-Type": "application/json",
            };

            const response = await fetch(`${this.baseUrl}/AvesActivas`, {
                method: "GET",
                headers,
            });

            const aves: IAve[] = await response.json();
            const machos = (aves.value || []).filter((a: any) => a.sexo === "M" && a.padrote === true);
            const hembras = (aves.value || []).filter((a: any) => a.sexo === "H" && a.padrote === true);
            this.getView()?.setModel(new JSONModel(machos), "avesMachos");
            this.getView()?.setModel(new JSONModel(hembras), "avesHembras");
        } catch (error) {
            console.error("Error cargando catálogos:", error);
        }
    }

    private onValueHelpPadre = (): void => {

        const oThat = this;
        oThat.helpSelected = "valueHelpPadre";
        oThat.onAbrirPopupPadres(oThat.helpSelected, "Seleccionar Padre");

    }

    private onValueHelpMadre = (): void => {
        const oThat = this;
        oThat.helpSelected = "valueHelpMadre";
        oThat.onAbrirPopupPadres(oThat.helpSelected, "Seleccionar Madre");
    }

    public async onAbrirPopupPadres(helpSelected: string, sTitulo: string): Promise<void> {
        try {

            const response = await fetch(`${this.baseUrl}/AvesActivas`, {
                method: "GET",
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    "Content-Type": "application/json",
                },
            });

            const aves: IAve[] = await response.json();
            let padres: any[]= [];
            if (helpSelected === "valueHelpPadre"){
                padres = (aves.value || []).filter((a: any) => a.sexo === 'M' && a.padrote === true);
            } else if(helpSelected === "valueHelpMadre"){
                padres = (aves.value || []).filter((a: any) => a.sexo === 'H' && a.padrote === true);
            }
            this.getView()?.setModel(new JSONModel(padres), "avesPadres");

            if (!this._oPadresDialog) {
                this._oPadresDialog = await Fragment.load({
                    id: this.getView()?.getId(),
                    name: "com.rprincipees.registroavescombate.view.fragments.PadresDialog",
                    controller: this
                }) as Dialog;

                this.getView()?.addDependent(this._oPadresDialog);
            }

            this._oPadresDialog.setTitle(sTitulo);
            this._oPadresDialog.open();

        } catch (error) {
            console.error("Error :", error);
        }

    }

    public onSeleccionarPadre(oEvent: Event): void {
        const oThat = this;
        const oSelectedItem = oEvent.getParameter("listItem");

        if (oSelectedItem) {
            const sNombre = oSelectedItem.getTitle();
            const sPlaca = oSelectedItem.getDescription();
            let oInput: Input | undefined;
            if(oThat.helpSelected === "valueHelpPadre") {
                oInput = this.byId("inputPadre") as Input;
            } else if(oThat.helpSelected === "valueHelpMadre"){
                oInput = this.byId("inputMadre") as Input;
            }
            if (oInput) {
                oInput.setValue(sPlaca);
                oInput.setDescription(sNombre);

            }
        }

        this._oPadresDialog?.close();

    }

    public onCerrarPopupPadres(): void {
        this._oPadresDialog?.close();
    }

    public onSearchPadres(oEvent: Event): void {
        const sValue = oEvent.getParameter("newValue") || "";
        const oList = this.byId("listaPadres") as List;
        const oBinding = oList.getBinding("items");

        if (!oBinding) return;

        if (sValue) {
            const oFilter = new Filter({
                filters: [
                    new Filter("nombre", FilterOperator.Contains, sValue),
                    new Filter("placa", FilterOperator.Contains, sValue)
                ],
                and: false // OR
            });

            oBinding.filter([oFilter]);
        } else {
            oBinding.filter([]); // limpia filtro
        }
    }

    public async onGuardar(): Promise<void> {
        try {
            const oThat = this;
            const oModel = this.getView()?.getModel("create") as JSONModel;
            const data = oModel.getData();

            // Validar placa
            if (!data.placa) {
                oModel.setProperty("/placaState", "Error");
                MessageToast.show("La placa es requerida");
                return;
            }
            oModel.setProperty("/placaState", "None");

             // Validar género
             if (!data.sexo) {
                oModel.setProperty("/generoState", "Error");
                MessageToast.show("El género es requerido");
                return;
            }
            oModel.setProperty("/generoState", "None");

             // Validar fecha de nacimiento
             if (!data.fechaNacimiento) {
                oModel.setProperty("/fecNacState", "Error");
                MessageToast.show("La fecha de nacimiento es requerida");
                return;
            }
            oModel.setProperty("/fecNacState", "None");

            if (data.estado === "FALLECIDO" && !data.fechaFallecimiento) {
                oModel.setProperty("/fechaFallecimientoState", "Error");
                MessageToast.show("La fecha de fallecimiento es requerida");
                return;
            }
            oModel.setProperty("/fechaFallecimientoState", "None");

            const authUser = localStorage.getItem("auth_user");
            if (!authUser) {
                MessageToast.show("No se encontró la sesión del usuario");
                return;
            }
            const usuario = JSON.parse(authUser);
            const userId = usuario._id;
            // Construir payload
            const payload: any = {
                placa: data.placa,
                nombre: data.nombre || null,
                apodo: data.apodo || null,
                sexo: data.sexo,
                estado: data.estado,
                raza: data.raza || null,
                color: data.color || null,
                tipoAve: data.tipoAve || null,
                ubicacion: data.ubicacion || null,
                procedencia: data.procedencia || null,
                criador: data.criador || null,
                categoria: data.categoria || null,
                cria: data.cria || null,
                padrote: data.padrote || null,
                observaciones: data.observaciones || null,
                fechaNacimiento: data.fechaNacimiento || null,
                fechaCompra: data.fechaCompra || null,
                fechaFallecimiento: data.estado === "FALLECIDO"
                    ? data.fechaFallecimiento || null
                    : null,
                valorCompra: data.valorCompra ? parseFloat(data.valorCompra) : null,
                valorActual: data.valorActual ? parseFloat(data.valorActual) : null,
                usuario_ID: userId,
                padre_ID: null,
                madre_ID: null
            };

            //const oInputPadre = oThat.byId("inputPadre") as Input;
            const placaPadre = data.placaPadre;
            const oMachosModel = oThat.getView()?.getModel("avesMachos") as JSONModel;
            const aMachos = oMachosModel.getData() as any[];
            let oPadre: IAve[];
            if (aMachos.length > 0 && placaPadre) {
                oPadre = aMachos.filter((a: any) => a.placa === placaPadre);
                data.padre_ID = oPadre[0].ID;
            }

            //const oInputMadre = oThat.byId("inputMadre") as Input;
            const placaMadre = data.placaMadre;
            const oHembrasModel = oThat.getView()?.getModel("avesHembras") as JSONModel;
            const aHembras = oHembrasModel.getData() as any[];
            let oMadre: IAve[];
            if (aHembras.length > 0 && placaMadre) {
                oMadre = aHembras.filter((a: any) => a.placa === placaMadre);
                data.madre_ID = oMadre[0].ID;
            }

            if (data.padre_ID) payload.padre_ID = data.padre_ID;
            if (data.madre_ID) payload.madre_ID = data.madre_ID;

            if (placaPadre && placaPadre === data.placa) {
                MessageToast.show("Un ave no puede ser su propio padre");
                return;
            }
            if (placaMadre && placaMadre === data.placa) {
                MessageToast.show("Un ave no puede ser su propia madre");
                return;
            }
            if (data.padre_ID && data.madre_ID && data.padre_ID === data.madre_ID) {
                MessageToast.show("El padre y la madre no pueden ser la misma ave");
                return;
            }

            const confirmed = await ConfirmationService.confirmCreate(
                "el ave",
                `Placa: ${payload.placa}${payload.nombre ? `\nNombre: ${payload.nombre}` : ""}`
            );
            if (!confirmed) return;

            const response = await fetch(`${this.baseUrl}/Aves`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authService.getToken()}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                // const aveCreada = await response.json();
                // await this.guardarArchivosAve(aveCreada.ID, data.archivosAve || []);
                MessageBox.success("¡Ave creada exitosamente!", {
                    actions: [MessageBox.Action.OK],
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function (sAction) {
                        oThat.onNavBack();
                    },
                    dependentOn: this.getView()
                });
            } else {
                const error = await response.json();
                MessageBox.error(error.error?.message || "Error al crear el ave");
            }
        } catch (error) {
            MessageBox.error(JSON.stringify(error));
        }
    }

    public onArchivosAveChange(oEvent: any): void {
        const oModel = this.getView()?.getModel("create") as JSONModel;
        const actuales = oModel.getProperty("/archivosAve") || [];
        const files = Array.from(oEvent.getParameter("files") || []) as File[];
        const disponibles = this.maxArchivosAve - actuales.length;

        if (!files.length) return;

        if (disponibles <= 0) {
            MessageBox.warning(`No se agrego ningun archivo porque el ave ya tiene el maximo permitido de ${this.maxArchivosAve} archivos.`);
            this.limpiarUploaderArchivosAve();
            return;
        }

        if (files.length > disponibles) {
            MessageBox.warning(`Seleccionaste ${files.length} archivos, pero solo quedan ${disponibles} espacios disponibles. Se agregaran solo los permitidos.`);
        }

        const agregados = new Set(actuales.map((archivo: any) => this.normalizarNombreArchivo(archivo.nombreArchivo)));
        let archivosAgregados = 0;
        let archivosOmitidos = 0;
        let huboDuplicados = false;

        files.slice(0, Math.max(disponibles, 0)).forEach((file) => {
            if (!file.type?.startsWith("image/") && !file.type?.startsWith("video/")) {
                archivosOmitidos++;
                MessageToast.show(`${file.name} no se agrego porque solo se permiten imagenes o videos.`);
                return;
            }

            const nombreNormalizado = this.normalizarNombreArchivo(file.name);
            if (agregados.has(nombreNormalizado)) {
                archivosOmitidos++;
                huboDuplicados = true;
                MessageBox.warning(`No se pueden guardar archivos duplicados. "${this.obtenerNombreSinExtension(file.name)}" ya fue seleccionado.`);
                return;
            }

            agregados.add(nombreNormalizado);
            archivosAgregados++;
            actuales.push({
                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                nombreArchivo: file.name,
                nombreVisual: this.obtenerNombreSinExtension(file.name),
                mimeType: file.type,
                sizeBytes: file.size,
                sizeLabel: this.formatearTamanioArchivo(file.size),
                tipo: file.type.startsWith("image/") ? "IMAGEN" : "VIDEO",
                file
            });
        });

        oModel.setProperty("/archivosAve", actuales);
        oModel.setProperty("/archivosRestantes", this.maxArchivosAve - actuales.length);
        this.limpiarUploaderArchivosAve();

        if (archivosAgregados > 0) {
            MessageToast.show(`${archivosAgregados} archivo(s) agregado(s). ${this.maxArchivosAve - actuales.length} espacio(s) disponible(s).`);
        } else if ((archivosOmitidos > 0 || disponibles <= 0) && !huboDuplicados) {
            MessageToast.show("No se agregaron archivos nuevos.");
        }
    }

    public onQuitarArchivoAve(oEvent: Event): void {
        const oModel = this.getView()?.getModel("create") as JSONModel;
        const oContext = oEvent.getSource().getBindingContext("create");
        const archivo = oContext?.getObject();
        if (!archivo) return;

        const archivos = (oModel.getProperty("/archivosAve") || []).filter((item: any) => item.id !== archivo.id);
        oModel.setProperty("/archivosAve", archivos);
        oModel.setProperty("/archivosRestantes", this.maxArchivosAve - archivos.length);
    }

    private async guardarArchivosAve(aveId: string, archivos: any[]): Promise<void> {
        for (const archivo of archivos) {
            const esImagen = archivo.tipo === "IMAGEN";
            const endpoint = esImagen ? "FotosAve" : "VideosAve";
            const carga = await this.prepararCargaArchivoAve(aveId, archivo);
            await this.subirArchivoAS3(carga.uploadUrl, archivo.file, archivo.mimeType);

            const payload: any = {
                ave_ID: aveId,
                titulo: carga.nombreArchivo || archivo.nombreArchivo,
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
                throw new Error(error.error?.message || `No se pudo registrar el archivo ${archivo.nombreArchivo}`);
            }
        }
    }

    private async prepararCargaArchivoAve(aveId: string, archivo: any): Promise<any> {
        const response = await fetch(`${this.baseUrl}/prepararCargaArchivoAve`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.authService.getToken()}`
            },
            body: JSON.stringify({
                aveId,
                nombreArchivo: archivo.nombreArchivo,
                mimeType: archivo.mimeType,
                tamanioBytes: archivo.sizeBytes,
                tipo: archivo.tipo
            })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || data.message || `No se pudo preparar ${archivo.nombreArchivo}`);
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

    private limpiarUploaderArchivosAve(): void {
        const uploader = this.byId("archivosAveUploader") as any;
        uploader?.clear?.();
        uploader?.setValue?.("");
    }

    private formatearTamanioArchivo(bytes: number): string {
        if (!bytes) return "";
        const mb = bytes / (1024 * 1024);
        return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(bytes / 1024, 1).toFixed(0)} KB`;
    }

    private obtenerNombreSinExtension(nombreArchivo: string): string {
        return String(nombreArchivo || "").replace(/\.[^/.]+$/, "");
    }

    private normalizarNombreArchivo(nombreArchivo: string): string {
        return String(nombreArchivo || "").trim().toLowerCase();
    }

    public onNavBack(): void {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteList");
    }

    public onSuggestionItemSelectedPlacaPadre(oEvent: Event): void {
        const oModel = this.getView()?.getModel("create") as JSONModel
        let placa = oEvent.getSource().getSelectedKey();
        let descripcion = oEvent.getSource().getValue();
        // Validar placa
        if (!placa && descripcion) {
            oModel.setProperty("/placaPadreState", "Error");
            MessageToast.show("La placa del padre es incorrecto");
            return;
        }
        oModel.setProperty("/placaPadreState", "None");
        // alert("idPadre: " + placa);
        // this.byId("selectedKeyIndicator").setText(oText);

    }

    public onSuggestionItemSelectedPlacaMadre(oEvent: Event): void {
        const oModel = this.getView()?.getModel("create") as JSONModel
        let placa = oEvent.getSource().getSelectedKey();
        let descripcion = oEvent.getSource().getValue();
        // Validar placa
        if (!placa && descripcion) {
            oModel.setProperty("/placaMadreState", "Error");
            MessageToast.show("La placa del madre es incorrecto");
            return;
        }
        oModel.setProperty("/placaMadreState", "None");
        // alert("idPadre: " + placa);
        // this.byId("selectedKeyIndicator").setText(oText);

    }

    // UploadCompleted event handler
    public onUploadCompleted(oEvent: Event) {
        const oModel = this.byId("table-uploadSet").getModel("documents");
        const iResponseStatus = oEvent.getParameter("status");

        // check for upload is sucess
        if (iResponseStatus === 201) {
            oModel.refresh(true);
            setTimeout(function () {
                MessageToast.show("Document Added");
            }, 1000);
        }
        // This code block is only for demonstration purpose to simulate XHR requests, hence restoring the server to not fake the xhr requests.
        //this.oMockServer.restore();
    }

    public onBeforeUploadStarts(oEvent: any): void {
        const oItem = oEvent.getParameter("item");
        const oFileObject = oItem?.getFileObject?.();

        debugger;
        console.log("Antes de agregar:", oFileObject);

        if (!oFileObject) {
            return;
        }

        if (!oFileObject.type.startsWith("image/")) {
            sap.m.MessageToast.show("Solo se permiten imágenes");
            oEvent.preventDefault?.();
            return;
        }

        if (!oFileObject) {
            return;
        }

        const oReader = new FileReader();

        oReader.onload = () => {
            const sBase64 = oReader.result as string;

            console.log("Imagen en base64:", sBase64);

            // 👇 aquí viene lo importante
            this._asignarContenidoAlItem(oItem, sBase64);
        };

        oReader.readAsDataURL(oFileObject);

    }

    private _asignarContenidoAlItem(oItem: any, sBase64: string): void {
        const oThat = this;
        const oFileObject = oItem?.getFileObject?.();
        let authUser = localStorage.getItem("auth_user")
        const usuario = JSON.parse(authUser);
        const oNuevoDocumento = {
            id: Date.now().toString(),
            fileName: oFileObject.name,
            mediaType: oFileObject.type,
            fileSize: oFileObject.size,
            lastModifiedBy: usuario.nombre + " " + usuario.apellido,
            lastmodified: new Date(oFileObject.lastModified).toLocaleString(),
            revision: "1",
            status: "",
            documentType: "Imagen",
            previewable: true,
            url: sBase64,
            imageUrl: sBase64,
            trustedSource: false
        };

        let datos = oThat.byId("table-uploadSet").getModel("documents")?.getData();
        datos.items.unshift(oNuevoDocumento);
        const oModelDocuments = new JSONModel(datos);
        oThat.byId("table-uploadSet").setModel(oModelDocuments, "documents");
        oModelDocuments.refresh();
    }

    public cargarDatosFotos(): { items: any[] } {
        let obj = {
            "items": []
        }

        return obj;;
    }

    public onSelectionChange(oEvent: Event) {
        const oTable = oEvent.getSource();
        const aSelectedItems = oTable?.getSelectedContexts();
        const oDownloadBtn = this.byId("downloadSelectedButton");
        const oEditUrlBtn = this.byId("editUrlButton");
        const oRenameBtn = this.byId("renameButton");
        const oRemoveDocumentBtn = this.byId("removeDocumentButton");

        if (aSelectedItems.length > 0) {
            oDownloadBtn.setEnabled(true);
        } else {
            oDownloadBtn.setEnabled(false);
        }
        if (aSelectedItems.length === 1) {
            oEditUrlBtn.setEnabled(true);
            oRenameBtn.setEnabled(true);
            oRemoveDocumentBtn.setEnabled(true);
        } else {
            oRenameBtn.setEnabled(false);
            oEditUrlBtn.setEnabled(false);
            oRemoveDocumentBtn.setEnabled(false);
        }
    }

    // Download files handler
    public onDownloadFiles(oEvent: Event) {
        const oContexts = this.byId("table-uploadSet").getSelectedContexts();
        if (oContexts && oContexts.length) {
            oContexts.forEach((oContext) => this.oUploadPluginInstance.download(oContext, true));
        }
    }

    public onPluginActivated(oEvent: Event) {
        this.oUploadPluginInstance = oEvent.getParameter("oPlugin");
    }

    public onNavWelcome(): void {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteWelcome");
    }

}
