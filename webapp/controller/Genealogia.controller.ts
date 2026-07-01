import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import { AuthService } from "../services/AuthService";
import { IAve } from "../types/Models";
import Fragment from "sap/ui/core/Fragment";
import Dialog from "sap/m/Dialog";
import Input from "sap/m/Input";
import List from "sap/m/List";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import Popover from "sap/m/Popover";
import ActionSheet from "sap/m/ActionSheet";
import Control from "sap/ui/core/Control";
import Device from "sap/ui/Device";

interface IAveGenealogia {
  ID: string;
  placa?: string;
  nombre?: string;
  sexo?: string;
  estado?: string;
  categoria?: string;
  fechaNacimiento?: string;
  padre_ID?: string;
  madre_ID?: string;
  fotos?: Array<{
    esPrincipal?: boolean;
    thumbnailUrl?: string;
    urlSharepoint?: string;
  }>;
  fotoPrincipalUrl?: string;
}

interface INodoGenealogia {
  id: string;
  aveId?: string;
  placa: string;
  nombre: string;
  iniciales: string;
  avatarIcon: string;
  avatarColor: string;
  fotoUrl: string;
  sexo: string;
  rol: string;
  rama: string;
  parentId?: string;
  estado: string;
  categoria: string;
  fechaNacimiento: string;
  generacion: number;
  faltante: boolean;
}

export default class Genealogia extends Controller {
  private baseUrl = "http://localhost:4004/api/avecombatiente";
  private authService: AuthService;
  private avesPorId = new Map<string, IAveGenealogia>();
  private aveIdInicial = "";
  helpSelected: string;
  private _oPadresDialog: any;
  private _oUserMenuPopover: any;
  private _oUserMenuSheet: any;
  private _oImagenAveDialog: Dialog;

  public onInit(): void {
    this.authService = AuthService.getInstance();

    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter
      ?.getRoute("RouteGenealogia")
      ?.attachPatternMatched(this.onRouteMatched, this);

    this.getView()?.setModel(
      new JSONModel({
        busy: false,
        aveSeleccionadaId: "",
        aveSeleccionada: null,
        aves: [],
        generaciones: [],
        graph: {
          nodes: [],
          lines: [],
        },
        resumen: {
          generaciones: 0,
          ancestrosIdentificados: 0,
          registrosFaltantes: 0,
          hermanosCompletos: 0,
          mediosHermanosPadre: 0,
          mediosHermanosMadre: 0,
        },
        hermanos: [],
        mediosHermanosPadre: [],
        mediosHermanosMadre: [],
        imagenViewer: {
          title: "",
          nombreArchivo: "",
          html: "",
        },
      }),
      "genealogia",
    );
  }

  private onRouteMatched = (oEvent: any): void => {
    if (!this.authService.isAuthenticated()) {
      (this.getOwnerComponent() as UIComponent)
        ?.getRouter()
        ?.navTo("RouteLogin");
      return;
    }

    const sUserData = localStorage.getItem("auth_user");

    if (sUserData) {
      const oUser = JSON.parse(sUserData);
      const oUserModel = new JSONModel(oUser);
      this.getView()?.setModel(oUserModel, "user");
    }

    const oArguments = oEvent.getParameter("arguments") || {};
    this.aveIdInicial = oArguments["?query"]?.aveId || "";

    void this.cargarAves();
  };

