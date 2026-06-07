import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import Fragment from "sap/ui/core/Fragment";
import Device from "sap/ui/Device";
import ActionSheet from "sap/m/ActionSheet";
import Popover from "sap/m/Popover";
import Control from "sap/ui/core/Control";
import { AuthService } from "../services/AuthService";
import ConfirmationService from "../services/ConfirmationService";

export default class AccountSettings extends Controller {
  private authService: AuthService;
  private _oUserMenuPopover: any;
  private _oUserMenuSheet: any;

  public onInit(): void {
    this.authService = AuthService.getInstance();

    this.getView()?.setModel(new JSONModel({
      busy: false,
      perfil: {
        username: "",
        email: "",
        nombre: "",
        apellido: "",
        telefono: "",
        direccion: "",
      },
      password: {
        actual: "",
        nueva: "",
        confirmacion: "",
      },
    }), "account");

    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.getRoute("RouteAccountSettings")?.attachPatternMatched(this.onRouteMatched, this);
  }

  private onRouteMatched = (): void => {
    if (!this.authService.isAuthenticated()) {
      (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteLogin");
      return;
    }

    this.cargarUsuarioLocal();
    void this.cargarPerfil();
  };

  private cargarUsuarioLocal(): void {
    const userData = localStorage.getItem("auth_user");
    if (!userData) return;

    const user = JSON.parse(userData);
    this.getView()?.setModel(new JSONModel(user), "user");
    const oModel = this.getView()?.getModel("account") as JSONModel;
    oModel.setProperty("/perfil", {
      username: user.username || "",
      email: user.email || "",
      nombre: user.nombre || "",
      apellido: user.apellido || "",
      telefono: user.telefono || "",
      direccion: user.direccion || "",
    });
  }

  private async cargarPerfil(): Promise<void> {
    const oModel = this.getView()?.getModel("account") as JSONModel;
    oModel.setProperty("/busy", true);

    try {
      const perfil = await this.authService.obtenerPerfil();
      if (!perfil) {
        throw new Error("No se pudo cargar el perfil");
      }

      oModel.setProperty("/perfil", {
        username: perfil.username || "",
        email: perfil.email || "",
        nombre: perfil.nombre || "",
        apellido: perfil.apellido || "",
        telefono: perfil.telefono || "",
        direccion: perfil.direccion || "",
      });
      this.getView()?.setModel(new JSONModel(perfil), "user");
    } catch (error: any) {
      MessageBox.error(error.message || "No se pudo cargar la configuracion de cuenta");
    } finally {
      oModel.setProperty("/busy", false);
    }
  }

  public async onGuardarPerfil(): Promise<void> {
    const oModel = this.getView()?.getModel("account") as JSONModel;
    const perfil = oModel.getProperty("/perfil") || {};

    if (!perfil.email || !perfil.nombre || !perfil.apellido) {
      MessageBox.warning("Email, nombre y apellido son obligatorios");
      return;
    }

    const confirmado = await ConfirmationService.confirmUpdate("tu perfil de usuario", `Email: ${perfil.email}`);
    if (!confirmado) return;

    oModel.setProperty("/busy", true);

    try {
      const result = await this.authService.actualizarPerfil(perfil);
      if (!result.success) {
        throw new Error(result.error || result.message || "No se pudo actualizar el perfil");
      }

      const userData = localStorage.getItem("auth_user");
      if (userData) {
        this.getView()?.setModel(new JSONModel(JSON.parse(userData)), "user");
      }

      MessageToast.show(result.message || "Perfil actualizado");
    } catch (error: any) {
      MessageBox.error(error.message || "No se pudo actualizar el perfil");
    } finally {
      oModel.setProperty("/busy", false);
    }
  }

  public async onCambiarPassword(): Promise<void> {
    const oModel = this.getView()?.getModel("account") as JSONModel;
    const password = oModel.getProperty("/password") || {};

    if (!password.actual || !password.nueva || !password.confirmacion) {
      MessageBox.warning("Completa los campos de contrasena");
      return;
    }

    if (password.nueva !== password.confirmacion) {
      MessageBox.warning("La nueva contrasena y la confirmacion no coinciden");
      return;
    }

    const confirmado = await ConfirmationService.confirmUpdate("tu contrasena");
    if (!confirmado) return;

    oModel.setProperty("/busy", true);

    try {
      const result = await this.authService.cambiarPassword(password.actual, password.nueva);
      if (!result.success) {
        throw new Error(result.error || result.message || "No se pudo actualizar la contrasena");
      }

      oModel.setProperty("/password", {
        actual: "",
        nueva: "",
        confirmacion: "",
      });
      MessageToast.show(result.message || "Contrasena actualizada");
    } catch (error: any) {
      MessageBox.error(error.message || "No se pudo actualizar la contrasena");
    } finally {
      oModel.setProperty("/busy", false);
    }
  }

  public onNavBack(): void {
    (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteWelcome");
  }

  public onNavWelcome(): void {
    this.onNavBack();
  }

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

    if (this._oUserMenuPopover.isOpen()) {
      this._oUserMenuPopover.close();
    } else {
      this._oUserMenuPopover.openBy(oSource);
    }
  }

  public async onLogout(): Promise<void> {
    try {
      await this.authService.logout();
      MessageToast.show("Sesion cerrada exitosamente");
      (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteLogin");
      (this.getOwnerComponent() as any)?.updateUserModel?.();
    } catch (error) {
      MessageToast.show("Error cerrando sesion");
    }
  }
}
