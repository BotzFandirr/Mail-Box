(function () {
  const flash = window.APP_FLASH;

  if (flash?.text) {
    const toastContainer = document.getElementById('toastContainer');
    const colorMap = {
      success: 'text-bg-success',
      warning: 'text-bg-warning',
      danger: 'text-bg-danger',
      info: 'text-bg-info'
    };

    const wrapper = document.createElement('div');
    wrapper.className = `toast align-items-center border-0 ${colorMap[flash.type] || 'text-bg-primary'}`;
    wrapper.role = 'alert';
    wrapper.innerHTML = `
      <div class="d-flex">
        <div class="toast-body fw-semibold">${flash.text}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    `;

    toastContainer.appendChild(wrapper);
    const toast = new bootstrap.Toast(wrapper, { delay: 3200 });
    toast.show();
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
