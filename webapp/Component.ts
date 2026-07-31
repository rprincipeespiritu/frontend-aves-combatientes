import BaseComponent from "sap/ui/core/UIComponent";
import Controller from "sap/ui/core/mvc/Controller";
import View from "sap/ui/core/mvc/View";
import App from "sap/m/App";
import EventBus from "sap/ui/core/EventBus";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import BusyDialog from "sap/m/BusyDialog";
import Dialog from "sap/m/Dialog";
import Fragment from "sap/ui/core/Fragment";
import { createDeviceModel } from "./model/models";
import formatter from "./model/formatter";
import { AuthService, Usuario } from "./services/AuthService";

type PlanIndicatorData = {
  visible: boolean;
  plan: string;
  text: string;
  state: string;
  type: string;
  icon: string;
  tieneSuscripcion?: boolean;
  estado?: string;
  diasRestantes?: number;
};

/**
 * @namespace com.rprincipees.registroavescombate
 */
export default class Component extends BaseComponent {
  private baseUrl = "http://localhost:4004/api/avecombatiente";
  private static fetchBusyDialog: BusyDialog | null = null;
  private static pendingFetchRequests = 0;
  private static fetchWrapped = false;
  private static fetchBusyDialogOpened = false;
  private readonly publicRoutes = new Set([
    "RouteLogin",
    "RouteLanding",
    "RouteRegister",
    "RouteForgotPassword",
    "RouteResetPassword",
  ]);
  private readonly unrestrictedRoutes = new Set([
    "RouteWelcome",
    "RouteSuscripcion",
    "RouteAccountSettings",
  ]);
  private readonly routeModuleMap: Record<string, string> = {
    RouteList: "Aves",
    RouteAveCreate: "Aves",
    RouteAveDetail: "Aves",
    RouteAveUpdate: "Aves",
    RoutePollitos: "Crias",
    RoutePollitoCreate: "Crias",
    RoutePollitoDetail: "Crias",
    RoutePollitoEdit: "Crias",
    RouteIncubacionList: "Incubaciones",
    RouteIncubacionCreate: "Incubaciones",
    RouteIncubacionEdit: "Incubaciones",
    RouteIncubacionReprogramar: "Incubaciones",
    RouteIncubacionDetail: "Incubaciones",
    RouteLineaGallos: "LineasAves",
    RouteLineaGalloCreate: "LineasAves",
    RouteLineaGalloEdit: "LineasAves",
    RouteLineaGalloDetail: "LineasAves",
    RouteGenealogia: "LineasAves",
    RouteEstadisticasPeleas: "LineasAves",
    RoutePlanesCruce: "PlanesCruces",
    RoutelineaGallosCruceCreate: "PlanesCruces",
    RouteLineaGallosCruceEdit: "PlanesCruces",
    RouteLineaGallosCruceDetail: "PlanesCruces",
    RouteReportes: "Historial",
    RouteCombates: "Peleas",
    RouteCombateCreate: "Peleas",
    RouteCombateEdit: "Peleas",
    RouteCombateDetail: "Peleas",
  };
  private readonly modulesByPlan: Record<string, string[]> = {
    PRUEBA: ["*"],
    BASICO: [
      "Aves",
      "Crias",
      "Incubaciones",
      "IncubacionDetalles",
      "FotosAve",
      "VideosAve",
      "DocumentosAve",
      "Suscripciones",
    ],
    PRO: [
      "Aves",
      "Crias",
      "Incubaciones",
      "IncubacionDetalles",
      "FotosAve",
      "VideosAve",
      "DocumentosAve",
      "LineasAves",
      "PlanesCruces",
      "EvaluacionesAves",
      "Suscripciones",
      "Historial",
    ],
    PREMIUM: ["*"],
  };

  public static metadata = {
    manifest: "json",
    interfaces: ["sap.ui.core.IAsyncContentCreation"],
  };

  public init(): void {
    // call the base component's init function
    super.init();
    this.installGlobalFetchBusyDialog();
    this.installGlobalAccountSettingsHandler();
    this.installGlobalProfilePhotoHandlers();
    this.installGlobalImageLightbox();
    this.installGlobalFormatters();
    this.subscribeUserProfileUpdates();
    void AuthService.getInstance().ensureUserPhotoDisplay().then((user) => {
      if (user) {
        this.propagateUserModelToViews(user);
      }
    });

    // set the device model
    this.setModel(createDeviceModel(), "device");
    this.setModel(new JSONModel({
      visible: false,
      plan: "",
      text: "",
      state: "None",
      type: "Transparent",
      icon: "sap-icon://locked",
    }), "planIndicator");

    // enable routing
    this.getRouter().attachRouteMatched((event: any) => {
      void this.onRouteMatched(event);
    });
    this.getRouter().initialize();
  }

