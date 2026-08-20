import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { NewPaymentRequestPage } from "./pages/NewPaymentRequestPage";
import { PaymentRequestDetailPage } from "./pages/PaymentRequestDetailPage";
import { SigningQueuePage } from "./pages/SigningQueuePage";
import { TreasuryHealthPage } from "./pages/TreasuryHealthPage";
import { AuditLogPage } from "./pages/AuditLogPage";
import { AdminTreasuryConfigPage } from "./pages/AdminTreasuryConfigPage";
import { LoginPage } from "./pages/LoginPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route index element={<DashboardPage />} />
            <Route path="requests/new" element={<NewPaymentRequestPage />} />
            <Route path="requests/:id" element={<PaymentRequestDetailPage />} />
            <Route path="signing-queue" element={<SigningQueuePage />} />
            <Route path="treasury" element={<TreasuryHealthPage />} />
            <Route path="admin/treasury" element={<AdminTreasuryConfigPage />} />
            <Route path="audit" element={<AuditLogPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
