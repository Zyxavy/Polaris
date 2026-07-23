type ToastType = 'error' | 'info' | 'success';

type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
};

class ToastStore {
  items = $state<ToastItem[]>([]);

  push(item: { type: ToastType; message: string }) {
    const id = crypto.randomUUID();
    this.items = [...this.items, { id, ...item }];
    setTimeout(() => {
      this.items = this.items.filter(i => i.id !== id);
    }, 4000);
  }

  dismiss(id: string) {
    this.items = this.items.filter(i => i.id !== id);
  }
}

export const toastStore = new ToastStore();