  private installGlobalFetchBusyDialog(): void {
    if (Component.fetchWrapped || typeof window === "undefined" || typeof window.fetch !== "function") {
      return;
    }

    const nativeFetch = window.fetch.bind(window);
    Component.fetchWrapped = true;

    window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
      this.openFetchBusyDialog();
      try {
        return await nativeFetch(...args);
      } finally {
        this.closeFetchBusyDialog();
      }
    };
  }

  private openFetchBusyDialog(): void {
    Component.pendingFetchRequests += 1;

    if (!Component.fetchBusyDialog) {
      Component.fetchBusyDialog = new BusyDialog({
        title: "Procesando",
        text: "Espere por favor...",
      });
    }

    if (!Component.fetchBusyDialogOpened) {
      Component.fetchBusyDialog.open();
      Component.fetchBusyDialogOpened = true;
    }
  }

  private closeFetchBusyDialog(): void {
    Component.pendingFetchRequests = Math.max(0, Component.pendingFetchRequests - 1);

    if (Component.pendingFetchRequests === 0 && Component.fetchBusyDialog && Component.fetchBusyDialogOpened) {
      Component.fetchBusyDialog.close();
      Component.fetchBusyDialogOpened = false;
    }
  }

  private installGlobalAccountSettingsHandler(): void {
    const controllerPrototype = Controller.prototype as any;

    if (!controllerPrototype.onAccountSettings) {
      controllerPrototype.onAccountSettings = function (): void {
        this._oUserMenuPopover?.close?.();
        this._oUserMenuSheet?.close?.();
        this.getOwnerComponent?.()?.getRouter?.()?.navTo("RouteAccountSettings");
      };
    }

    if (!controllerPrototype.onSubscriptionSettings) {
      controllerPrototype.onSubscriptionSettings = function (): void {
        this._oUserMenuPopover?.close?.();
        this._oUserMenuSheet?.close?.();
        this.getOwnerComponent?.()?.getRouter?.()?.navTo("RouteSuscripcion");
      };
    }

    if (!controllerPrototype.onCerrarUserMenu) {
      controllerPrototype.onCerrarUserMenu = function (): void {
        this._oUserMenuPopover?.close?.();
        this._oUserMenuSheet?.close?.();
      };
    }

    if (!controllerPrototype.bindUserModel) {
      controllerPrototype.bindUserModel = function (): void {
        AuthService.getInstance().bindUserModelToView(this.getView?.());
      };
    }
  }

  private installGlobalProfilePhotoHandlers(): void {
    const controllerPrototype = Controller.prototype as any;
    const authService = AuthService.getInstance();
    const component = this;

    const syncUserModel = (controller: any, user: Usuario): void => {
      const view = controller.getView?.();
      if (!view) return;

      const userModel = view.getModel("user") as JSONModel | undefined;
      if (!userModel) {
        view.setModel(new JSONModel({ ...user }), "user");
        return;
      }

      userModel.setData({ ...user });
    };

    const procesarArchivoPerfil = async function (this: any, file: File): Promise<void> {
      const busy = new BusyDialog({
        title: "Procesando",
        text: "Subiendo foto de perfil...",
      });
      busy.open();

      try {
        const result = await authService.subirFotoPerfil(file);
        if (!result.success) {
          throw new Error(result.error || result.message || "No se pudo actualizar la foto de perfil");
        }

        const user = authService.getCurrentUser();
        if (user) {
          syncUserModel(this, user);
        }

        MessageToast.show(result.message || "Foto de perfil actualizada");

        const lightboxModel = this.getView?.()?.getModel("imageLightbox") as JSONModel | undefined;
        if (lightboxModel?.getProperty("/esFotoPerfil") && user?.foto) {
          const safeUrl = String(user.foto)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
          lightboxModel.setProperty(
            "/html",
            `<div class="aveMediaViewer imageLightboxViewer"><img src="${safeUrl}" alt="Foto de perfil" /></div>`
          );
          lightboxModel.setProperty("/puedeEliminar", !!user.fotoUrl);
        }
      } catch (error: any) {
        MessageBox.error(error.message || "No se pudo actualizar la foto de perfil");
      } finally {
        busy.close();
        busy.destroy();
      }
    };

    const abrirSelectorFoto = function (this: any): void {
      const controller = this;

      component.abrirSelectorFotoNativo((file) => {
        controller._oUserMenuPopover?.close?.();
        controller._oUserMenuSheet?.close?.();
        void procesarArchivoPerfil.call(controller, file);
      });
    };

    const abrirCamaraFoto = function (this: any): void {
      const controller = this;
      controller._oUserMenuPopover?.close?.();
      controller._oUserMenuSheet?.close?.();
      void component.abrirCapturaCamaraPerfil(controller, (file) => {
        void procesarArchivoPerfil.call(controller, file);
      });
    };

    if (!controllerPrototype.onTomarFotoPerfil) {
      controllerPrototype.onTomarFotoPerfil = function (): void {
        abrirCamaraFoto.call(this);
      };
    }

    if (!controllerPrototype.onSubirFotoPerfil) {
      controllerPrototype.onSubirFotoPerfil = function (): void {
        abrirSelectorFoto.call(this);
      };
    }

    if (!controllerPrototype.onSeleccionarFotoPerfil) {
      controllerPrototype.onSeleccionarFotoPerfil = async function (oEvent: any): Promise<void> {
        const files = oEvent.getParameter("files") as FileList | undefined;
        const file = files?.[0];
        if (!file) return;
        await procesarArchivoPerfil.call(this, file);
        oEvent.getSource()?.clear?.();
      };
    }

    if (!controllerPrototype.onConfirmarCapturaCamara) {
      controllerPrototype.onConfirmarCapturaCamara = function (this: any): void {
        void component.confirmarCapturaCamara(this);
      };
    }

    if (!controllerPrototype.onCancelarCapturaCamara) {
      controllerPrototype.onCancelarCapturaCamara = function (this: any): void {
        component.detenerCamara();
        this._oCameraCaptureDialog?.close();
      };
    }

    if (!controllerPrototype.onCameraCaptureDialogClosed) {
      controllerPrototype.onCameraCaptureDialogClosed = function (): void {
        component.detenerCamara();
      };
    }

    if (!controllerPrototype.onEliminarFotoPerfil) {
      controllerPrototype.onEliminarFotoPerfil = async function (): Promise<void> {
        const confirmado = await new Promise<boolean>((resolve) => {
          MessageBox.confirm("Desea eliminar la foto de perfil?", {
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            onClose: (action: string) => resolve(action === MessageBox.Action.OK),
          });
        });

        if (!confirmado) return;

        const busy = new BusyDialog({
          title: "Procesando",
          text: "Eliminando foto de perfil...",
        });
        busy.open();

        try {
          const result = await authService.eliminarFotoPerfil();
          if (!result.success) {
            throw new Error(result.error || result.message || "No se pudo eliminar la foto de perfil");
          }

          const user = authService.getCurrentUser();
          if (user) {
            syncUserModel(this, user);
          }

          MessageToast.show(result.message || "Foto de perfil eliminada");

          const lightboxModel = this.getView?.()?.getModel("imageLightbox") as JSONModel | undefined;
          if (lightboxModel?.getProperty("/esFotoPerfil")) {
            this.onCerrarImagenAmpliada?.();
          }
        } catch (error: any) {
          MessageBox.error(error.message || "No se pudo eliminar la foto de perfil");
        } finally {
          busy.close();
          busy.destroy();
        }
      };
    }
  }

  private installGlobalImageLightbox(): void {
    const controllerPrototype = Controller.prototype as any;

    const escapeHtml = (value: string): string =>
      String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    if (!controllerPrototype.mostrarImagenAmpliada) {
      controllerPrototype.mostrarImagenAmpliada = async function (
        this: any,
        url: string,
        title = "Imagen",
        options?: { esFotoPerfil?: boolean }
      ): Promise<void> {
        if (!url) {
          MessageToast.show("No hay imagen para mostrar");
          return;
        }

        const view = this.getView?.();
        if (!view) return;

        const esFotoPerfil = !!options?.esFotoPerfil;
        const user = AuthService.getInstance().getCurrentUser();
        const safeUrl = escapeHtml(url);
        const safeTitle = escapeHtml(title);
        view.setModel(
          new JSONModel({
            title,
            esFotoPerfil,
            puedeEliminar: esFotoPerfil && !!user?.fotoUrl,
            html: `<div class="aveMediaViewer imageLightboxViewer"><img src="${safeUrl}" alt="${safeTitle}" /></div>`,
          }),
          "imageLightbox"
        );

        if (!this._oImageLightboxDialog) {
          this._oImageLightboxDialog = (await Fragment.load({
            id: view.getId(),
            name: "com.rprincipees.registroavescombate.view.fragments.ImageLightboxDialog",
            controller: this,
          })) as Dialog;
          view.addDependent(this._oImageLightboxDialog);
        }

        this._oImageLightboxDialog.open();
      };
    }

    if (!controllerPrototype.onVerFotoPerfilAmpliada) {
      controllerPrototype.onVerFotoPerfilAmpliada = function (this: any): void {
        const user = AuthService.getInstance().getCurrentUser();
        const url = user?.foto || "";
        if (!url) {
          MessageToast.show("No hay foto de perfil para mostrar");
          return;
        }
        void this.mostrarImagenAmpliada(url, "Foto de perfil", { esFotoPerfil: true });
      };
    }

    if (!controllerPrototype.onVerImagenAmpliada) {
      controllerPrototype.onVerImagenAmpliada = function (this: any, oEvent: any): void {
        const source = oEvent.getSource?.();
        const url = source?.getSrc?.() || "";
        if (!url) {
          MessageToast.show("No hay imagen para mostrar");
          return;
        }
        const tooltip = source?.getTooltip?.();
        const alt = source?.getAlt?.();
        const title =
          (typeof tooltip === "string" && tooltip) ||
          (typeof alt === "string" && alt) ||
          "Imagen";
        void this.mostrarImagenAmpliada(url, title);
      };
    }

    if (!controllerPrototype.onCambiarFotoDesdeLightbox) {
      controllerPrototype.onCambiarFotoDesdeLightbox = function (this: any): void {
        this.onTomarFotoPerfil?.();
      };
    }

    if (!controllerPrototype.onSubirFotoDesdeLightbox) {
      controllerPrototype.onSubirFotoDesdeLightbox = function (this: any): void {
        this.onSubirFotoPerfil?.();
      };
    }

    if (!controllerPrototype.onEliminarFotoDesdeLightbox) {
      controllerPrototype.onEliminarFotoDesdeLightbox = function (this: any): void {
        void this.onEliminarFotoPerfil?.();
      };
    }

    if (!controllerPrototype.onCerrarImagenAmpliada) {
      controllerPrototype.onCerrarImagenAmpliada = function (this: any): void {
        this._oImageLightboxDialog?.close();
        const model = this.getView?.()?.getModel("imageLightbox") as JSONModel | undefined;
        model?.setProperty("/html", "");
        model?.setProperty("/esFotoPerfil", false);
        model?.setProperty("/puedeEliminar", false);
      };
    }
  }

  private cameraStream: MediaStream | null = null;

  private detenerCamara(): void {
    this.cameraStream?.getTracks().forEach((track) => track.stop());
    this.cameraStream = null;
  }

  private async abrirCapturaCamaraPerfil(
    controller: any,
    onCaptured: (file: File) => void
  ): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      MessageBox.warning(
        "Este equipo no permite usar la cámara desde el navegador. Se abrirá el selector de archivos."
      );
      this.abrirSelectorFotoNativo(onCaptured);
      return;
    }

    const view = controller.getView?.();
    if (!view) return;

    view.setModel(
      new JSONModel({
        listo: false,
        mensaje: "Iniciando cámara...",
        html: `<div class="cameraCapturePreview"><video class="cameraCaptureVideo" autoplay playsinline muted></video><canvas class="cameraCaptureCanvas" hidden></canvas></div>`,
      }),
      "cameraCapture"
    );

    controller._cameraCaptureCallback = onCaptured;

    if (!controller._oCameraCaptureDialog) {
      controller._oCameraCaptureDialog = (await Fragment.load({
        id: view.getId(),
        name: "com.rprincipees.registroavescombate.view.fragments.CameraCaptureDialog",
        controller,
      })) as Dialog;
      view.addDependent(controller._oCameraCaptureDialog);
    }

    controller._oCameraCaptureDialog.open();

    const model = view.getModel("cameraCapture") as JSONModel;
    try {
      this.detenerCamara();
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      // Esperar a que el HTML del video esté en el DOM
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 80);
      });

      const video = controller._oCameraCaptureDialog
        ?.getDomRef()
        ?.querySelector(".cameraCaptureVideo") as HTMLVideoElement | null;

      if (!video) {
        throw new Error("No se pudo inicializar la vista de la cámara");
      }

      video.srcObject = this.cameraStream;
      await video.play();
      model.setProperty("/listo", true);
      model.setProperty("/mensaje", "");
    } catch (error: any) {
      this.detenerCamara();
      model.setProperty("/listo", false);
      model.setProperty("/mensaje", "No se pudo acceder a la cámara.");
      MessageBox.error(
        error?.message ||
          "No se pudo acceder a la cámara. Verifique los permisos del navegador."
      );
      controller._oCameraCaptureDialog?.close();
    }
  }

  private async confirmarCapturaCamara(controller: any): Promise<void> {
    const dialog = controller._oCameraCaptureDialog as Dialog | undefined;
    const video = dialog
      ?.getDomRef()
      ?.querySelector(".cameraCaptureVideo") as HTMLVideoElement | null;
    const canvas = dialog
      ?.getDomRef()
      ?.querySelector(".cameraCaptureCanvas") as HTMLCanvasElement | null;

    if (!video || !canvas) {
      MessageToast.show("La cámara aún no está lista");
      return;
    }

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      MessageBox.error("No se pudo capturar la imagen");
      return;
    }

    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/jpeg", 0.92);
    });

    if (!blob) {
      MessageBox.error("No se pudo generar la foto");
      return;
    }

    const file = new File([blob], `foto-perfil-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });

    this.detenerCamara();
    dialog?.close();
    controller._cameraCaptureCallback?.(file);
    controller._cameraCaptureCallback = undefined;
  }

  private abrirSelectorFotoNativo(onFileSelected: (file: File) => void): void {
    if (typeof document === "undefined") return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/jpg";
    input.style.display = "none";

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) {
        onFileSelected(file);
      }
      input.remove();
    }, { once: true });

    document.body.appendChild(input);
    input.click();
  }

  private subscribeUserProfileUpdates(): void {
    EventBus.getInstance().subscribe("app", "userProfileUpdated", (_channel, _event, data: { user?: Usuario }) => {
      if (!data?.user) return;
      this.propagateUserModelToViews(data.user);
    });
  }

  private setUserModelOnView(view: View, user: Usuario): void {
    const userModel = view.getModel("user") as JSONModel | undefined;
    if (!userModel) {
      view.setModel(new JSONModel({ ...user }), "user");
      return;
    }

    userModel.setData({ ...user });
  }

  private propagateUserModelToViews(user: Usuario): void {
    const core = sap.ui.getCore();
    Object.keys(core.mElements || {}).forEach((elementId) => {
      const element = core.byId(elementId);
      if (element instanceof View) {
        this.setUserModelOnView(element, user);
      }
    });

    const appControl = this.byId("app") as App;
    const currentPage = appControl?.getCurrentPage?.();
    if (currentPage instanceof View) {
      this.setUserModelOnView(currentPage, user);
    }
  }

  private installGlobalFormatters(): void {
    const controllerPrototype = Controller.prototype as any;

    if (!controllerPrototype.formatearEstadoState) {
      controllerPrototype.formatearEstadoState = formatter.formatEstadoAveState;
    }

    if (!controllerPrototype.formatearEstadoAveText) {
      controllerPrototype.formatearEstadoAveText = formatter.formatEstadoAveText;
    }
  }

  private async onRouteMatched(event: any): Promise<void> {
    const routeName = String(event.getParameter("name") || "");
    const subscription = await this.loadPlanIndicator();
    this.validateRouteAccess(routeName, subscription);
    void this.refreshAuthenticatedUserPhoto();
  }

  private async refreshAuthenticatedUserPhoto(): Promise<void> {
    const authService = AuthService.getInstance();
    if (!authService.isAuthenticated()) return;

    const user = await authService.ensureUserPhotoDisplay();
    if (!user) return;

    const propagate = (): void => {
      this.propagateUserModelToViews(user);
    };

    propagate();
    window.setTimeout(propagate, 0);
    window.setTimeout(propagate, 300);
  }

  public async loadPlanIndicator(): Promise<PlanIndicatorData> {
    const token = localStorage.getItem("auth_token");
    const oModel = this.getModel("planIndicator") as JSONModel;

    if (!token) {
      const indicator = {
        ...this.getPlanIndicatorData("", false),
        tieneSuscripcion: false,
      };
      oModel.setData(indicator);
      return indicator;
    }

    try {
      const response = await fetch(`${this.baseUrl}/obtenerSuscripcionActual`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const data = await response.json();

      if (!response.ok || data.tieneSuscripcion === false) {
        const indicator = {
          ...this.getPlanIndicatorData(""),
          tieneSuscripcion: false,
          estado: data.estado,
          diasRestantes: data.diasRestantes,
        };
        oModel.setData(indicator);
        return indicator;
      }

      const plan = String(data.plan || "").toUpperCase();
      const indicator = {
        ...this.getPlanIndicatorData(plan),
        tieneSuscripcion: true,
        estado: data.estado,
        diasRestantes: data.diasRestantes,
      };
      oModel.setData(indicator);
      return indicator;
    } catch (error) {
      const indicator = {
        ...this.getPlanIndicatorData("", false),
        tieneSuscripcion: false,
      };
      oModel.setData(indicator);
      return indicator;
    }
  }

  private getPlanIndicatorData(plan: string, visible = true): PlanIndicatorData {
    const planKey = String(plan || "").toUpperCase();
    const config: Record<string, Record<string, string>> = {
      PRUEBA: {
        text: "Prueba",
        state: "Warning",
        type: "Transparent",
        icon: "sap-icon://unlocked",
      },
      BASICO: {
        text: "Basico",
        state: "Information",
        type: "Transparent",
        icon: "sap-icon://initiative",
      },
      PRO: {
        text: "Pro",
        state: "Information",
        type: "Transparent",
        icon: "sap-icon://favorite",
      },
      PREMIUM: {
        text: "Premium",
        state: "Success",
        type: "Transparent",
        icon: "sap-icon://badge",
      },
    };
    const selected = config[planKey] || {
      text: "Sin plan",
      state: "Warning",
      type: "Transparent",
      icon: "sap-icon://locked",
    };

    return {
      visible,
      plan: planKey,
      ...selected,
    };
  }

  private validateRouteAccess(routeName: string, subscription: PlanIndicatorData): void {
    if (!routeName || this.publicRoutes.has(routeName) || this.unrestrictedRoutes.has(routeName)) {
      return;
    }

    const moduleName = this.routeModuleMap[routeName];
    if (!moduleName) {
      return;
    }

    if (!localStorage.getItem("auth_token")) {
      return;
    }

    const plan = String(subscription.plan || "").toUpperCase();
    const estado = String(subscription.estado || "").toUpperCase();
    const diasRestantes = Number(subscription.diasRestantes ?? 0);
    const hasActiveSubscription =
      subscription.tieneSuscripcion === true &&
      Boolean(plan) &&
      ["ACTIVA", "CANCELADA"].includes(estado) &&
      diasRestantes >= 0;

    if (!hasActiveSubscription) {
      MessageToast.show("Tu suscripcion no esta activa. Revisa o elige un plan.");
      this.getRouter().navTo("RouteSuscripcion", {}, true);
      return;
    }

    if (!this.isModuleAllowed(plan, moduleName)) {
      MessageToast.show(`El modulo requiere un plan superior al ${this.formatPlan(plan)}.`);
      this.getRouter().navTo("RouteSuscripcion", {}, true);
    }
  }

  private isModuleAllowed(plan: string, moduleName: string): boolean {
    const modules = this.modulesByPlan[plan] || [];
    return modules.includes("*") || modules.includes(moduleName);
  }

  private formatPlan(plan: string): string {
    const labels: Record<string, string> = {
      PRUEBA: "Prueba",
      BASICO: "Basico",
      PRO: "Pro",
      PREMIUM: "Premium",
    };

    return labels[plan] || plan;
  }

  // Component.ts
  public updateUserModel(): void {
    const oModel = this.getModel("user") as JSONModel;
    if (oModel) {
      oModel.setData({
        username: "",
        email: "",
        rol: "",
        isLoggedIn: false,
      });
    }

    const oPlanModel = this.getModel("planIndicator") as JSONModel;
    oPlanModel?.setData(this.getPlanIndicatorData("", false));
  }
}
