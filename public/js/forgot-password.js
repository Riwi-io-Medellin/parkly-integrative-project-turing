document.getElementById('forgot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const btn = e.target.querySelector('button');
    const statusMsg = document.getElementById('status-message');

    btn.disabled = true;
    btn.innerHTML = '<span class="flex items-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Sending...</span>';
    lucide.createIcons();

    try {
        const res = await fetch('/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await res.json();

        statusMsg.classList.remove('hidden', 'bg-red-900/20', 'border-red-900/50', 'text-red-400', 'bg-green-900/20', 'border-green-900/50', 'text-green-400');

        if (res.ok) {
            statusMsg.classList.add('bg-green-900/20', 'border-green-900/50', 'text-green-400');
            statusMsg.textContent = data.message;
            e.target.reset();
        } else {
            statusMsg.classList.add('bg-red-900/20', 'border-red-900/50', 'text-red-400');
            statusMsg.textContent = data.error || 'Something went wrong.';
        }
    } catch (err) {
        statusMsg.classList.remove('hidden');
        statusMsg.classList.add('bg-red-900/20', 'border-red-900/50', 'text-red-400');
        statusMsg.textContent = 'Connection error. Please try again later.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Send Reset Link';
    }
});
