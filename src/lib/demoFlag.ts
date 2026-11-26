/** True only in builds made with VITE_DEMO=true. A literal after build, so dead branches drop out. */
export const DEMO = import.meta.env.VITE_DEMO === "true";
