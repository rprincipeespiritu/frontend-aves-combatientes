import UIComponent from "sap/ui/core/UIComponent";
import Controller from "sap/ui/core/mvc/Controller";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import JSONModel from "sap/ui/model/json/JSONModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import Table from "sap/m/Table";
import SearchField from "sap/m/SearchField";
import ComboBox from "sap/m/ComboBox";
import CheckBox from "sap/m/CheckBox";
import Event from "sap/ui/base/Event";
import ColumnListItem from "sap/m/ColumnListItem";
import View from "sap/ui/core/mvc/View";
import Fragment from "sap/ui/core/Fragment";
import Dialog from "sap/m/Dialog";
import Router from "sap/ui/core/routing/Router";
import Spreadsheet from "sap/ui/export/Spreadsheet";
import { AuthService } from "../services/AuthService";
import {
  IAve,
  ITableModel,
  EstadoAve,
  ValidationMessages,
  SexoAve,
  CategoriaAve,
} from "../types/Models";
import Device from "sap/ui/Device";
import ActionSheet from "sap/m/ActionSheet";
import Control from "sap/ui/mdc/Control";
import Popover from "sap/m/Popover";
import Input from "sap/m/Input";
import formatter from "../model/formatter";

/**
 * @namespace com.rprincipees.registroavescombate.controller
 */
export default class List extends Controller {
  private baseUrl: string = window.APP_CONFIG?.API_BASE_URL || "";
  private authService: AuthService;
  private _oUserMenuSheet: any;
  private _oUserMenuPopover: any;
  private _oPadresDialog: Dialog;
  private importTemplateColumns = [
    "placa",
    "nombre",
    "sexo",
    "fechaNacimiento",
    "categoria",
    "estado",
    "cria",
    "padrote",
    "padrePlaca",
    "madrePlaca",
    "apodo",
    "raza",
    "color",
    "tipoAve",
    "ubicacion",
    "procedencia",
    "criador",
    "fechaCompra",
    "valorCompra",
    "valorActual",
    "observaciones"
  ];
  public formatter = formatter;

  public onInit(): void {
    this.authService = AuthService.getInstance();

    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.getRoute("RouteList")?.attachPatternMatched(this.onRouteMatched, this);
  }

  private onRouteMatched = (oEvent: any): void => {

    console.log("Main Controller initialized with TypeScript");
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

    // Crear modelo para el estado de la tabla
    const oTableModel = new JSONModel({
      selectedIndex: -1,
      busy: false,
      count: 0,
    } as ITableModel);

    this.getView()?.setModel(oTableModel, "table");

    this.initializeData();


  }

