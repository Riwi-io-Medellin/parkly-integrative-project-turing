// wrapper around SweetAlert2 so every page can just call Alerts.success() etc.
// reads CSS variables so the popups match the current theme automatically

const swalConfig = {
    background: 'hsl(var(--background))',
    color: 'hsl(var(--foreground))',
    confirmButtonColor: 'hsl(var(--primary))',
    cancelButtonColor: 'hsl(var(--muted, 220 13% 88%))',
    borderRadius: 'var(--radius)',
    customClass: {
        popup: 'rounded-2xl border border-border shadow-2xl',
        confirmButton: 'rounded-xl font-semibold',
        cancelButton: 'rounded-xl font-semibold text-foreground',
    }
};

window.Alerts = {
    success: (text, title = 'Success!') => {
        return Swal.fire({
            ...swalConfig,
            icon: 'success',
            title: title,
            text: text,
            confirmButtonText: 'Got it'
        });
    },

    error: (text, title = 'Error') => {
        return Swal.fire({
            ...swalConfig,
            icon: 'error',
            title: title,
            text: text,
            confirmButtonColor: 'hsl(var(--danger))',
            confirmButtonText: 'Ok'
        });
    },

    // small auto-dismiss notification in the top-right corner
    toast: (title, icon = 'success') => {
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            background: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
            customClass: {
                popup: 'rounded-xl border border-border shadow-lg mt-4 mr-4',
            },
            didOpen: (toast) => {
                toast.onmouseenter = Swal.stopTimer;
                toast.onmouseleave = Swal.resumeTimer;
            }
        });
        return Toast.fire({ icon, title });
    },

    // nicer replacement for the native confirm() — resolves to true/false
    confirm: async (text, title = 'Are you sure?', confirmText = 'Yes, continue', isDanger = false) => {
        const result = await Swal.fire({
            ...swalConfig,
            icon: 'warning',
            title: title,
            text: text,
            showCancelButton: true,
            confirmButtonColor: isDanger ? 'hsl(var(--danger))' : 'hsl(var(--primary))',
            cancelButtonColor: 'transparent',
            confirmButtonText: confirmText,
            cancelButtonText: 'Cancel',
            customClass: {
                ...swalConfig.customClass,
                cancelButton: 'rounded-xl font-semibold bg-input text-foreground hover:bg-border/50 border border-border'
            }
        });
        return result.isConfirmed;
    }
};
