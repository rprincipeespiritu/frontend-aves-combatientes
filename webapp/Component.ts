import BaseComponent from "sap/ui/core/UIComponent";
import { createDeviceModel } from "./model/models";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * @namespace com.rprincipees.registroavescombate
 */
export default class Component extends BaseComponent {
  public static metadata = {
    manifest: "json",
    interfaces: ["sap.ui.core.IAsyncContentCreation"],
  };

  public init(): void {
    // call the base component's init function
    super.init();

    // set the device model
    this.setModel(createDeviceModel(), "device");

    // enable routing
    this.getRouter().initialize();
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
  }
}
