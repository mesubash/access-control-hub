/** Product name in the sidebar and page titles. Set VITE_APP_NAME to rebrand. */
export const APP_NAME: string = import.meta.env.VITE_APP_NAME || "Access Control";

/** Page title helper: "Roles · Access Control". */
export const pageTitle = (page?: string) => (page ? `${page} · ${APP_NAME}` : APP_NAME);
