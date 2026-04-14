(function () {
  const flash = window.APP_FLASH;

  function showToast(type, text) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const colorMap = {
      success: 'text-bg-success',
      warning: 'text-bg-warning',
      danger: 'text-bg-danger',
      info: 'text-bg-info',
      primary: 'text-bg-primary'
    };

    const wrapper = document.createElement('div');
    wrapper.className = `toast align-items-center border-0 ${colorMap[type] || 'text-bg-primary'}`;
    wrapper.role = 'alert';
    wrapper.innerHTML = `
      <div class="d-flex">
        <div class="toast-body fw-semibold">${text}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    `;

    toastContainer.appendChild(wrapper);
    const toast = new bootstrap.Toast(wrapper, { delay: 3500 });
    toast.show();
  }

  if (flash?.text) {
    showToast(flash.type, flash.text);
  }

  if (window.io && window.CURRENT_MAILBOX) {
    const socket = io();
    socket.emit('mailbox:watch', window.CURRENT_MAILBOX);

    socket.on('mailbox:update', (payload) => {
      showToast('info', payload?.title || 'Mailbox diperbarui');

      if (payload?.text) {
        setTimeout(() => showToast('primary', payload.text), 300);
      }

      setTimeout(() => {
        if (window.location.pathname !== '/compose') {
          window.location.reload();
        }
      }, 1200);
    });
  }

  document.querySelectorAll('.js-confirm').forEach((button) => {
    button.addEventListener('click', function (event) {
      event.preventDefault();
      const form = this.closest('form');

      Swal.fire({
        icon: 'question',
        title: this.dataset.title || 'Yakin?',
        text: this.dataset.text || 'Lanjutkan aksi ini?',
        showCancelButton: true,
        confirmButtonText: 'Ya, lanjutkan',
        cancelButtonText: 'Batal',
        reverseButtons: true
      }).then((result) => {
        if (result.isConfirmed) {
          form.submit();
        }
      });
    });
  });
})();
