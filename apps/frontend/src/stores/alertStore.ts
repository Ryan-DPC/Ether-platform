import { defineStore } from 'pinia';
import { ref } from 'vue';

export type AlertType = 'success' | 'error' | 'info' | 'warning';

export interface AlertOptions {
  title: string;
  message: string;
  type?: AlertType;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

export const useAlertStore = defineStore('alert', () => {
  const isVisible = ref(false);
  const options = ref<AlertOptions>({
    title: '',
    message: '',
    type: 'info',
    confirmText: 'OK',
    cancelText: 'Annuler',
    showCancel: false,
  });

  let resolvePromise: ((value: boolean) => void) | null = null;

  const showAlert = (opts: AlertOptions) => {
    options.value = {
      ...opts,
      type: opts.type || 'info',
      confirmText: opts.confirmText || 'OK',
      showCancel: false,
    };
    isVisible.value = true;
    return new Promise<boolean>((resolve) => {
      resolvePromise = resolve;
    });
  };

  const showConfirm = (opts: AlertOptions) => {
    options.value = {
      ...opts,
      type: opts.type || 'warning',
      confirmText: opts.confirmText || 'Confirmer',
      cancelText: opts.cancelText || 'Annuler',
      showCancel: true,
    };
    isVisible.value = true;
    return new Promise<boolean>((resolve) => {
      resolvePromise = resolve;
    });
  };

  const handleConfirm = () => {
    isVisible.value = false;
    if (resolvePromise) {
      resolvePromise(true);
      resolvePromise = null;
    }
  };

  const handleCancel = () => {
    isVisible.value = false;
    if (resolvePromise) {
      resolvePromise(false);
      resolvePromise = null;
    }
  };

  return {
    isVisible,
    options,
    showAlert,
    showConfirm,
    handleConfirm,
    handleCancel,
  };
});