  public async onUserMenuPress(oEvent: Event): Promise<void> {
    const oSource = oEvent.getSource() as Control;

    if (Device.system.phone) {
      if (!this._oUserMenuSheet) {
        const oFragment = await Fragment.load({
          id: this.getView()?.getId(),
          name: "com.rprincipees.registroavescombate.view.fragments.UserMenuMobile",
          controller: this,
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
        controller: this,
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

  private onValueHelpAve = (): void => {
    const oThat = this;
    oThat.onAbrirPopupAves(oThat.helpSelected, "Seleccionar Ave");
  };

  public async onAbrirPopupAves(
    helpSelected: string,
    sTitulo: string,
  ): Promise<void> {

    const oThat = this;
    try {
      const response = await fetch(`${this.baseUrl}/AvesActivas`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          "Content-Type": "application/json",
        },
      });

      const aves: IAve[] = await response.json();
      // let padres: any[] = [];

      this.getView()?.setModel(new JSONModel(aves.value), "avesPadres");

      if (!this._oPadresDialog) {
        this._oPadresDialog = (await Fragment.load({
          id: this.getView()?.getId(),
          name: "com.rprincipees.registroavescombate.view.fragments.PadresDialog",
          controller: this,
        })) as Dialog;

        this.getView()?.addDependent(this._oPadresDialog);
      }

      this._oPadresDialog.setTitle(sTitulo);
      this._oPadresDialog.open();

      let idSearchPadres = oThat.getView()?.byId("idSearchPadres");
      idSearchPadres?.setValue("");

    } catch (error) {
      console.error("Error :", error);
    }
  }

  public onSeleccionarPadre(oEvent: Event): void {
    const oThat = this;
    const oSelectedItem = oEvent.getParameter("listItem");

    const oContext = oSelectedItem.getBindingContext("avesPadres");

    if (!oContext) {
      console.error("No se encontró contexto avesPadres");
      return;
    }

    const oAve = oContext.getObject();

    if (oSelectedItem) {
      const sNombre = oSelectedItem.getTitle();
      const sPlaca = oSelectedItem.getDescription();
      let oInput: Input | undefined;

      oInput = this.byId("inputAve") as Input;
      if (oInput) {
        oInput.setValue(sPlaca);
        oInput.setDescription(sNombre);
      }

      const oModel = this.getView()?.getModel("genealogia") as JSONModel;
      this.construirArbol(oAve.ID);
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
          new Filter("placa", FilterOperator.Contains, sValue),
        ],
        and: false, // OR
      });

      oBinding.filter([oFilter]);
    } else {
      oBinding.filter([]); // limpia filtro
    }
  }

