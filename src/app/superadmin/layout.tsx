import SuperadminShell from "@/components/superadmin/SuperadminShell";
import { vfFontVars } from "@/fonts";
import "./superadmin.css";

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`sa ${vfFontVars}`}>
      <SuperadminShell>{children}</SuperadminShell>
    </div>
  );
}
