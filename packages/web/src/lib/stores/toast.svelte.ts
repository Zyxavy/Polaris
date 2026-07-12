class ToastStore {
    items = $state<{ id: string; type: 'error' | 'info'; message: string }[]>([]);

    push(item: { type: 'error' | 'info'; message: string }) {
        const id = crypto.randomUUID();
        this.items = [...this.items, { id, ...item }];
        setTimeout(() => {
            this.items = this.items.filter(i => i.id !== id);
        }, 4000);
    }
}

export const toastStore = new ToastStore();