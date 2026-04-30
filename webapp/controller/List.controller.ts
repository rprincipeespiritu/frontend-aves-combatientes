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

      const mockAves: IAve[] = await response.json();
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

  public formatearFecha(fecha: Date): string {
    if (!fecha) {
      return "";
    }

    return new Intl.DateTimeFormat("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(fecha));
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
        fechaNacimiento: o.fechaNacimiento,
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

  public onNavWelcome(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
    oRouter?.navTo("RouteWelcome");
  }

}