  public async onAbrirPopupPadres(_oEvent: Event): Promise<void> {
    try {

      const response = await fetch(`${this.baseUrl}/AvesActivas`, {
        method: "GET",
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          "Content-Type": "application/json",
        },
      });

      const aves: IAve[] = await response.json();
      const padres = (aves.value || []).filter((a: any) => a.padrote === true);

      this.getView()?.setModel(new JSONModel(padres), "avesPadres");

      if (!this._oPadresDialog) {
        this._oPadresDialog = await Fragment.load({
          id: this.getView()?.getId(),
          name: "com.rprincipees.registroavescombate.view.fragments.PadresDialog",
          controller: this
        }) as Dialog;

        this.getView()?.addDependent(this._oPadresDialog);
      }

      this._oPadresDialog.open();

    } catch (error) {
      console.error("Error :", error);
    }

  }

  public onSeleccionarPadre(oEvent: Event): void {
    const oSelectedItem = oEvent.getParameter("listItem");

    if (oSelectedItem) {
      const sNombre = oSelectedItem.getTitle();
      const sPlaca = oSelectedItem.getDescription();
      const oInput = this.byId("inputPadres") as Input;
      oInput.setValue(sPlaca);
    }

    this._oPadresDialog?.close();
    this.aplicarFiltros();
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

  private async initializeData(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/AvesActivas?$expand=padre,madre`, {
        method: "GET",
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          "Content-Type": "application/json",
        },
      });

      const mockAves: any = await response.json();
      mockAves.value = (mockAves.value || []).filter((ave: any) => ave.etapaVida !== "POLLITO");
      const oAvesModel = new JSONModel(mockAves)
      this.getView()?.setModel(oAvesModel, "aves");
    } catch (error) { }
  }

  // === OPERACIONES CRUD ===

  // public async onAgregarAve(): Promise<void> {
  //   //this.openAveDialog();
  //   const oView = this.getView() as View;

  //   if (!this._oAddBirdDialog) {
  //     try {
  //       const oDialog = (await Fragment.load({
  //         id: oView.getId(),
  //         name: "com.rprincipees.registroavescombate.view.fragments.AddBirdDialog",
  //         controller: this,
  //       })) as Dialog;

  //       this._oAddBirdDialog = oDialog;
  //       oView.addDependent(this._oAddBirdDialog);
  //       //this._resetForm();
  //       this._oAddBirdDialog.open();
  //     } catch (error) {
  //       MessageBox.error(
  //         "Error al cargar el diálogo: " + (error as Error).message
  //       );
  //     }
  //   } else {
  //     //this._resetForm();
  //     this._oAddBirdDialog.open();
  //   }
  // }

  public onEditarAve(): void {
    const oTable = this.byId("avesTable") as Table;
    const oSelectedItem = oTable.getSelectedItem();

    if (oSelectedItem) {
      const oContext = oSelectedItem.getBindingContext("aves");
      this.openAveDialog(oContext);
    } else {
      MessageToast.show("Por favor selecciona un ave para editar");
    }
  }

  public onEliminarAve(): void {
    const oTable = this.byId("avesTable") as Table;
    const oSelectedItem = oTable.getSelectedItem();

    if (oSelectedItem) {
      const oContext = oSelectedItem.getBindingContext("aves");
      this.eliminarAve(oContext);
    } else {
      MessageToast.show("Por favor selecciona un ave para eliminar");
    }
  }

  public onEliminarAveInline(oEvent: Event): void {
    const oSource = oEvent.getSource();
    const oContext = (oSource as any).getBindingContext("aves");
    this.eliminarAve(oContext);
  }

  private eliminarAve(oContext: any): void {
    const oAve = oContext.getObject() as IAve;
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
        MessageToast.show("Ave eliminada exitosamente");
        /*const oTable = this.byId("avesTable") as any;
        oTable?.removeSelections?.(true);
        const oTableModel = this.getView()?.getModel("table") as JSONModel;
        oTableModel?.setProperty("/selectedIndex", -1);
        oTableModel?.setProperty("/selected", false);
        oTableModel?.setProperty("/selectedItem", null);
         */
        this.initializeData();
      } else {
        MessageToast.show(oResult?.message || "No se pudo eliminar");
      }


    } catch (error) {
      console.error("Error eliminando ave:", error);
      MessageBox.error("Error al eliminar el ave");
    }
  }

  private openAveDialog(oContext?: any): void {
    var oView = this.getView();

    // Crear el diálogo si no existe
    if (!this._oAddBirdDialog) {
      Fragment.load({
        id: oView.getId(),
        name: "com.rprincipees.registroavescombate.view.fragments.AddBirdDialog",
        controller: this,
      }).then(
          function (oDialog) {
            this._oAddBirdDialog = oDialog;
            oView.addDependent(this._oAddBirdDialog);
            //this._resetForm();
            this._oAddBirdDialog.open();
          }.bind(this)
      );
    } else {
      //this._resetForm();
      this._oAddBirdDialog.open();
    }
  }

  // === BÚSQUEDA Y FILTROS ===

  public onBuscar(): void {
    this.aplicarFiltros();
  }

  public onBuscar2(): void {
    this.aplicarFiltros();
  }

  public onFiltrarGenero(): void {
    this.aplicarFiltros();
  }

  public onFiltrarCategoria(): void {
    this.aplicarFiltros();
  }

  public onFiltrarEstado(): void {
    this.aplicarFiltros();
  }

  public onSelectPadrote(): void {
    this.aplicarFiltros();
  }

  private aplicarFiltros(): void {
    const oTable = this.byId("avesTable") as Table;
    const oBinding = oTable.getBinding("items");

    const aFilters: Filter[] = [];

    // BÚSQUEDA
    const sBusqueda = (this.byId("searchField") as SearchField)?.getValue();
    if (sBusqueda) {
      aFilters.push(
          new Filter({
            filters: [
              new Filter("nombre", FilterOperator.Contains, sBusqueda),
              new Filter("placa", FilterOperator.Contains, sBusqueda)
            ],
            and: false
          })
      );
    }

    // BÚSQUEDA
    const placaPadres = (this.byId("inputPadres") as Input)?.getValue();
    if (placaPadres) {
      aFilters.push(
          new Filter({
            filters: [
              new Filter("padre/placa", FilterOperator.Contains, placaPadres),
              new Filter("madre/placa", FilterOperator.Contains, placaPadres)
            ],
            and: false
          })
      );
    }

    // GÉNERO
    const sGenero = (this.byId("generoFilter") as ComboBox)?.getSelectedKey();
    if (sGenero) {
      aFilters.push(new Filter("sexo", FilterOperator.EQ, sGenero));
    }

    // CATEGORÍA
    const sCategoria = (this.byId("categoriaFilter") as ComboBox)?.getSelectedKey();
    if (sCategoria) {
      aFilters.push(new Filter("categoria", FilterOperator.EQ, sCategoria));
    }

    // ESTADO
    const sEstado = (this.byId("estadoFilter") as ComboBox)?.getSelectedKey();
    if (sEstado) {
      aFilters.push(new Filter("estado", FilterOperator.EQ, sEstado));
    }

    // PADROTE
    const bPadrote = (this.byId("padroteFilter") as CheckBox)?.getSelected();
    if (bPadrote) {
      aFilters.push(new Filter("padrote", FilterOperator.EQ, true));
    }

    (oBinding as any)?.filter(aFilters);
  }

  public onLimpiarFiltros(): void {
    (this.byId("searchField") as SearchField).setValue("");
    (this.byId("inputPadres") as Input).setValue("");
    (this.byId("generoFilter") as ComboBox).setSelectedKey("");
    (this.byId("categoriaFilter") as ComboBox).setSelectedKey("");
    (this.byId("estadoFilter") as ComboBox).setSelectedKey("");
    (this.byId("padroteFilter") as CheckBox).setSelected(false);

    this.aplicarFiltros();
  }

  // === NAVEGACIÓN ===

  // public onAvePress(oEvent: Event): void {
  //   const oItem = oEvent.getSource();
  //   const oContext = (oItem as any)?.getBindingContext("aves");
  //   const oAve = oContext?.getObject() as IAve;

  //   if (oAve.id) {
  //     const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
  //     oRouter?.navTo("aveDetail", {
  //       aveId: oAve.id,
  //     });
  //   }
  // }

  // === UTILIDADES ===

  public async onRefrescar(): Promise<void> {
    // Recargar datos
    await this.initializeData();
    MessageToast.show("Datos actualizados");
  }

  public formatearCategoria(categoria: CategoriaAve): string {
    const categorias = {
      [CategoriaAve.Bueno]: "Bueno",
      [CategoriaAve.Excelente]: "Excelente",
      [CategoriaAve.Extraordinario]: "Extraordinario",
    };

    return categorias[categoria] || categoria;
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

  public formatearPeso(peso: number): string {
    if (!peso) {
      return "";
    }
    return `${peso} kg`;
  }

  public onNavBack(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.navTo("RouteWelcome");
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
  // Cambia onAgregarAve para navegar a la vista
  public onAgregarAve(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.navTo("RouteAveCreate");
  }

  // Cambia onAvePress para navegar al detalle
  public onAvePress(oEvent: Event): void {
    const oItem = oEvent.getSource();
    const oContext = (oItem as any)?.getBindingContext("aves");
    const oAve = oContext?.getObject() as any;
    if (oAve?.ID) {
      const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
      oRouter?.navTo("RouteAveDetail", { aveId: oAve.ID });
    }
  }

  public onEditarAveInline(oEvent: Event): void {
    const oSource = oEvent.getSource();
    const oContext = (oSource as any).getBindingContext("aves");
    const oAve = oContext?.getObject() as any;
    if (oAve?.ID) {
      const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
      oRouter?.navTo("RouteAveUpdate", { aveId: oAve.ID });
    }
  }

  public onExportarExcel = (): void => {
    const oTable = this.byId("avesTable") as any;
    const oBinding = oTable.getBinding("items");

    const aData = oBinding.getContexts().map((oContext: any) => {
      const o = oContext.getObject();

      return {
        placa: o.placa,
        nombre: o.nombre,
        fechaNacimiento: this.formatearFecha(o.fechaNacimiento),
        sexo: o.sexo,
        categoria: o.categoria,
        cria: o.cria,
        estado: o.estado,
        padrote: o.padrote,
        padre: o.padre ? o.padre.placa + " " + o.padre?.nombre : "",
        madre: o.madre ? o.madre.placa + " " + o.madre?.nombre : ""
      };
    });

    const aCols = [
      { label: "Placa", property: "placa" },
      { label: "Nombre", property: "nombre" },
      { label: "Fecha Nacimiento", property: "fechaNacimiento" },
      { label: "Sexo", property: "sexo" },
      { label: "Categoria", property: "categoria" },
      { label: "Estado", property: "estado" },
      { label: "Cria", property: "cria" },
      { label: "Padre", property: "padre" },
      { label: "Madre", property: "madre" }
    ];

    const oSettings = {
      workbook: {
        columns: aCols
      },
      dataSource: aData,
      fileName: "Aves adultas.xlsx"
    };

    const oSheet = new Spreadsheet(oSettings);

    oSheet.build().finally(() => {
      oSheet.destroy();
    });
  }

  public onDescargarPlantilla(): void {
    const aRows = [
      this.importTemplateColumns,
      [
        "PLACA-001",
        "Nombre del ave",
        "M",
        "2024-01-15",
        "BUENO",
        "ACTIVO",
        "NO",
        "NO",
        "",
        "",
        "",
        "Navajero",
        "Colorado",
        "Gallo",
        "Galpon A",
        "Criadero propio",
        "Criador",
        "",
        "",
        "",
        ""
      ]
    ];

    this.descargarCsv("plantilla_carga_aves.csv", aRows);
  }

  public onSubirDatos(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.txt,text/csv,text/plain";
    input.style.display = "none";

    input.onchange = () => {
      const file = input.files?.[0];
      input.remove();

      if (!file) return;

      if (!/\.(csv|txt)$/i.test(file.name)) {
        MessageBox.warning("Sube la plantilla en formato CSV.");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => void this.importarAvesDesdeCsv(String(reader.result || ""));
      reader.onerror = () => MessageBox.error("No se pudo leer el archivo seleccionado.");
      reader.readAsText(file, "UTF-8");
    };

    document.body.appendChild(input);
    input.click();
  }

  private async importarAvesDesdeCsv(contenido: string): Promise<void> {
    const rows = this.parseDelimitedText(contenido);
    const nonEmptyRows = rows.filter((row) => row.some((cell) => String(cell || "").trim()));

    if (nonEmptyRows.length < 2) {
      MessageBox.warning("La plantilla no contiene filas para importar.");
      return;
    }

    const headers = nonEmptyRows[0].map((header) => this.normalizarHeader(header));
    const registros = nonEmptyRows.slice(1).map((row) => this.crearRegistroDesdeFila(headers, row));
    const authUser = localStorage.getItem("auth_user");

    if (!authUser) {
      MessageToast.show("No se encontrÃ³ la sesiÃ³n del usuario");
      return;
    }

    const usuario = JSON.parse(authUser);
    const userId = usuario._id;
    const avesModel = this.getView()?.getModel("aves") as JSONModel;
    const avesActuales = avesModel?.getProperty("/value") || [];
    const avesPorPlaca = new Map<string, any>();
    const placasImportadas = new Set<string>();

    avesActuales.forEach((ave: any) => {
      if (ave?.placa) avesPorPlaca.set(String(ave.placa).trim().toUpperCase(), ave);
    });

    let creadas = 0;
    const errores: string[] = [];
    const advertencias: string[] = [];

    for (let index = 0; index < registros.length; index += 1) {
      const fila = index + 2;
      const registro = registros[index];
      const placa = String(registro.placa || "").trim().toUpperCase();

      if (!placa) {
        errores.push(`Fila ${fila}: la placa es obligatoria.`);
        continue;
      }

      if (avesPorPlaca.has(placa) || placasImportadas.has(placa)) {
        errores.push(`Fila ${fila}: la placa ${placa} ya existe o estÃ¡ duplicada en el archivo.`);
        continue;
      }

      const sexo = this.normalizarSexo(registro.sexo);
      if (!sexo) {
        errores.push(`Fila ${fila}: el sexo debe ser M, H, Macho o Hembra.`);
        continue;
      }

      const fechaNacimiento = this.normalizarFechaImportacion(registro.fechaNacimiento);
      if (!fechaNacimiento) {
        errores.push(`Fila ${fila}: la fechaNacimiento es obligatoria y debe ser yyyy-mm-dd o dd/mm/yyyy.`);
        continue;
      }

      const payload: any = {
        placa,
        nombre: this.valorTexto(registro.nombre),
        apodo: this.valorTexto(registro.apodo),
        sexo,
        estado: this.normalizarEstado(registro.estado),
        raza: this.valorTexto(registro.raza),
        color: this.valorTexto(registro.color),
        tipoAve: this.valorTexto(registro.tipoAve),
        ubicacion: this.valorTexto(registro.ubicacion),
        procedencia: this.valorTexto(registro.procedencia),
        criador: this.valorTexto(registro.criador),
        categoria: this.normalizarCategoria(registro.categoria),
        cria: this.normalizarBooleano(registro.cria),
        padrote: this.normalizarBooleano(registro.padrote),
        observaciones: this.valorTexto(registro.observaciones),
        fechaNacimiento,
        fechaCompra: this.normalizarFechaImportacion(registro.fechaCompra),
        valorCompra: this.normalizarNumero(registro.valorCompra),
        valorActual: this.normalizarNumero(registro.valorActual),
        usuario_ID: userId
      };

      const padre = this.buscarAvePorPlaca(avesPorPlaca, registro.padrePlaca);
      const madre = this.buscarAvePorPlaca(avesPorPlaca, registro.madrePlaca);

      if (padre) {
        payload.padre_ID = padre.ID;
      } else if (this.valorTexto(registro.padrePlaca)) {
        advertencias.push(`Fila ${fila}: no se encontrÃ³ padre con placa ${registro.padrePlaca}.`);
      }

      if (madre) {
        payload.madre_ID = madre.ID;
      } else if (this.valorTexto(registro.madrePlaca)) {
        advertencias.push(`Fila ${fila}: no se encontrÃ³ madre con placa ${registro.madrePlaca}.`);
      }

      try {
        const response = await fetch(`${this.baseUrl}/Aves`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.authService.getToken()}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const error = await response.json();
          errores.push(`Fila ${fila}: ${error.error?.message || error.message || "no se pudo crear."}`);
          continue;
        }

        const creada = await response.json();
        creadas += 1;
        placasImportadas.add(placa);
        avesPorPlaca.set(placa, creada);
      } catch (error: any) {
        errores.push(`Fila ${fila}: ${error.message || "error de conexiÃ³n."}`);
      }
    }

    await this.initializeData();
    this.mostrarResumenImportacion(creadas, errores, advertencias);
  }

  private mostrarResumenImportacion(creadas: number, errores: string[], advertencias: string[]): void {
    const detalle = [...advertencias, ...errores].slice(0, 12).join("\n");
    const mensaje = [
      `Aves creadas: ${creadas}`,
      `Advertencias: ${advertencias.length}`,
      `Errores: ${errores.length}`,
      detalle ? `\n${detalle}` : ""
    ].join("\n");

    if (errores.length) {
      MessageBox.warning(mensaje);
    } else {
      MessageBox.success(mensaje);
    }
  }

  private descargarCsv(fileName: string, rows: any[][]): void {
    const content = "\uFEFF" + rows
      .map((row) => row.map((cell) => this.escapeCsvCell(cell)).join(";"))
      .join("\r\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  private escapeCsvCell(value: any): string {
    const text = value == null ? "" : String(value);
    return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  private parseDelimitedText(text: string): string[][] {
    const cleanText = text.replace(/^\uFEFF/, "");
    const firstLine = cleanText.split(/\r?\n/)[0] || "";
    const delimiter = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ",";
    const rows: string[][] = [];
    let current = "";
    let row: string[] = [];
    let inQuotes = false;

    for (let i = 0; i < cleanText.length; i += 1) {
      const char = cleanText[i];
      const next = cleanText[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        row.push(current.trim());
        current = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") i += 1;
        row.push(current.trim());
        rows.push(row);
        row = [];
        current = "";
      } else {
        current += char;
      }
    }

    if (current || row.length) {
      row.push(current.trim());
      rows.push(row);
    }

    return rows;
  }

  private normalizarHeader(value: string): string {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
  }

  private crearRegistroDesdeFila(headers: string[], row: string[]): any {
    const aliases: Record<string, string> = {
      placa: "placa",
      nombre: "nombre",
      sexo: "sexo",
      genero: "sexo",
      fechanacimiento: "fechaNacimiento",
      fechanac: "fechaNacimiento",
      categoria: "categoria",
      estado: "estado",
      cria: "cria",
      padrote: "padrote",
      padreplaca: "padrePlaca",
      padre: "padrePlaca",
      madreplaca: "madrePlaca",
      madre: "madrePlaca",
      apodo: "apodo",
      raza: "raza",
      color: "color",
      tipoave: "tipoAve",
      ubicacion: "ubicacion",
      procedencia: "procedencia",
      criador: "criador",
      fechacompra: "fechaCompra",
      valorcompra: "valorCompra",
      valoractual: "valorActual",
      observaciones: "observaciones"
    };
    const registro: any = {};

    headers.forEach((header, index) => {
      const key = aliases[header];
      if (key) registro[key] = row[index] || "";
    });

    return registro;
  }

  private normalizarSexo(value: any): string {
    const normalized = String(value || "").trim().toUpperCase();
    if (["M", "MACHO"].includes(normalized)) return "M";
    if (["H", "HEMBRA"].includes(normalized)) return "H";
    return "";
  }

  private normalizarEstado(value: any): string {
    const normalized = String(value || "ACTIVO").trim().toUpperCase();
    return ["ACTIVO", "VENDIDO", "PRESTADO", "RETIRADO", "FALLECIDO"].includes(normalized)
      ? normalized
      : "ACTIVO";
  }

  private normalizarCategoria(value: any): string {
    const normalized = String(value || "BUENO").trim().toUpperCase();
    return ["PESIMO", "REGULAR", "BUENO", "EXCELENTE", "EXTRAORDINARIO"].includes(normalized)
      ? normalized
      : "BUENO";
  }

  private normalizarBooleano(value: any): boolean {
    const normalized = String(value || "").trim().toUpperCase();
    return ["SI", "S", "TRUE", "1", "X", "YES"].includes(normalized);
  }

  private normalizarNumero(value: any): number | null {
    const text = String(value || "").trim().replace(",", ".");
    if (!text) return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  }

  private normalizarFechaImportacion(value: any): string | null {
    const text = String(value || "").trim();
    if (!text) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

    const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (match) {
      const day = match[1].padStart(2, "0");
      const month = match[2].padStart(2, "0");
      return `${match[3]}-${month}-${day}`;
    }

    return null;
  }

  private valorTexto(value: any): string | null {
    const text = String(value || "").trim();
    return text || null;
  }

  private buscarAvePorPlaca(avesPorPlaca: Map<string, any>, placa: any): any {
    const key = String(placa || "").trim().toUpperCase();
    return key ? avesPorPlaca.get(key) : null;
  }

  public onNavWelcome(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
    oRouter?.navTo("RouteWelcome");
  }

}
