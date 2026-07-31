import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import { MetaPixelService } from "../services/MetaPixelService";

export default class Landing extends Controller {
  public onInit(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.getRoute("RouteLanding")?.attachPatternMatched(this.onRouteMatched, this);
  }

  private onRouteMatched(): void {
    if (localStorage.getItem("auth_token")) {
      (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteWelcome", {}, true);
      return;
    }

    MetaPixelService.init();
    MetaPixelService.trackViewContent();
  }

  public onCrearCuenta(): void {
    MetaPixelService.trackCustom("LandingCTARegister", { country: "PE" });
    (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteRegister");
  }

  public onIniciarSesion(): void {
    MetaPixelService.trackCustom("LandingCTALogin", { country: "PE" });
    (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteLogin");
  }
}
