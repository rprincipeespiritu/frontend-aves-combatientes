import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import Router from "sap/ui/core/routing/Router";
import Control from "sap/ui/core/Control";
import Device from "sap/ui/Device";
import Fragment from "sap/ui/core/Fragment";
import ActionSheet from "sap/m/ActionSheet";
import Popover from "sap/m/Popover";
import Event from "sap/ui/base/Event";
import Dialog from "sap/m/Dialog";
import List from "sap/m/List";
import StandardListItem from "sap/m/StandardListItem";
import SearchField from "sap/m/SearchField";
import Button from "sap/m/Button";
import Bar from "sap/m/Bar";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import Core from "sap/ui/core/Core";
import { AuthService } from "../services/AuthService";
import ConfirmationService from "../services/ConfirmationService";

export default class CombateForm extends Controller {
  private baseUrl = "http://localhost:4004/api/avecombatiente";
  private authService: AuthService;
  private combateId: string | null = null;
  private selectedVideoFile?: File;
  private _oUserMenuSheet: any;
  private _oUserMenuPopover: any;
  private _oCombatienteDialog?: Dialog;
  private _oVideoCombateViewerDialog?: Dialog;
  private selectedCombatienteField: "A" | "B" = "A";

  public onInit(): void {
    this.authService = AuthService.getInstance();
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.getRoute("RouteCombateCreate")?.attachPatternMatched(this.onCreateMatched, this);
    oRouter?.getRoute("RouteCombateEdit")?.attachPatternMatched(this.onEditMatched, this);
  }

  private onCreateMatched = async (): Promise<void> => {
    if (!this.prepararSesion()) return;

    this.combateId = null;
    this.selectedVideoFile = undefined;
    this.getView()?.setModel(new JSONModel({
      busy: false,
      editMode: false,
      avesMachos: [],
      form: this.getEmptyForm(),
      videoViewer: this.getEmptyVideoViewer(),
    }), "combate");

    this.limpiarFileUploader();
    void this.cargarSuscripcionResumen();
    await this.cargarAves();
  };

  private onEditMatched = async (oEvent: any): Promise<void> => {
    if (!this.prepararSesion()) return;

    this.combateId = oEvent.getParameter("arguments").id;
    this.selectedVideoFile = undefined;
    this.getView()?.setModel(new JSONModel({
      busy: false,
      editMode: true,
      avesMachos: [],
      form: this.getEmptyForm(),
      videoViewer: this.getEmptyVideoViewer(),
    }), "combate");

    void this.cargarSuscripcionResumen();
    await Promise.all([this.cargarAves(), this.cargarCombate()]);
  };

  private getDashboardModel(): JSONModel {
    let model = this.getOwnerComponent()?.getModel("dashboard") as JSONModel;

    if (!model) {
      model = new JSONModel({
        plan: "",
        estadoSuscripcion: "",
        accesoSuscripcion: false,
        multimediaPremium: false,
      });
      this.getOwnerComponent()?.setModel(model, "dashboard");
    }

    return model;
  }

  private async cargarSuscripcionResumen(): Promise<void> {
    const model = this.getDashboardModel();
    model.setProperty("/multimediaPremium", false);

    try {
      const response = await fetch(`${this.baseUrl}/obtenerSuscripcionActual`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) return;

      const tieneAcceso =
        data.tieneSuscripcion !== false &&
        ["ACTIVA", "CANCELADA"].includes(data.estado) &&
        Number(data.diasRestantes || 0) >= 0;

      model.setProperty("/plan", data.plan || "");
      model.setProperty("/estadoSuscripcion", data.estado || "");
      model.setProperty("/accesoSuscripcion", tieneAcceso);
      model.setProperty(
        "/multimediaPremium",
        tieneAcceso && ["PRUEBA", "PREMIUM"].includes(String(data.plan || "").toUpperCase()),
      );
      model.refresh(true);
    } catch (error) {
      // La carga del formulario no depende del resumen de suscripcion.
    }
  }

