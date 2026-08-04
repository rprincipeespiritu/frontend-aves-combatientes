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
  padrote?: boolean;
  fotos?: Array<{
    esPrincipal?: boolean;
    thumbnailUrl?: string;
    urlSharepoint?: string;
  }>;
  fotoPrincipalRawUrl?: string;
  fotoPrincipalUrl?: string;
}

interface ICriaGenealogia {
  ID: string;
  cintillo?: string;
  nombre?: string;
  sexo?: string;
  estado?: string;
  padre_ID?: string;
  madre_ID?: string;
  aveGenerada_ID?: string;
}

interface IEstadisticasPeleas {
  totalPeleas: number;
  victorias: number;
  derrotas: number;
  empates: number;
  porcentajeVictorias: string;
}

interface IEstadisticasDescendencia {
  totalHijos: number;
  hijosComoPadre: number;
  hijosComoMadre: number;
  hijosMachos: number;
  hijosHembras: number;
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
  totalPeleas: number;
  victorias: number;
  derrotas: number;
  totalHijos: number;
  hijosComoPadre: number;
  hijosComoMadre: number;
  hijosMachos: number;
  hijosHembras: number;
}

export default class Genealogia extends Controller {
  private baseUrl: string = window.APP_CONFIG?.API_BASE_URL || "";
  private authService: AuthService;
  private avesPorId = new Map<string, IAveGenealogia>();
  private crias: ICriaGenealogia[] = [];
  private estadisticasPorAveId = new Map<string, IEstadisticasPeleas>();
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
          descendientesIdentificados: 0,
          registrosArbol: 0,
          registrosFaltantes: 0,
          hermanosCompletos: 0,
          mediosHermanosPadre: 0,
          mediosHermanosMadre: 0,
          totalHijos: 0,
          hijosComoPadre: 0,
          hijosComoMadre: 0,
          totalPeleas: 0,
          victorias: 0,
          derrotas: 0,
          porcentajeVictorias: "0%",
        },
        hermanos: [],
        mediosHermanosPadre: [],
        mediosHermanosMadre: [],
        hijosComoPadre: [],
        hijosComoMadre: [],
        direccionArbol: "ASCENDENCIA",
        maxGeneraciones: "5",
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
        ?.navTo("RouteLanding");
      return;
    }

    this.bindUserModel();

    const oArguments = oEvent.getParameter("arguments") || {};
    this.aveIdInicial = oArguments["?query"]?.aveId || "";

    void this.cargarAves();
  };

  public async onUserMenuPress(oEvent: Event): Promise<void> {
    const oSource = oEvent.getSource() as Control;
    this.bindUserModel();

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
      this.seleccionarAve(oAve.ID);
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
        `${this.baseUrl}/Aves?$select=ID,placa,nombre,sexo,estado,categoria,fechaNacimiento,padre_ID,madre_ID,padrote&$expand=fotos($filter=esPrincipal eq true;$select=esPrincipal,thumbnailUrl,urlSharepoint)&$orderby=placa asc`,
        { headers: this.getHeaders() },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error?.message || data?.message || "No se pudo cargar aves",
        );
      }

      // No firmar S3 aquí: permite pintar genealogía sin esperar N requests.
      const aves = (data.value || []).map((ave: IAveGenealogia) => {
        const fotoPrincipal = (ave.fotos || []).find((foto: any) => foto.esPrincipal) || ave.fotos?.[0];
        const fotoPrincipalRawUrl =
          fotoPrincipal?.thumbnailUrl ||
          fotoPrincipal?.urlSharepoint ||
          "";

        return {
          ...ave,
          fotoPrincipalRawUrl,
          fotoPrincipalUrl:
            fotoPrincipalRawUrl && !String(fotoPrincipalRawUrl).includes(".s3.")
              ? fotoPrincipalRawUrl
              : "",
        };
      });
      this.avesPorId = new Map(
        aves.map((ave: IAveGenealogia) => [ave.ID, ave]),
      );

      await Promise.all([
        this.cargarEstadisticasPeleas(),
        this.cargarCrias(),
      ]);

      oModel.setProperty("/aves", aves);
      const aveSeleccionadaId = this.avesPorId.has(this.aveIdInicial)
        ? this.aveIdInicial
        : aves[0]?.ID;

      if (aveSeleccionadaId) {
        this.seleccionarAve(aveSeleccionadaId);
      }
      void this.firmarFotosGenealogiaEnLotes(aves);
    } catch (error: any) {
      MessageBox.error(error.message || "No se pudo cargar genealogia");
    } finally {
      oModel.setProperty("/busy", false);
    }
  }

  private async firmarFotosGenealogiaEnLotes(aves: IAveGenealogia[]): Promise<void> {
    const lote = 6;
    for (let i = 0; i < aves.length; i += lote) {
      const chunk = aves.slice(i, i + lote);
      await Promise.all(
        chunk.map(async (ave: any) => {
          const raw = ave.fotoPrincipalRawUrl || "";
          if (!raw || !String(raw).includes(".s3.") || ave.fotoPrincipalUrl) {
            return;
          }
          const firmada = await this.obtenerUrlFotoNodo(raw);
          ave.fotoPrincipalUrl = firmada;
          this.avesPorId.set(ave.ID, ave);
        }),
      );
    }
    (this.getView()?.getModel("genealogia") as JSONModel | undefined)?.refresh(true);
  }

  private async cargarEstadisticasPeleas(): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}/Peleas?$select=ave_ID,resultado`,
        { headers: this.getHeaders() },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error?.message || data?.message || "No se pudo cargar peleas",
        );
      }

      const statsMap = new Map<string, IEstadisticasPeleas>();

      (data.value || []).forEach((pelea: { ave_ID?: string; resultado?: string }) => {
        if (!pelea.ave_ID) return;

        const stats = statsMap.get(pelea.ave_ID) || {
          totalPeleas: 0,
          victorias: 0,
          derrotas: 0,
          empates: 0,
          porcentajeVictorias: "0%",
        };

        stats.totalPeleas += 1;
        if (pelea.resultado === "VICTORIA") stats.victorias += 1;
        else if (pelea.resultado === "DERROTA") stats.derrotas += 1;
        else if (pelea.resultado === "EMPATE") stats.empates += 1;

        statsMap.set(pelea.ave_ID, stats);
      });

      statsMap.forEach((stats) => {
        if (stats.totalPeleas > 0) {
          stats.porcentajeVictorias = `${((stats.victorias / stats.totalPeleas) * 100).toFixed(1)}%`;
        }
      });

      this.estadisticasPorAveId = statsMap;
    } catch (error) {
      console.error("Error cargando estadisticas de peleas:", error);
      this.estadisticasPorAveId = new Map();
    }
  }

  private async cargarCrias(): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}/Crias?$select=ID,cintillo,nombre,sexo,estado,padre_ID,madre_ID,aveGenerada_ID&$filter=estado ne 'ELIMINADO'`,
        { headers: this.getHeaders() },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error?.message || data?.message || "No se pudo cargar crias",
        );
      }

      this.crias = data.value || [];
    } catch (error) {
      console.error("Error cargando crias:", error);
      this.crias = [];
    }
  }

  private obtenerTodosLosHijos(aveId: string): Array<{ sexo?: string }> {
    const map = new Map<string, { sexo?: string }>();

    [...this.obtenerHijosComoPadre(aveId), ...this.obtenerHijosComoMadre(aveId)]
      .forEach((hijo) => map.set(`ave-${hijo.ID}`, { sexo: hijo.sexo }));

    this.crias.forEach((cria) => {
      if (cria.padre_ID !== aveId && cria.madre_ID !== aveId) return;
      if (cria.aveGenerada_ID && this.avesPorId.has(cria.aveGenerada_ID)) return;

      map.set(`cria-${cria.ID}`, { sexo: cria.sexo });
    });

    return Array.from(map.values());
  }

  private obtenerEstadisticasPeleas(aveId?: string): IEstadisticasPeleas {
    if (!aveId) {
      return {
        totalPeleas: 0,
        victorias: 0,
        derrotas: 0,
        empates: 0,
        porcentajeVictorias: "0%",
      };
    }

    return (
      this.estadisticasPorAveId.get(aveId) || {
        totalPeleas: 0,
        victorias: 0,
        derrotas: 0,
        empates: 0,
        porcentajeVictorias: "0%",
      }
    );
  }

  private obtenerHijosComoPadre(aveId: string): IAveGenealogia[] {
    return Array.from(this.avesPorId.values())
      .filter((candidato) => candidato.padre_ID === aveId)
      .sort((a, b) => (a.placa || "").localeCompare(b.placa || ""));
  }

  private obtenerHijosComoMadre(aveId: string): IAveGenealogia[] {
    return Array.from(this.avesPorId.values())
      .filter((candidato) => candidato.madre_ID === aveId)
      .sort((a, b) => (a.placa || "").localeCompare(b.placa || ""));
  }

  private obtenerEstadisticasDescendencia(aveId?: string): IEstadisticasDescendencia {
    if (!aveId) {
      return {
        totalHijos: 0,
        hijosComoPadre: 0,
        hijosComoMadre: 0,
        hijosMachos: 0,
        hijosHembras: 0,
      };
    }

    const hijosPadre = this.obtenerHijosComoPadre(aveId);
    const hijosMadre = this.obtenerHijosComoMadre(aveId);
    const hijos = this.obtenerTodosLosHijos(aveId);

    return {
      totalHijos: hijos.length,
      hijosComoPadre: hijosPadre.length,
      hijosComoMadre: hijosMadre.length,
      hijosMachos: hijos.filter((hijo) => hijo.sexo === "M").length,
      hijosHembras: hijos.filter((hijo) => hijo.sexo === "H").length,
    };
  }

  private crearItemAveConEstadisticas(ave: IAveGenealogia, parentesco?: string): any {
    const peleas = this.obtenerEstadisticasPeleas(ave.ID);
    const descendencia = this.obtenerEstadisticasDescendencia(ave.ID);

    return {
      ...ave,
      sexoFmt: this.formatearSexo(ave.sexo),
      fechaNacimientoFmt: this.formatearFecha(ave.fechaNacimiento),
      padroteFmt: ave.padrote ? "Padrote" : "",
      parentesco,
      totalPeleas: peleas.totalPeleas,
      victorias: peleas.victorias,
      derrotas: peleas.derrotas,
      porcentajeVictorias: peleas.porcentajeVictorias,
      peleasFmt: `${peleas.victorias}V / ${peleas.derrotas}D (${peleas.totalPeleas})`,
      totalHijos: descendencia.totalHijos,
      hijosComoPadre: descendencia.hijosComoPadre,
      hijosComoMadre: descendencia.hijosComoMadre,
      hijosFmt: this.formatearHijos(descendencia),
    };
  }

  private formatearHijos(descendencia: IEstadisticasDescendencia): string {
    if (descendencia.totalHijos === 0) return "0 hijos e hijas";

    const partes: string[] = [];
    if (descendencia.hijosMachos > 0) {
      partes.push(`${descendencia.hijosMachos} hijo${descendencia.hijosMachos !== 1 ? "s" : ""}`);
    }
    if (descendencia.hijosHembras > 0) {
      partes.push(`${descendencia.hijosHembras} hija${descendencia.hijosHembras !== 1 ? "s" : ""}`);
    }

    if (!partes.length) {
      return `${descendencia.totalHijos} descendiente${descendencia.totalHijos !== 1 ? "s" : ""}`;
    }

    return partes.join(", ");
  }

  private seleccionarAve(aveId: string): void {
    const ave = this.avesPorId.get(aveId);

    if (!ave) return;

    this.sincronizarAveSeleccionada(aveId, ave);
    this.construirArbol(aveId);
  }

  public onSeleccionarAve(): void {
    const oModel = this.getView()?.getModel("genealogia") as JSONModel;
    this.construirArbol(oModel.getProperty("/aveSeleccionadaId"));
  }

  public onRefrescar(): void {
    void this.cargarAves();
  }

  public onCambiarDireccionArbol(): void {
    const aveId = this.obtenerAveSeleccionadaId();
    if (aveId) {
      this.construirArbol(aveId);
    }
  }

  public onCambiarMaxGeneraciones(oEvent: any): void {
    const oModel = this.getView()?.getModel("genealogia") as JSONModel;
    const selectedKey = oEvent.getSource()?.getSelectedKey?.()
      || oEvent.getParameter("selectedItem")?.getKey();
    oModel.setProperty(
      "/maxGeneraciones",
      String(this.normalizarMaxGeneraciones(Number(selectedKey))),
    );

    const aveId = this.obtenerAveSeleccionadaId();
    if (aveId) {
      this.construirArbol(aveId);
    }
  }

  public onVerEstadisticasPeleas(): void {
    const aveId = this.obtenerAveSeleccionadaId();
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();

    if (aveId) {
      oRouter?.navTo("RouteEstadisticasPeleas", {}, { aveId });
      return;
    }

    oRouter?.navTo("RouteEstadisticasPeleas");
  }

  private normalizarMaxGeneraciones(value: number): number {
    if (!Number.isFinite(value)) {
      return 5;
    }

    return Math.min(10, Math.max(1, Math.round(value)));
  }

  private obtenerMaxGeneraciones(): number {
    const oModel = this.getView()?.getModel("genealogia") as JSONModel;
    return this.normalizarMaxGeneraciones(Number(oModel.getProperty("/maxGeneraciones") || 5));
  }

  private obtenerAveSeleccionadaId(): string {
    const oModel = this.getView()?.getModel("genealogia") as JSONModel;
    const aveIdModel = oModel.getProperty("/aveSeleccionadaId") as string;

    if (aveIdModel && this.avesPorId.has(aveIdModel)) {
      return aveIdModel;
    }

    const placaInput = (this.byId("inputAve") as Input)?.getValue()?.trim();
    if (placaInput) {
      const avePorPlaca = Array.from(this.avesPorId.values()).find(
        (ave) => ave.placa === placaInput,
      );
      if (avePorPlaca) {
        return avePorPlaca.ID;
      }
    }

    return "";
  }

  private sincronizarAveSeleccionada(aveId: string, ave: IAveGenealogia): void {
    const oModel = this.getView()?.getModel("genealogia") as JSONModel;

    oModel.setProperty("/aveSeleccionadaId", aveId);
    oModel.setProperty("/placa", ave.placa || "");
    oModel.setProperty("/nombre", ave.nombre || "");

    const oInput = this.byId("inputAve") as Input;
    if (oInput) {
      oInput.setValue(ave.placa || "");
      oInput.setDescription(ave.nombre || "");
    }
  }

  private obtenerHijosDirectosAves(aveId: string): IAveGenealogia[] {
    const map = new Map<string, IAveGenealogia>();

    [...this.obtenerHijosComoPadre(aveId), ...this.obtenerHijosComoMadre(aveId)]
      .forEach((hijo) => map.set(hijo.ID, hijo));

    return Array.from(map.values()).sort((a, b) =>
      (a.placa || "").localeCompare(b.placa || ""),
    );
  }

  private construirGeneracionesAscendentes(ave: IAveGenealogia): {
    generaciones: any[];
    referenciasFaltantes: number;
    registrosArbol: number;
  } {
    const generaciones = [];
    let referenciasFaltantes = 0;
    const maxGeneraciones = this.obtenerMaxGeneraciones();
    let nivelActual = [this.crearNodo(ave, 0, "Ave seleccionada", "Base")];

    generaciones.push({
      numero: 0,
      titulo: "Ave seleccionada",
      subtitulo: "Generacion 0",
      nodos: nivelActual,
    });

    for (let generacion = 1; generacion <= maxGeneraciones; generacion += 1) {
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
        titulo: this.getTituloGeneracionAscendente(generacion),
        subtitulo: `Generacion ${generacion}`,
        nodos: siguienteNivel,
      });

      nivelActual = siguienteNivel;
    }

    const registrosArbol = generaciones
      .flatMap((generacion) => generacion.nodos)
      .filter((nodo) => !nodo.faltante && nodo.generacion > 0).length;

    return { generaciones, referenciasFaltantes, registrosArbol };
  }

  private construirGeneracionesDescendentes(ave: IAveGenealogia): {
    generaciones: any[];
    referenciasFaltantes: number;
    registrosArbol: number;
  } {
    const generaciones = [];
    const referenciasFaltantes = 0;
    const maxGeneraciones = this.obtenerMaxGeneraciones();
    let nivelActual = [this.crearNodo(ave, 0, "Ave seleccionada", "Base")];

    generaciones.push({
      numero: 0,
      titulo: "Ave seleccionada",
      subtitulo: "Generacion 0",
      nodos: nivelActual,
    });

    for (let generacion = 1; generacion <= maxGeneraciones; generacion += 1) {
      const siguienteNivel: INodoGenealogia[] = [];

      nivelActual.forEach((nodo) => {
        if (!nodo.aveId) return;

        this.obtenerHijosDirectosAves(nodo.aveId).forEach((hijo) => {
          const rol = hijo.sexo === "H" ? "Hija" : "Hijo";
          siguienteNivel.push(
            this.crearNodo(
              hijo,
              generacion,
              rol,
              `${nodo.rama} > ${rol}`,
              nodo.id,
            ),
          );
        });
      });

      if (!siguienteNivel.length) {
        break;
      }

      generaciones.push({
        numero: generacion,
        titulo: this.getTituloGeneracionDescendente(generacion),
        subtitulo: `Generacion ${generacion}`,
        nodos: siguienteNivel,
      });

      nivelActual = siguienteNivel;
    }

    const registrosArbol = generaciones
      .flatMap((generacion) => generacion.nodos)
      .filter((nodo) => !nodo.faltante && nodo.generacion > 0).length;

    return { generaciones, referenciasFaltantes, registrosArbol };
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
      oModel.setProperty("/hijosComoPadre", []);
      oModel.setProperty("/hijosComoMadre", []);
      return;
    }

    this.sincronizarAveSeleccionada(aveId, ave);

    const hermanos = this.obtenerHermanosCompletos(ave);
    const mediosHermanosPadre = this.obtenerMediosHermanosPorPadre(ave);
    const mediosHermanosMadre = this.obtenerMediosHermanosPorMadre(ave);
    const hijosComoPadre = this.obtenerHijosComoPadre(aveId).map((hijo) =>
      this.crearItemAveConEstadisticas(hijo, "Hijo/a como padre"),
    );
    const hijosComoMadre = this.obtenerHijosComoMadre(aveId).map((hijo) =>
      this.crearItemAveConEstadisticas(hijo, "Hijo/a como madre"),
    );
    const descendenciaAve = this.obtenerEstadisticasDescendencia(aveId);
    const peleasAve = this.obtenerEstadisticasPeleas(aveId);
    const direccionArbol = oModel.getProperty("/direccionArbol") || "ASCENDENCIA";
    const resultadoArbol = direccionArbol === "DESCENDENCIA"
      ? this.construirGeneracionesDescendentes(ave)
      : this.construirGeneracionesAscendentes(ave);
    const { generaciones, referenciasFaltantes, registrosArbol } = resultadoArbol;

    oModel.setProperty("/aveSeleccionada", {
      ...this.crearItemAveConEstadisticas(ave),
      fechaNacimientoFmt: this.formatearFecha(ave.fechaNacimiento),
    });
    oModel.setProperty("/generaciones", generaciones);
    oModel.setProperty("/graph", this.crearModeloGraph(generaciones, direccionArbol));
    oModel.setProperty("/hermanos", hermanos);
    oModel.setProperty("/mediosHermanosPadre", mediosHermanosPadre);
    oModel.setProperty("/mediosHermanosMadre", mediosHermanosMadre);
    oModel.setProperty("/hijosComoPadre", hijosComoPadre);
    oModel.setProperty("/hijosComoMadre", hijosComoMadre);
    oModel.setProperty("/resumen", {
      generaciones: generaciones.length - 1,
      ancestrosIdentificados: direccionArbol === "ASCENDENCIA" ? registrosArbol : 0,
      descendientesIdentificados: direccionArbol === "DESCENDENCIA" ? registrosArbol : 0,
      registrosArbol,
      registrosFaltantes: referenciasFaltantes,
      hermanosCompletos: hermanos.length,
      mediosHermanosPadre: mediosHermanosPadre.length,
      mediosHermanosMadre: mediosHermanosMadre.length,
      totalHijos: descendenciaAve.totalHijos,
      hijosComoPadre: descendenciaAve.hijosComoPadre,
      hijosComoMadre: descendenciaAve.hijosComoMadre,
      totalPeleas: peleasAve.totalPeleas,
      victorias: peleasAve.victorias,
      derrotas: peleasAve.derrotas,
      porcentajeVictorias: peleasAve.porcentajeVictorias,
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
    return this.crearItemAveConEstadisticas(ave);
  }

  private crearNodo(
    ave: IAveGenealogia,
    generacion: number,
    rol: string,
    rama: string,
    parentId?: string,
  ): INodoGenealogia {
    const peleas = this.obtenerEstadisticasPeleas(ave.ID);
    const descendencia = this.obtenerEstadisticasDescendencia(ave.ID);

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
      totalPeleas: peleas.totalPeleas,
      victorias: peleas.victorias,
      derrotas: peleas.derrotas,
      totalHijos: descendencia.totalHijos,
      hijosComoPadre: descendencia.hijosComoPadre,
      hijosComoMadre: descendencia.hijosComoMadre,
      hijosMachos: descendencia.hijosMachos,
      hijosHembras: descendencia.hijosHembras,
    };
  }

  private crearModeloGraph(generaciones: any[], direccionArbol = "ASCENDENCIA"): any {
    const nodes: any[] = [];
    const lines: any[] = [];
    const esDescendencia = direccionArbol === "DESCENDENCIA";

    generaciones.forEach((generacion: any, generacionIndex: number) => {
      (generacion.nodos || []).forEach((nodo: INodoGenealogia, nodoIndex: number) => {
        const key = this.normalizarGraphKey(nodo.id);
        const hijosFmt = this.formatearHijos({
          totalHijos: nodo.totalHijos,
          hijosComoPadre: nodo.hijosComoPadre,
          hijosComoMadre: nodo.hijosComoMadre,
          hijosMachos: nodo.hijosMachos,
          hijosHembras: nodo.hijosHembras,
        });
        const descripcion = [
          nodo.nombre,
          nodo.fechaNacimiento ? `Nac. ${nodo.fechaNacimiento}` : "",
          nodo.rol,
          nodo.totalPeleas > 0 ? `${nodo.victorias}V/${nodo.derrotas}D` : "",
          nodo.totalHijos > 0 ? hijosFmt : "",
        ].filter(Boolean).join(" | ");

        const status = nodo.faltante
          ? "Faltante"
          : nodo.rol === "Madre"
            ? "Madre"
            : nodo.rol === "Padre"
              ? "Padre"
              : nodo.rol === "Hijo" || nodo.rol === "Hija"
                ? "Descendiente"
                : "Base";

        nodes.push({
          key,
          aveId: nodo.aveId,
          title: nodo.placa,
          description: descripcion,
          icon: nodo.faltante ? "sap-icon://question-mark" : "sap-icon://customer",
          image: nodo.fotoUrl || "",
          status,
          shape: "Box",
          width: 260,
          nombre: nodo.nombre || "Sin nombre",
          rol: nodo.rol,
          generacion: `G${nodo.generacion}`,
          sexo: nodo.sexo || "-",
          estado: this.formatearEstado(nodo.estado),
          peleasFmt: nodo.totalPeleas > 0 ? `${nodo.victorias}V / ${nodo.derrotas}D (${nodo.totalPeleas})` : "Sin peleas",
          hijosFmt: nodo.totalHijos > 0 ? hijosFmt : "0 hijos e hijas",
        });

        if (nodo.parentId) {
          lines.push({
            from: esDescendencia
              ? this.normalizarGraphKey(nodo.parentId)
              : key,
            to: esDescendencia
              ? key
              : this.normalizarGraphKey(nodo.parentId),
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
      totalPeleas: 0,
      victorias: 0,
      derrotas: 0,
      totalHijos: 0,
      hijosComoPadre: 0,
      hijosComoMadre: 0,
      hijosMachos: 0,
      hijosHembras: 0,
    };
  }

  private getTituloGeneracionAscendente(generacion: number): string {
    const titulos: Record<number, string> = {
      1: "Padres",
      2: "Abuelos",
      3: "Bisabuelos",
      4: "Tatarabuelos",
      5: "5ta generacion",
    };

    return titulos[generacion] || `Generacion ${generacion}`;
  }

  private getTituloGeneracionDescendente(generacion: number): string {
    const titulos: Record<number, string> = {
      1: "Hijos",
      2: "Nietos",
      3: "Bisnietos",
      4: "Tataranietos",
      5: "5ta generacion descendiente",
    };

    return titulos[generacion] || `Generacion ${generacion}`;
  }

  private getTituloGeneracion(generacion: number): string {
    return this.getTituloGeneracionAscendente(generacion);
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

    if (!hermano?.ID && !hermano?.aveId) return;

    const aveId = hermano.ID || hermano.aveId;

    const oInput = this.byId("inputAve") as Input;
    if (oInput) {
      oInput.setValue(hermano.placa || "");
      oInput.setDescription(hermano.nombre || "");
    }

    this.seleccionarAve(aveId);
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
