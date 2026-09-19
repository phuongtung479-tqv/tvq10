import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearSupabaseAccessToken,
  getSupabaseAccessToken,
  signInWithSupabase,
  type SupabaseSignInResult,
} from "@/lib/supabase-auth";
import { syncPendingLocalAdminData } from "@/services/dataAdapter";

export type AdminModalKey =
  | "editor"
  | "fomo"
  | "exitintent"
  | "analytics"
  | "pages"
  | "abtest"
  | "email"
  | "webhook"
  | "theme"
  | "guide"
  | "leads"
  | "webmaster"
  | "pixel"
  | "cron"
  | "storage"
  | "seo"
  | "form"
  | "ai"
  | "salesadvice"
  | "contact"
  | "countdown"
  | "adminlink"
  | "utm";

const AUTH_KEY = "funnel_admin_authed_v1";

export type DeviceView = "mobile" | "tablet" | "desktop";
export type DeviceSize = { width: number; height: number };

export const DEFAULT_DEVICE_SIZES: Record<DeviceView, DeviceSize> = {
  mobile: { width: 375, height: 780 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 780 },
};

interface AdminContextValue {
  authed: boolean;
  login: (
    password: string,
    expected: string,
    supabaseUrl?: string,
    supabaseAnonKey?: string,
    supabaseAdminEmail?: string,
  ) => Promise<SupabaseSignInResult>;
  logout: () => void;
  activeModal: AdminModalKey | null;
  openModal: (key: AdminModalKey) => void;
  closeModal: () => void;
  device: DeviceView;
  setDevice: (d: DeviceView) => void;
  deviceSizes: Record<DeviceView, DeviceSize>;
  setDeviceSize: (device: DeviceView, size: DeviceSize) => void;
  resetDeviceSizes: () => void;
  previewEnabled: boolean;
  setPreviewEnabled: (enabled: boolean) => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [activeModal, setActiveModal] = useState<AdminModalKey | null>(null);
  const [device, setDevice] = useState<DeviceView>("desktop");
  const [deviceSizes, setDeviceSizes] =
    useState<Record<DeviceView, DeviceSize>>(DEFAULT_DEVICE_SIZES);
  const [previewEnabled, setPreviewEnabledState] = useState(true);

  useEffect(() => {
    try {
      setAuthed(
        window.sessionStorage.getItem(AUTH_KEY) === "1" &&
          Boolean(getSupabaseAccessToken()),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const setDeviceSize = useCallback((view: DeviceView, size: DeviceSize) => {
    setDeviceSizes((current) => ({ ...current, [view]: size }));
  }, []);

  const resetDeviceSizes = useCallback(() => {
    setDeviceSizes(DEFAULT_DEVICE_SIZES);
  }, []);

  const setPreviewEnabled = useCallback((enabled: boolean) => {
    setPreviewEnabledState(enabled);
  }, []);

  const login = useCallback(
    async (
      password: string,
      _expected: string,
      supabaseUrl = "",
      supabaseAnonKey = "",
      supabaseAdminEmail = "",
    ) => {
      const env = import.meta.env as Record<string, string | undefined>;
      const email =
        supabaseAdminEmail.trim() ||
        env["VITE_SUPABASE_ADMIN_EMAIL"]?.trim() ||
        "";
      const cloudLogin: SupabaseSignInResult = await signInWithSupabase(
        supabaseUrl,
        supabaseAnonKey,
        email,
        password,
      );
      if (!cloudLogin.ok) return cloudLogin;
      setAuthed(true);
      try {
        window.sessionStorage.setItem(AUTH_KEY, "1");
      } catch {
        /* ignore */
      }
      try {
        await syncPendingLocalAdminData();
      } catch {
        /* best effort */
      }
      return { ok: true };
    },
    [],
  );

  const logout = useCallback(() => {
    setAuthed(false);
    setActiveModal(null);
    try {
      window.sessionStorage.removeItem(AUTH_KEY);
      clearSupabaseAccessToken();
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      authed,
      login,
      logout,
      activeModal,
      openModal: (key: AdminModalKey) => setActiveModal(key),
      closeModal: () => setActiveModal(null),
      device,
      setDevice,
      deviceSizes,
      setDeviceSize,
      resetDeviceSizes,
      previewEnabled,
      setPreviewEnabled,
    }),
    [
      authed,
      login,
      logout,
      activeModal,
      device,
      deviceSizes,
      setDeviceSize,
      resetDeviceSizes,
      previewEnabled,
      setPreviewEnabled,
    ],
  );

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
