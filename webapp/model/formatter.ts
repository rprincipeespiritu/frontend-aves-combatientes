function formatEnumText(value: string | null | undefined): string {
    if (!value) {
        return "";
    }

    return String(value)
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export default {
    formatDateTime(value: string | Date | null | undefined): string {
        if (!value) {
            return "";
        }

        if (typeof value === "string") {
            const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (dateOnly) {
                return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
            }
        }

        const date = value instanceof Date ? value : new Date(value);

        if (isNaN(date.getTime())) {
            return "";
        }

        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();

        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const seconds = String(date.getSeconds()).padStart(2, "0");

        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    },

    formatNivelRiesgoTexto(value: string | null | undefined): string {
        return formatEnumText(value);
    },

    formatNivelRiesgoState(value: string | null | undefined): string {
        switch (String(value || "").toUpperCase()) {
            case "ALTO":
                return "Error";
            case "MODERADO":
            case "MEDIO":
            case "BAJO_MODERADO":
                return "Warning";
            case "BAJO":
                return "Success";
            default:
                return "None";
        }
    },

    formatDecisionTexto(value: string | null | undefined): string {
        return formatEnumText(value);
    },

    formatDecisionState(value: string | null | undefined): string {
        switch (String(value || "").toUpperCase()) {
            case "NO_RECOMENDADO":
                return "Error";
            case "OBSERVAR":
                return "Warning";
            case "APROBADO":
                return "Success";
            default:
                return "None";
        }
    },

    formatTipoCruceTexto(lineaNombre: string | null | undefined): string {
        return lineaNombre === "Cruce abierto" ? "Cruce abierto" : "Por linaje";
    },

    formatTipoCruceState(lineaNombre: string | null | undefined): string {
        return lineaNombre === "Cruce abierto" ? "Information" : "Success";
    },

    formatTipoFormacionCruceTexto(value: string | null | undefined, lineaNombre?: string | null): string {
        const key = String(value || "").toUpperCase();
        const labels: Record<string, string> = {
            CRUCE_ABIERTO: "Cruce abierto",
            CRUCE_POR_LINAJE: "Cruce por linaje",
            LINEBREEDING: "Linebreeding",
            INBREEDING: "Inbreeding",
            OUTCROSS: "Outcross",
            BACKCROSS: "Backcross",
        };

        if (labels[key]) {
            return labels[key];
        }

        return lineaNombre === "Cruce abierto" ? "Cruce abierto" : (lineaNombre ? "Por linaje" : formatEnumText(value));
    },

    formatTipoFormacionCruceState(value: string | null | undefined, lineaNombre?: string | null): string {
        switch (String(value || "").toUpperCase()) {
            case "INBREEDING":
                return "Error";
            case "LINEBREEDING":
            case "BACKCROSS":
                return "Warning";
            case "CRUCE_POR_LINAJE":
                return "Success";
            case "OUTCROSS":
            case "CRUCE_ABIERTO":
                return "Information";
            default:
                return lineaNombre ? (lineaNombre === "Cruce abierto" ? "Information" : "Success") : "None";
        }
    },

    formatAveNombre(nombre: string | null | undefined, apodo: string | null | undefined): string {
        const partes = [nombre, apodo ? `"${apodo}"` : ""]
            .map((valor) => String(valor || "").trim())
            .filter(Boolean);

        return partes.join(" ");
    },

    formatEstadoAveState(value: string | null | undefined): string {
        const estado = String(value || "").trim().toUpperCase();

        switch (estado) {
            case "ACTIVO":
            case "ACTIVA":
            case "REGISTRADA_ADULTA":
                return "Success";
            case "FALLECIDO":
            case "FALLECIDA":
            case "ELIMINADO":
                return "Error";
            case "VENDIDO":
            case "OBSEQUIADO":
                return "Warning";
            case "PRESTADO":
            case "RETIRADO":
                return "Information";
            default:
                return "Information";
        }
    },

    formatEstadoAveText(value: string | null | undefined): string {
        if (!value) {
            return "-";
        }

        const estado = String(value).trim().toUpperCase();
        const labels: Record<string, string> = {
            ACTIVO: "Activo",
            ACTIVA: "Activa",
            FALLECIDO: "Fallecido",
            FALLECIDA: "Fallecida",
            VENDIDO: "Vendido",
            PRESTADO: "Prestado",
            RETIRADO: "Retirado",
            REGISTRADA_ADULTA: "Registrada adulta",
            OBSEQUIADO: "Obsequiado",
            ELIMINADO: "Eliminado",
            ENTRENAMIENTO: "En entrenamiento",
            COMPETENCIA: "En competencia",
        };

        return labels[estado] || formatEnumText(value);
    }
};
