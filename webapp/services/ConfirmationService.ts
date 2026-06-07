import MessageBox from "sap/m/MessageBox";

type ConfirmationAction = "crear" | "actualizar" | "eliminar" | "procesar";

const ACTION_TEXT: Record<ConfirmationAction, string> = {
  crear: "crear",
  actualizar: "actualizar",
  eliminar: "eliminar",
  procesar: "continuar con",
};

const ACTION_TITLE: Record<ConfirmationAction, string> = {
  crear: "Confirmar creacion",
  actualizar: "Confirmar actualizacion",
  eliminar: "Confirmar eliminacion",
  procesar: "Confirmar accion",
};

export default class ConfirmationService {
  public static confirm(
    action: ConfirmationAction,
    entityName: string,
    detail?: string,
  ): Promise<boolean> {
    const text = detail
      ? `Deseas ${ACTION_TEXT[action]} ${entityName}?\n\n${detail}`
      : `Deseas ${ACTION_TEXT[action]} ${entityName}?`;

    return new Promise((resolve) => {
      MessageBox.confirm(text, {
        title: ACTION_TITLE[action],
        actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
        emphasizedAction: MessageBox.Action.OK,
        onClose: (sAction: string) => resolve(sAction === MessageBox.Action.OK),
      });
    });
  }

  public static confirmCreate(entityName: string, detail?: string): Promise<boolean> {
    return this.confirm("crear", entityName, detail);
  }

  public static confirmUpdate(entityName: string, detail?: string): Promise<boolean> {
    return this.confirm("actualizar", entityName, detail);
  }

  public static confirmDelete(entityName: string, detail?: string): Promise<boolean> {
    return this.confirm("eliminar", entityName, detail);
  }

  public static confirmProcess(entityName: string, detail?: string): Promise<boolean> {
    return this.confirm("procesar", entityName, detail);
  }
}