  private getHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
      "Content-Type": "application/json",
    };
  }

  private async cargarAves(): Promise<void> {
    const oModel = this.getView()?.getModel("genealogia") as JSONModel;
    oModel.setProperty("/busy", true);

    try {
      const response = await fetch(
        `${this.baseUrl}/Aves?$select=ID,placa,nombre,sexo,estado,categoria,fechaNacimiento,padre_ID,madre_ID&$expand=fotos($filter=esPrincipal eq true;$select=esPrincipal,thumbnailUrl,urlSharepoint)&$orderby=placa asc`,
        { headers: this.getHeaders() },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error?.message || data?.message || "No se pudo cargar aves",
        );
      }

      const aves = await Promise.all((data.value || []).map(async (ave: IAveGenealogia) => {
        const fotoPrincipal = (ave.fotos || []).find((foto: any) => foto.esPrincipal) || ave.fotos?.[0];
        const fotoPrincipalRawUrl =
          fotoPrincipal?.thumbnailUrl ||
          fotoPrincipal?.urlSharepoint ||
          "";

        const fotoPrincipalUrl = await this.obtenerUrlFotoNodo(fotoPrincipalRawUrl);

        return {
          ...ave,
          fotoPrincipalUrl,
        };
      }));
      this.avesPorId = new Map(
        aves.map((ave: IAveGenealogia) => [ave.ID, ave]),
      );

      oModel.setProperty("/aves", aves);
      const aveSeleccionadaId = this.avesPorId.has(this.aveIdInicial)
        ? this.aveIdInicial
        : aves[0]?.ID;

      if (aveSeleccionadaId) {
        this.seleccionarAve(aveSeleccionadaId);
      }
    } catch (error: any) {
      MessageBox.error(error.message || "No se pudo cargar genealogia");
    } finally {
      oModel.setProperty("/busy", false);
    }
  }

  private seleccionarAve(aveId: string): void {
    const ave = this.avesPorId.get(aveId);
    const oModel = this.getView()?.getModel("genealogia") as JSONModel;

    if (!ave) return;

    const oInput = this.byId("inputAve") as Input;
    if (oInput) {
      oInput.setValue(ave.placa || "");
      oInput.setDescription(ave.nombre || "");
    }

    oModel.setProperty("/aveSeleccionadaId", aveId);
    oModel.setProperty("/placa", ave.placa || "");
    oModel.setProperty("/nombre", ave.nombre || "");
    this.construirArbol(aveId);
  }

  public onSeleccionarAve(): void {
    const oModel = this.getView()?.getModel("genealogia") as JSONModel;
    this.construirArbol(oModel.getProperty("/aveSeleccionadaId"));
  }

  public onRefrescar(): void {
    void this.cargarAves();
  }

  private construirArbol(aveId: string): void {
    const oModel = this.getView()?.getModel("genealogia") as JSONModel;
    const ave = this.avesPorId.get(aveId);

    if (!ave) {
      oModel.setProperty("/aveSeleccionada", null);
      oModel.setProperty("/generaciones", []);
      oModel.setProperty("/hermanos", []);
      oModel.setProperty("/mediosHermanosPadre", []);
      oModel.setProperty("/mediosHermanosMadre", []);
      return;
    }

    const hermanos = this.obtenerHermanosCompletos(ave);
    const mediosHermanosPadre = this.obtenerMediosHermanosPorPadre(ave);
    const mediosHermanosMadre = this.obtenerMediosHermanosPorMadre(ave);
    const generaciones = [];
    let referenciasFaltantes = 0;
    let nivelActual = [this.crearNodo(ave, 0, "Ave seleccionada", "Base")];

    generaciones.push({
      numero: 0,
      titulo: "Ave seleccionada",
      subtitulo: "Generacion 0",
      nodos: nivelActual,
    });

    for (let generacion = 1; generacion <= 5; generacion += 1) {
      const siguienteNivel: INodoGenealogia[] = [];

      nivelActual.forEach((nodo) => {
        const aveActual = this.avesPorId.get(nodo.aveId);
        const padre = aveActual?.padre_ID
          ? this.avesPorId.get(aveActual.padre_ID)
          : undefined;
        const madre = aveActual?.madre_ID
          ? this.avesPorId.get(aveActual.madre_ID)
          : undefined;

        if (padre) {
          siguienteNivel.push(
            this.crearNodo(padre, generacion, "Padre", `${nodo.rama} > Padre`, nodo.id),
          );
        } else {
          referenciasFaltantes += 1;
        }

        if (madre) {
          siguienteNivel.push(
            this.crearNodo(madre, generacion, "Madre", `${nodo.rama} > Madre`, nodo.id),
          );
        } else {
          referenciasFaltantes += 1;
        }
      });

      if (!siguienteNivel.length) {
        break;
      }

      generaciones.push({
        numero: generacion,
        titulo: this.getTituloGeneracion(generacion),
        subtitulo: `Generacion ${generacion}`,
        nodos: siguienteNivel,
      });

      nivelActual = siguienteNivel;
    }

    const nodos = generaciones.flatMap((generacion) => generacion.nodos);
    const ancestrosIdentificados = nodos.filter(
      (nodo) => !nodo.faltante && nodo.generacion > 0,
    ).length;

    oModel.setProperty("/aveSeleccionada", {
      ...ave,
      fechaNacimientoFmt: this.formatearFecha(ave.fechaNacimiento),
    });
    oModel.setProperty("/generaciones", generaciones);
    oModel.setProperty("/graph", this.crearModeloGraph(generaciones));
    oModel.setProperty("/hermanos", hermanos);
    oModel.setProperty("/mediosHermanosPadre", mediosHermanosPadre);
    oModel.setProperty("/mediosHermanosMadre", mediosHermanosMadre);
    oModel.setProperty("/resumen", {
      generaciones: generaciones.length - 1,
      ancestrosIdentificados,
      registrosFaltantes: referenciasFaltantes,
      hermanosCompletos: hermanos.length,
      mediosHermanosPadre: mediosHermanosPadre.length,
      mediosHermanosMadre: mediosHermanosMadre.length,
    });
  }

  private obtenerHermanosCompletos(ave: IAveGenealogia): any[] {
    if (!ave.padre_ID || !ave.madre_ID) return [];

    return Array.from(this.avesPorId.values())
      .filter((candidato) =>
        candidato.ID !== ave.ID &&
        candidato.padre_ID === ave.padre_ID &&
        candidato.madre_ID === ave.madre_ID,
      )
      .sort((a, b) => (a.placa || "").localeCompare(b.placa || ""))
      .map((hermano) => ({
        ...this.crearItemHermano(hermano),
        parentesco: "Hermano completo",
      }));
  }

  private obtenerMediosHermanosPorPadre(ave: IAveGenealogia): any[] {
    if (!ave.padre_ID) return [];

    return Array.from(this.avesPorId.values())
      .filter((candidato) =>
        candidato.ID !== ave.ID &&
        candidato.padre_ID === ave.padre_ID &&
        candidato.madre_ID !== ave.madre_ID,
      )
      .sort((a, b) => (a.placa || "").localeCompare(b.placa || ""))
      .map((hermano) => ({
        ...this.crearItemHermano(hermano),
        parentesco: "Medio hermano por padre",
      }));
  }

  private obtenerMediosHermanosPorMadre(ave: IAveGenealogia): any[] {
    if (!ave.madre_ID) return [];

    return Array.from(this.avesPorId.values())
      .filter((candidato) =>
        candidato.ID !== ave.ID &&
        candidato.madre_ID === ave.madre_ID &&
        candidato.padre_ID !== ave.padre_ID,
      )
      .sort((a, b) => (a.placa || "").localeCompare(b.placa || ""))
      .map((hermano) => ({
        ...this.crearItemHermano(hermano),
        parentesco: "Medio hermano por madre",
      }));
  }

  private crearItemHermano(ave: IAveGenealogia): any {
    return {
      ...ave,
      sexoFmt: this.formatearSexo(ave.sexo),
      fechaNacimientoFmt: this.formatearFecha(ave.fechaNacimiento),
    };
  }

  private crearNodo(
    ave: IAveGenealogia,
    generacion: number,
    rol: string,
    rama: string,
    parentId?: string,
  ): INodoGenealogia {
    return {
      id: `${generacion}-${rama}-${ave.ID}`,
      aveId: ave.ID,
      placa: ave.placa || "Sin placa",
      nombre: ave.nombre || "Sin nombre",
      sexo: this.formatearSexo(ave.sexo),
      rol,
      rama,
      parentId,
      estado: ave.estado || "",
      categoria: ave.categoria || "",
      fechaNacimiento: this.formatearFecha(ave.fechaNacimiento),
      iniciales: this.obtenerIniciales(ave),
      avatarIcon: "",
      avatarColor:
        rol === "Madre" ? "Accent6" : rol === "Padre" ? "Accent5" : "Accent1",
      fotoUrl: ave.fotoPrincipalUrl || "",
      generacion,
      faltante: false,
    };
  }

  private crearModeloGraph(generaciones: any[]): any {
    const nodes: any[] = [];
    const lines: any[] = [];

    generaciones.forEach((generacion: any, generacionIndex: number) => {
      (generacion.nodos || []).forEach((nodo: INodoGenealogia, nodoIndex: number) => {
        const key = this.normalizarGraphKey(nodo.id);
        const descripcion = [
          nodo.nombre,
          nodo.fechaNacimiento ? `Nac. ${nodo.fechaNacimiento}` : "",
          nodo.rol,
        ].filter(Boolean).join(" | ");

        nodes.push({
          key,
          aveId: nodo.aveId,
          title: nodo.placa,
          description: descripcion,
          icon: nodo.faltante ? "sap-icon://question-mark" : "sap-icon://customer",
          image: nodo.fotoUrl || "",
          status: nodo.faltante ? "Faltante" : nodo.rol === "Madre" ? "Madre" : nodo.rol === "Padre" ? "Padre" : "Base",
          shape: "Box",
          width: 236,
          nombre: nodo.nombre || "Sin nombre",
          rol: nodo.rol,
          generacion: `G${nodo.generacion}`,
          sexo: nodo.sexo || "-",
          estado: this.formatearEstado(nodo.estado),
        });

        if (nodo.parentId) {
          lines.push({
            from: key,
            to: this.normalizarGraphKey(nodo.parentId),
            status: nodo.faltante ? "Faltante" : "Linea",
          });
        }
      });
    });

    return { nodes, lines };
  }

  private normalizarGraphKey(value: string): string {
    return value.replace(/[^A-Za-z0-9_-]/g, "_");
  }

  private crearNodoFaltante(
    generacion: number,
    rol: string,
    rama: string,
  ): INodoGenealogia {
    return {
      id: `${generacion}-${rama}-faltante`,
      placa: "Sin registro",
      nombre: "Genealogia pendiente",
      iniciales: "",
      avatarIcon: "sap-icon://question-mark",
      avatarColor: "Accent10",
      fotoUrl: "",
      sexo: "",
      rol,
      rama,
      parentId: undefined,
      estado: "",
      categoria: "",
      fechaNacimiento: "",
      generacion,
      faltante: true,
    };
  }

  private getTituloGeneracion(generacion: number): string {
    const titulos: Record<number, string> = {
      1: "Padres",
      2: "Abuelos",
      3: "Bisabuelos",
      4: "Tatarabuelos",
      5: "5ta generacion",
    };

    return titulos[generacion] || `Generacion ${generacion}`;
  }

  private formatearSexo(sexo?: string): string {
    if (sexo === "M") return "Macho";
    if (sexo === "H") return "Hembra";
    return "";
  }

  private formatearEstado(estado?: string): string {
    if (!estado) return "-";

    return estado
      .trim()
      .toLowerCase()
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1))
      .join(" ");
  }

  private formatearFecha(fecha?: string): string {
    if (!fecha) return "";

    const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }

    const date = new Date(fecha);
    if (isNaN(date.getTime())) return "";

    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${date.getFullYear()}`;
  }

  private obtenerIniciales(ave: IAveGenealogia): string {
    const nombre = (ave.nombre || ave.placa || "").trim();
    if (!nombre) return "AV";

    const partes = nombre.split(/\s+/).filter(Boolean);
    if (partes.length === 1) {
      return partes[0].slice(0, 2).toUpperCase();
    }

    return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
  }

  public onAbrirAve(oEvent: any): void {
    const nodo = oEvent
      .getSource()
      ?.getBindingContext("genealogia")
      ?.getObject();

    if (!nodo?.aveId) {
      MessageToast.show("No hay ave registrada en esta posicion.");
      return;
    }

    (this.getOwnerComponent() as UIComponent)
      ?.getRouter()
      ?.navTo("RouteAveDetail", { aveId: nodo.aveId });
  }

  public async onVerImagenAve(oEvent: any): Promise<void> {
    const nodo = oEvent
      .getSource()
      ?.getBindingContext("genealogia")
      ?.getObject();

    if (!nodo?.aveId) {
      MessageToast.show("No hay ave registrada en esta posicion.");
      return;
    }

    const oModel = this.getView()?.getModel("genealogia") as JSONModel;
    oModel.setProperty("/busy", true);

    try {
      const response = await fetch(
        `${this.baseUrl}/FotosAve?$filter=ave_ID eq ${nodo.aveId}&$orderby=esPrincipal desc,createdAt desc`,
        { headers: this.getHeaders() },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error?.message || data?.message || "No se pudo obtener la imagen del ave.",
        );
      }

      const fotos = data.value || [];
      const foto = fotos.find((item: any) => item.esPrincipal) || fotos[0];

      const urlArchivo = foto?.thumbnailUrl || foto?.urlArchivo || foto?.urlSharepoint || foto?.url || "";

      if (!urlArchivo) {
        MessageBox.information("Esta ave no tiene una imagen registrada.");
        return;
      }

      const urlImagen = await this.obtenerUrlVisualizacionArchivo(urlArchivo);
      const titulo = `${nodo.title || "Ave"}${nodo.description ? ` - ${String(nodo.description).split("|")[0].trim()}` : ""}`;

      oModel.setProperty("/imagenViewer/title", titulo);
      oModel.setProperty("/imagenViewer/nombreArchivo", foto.nombreArchivo || "Imagen del ave");
      oModel.setProperty("/imagenViewer/html", this.crearHtmlImagenAve(urlImagen, foto.nombreArchivo || titulo));

      await this.abrirVisorImagenAve();
    } catch (error: any) {
      MessageBox.error(error.message || "No se pudo mostrar la imagen del ave.");
    } finally {
      oModel.setProperty("/busy", false);
    }
  }

  private async abrirVisorImagenAve(): Promise<void> {
    if (!this._oImagenAveDialog) {
      this._oImagenAveDialog = (await Fragment.load({
        id: this.getView()?.getId(),
        name: "com.rprincipees.registroavescombate.view.fragments.GenealogiaImagenAveDialog",
        controller: this,
      })) as Dialog;

      this.getView()?.addDependent(this._oImagenAveDialog);
    }

    this._oImagenAveDialog.open();
  }

  public onCerrarVisorImagenAve(): void {
    this._oImagenAveDialog?.close();
  }

  private async obtenerUrlVisualizacionArchivo(url: string): Promise<string> {
    if (!url || !String(url).includes(".s3.")) return url;

    const response = await fetch(`${this.baseUrl}/obtenerUrlLecturaS3`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ fileUrl: url }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || data?.message || "No se pudo preparar la imagen.");
    }

    return data.downloadUrl || url;
  }

  private async obtenerUrlFotoNodo(url: string): Promise<string> {
    if (!url) return "";

    try {
      return await this.obtenerUrlVisualizacionArchivo(url);
    } catch {
      return "";
    }
  }

  private crearHtmlImagenAve(src: string, nombre: string): string {
    return `<div class="genealogiaImageViewer"><img src="${this.escapeHtml(src)}" alt="${this.escapeHtml(nombre)}" /></div>`;
  }

  private escapeHtml(value: string): string {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  public onSeleccionarHermano(oEvent: any): void {
    const hermano = oEvent
      .getSource()
      ?.getBindingContext("genealogia")
      ?.getObject();

    if (!hermano?.ID) return;

    const oInput = this.byId("inputAve") as Input;
    if (oInput) {
      oInput.setValue(hermano.placa || "");
      oInput.setDescription(hermano.nombre || "");
    }

    const oModel = this.getView()?.getModel("genealogia") as JSONModel;
    oModel.setProperty("/aveSeleccionadaId", hermano.ID);
    this.construirArbol(hermano.ID);
  }

  public onNavBack(): void {
    (this.getOwnerComponent() as UIComponent)
      ?.getRouter()
      ?.navTo("RouteWelcome");
  }

  public onNavWelcome(): void {
    this.onNavBack();
  }
}
