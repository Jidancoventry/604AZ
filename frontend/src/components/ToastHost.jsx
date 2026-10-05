import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useStore } from '../context/StoreContext.jsx';

const icons = {
  success: CheckCircle2,
  error: TriangleAlert,
  info: Info
};

export default function ToastHost() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = icons[toast.type] || CheckCircle2;
        return (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <Icon size={19} />
            <span>{toast.message}</span>
            <button type="button" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
