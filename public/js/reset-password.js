document.getElementById('reset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const statusMsg = document.getElementById('status-message');
    const btn = e.target.querySelector('button');

    // Get token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        statusMsg.classList.remove('hidden');
        statusMsg.classList.add('bg-red-900/20', 'border-red-900/50', 'text-red-400');
        statusMsg.textContent = 'Invalid or missing token.';
        return;
    }

    if (newPassword !== confirmPassword) {
        statusMsg.classList.remove('hidden');
        statusMsg.classList.add('bg-red-900/20', 'border-red-900/50', 'text-red-400');
        statusMsg.textContent = 'Passwords do not match.';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="flex items-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Resetting...</span>';
    lucide.createIcons();

    try {
        const res = await fetch('/api/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword })
        });

        const data = await res.json();

        statusMsg.classList.remove('hidden', 'bg-red-900/20', 'border-red-900/50', 'text-red-400', 'bg-green-900/20', 'border-green-900/50', 'text-green-400');

        if (res.ok) {
            statusMsg.classList.add('bg-green-900/20', 'border-green-900/50', 'text-green-400');
            statusMsg.textContent = data.message;
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 3000);
        } else {
            statusMsg.classList.add('bg-red-900/20', 'border-red-900/50', 'text-red-400');
            statusMsg.textContent = data.error || 'Failed to reset password.';
        }
    } catch (err) {
        statusMsg.classList.remove('hidden');
        statusMsg.classList.add('bg-red-900/20', 'border-red-900/50', 'text-red-400');
        statusMsg.textContent = 'Connection error. Please try again later.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Reset Password';
    }
});