  private prepararSesion(): boolean {
    if (!this.authService.isAuthenticated()) {
      (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteLogin");
      return false;
    }

    this.bindUserModel();

    return true;
  }

  private getHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
      "Content-Type": "application/json",
    };
  }

  private getEmptyForm(): any {
    const now = new Date();

    return {
      ave_ID: "",
      combatienteATexto: "",
      placaCombA: "",
      nombreCombA: "",
      combatienteB_ID: "",
      combatienteBTexto: "",
      placaCombB: "",
      nombreCombB: "",
      ambosPropios: true,
      tieneDatosObligatoriosAves: true,
      fecha: this.formatearFechaInput(now),
      tipoCombate: "PRUEBA",
      lugar: "",
      evento: "",
      nombreOponente: "",
      propietarioOponente: "",
      procedenciaOponente: "",
      resultado: "",
      metodoVictoria: "",
      premioDinero: "",
      lesiones: "",
      observaciones: "",
      videoUrl: "",
      videoStorageProvider: "",
      videoStorageBucket: "",
      videoStorageKey: "",
      videoNombreArchivo: "",
      videoMimeType: "",
      videoSizeBytes: 0,
      videoSizeLabel: "",
      videoEstadoCarga: "",
      videoRemoved: false,
    };
  }

  private getEmptyVideoViewer(): any {
    return {
      nombreArchivo: "",
      url: "",
      html: "",
    };
  }

  private async cargarAves(): Promise<void> {
    const oModel = this.getView()?.getModel("combate") as JSONModel;
    const response = await fetch(
      `${this.baseUrl}/AvesActivas?$select=ID,placa,nombre,sexo,estado,etapaVida&$orderby=placa asc`,
      { headers: this.getHeaders() },
    );
    const data = await response.json();

    if (!response.ok) {
      MessageBox.error(data?.error?.message || "No se pudo cargar aves activas.");
      return;
    }

    const avesMachos = (data.value || []).filter((ave: any) =>
      ["M", "MACHO"].includes(String(ave.sexo || "").toUpperCase()) &&
      String(ave.etapaVida || "").toUpperCase() !== "POLLITO",
    );
    oModel.setProperty("/avesMachos", avesMachos);
  }

  private async cargarCombate(): Promise<void> {
    if (!this.combateId) return;
    const oModel = this.getView()?.getModel("combate") as JSONModel;
    oModel.setProperty("/busy", true);

    try {
      const response = await fetch(`${this.baseUrl}/Peleas('${this.combateId}')?$expand=ave,combatienteB`, {
        headers: this.getHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message || "No se pudo cargar el combate.");
      }

      oModel.setProperty("/form", {
        ...this.getEmptyForm(),
        ...data,
        ambosPropios: data.ambosPropios !== false,
        tieneDatosObligatoriosAves: !!(data.ave_ID || data.ave?.ID),
        ave_ID: data.ave_ID || data.ave?.ID || "",
        combatienteB_ID: data.combatienteB_ID || data.combatienteB?.ID || "",
        combatienteATexto: data.combatienteATexto || this.formatearAveSeleccionada(data.ave),
        placaCombA: data.ave?.placa || "",
        nombreCombA: data.ave?.nombre || "",
        combatienteBTexto: data.combatienteBTexto || this.formatearAveSeleccionada(data.combatienteB),
        placaCombB: data.combatienteB?.placa || "",
        nombreCombB: data.combatienteB?.nombre || "",
        nombreOponente: data.ambosPropios !== false ? "" : data.nombreOponente || "",
        propietarioOponente: data.ambosPropios !== false ? "" : data.propietarioOponente || "",
        procedenciaOponente: data.ambosPropios !== false ? "" : data.procedenciaOponente || "",
        fecha: data.fecha ? this.formatearFechaInput(data.fecha) : this.getEmptyForm().fecha,
        premioDinero: data.premioDinero ?? "",
        resultado: data.resultado || "",
        videoSizeLabel: data.videoSizeBytes ? this.formatearTamanioArchivo(data.videoSizeBytes) : "",
      });
    } catch (error: any) {
      MessageBox.error(error.message || "No se pudo cargar el combate.");
    } finally {
      oModel.setProperty("/busy", false);
    }
  }

  public async onGuardar(): Promise<void> {
    this.detenerVideoCombateViewer();

    const oModel = this.getView()?.getModel("combate") as JSONModel;
    const form = oModel.getProperty("/form");
    const requiereDatosObligatoriosAves = form.tieneDatosObligatoriosAves !== false;
    const combatienteATexto = this.obtenerTextoCombatiente(form.placaCombA, form.combatienteATexto);
    const combatienteBTexto = this.obtenerTextoCombatiente(form.placaCombB, form.combatienteBTexto);

    if (!form.fecha || !form.tipoCombate) {
      MessageBox.warning("Indica fecha y tipo de combate.");
      return;
    }

    if (requiereDatosObligatoriosAves && !form.ave_ID) {
      MessageBox.warning("Selecciona el Primer Combatiente.");
      return;
    }

    if (!requiereDatosObligatoriosAves && !form.ave_ID && !combatienteATexto) {
      MessageBox.warning("Ingresa la placa o nombre del Primer Combatiente.");
      return;
    }

    if (requiereDatosObligatoriosAves && form.ambosPropios && !form.combatienteB_ID) {
      MessageBox.warning("Selecciona el Segundo Combatiente cuando ambas aves son tuyas.");
      return;
    }

    if (!requiereDatosObligatoriosAves && form.ambosPropios && !form.combatienteB_ID && !combatienteBTexto) {
      MessageBox.warning("Ingresa la placa o nombre del Segundo Combatiente.");
      return;
    }

    if (form.ambosPropios && this.esMismoCombatiente(form.ave_ID, form.combatienteB_ID)) {
      MessageBox.warning("El primer y segundo combatiente no pueden ser el mismo individuo.");
      return;
    }

    if (requiereDatosObligatoriosAves && !form.ambosPropios && (!form.nombreOponente || !form.propietarioOponente)) {
      MessageBox.warning("Ingresa el nombre del gallo rival y su propietario.");
      return;
    }

    if (!requiereDatosObligatoriosAves && !form.ambosPropios && !form.nombreOponente) {
      MessageBox.warning("Ingresa el nombre o placa del gallo rival.");
      return;
    }

    const payload: any = {
      ave_ID: form.ave_ID || null,
      combatienteATexto: form.ave_ID ? null : combatienteATexto || null,
      combatienteB_ID: form.ambosPropios && form.combatienteB_ID ? form.combatienteB_ID : null,
      combatienteBTexto: form.ambosPropios && !form.combatienteB_ID ? combatienteBTexto || null : null,
      ambosPropios: !!form.ambosPropios,
      fecha: this.formatearFechaPayload(form.fecha),
      tipoCombate: form.tipoCombate,
      lugar: form.lugar || null,
      evento: form.evento || null,
      nombreOponente: form.ambosPropios ? null : form.nombreOponente || null,
      propietarioOponente: form.ambosPropios ? null : form.propietarioOponente || null,
      procedenciaOponente: form.ambosPropios ? null : form.procedenciaOponente || null,
      metodoVictoria: form.metodoVictoria || null,
      lesiones: form.lesiones || null,
      observaciones: form.observaciones || null,
    };

    if (form.resultado) payload.resultado = form.resultado;
    if (form.premioDinero !== "" && form.premioDinero !== null) {
      payload.premioDinero = Number(form.premioDinero);
    }
    if (form.videoRemoved) {
      payload.videoUrl = null;
      payload.videoStorageProvider = null;
      payload.videoStorageBucket = null;
      payload.videoStorageKey = null;
      payload.videoNombreArchivo = null;
      payload.videoMimeType = null;
      payload.videoSizeBytes = null;
      payload.videoEstadoCarga = null;
    }

    const detalleConfirmacion = [
      `Fecha: ${this.formatearFechaDisplay(form.fecha)}`,
      `Primer Combatiente: ${form.placaCombA || combatienteATexto || form.ave_ID}`,
      `Segundo Combatiente: ${form.ambosPropios ? form.placaCombB || combatienteBTexto || form.combatienteB_ID : form.nombreOponente}`,
    ].filter(Boolean).join("\n");
    const confirmado = this.combateId
      ? await ConfirmationService.confirmUpdate("el combate", detalleConfirmacion)
      : await ConfirmationService.confirmCreate("el combate", detalleConfirmacion);
    if (!confirmado) return;

    oModel.setProperty("/busy", true);
    try {
      const url = this.combateId ? `${this.baseUrl}/Peleas('${this.combateId}')` : `${this.baseUrl}/registrarCombate`;
      const response = await fetch(url, {
        method: this.combateId ? "PATCH" : "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });
      const data = response.status === 204 ? {} : await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message || "No se pudo guardar el combate.");
      }

      const peleaId = this.combateId || data?.ID;
      if (this.selectedVideoFile && peleaId) {
        await this.prepararVideoCombate(peleaId, this.selectedVideoFile);
      }

      MessageToast.show(this.combateId ? "Combate actualizado" : "Combate registrado");
      this.onNavBack();
    } catch (error: any) {
      MessageBox.error(error.message || "No se pudo guardar el combate.");
    } finally {
      oModel.setProperty("/busy", false);
    }
  }

  private async prepararVideoCombate(peleaId: string, file: File): Promise<void> {
    const response = await fetch(`${this.baseUrl}/prepararCargaVideoCombate`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        peleaId,
        nombreArchivo: file.name,
        mimeType: file.type,
        tamanioBytes: file.size,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || data?.message || "El combate se guardo, pero no se pudo preparar el video.");
    }

    if (!data.uploadUrl) {
      throw new Error("El backend no devolvio URL de carga. Configura AWS_S3_COMBATES_BUCKET o AWS_S3_BUCKET.");
    }

    const uploadResponse = await fetch(data.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error("El video se preparo, pero no se pudo subir a AWS S3.");
    }

    await fetch(`${this.baseUrl}/Peleas('${peleaId}')`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify({ videoEstadoCarga: "SUBIDO" }),
    });
  }

  public onValueHelpCombatienteA(): void {
    this.abrirAyudaCombatiente("A");
  }

  public onValueHelpCombatienteB(): void {
    this.abrirAyudaCombatiente("B");
  }

  public onTipoCombateChange(): void {
  }

  public onAmbosPropiosChange(): void {
    const oModel = this.getView()?.getModel("combate") as JSONModel;
    const form = oModel.getProperty("/form");

    oModel.setProperty("/form/resultado", "");
    oModel.setProperty("/form/lesiones", "");
    oModel.setProperty("/form/metodoVictoria", "");
    oModel.setProperty("/form/premioDinero", "");
    oModel.setProperty("/form/nombreOponente", "");
    oModel.setProperty("/form/propietarioOponente", "");
    oModel.setProperty("/form/procedenciaOponente", "");

    if (form.ambosPropios) {
      return;
    }

    oModel.setProperty("/form/combatienteB_ID", "");
    oModel.setProperty("/form/combatienteBTexto", "");
    oModel.setProperty("/form/placaCombB", "");
    oModel.setProperty("/form/nombreCombB", "");
  }

  public onTieneDatosObligatoriosAvesChange(): void {
    const oModel = this.getView()?.getModel("combate") as JSONModel;
    const tieneDatos = oModel.getProperty("/form/tieneDatosObligatoriosAves") !== false;

    if (tieneDatos) {
      return;
    }

    oModel.setProperty("/form/ave_ID", "");
    oModel.setProperty("/form/nombreCombA", "");
    oModel.setProperty("/form/combatienteB_ID", "");
    oModel.setProperty("/form/nombreCombB", "");
  }

  public onCombatienteAManualLiveChange(oEvent: any): void {
    const oModel = this.getView()?.getModel("combate") as JSONModel;
    if (oModel.getProperty("/form/tieneDatosObligatoriosAves") !== false) return;

    const value = String(oEvent.getParameter("value") || "");
    oModel.setProperty("/form/ave_ID", "");
    oModel.setProperty("/form/nombreCombA", "");
    oModel.setProperty("/form/combatienteATexto", value);
  }

  public onCombatienteBManualLiveChange(oEvent: any): void {
    const oModel = this.getView()?.getModel("combate") as JSONModel;
    if (oModel.getProperty("/form/tieneDatosObligatoriosAves") !== false) return;

    const value = String(oEvent.getParameter("value") || "");
    oModel.setProperty("/form/combatienteB_ID", "");
    oModel.setProperty("/form/nombreCombB", "");
    oModel.setProperty("/form/combatienteBTexto", value);
  }

  private abrirAyudaCombatiente(field: "A" | "B"): void {
    this.selectedCombatienteField = field;

    if (!this._oCombatienteDialog) {
      const search = new SearchField({
        liveChange: (oEvent: any) => this.filtrarCombatientes(oEvent.getParameter("newValue")),
        search: (oEvent: any) => this.filtrarCombatientes(oEvent.getParameter("query")),
      });
      const list = new List("combatientesHelpList", {
        mode: "SingleSelectMaster",
        items: {
          path: "combate>/avesMachos",
          template: new StandardListItem({
            title: "{combate>placa}",
            description: "{combate>nombre}",
            type: "Active",
          }),
        },
        itemPress: (oEvent: any) => this.seleccionarCombatiente(oEvent.getParameter("listItem")),
      });

      this._oCombatienteDialog = new Dialog({
        title: "Seleccionar ave macho",
        contentWidth: "34rem",
        contentHeight: "28rem",
        subHeader: new Bar({
          contentMiddle: [search],
        }),
        content: [list],
        endButton: new Button({
          text: "Cerrar",
          press: () => this._oCombatienteDialog?.close(),
        }),
      });
      this.getView()?.addDependent(this._oCombatienteDialog);
    }

    this.filtrarCombatientes("");
    this._oCombatienteDialog.open();
  }

  private filtrarCombatientes(query?: string): void {
    const list = Core.byId("combatientesHelpList") as List;
    const binding = list?.getBinding("items");

    if (!binding) return;
    const value = String(query || "").trim();
    if (!value) {
      binding.filter([]);
      return;
    }

    binding.filter([
      new Filter({
        filters: [
          new Filter("placa", FilterOperator.Contains, value),
          new Filter("nombre", FilterOperator.Contains, value),
        ],
        and: false,
      }),
    ]);
  }

  private seleccionarCombatiente(item: StandardListItem): void {
    const ave = item.getBindingContext("combate")?.getObject() as any;
    const oModel = this.getView()?.getModel("combate") as JSONModel;
    if (!ave) return;

    const texto = this.formatearAveSeleccionada(ave);
    if (this.selectedCombatienteField === "A") {
      const combatienteBId = oModel.getProperty("/form/combatienteB_ID");
      if (this.esMismoCombatiente(ave.ID, combatienteBId)) {
        MessageBox.warning("El primer y segundo combatiente no pueden ser el mismo individuo.");
        return;
      }

      oModel.setProperty("/form/ave_ID", ave.ID);
      oModel.setProperty("/form/placaCombA", ave.placa);
      oModel.setProperty("/form/nombreCombA", ave.nombre);
      this._oCombatienteDialog?.close();
      return;
    }

    const combatienteAId = oModel.getProperty("/form/ave_ID");
    if (this.esMismoCombatiente(combatienteAId, ave.ID)) {
      MessageBox.warning("El primer y segundo combatiente no pueden ser el mismo individuo.");
      return;
    }

    oModel.setProperty("/form/combatienteB_ID", ave.ID);
    oModel.setProperty("/form/combatienteBTexto", texto);
    oModel.setProperty("/form/placaCombB", ave.placa);
    oModel.setProperty("/form/nombreCombB", ave.nombre);
    this._oCombatienteDialog?.close();
  }

  private formatearAveSeleccionada(ave?: any): string {
    if (!ave) return "";
    return `${ave.placa || "Sin placa"} - ${ave.nombre || "Sin nombre"}`;
  }

  private obtenerTextoCombatiente(...valores: Array<string | undefined | null>): string {
    return valores
      .map((valor) => String(valor || "").trim())
      .find(Boolean) || "";
  }

  private formatearFechaPayload(fecha: string): string {
    const valor = String(fecha || "").trim();
    if (!valor) return "";
    const fechaInput = this.formatearFechaInput(valor);
    return fechaInput ? `${fechaInput}T00:00:00` : "";
  }

  private formatearFechaInput(fecha: string | Date): string {
    if (fecha instanceof Date) {
      if (isNaN(fecha.getTime())) return "";
      const year = fecha.getFullYear();
      const month = String(fecha.getMonth() + 1).padStart(2, "0");
      const day = String(fecha.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    const valor = String(fecha || "").trim();
    if (!valor) return "";
    const match = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;

    const date = new Date(valor);
    if (isNaN(date.getTime())) return "";
    return this.formatearFechaInput(date);
  }

  private formatearFechaDisplay(fecha: string | Date): string {
    const fechaInput = this.formatearFechaInput(fecha);
    if (!fechaInput) return "";
    const [year, month, day] = fechaInput.split("-");
    return `${day}/${month}/${year}`;
  }

  private esMismoCombatiente(combatienteAId?: string, combatienteBId?: string): boolean {
    return !!combatienteAId && !!combatienteBId && String(combatienteAId) === String(combatienteBId);
  }

  public onVideoSeleccionado(oEvent: any): void {
    if (!this.getDashboardModel().getProperty("/multimediaPremium")) {
      MessageBox.warning("Los videos solo estan disponibles para el plan Premium o Prueba.");
      this.onQuitarVideo();
      return;
    }

    const files = oEvent.getParameter("files") as File[];
    const file = files?.[0];
    const oModel = this.getView()?.getModel("combate") as JSONModel;

    if (!file) {
      this.onQuitarVideo();
      return;
    }

    if (!file.type?.startsWith("video/")) {
      MessageBox.warning("Selecciona un archivo de video valido.");
      this.onQuitarVideo();
      return;
    }

    this.selectedVideoFile = file;
    oModel.setProperty("/form/videoNombreArchivo", file.name);
    oModel.setProperty("/form/videoMimeType", file.type);
    oModel.setProperty("/form/videoSizeBytes", file.size);
    oModel.setProperty("/form/videoSizeLabel", this.formatearTamanioArchivo(file.size));
    oModel.setProperty("/form/videoEstadoCarga", "PENDIENTE_SUBIDA");
    oModel.setProperty("/form/videoRemoved", false);
  }

  public onQuitarVideo(): void {
    this.detenerVideoCombateViewer();

    const oModel = this.getView()?.getModel("combate") as JSONModel;
    this.selectedVideoFile = undefined;
    oModel.setProperty("/form/videoUrl", "");
    oModel.setProperty("/form/videoNombreArchivo", "");
    oModel.setProperty("/form/videoMimeType", "");
    oModel.setProperty("/form/videoSizeBytes", 0);
    oModel.setProperty("/form/videoSizeLabel", "");
    oModel.setProperty("/form/videoEstadoCarga", "");
    oModel.setProperty("/form/videoRemoved", true);
    this.limpiarFileUploader();
  }

  private limpiarFileUploader(): void {
    const uploader = this.byId("videoCombateUploader") as any;
    uploader?.clear?.();
    uploader?.setValue?.("");
  }

  public formatearVideo(estado?: string): string {
    if (!estado) return "Sin video";
    const estados: Record<string, string> = {
      PENDIENTE_CONFIGURACION: "Pendiente",
      PENDIENTE_SUBIDA: "Pendiente subida",
      SUBIDO: "Video registrado",
      ERROR: "Error video",
    };
    return estados[estado] || "Video registrado";
  }

  private formatearTamanioArchivo(bytes: number): string {
    if (!bytes) return "";
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  }

  public async onAbrirVideoCombateViewer(oEvent?: Event): Promise<void> {
    oEvent?.preventDefault?.();

    const oModel = this.getView()?.getModel("combate") as JSONModel;
    const form = oModel.getProperty("/form") || {};
    const rawUrl = form.videoUrl || "";

    if (!rawUrl) {
      MessageBox.warning("No hay video registrado para mostrar.");
      return;
    }

    try {
      const url = await this.obtenerUrlVisualizacionVideo(rawUrl);
      const nombreArchivo = form.videoNombreArchivo || "Video de la pelea";

      oModel.setProperty("/videoViewer", {
        nombreArchivo,
        url,
        html: this.crearHtmlVideoCombate(url, nombreArchivo, form.videoMimeType),
      });

      if (!this._oVideoCombateViewerDialog) {
        this._oVideoCombateViewerDialog = await Fragment.load({
          id: this.getView()?.getId(),
          name: "com.rprincipees.registroavescombate.view.fragments.VideoCombateViewerDialog",
          controller: this,
        }) as Dialog;
        this.getView()?.addDependent(this._oVideoCombateViewerDialog);
      }

      this._oVideoCombateViewerDialog.open();
    } catch (error: any) {
      MessageBox.error(error.message || "No se pudo abrir el video.");
    }
  }

  public onCerrarVideoCombateViewer(): void {
    this.detenerVideoCombateViewer();
    this._oVideoCombateViewerDialog?.close();
  }

  private detenerVideoCombateViewer(): void {
    const dialogDom = this._oVideoCombateViewerDialog?.getDomRef?.();
    const mediaElements = dialogDom?.querySelectorAll?.("video, audio") || [];

    mediaElements.forEach((media: HTMLMediaElement) => {
      media.pause();
      media.removeAttribute("src");
      media.querySelectorAll("source").forEach((source) => source.removeAttribute("src"));
      media.load();
    });

    const oModel = this.getView()?.getModel("combate") as JSONModel;
    oModel?.setProperty("/videoViewer", this.getEmptyVideoViewer());
  }

  private async obtenerUrlVisualizacionVideo(url: string): Promise<string> {
    if (!String(url).includes(".s3.")) return url;

    const response = await fetch(`${this.baseUrl}/obtenerUrlLecturaS3`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ fileUrl: url }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || "No se pudo preparar la visualizacion del video.");
    }

    return data.downloadUrl || url;
  }

  private crearHtmlVideoCombate(url: string, nombreArchivo: string, mimeType?: string): string {
    const src = this.escapeHtml(url);
    const nombre = this.escapeHtml(nombreArchivo);
    const type = mimeType ? ` type="${this.escapeHtml(mimeType)}"` : "";

    return `
      <div class="combatVideoPlayer">
        <video controls preload="metadata" playsinline title="${nombre}">
          <source src="${src}"${type}>
          Tu navegador no puede reproducir este video.
        </video>
      </div>
    `;
  }

  private escapeHtml(value: string): string {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  public onNavBack(): void {
    this.detenerVideoCombateViewer();
    (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteCombates");
  }

  public onNavWelcome(): void {
    this.detenerVideoCombateViewer();
    (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteWelcome");
  }

  public async onUserMenuPress(oEvent: Event): Promise<void> {
    const oSource = oEvent.getSource() as Control;
    this.bindUserModel();

    if (Device.system.phone) {
      if (!this._oUserMenuSheet) {
        const fragment = await Fragment.load({
          id: this.getView()?.getId(),
          name: "com.rprincipees.registroavescombate.view.fragments.UserMenuMobile",
          controller: this,
        });
        this._oUserMenuSheet = fragment as ActionSheet;
        this.getView()?.addDependent(this._oUserMenuSheet);
      }

      this._oUserMenuSheet.isOpen() ? this._oUserMenuSheet.close() : this._oUserMenuSheet.openBy(oSource);
      return;
    }

    if (!this._oUserMenuPopover) {
      const fragment = await Fragment.load({
        id: this.getView()?.getId(),
        name: "com.rprincipees.registroavescombate.view.fragments.UserMenu",
        controller: this,
      });
      this._oUserMenuPopover = fragment as Popover;
      this.getView()?.addDependent(this._oUserMenuPopover);
    }

    this._oUserMenuPopover.isOpen() ? this._oUserMenuPopover.close() : this._oUserMenuPopover.openBy(oSource);
  }

  public async onLogout(): Promise<void> {
    await this.authService.logout();
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
    oRouter?.navTo("RouteLogin");
  }
}
