import { AlertTriangle } from "lucide-react";

export default function AnomaliesPage() {
  return (
    <div className="admin-card py-16 text-center">
      <AlertTriangle className="mx-auto mb-3 text-muted-foreground" size={32} />
      <h2 className="text-lg font-semibold text-foreground">Cảnh báo bất thường</h2>
      <p className="text-muted-foreground text-sm mt-1">Đang được xây dựng.</p>
    </div>
  );
}
