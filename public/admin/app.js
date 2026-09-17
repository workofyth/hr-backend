// Admin Dashboard — HTML/CSS/JS vanilla, tanpa build tooling (§2
// backend-architecture-hr.md). Murni consumer REST API yang sama dengan
// aplikasi mobile — TIDAK ada logika bisnis di sini, hanya panggil endpoint
// & render hasilnya.
//
// Catatan keamanan: token disimpan di sessionStorage demi kesederhanaan
// (MVP internal tool). Untuk produksi/hardening lebih lanjut, pertimbangkan
// menyimpan refresh token di httpOnly cookie agar tidak terjangkau JS/XSS.

const API_BASE = '/api/v1';
const SESSION_KEY = 'hr_admin_session';
const ADMIN_ROLES = ['SUPER_ADMIN', 'HR_ADMIN'];

const state = {
  accessToken: null,
  refreshToken: null,
  user: null,
  page: 1,
  limit: 10,
  totalPages: 1,
  companies: [],
  editingEmployeeId: null,
};

// ---------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------
function saveSession() {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    );
  } catch {
    // sessionStorage bisa gagal (private browsing dsb) — sesi tetap jalan
    // di memori untuk tab ini, cuma tidak bertahan lewat refresh halaman.
  }
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    state.accessToken = parsed.accessToken;
    state.refreshToken = parsed.refreshToken;
    state.user = parsed.user;
    return Boolean(state.accessToken);
  } catch {
    return false;
  }
}

function clearSession() {
  state.accessToken = null;
  state.refreshToken = null;
  state.user = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* noop */
  }
}

// ---------------------------------------------------------------------
// API helper — semua request lewat sini supaya handling token/refresh/
// error format konsisten di satu tempat (bukan diulang di tiap fitur).
// ---------------------------------------------------------------------
async function apiFetch(path, options = {}, allowRetry = true) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.accessToken) {
    headers.Authorization = `Bearer ${state.accessToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));

  if (response.status === 401 && allowRetry && state.refreshToken) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return apiFetch(path, options, false);
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      logout();
    }
    const error = new Error(body.message || 'Terjadi kesalahan');
    error.errorCode = body.errorCode;
    error.details = body.details;
    error.status = response.status;
    throw error;
  }

  // Kembalikan seluruh amplop response ({ success, data, message, meta })
  // supaya caller yang butuh `meta` (mis. pagination) tetap bisa akses,
  // bukan cuma `data`.
  return body;
}

async function tryRefreshToken() {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: state.refreshToken }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return false;

    state.accessToken = body.data.accessToken;
    state.refreshToken = body.data.refreshToken;
    saveSession();
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------
const loginForm = document.getElementById('login-form');
const loginAlert = document.getElementById('login-alert');
const loginSubmitBtn = document.getElementById('login-submit');

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginAlert.hidden = true;
  loginSubmitBtn.disabled = true;

  try {
    const { data } = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        emailOrPhone: document.getElementById('login-identifier').value.trim(),
        password: document.getElementById('login-password').value,
      }),
    });
    state.accessToken = data.accessToken;
    state.refreshToken = data.refreshToken;
    state.user = data.user;
    saveSession();
    await enterDashboard();
  } catch (error) {
    loginAlert.textContent = error.message;
    loginAlert.hidden = false;
  } finally {
    loginSubmitBtn.disabled = false;
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  logout();
});

function logout() {
  clearSession();
  document.getElementById('dashboard-view').hidden = true;
  document.getElementById('login-view').hidden = false;
  document.getElementById('login-password').value = '';
}

async function enterDashboard() {
  document.getElementById('login-view').hidden = true;
  document.getElementById('dashboard-view').hidden = false;

  document.getElementById('current-user-email').textContent = state.user.email;
  document.getElementById('current-user-role').textContent = state.user.role;

  const isAdmin = ADMIN_ROLES.includes(state.user.role);
  document.getElementById('employee-add-btn').hidden = !isAdmin;

  await loadCompanies();
  await loadEmployees(1);
}

// ---------------------------------------------------------------------
// Data referensi organisasi (dropdown)
// ---------------------------------------------------------------------
async function loadCompanies() {
  const { data } = await apiFetch('/companies');
  state.companies = data;
  const select = document.getElementById('f-company');
  select.innerHTML = state.companies
    .map((company) => `<option value="${company.id}">${escapeHtml(company.name)}</option>`)
    .join('');
}

async function loadBranchDeptPosition(companyId, selected = {}) {
  const [branches, departments, positions] = await Promise.all([
    apiFetch(`/branches?companyId=${companyId}`),
    apiFetch(`/departments?companyId=${companyId}`),
    apiFetch(`/positions?companyId=${companyId}`),
  ]);

  fillSelect('f-branch', branches.data, 'name', selected.branchId);
  fillSelect('f-department', departments.data, 'name', selected.departmentId);
  fillSelect('f-position', positions.data, 'title', selected.positionId);
}

function fillSelect(id, items, labelField, selectedId) {
  const select = document.getElementById(id);
  select.innerHTML = items
    .map((item) => `<option value="${item.id}">${escapeHtml(item[labelField])}</option>`)
    .join('');
  if (selectedId) select.value = selectedId;
}

document.getElementById('f-company').addEventListener('change', (event) => {
  if (event.target.value) loadBranchDeptPosition(event.target.value);
});

// ---------------------------------------------------------------------
// Daftar karyawan
// ---------------------------------------------------------------------
const tableBody = document.getElementById('employee-table-body');
const emptyState = document.getElementById('employee-empty');
const listAlert = document.getElementById('employee-list-alert');

async function loadEmployees(page) {
  listAlert.hidden = true;
  renderSkeletonRows();

  try {
    const { data, meta } = await apiFetch(`/employees?page=${page}&limit=${state.limit}`);
    state.page = meta.page;
    state.totalPages = meta.totalPages;
    renderEmployeeTable(data);
    renderPagination();
  } catch (error) {
    tableBody.innerHTML = '';
    listAlert.textContent = error.message;
    listAlert.hidden = false;
  }
}

function renderPagination() {
  document.getElementById('page-info').textContent = `Halaman ${state.page} dari ${state.totalPages}`;
  document.getElementById('page-prev').disabled = state.page <= 1;
  document.getElementById('page-next').disabled = state.page >= state.totalPages;
}

function renderSkeletonRows() {
  tableBody.innerHTML = Array.from({ length: 5 })
    .map(
      () => `<tr>${Array.from({ length: 8 })
        .map(() => '<td><div class="skeleton"></div></td>')
        .join('')}</tr>`,
    )
    .join('');
  emptyState.hidden = true;
}

function renderEmployeeTable(items) {
  if (!items.length) {
    tableBody.innerHTML = '';
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  const isAdmin = ADMIN_ROLES.includes(state.user.role);

  tableBody.innerHTML = items
    .map((employee) => {
      const statusClass = employee.status.toLowerCase();
      const actions = isAdmin
        ? `<button type="button" class="btn-icon" data-action="edit" data-id="${employee.id}" title="Edit"><i class="ph ph-pencil-simple"></i></button>
           <button type="button" class="btn-icon danger" data-action="delete" data-id="${employee.id}" title="Hapus"><i class="ph ph-trash"></i></button>`
        : '';

      return `<tr>
        <td>${escapeHtml(employee.employeeCode)}</td>
        <td>${escapeHtml(employee.fullName)}</td>
        <td>${escapeHtml(employee.branch?.name ?? '-')}</td>
        <td>${escapeHtml(employee.department?.name ?? '-')}</td>
        <td>${escapeHtml(employee.position?.title ?? '-')}</td>
        <td>${escapeHtml(employee.employmentType)}</td>
        <td><span class="status-pill ${statusClass}">${escapeHtml(employee.status)}</span></td>
        <td>${actions}</td>
      </tr>`;
    })
    .join('');

  tableBody.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => openEditForm(items.find((e) => e.id === btn.dataset.id)));
  });
  tableBody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => handleDelete(btn.dataset.id));
  });
}

document.getElementById('page-prev').addEventListener('click', () => {
  if (state.page > 1) loadEmployees(state.page - 1);
});
document.getElementById('page-next').addEventListener('click', () => {
  loadEmployees(state.page + 1);
});

async function handleDelete(id) {
  if (!confirm('Hapus karyawan ini? Data akan di-soft-delete (bisa dipulihkan lewat database bila perlu).')) {
    return;
  }
  try {
    await apiFetch(`/employees/${id}`, { method: 'DELETE' });
    await loadEmployees(state.page);
  } catch (error) {
    listAlert.textContent = error.message;
    listAlert.hidden = false;
  }
}

// ---------------------------------------------------------------------
// Form create/edit
// ---------------------------------------------------------------------
const formCard = document.getElementById('employee-form-card');
const employeeForm = document.getElementById('employee-form');
const formAlert = document.getElementById('employee-form-alert');
const formTitle = document.getElementById('employee-form-title');

document.getElementById('employee-add-btn').addEventListener('click', openCreateForm);
document.getElementById('employee-form-close').addEventListener('click', closeForm);
document.getElementById('employee-form-cancel').addEventListener('click', closeForm);

function toggleFormMode(isEdit) {
  document.querySelectorAll('[data-create-only]').forEach((el) => {
    el.hidden = isEdit;
    el.querySelectorAll('input,select').forEach((input) => (input.required = !isEdit && input.dataset.alwaysRequired !== 'false'));
  });
  document.querySelectorAll('[data-edit-only]').forEach((el) => {
    el.hidden = !isEdit;
  });
}

async function openCreateForm() {
  state.editingEmployeeId = null;
  formTitle.textContent = 'Tambah Karyawan';
  employeeForm.reset();
  toggleFormMode(false);
  formAlert.hidden = true;
  formCard.hidden = false;

  const firstCompanyId = document.getElementById('f-company').value;
  if (firstCompanyId) await loadBranchDeptPosition(firstCompanyId);
  formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function openEditForm(employee) {
  if (!employee) return;
  state.editingEmployeeId = employee.id;
  formTitle.textContent = `Edit Karyawan — ${employee.fullName}`;
  employeeForm.reset();
  toggleFormMode(true);
  formAlert.hidden = true;
  formCard.hidden = false;

  await loadBranchDeptPosition(employee.company.id, {
    branchId: employee.branch.id,
    departmentId: employee.department.id,
    positionId: employee.position.id,
  });

  document.getElementById('f-full-name').value = employee.fullName;
  document.getElementById('f-nik').value = employee.nik;
  document.getElementById('f-npwp').value = employee.npwp ?? '';
  document.getElementById('f-bank-name').value = employee.bankName;
  document.getElementById('f-bank-account').value = employee.bankAccountNo;
  document.getElementById('f-employment-type').value = employee.employmentType;
  document.getElementById('f-marital-status').value = employee.maritalStatus;
  document.getElementById('f-dependents-count').value = employee.dependentsCount;
  document.getElementById('f-status').value = employee.status;
  document.getElementById('f-resign-date').value = employee.resignDate ?? '';

  formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeForm() {
  formCard.hidden = true;
  state.editingEmployeeId = null;
}

employeeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  formAlert.hidden = true;

  const isEdit = Boolean(state.editingEmployeeId);
  const submitBtn = document.getElementById('employee-form-submit');
  submitBtn.disabled = true;

  try {
    if (isEdit) {
      const payload = {
        fullName: document.getElementById('f-full-name').value,
        branchId: document.getElementById('f-branch').value,
        departmentId: document.getElementById('f-department').value,
        positionId: document.getElementById('f-position').value,
        nik: document.getElementById('f-nik').value,
        npwp: document.getElementById('f-npwp').value || undefined,
        bankName: document.getElementById('f-bank-name').value,
        bankAccountNo: document.getElementById('f-bank-account').value,
        employmentType: document.getElementById('f-employment-type').value,
        maritalStatus: document.getElementById('f-marital-status').value,
        dependentsCount: Number(document.getElementById('f-dependents-count').value || 0),
        status: document.getElementById('f-status').value,
        resignDate: document.getElementById('f-resign-date').value || undefined,
      };
      await apiFetch(`/employees/${state.editingEmployeeId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      const payload = {
        email: document.getElementById('f-email').value,
        phone: document.getElementById('f-phone').value,
        password: document.getElementById('f-password').value,
        role: document.getElementById('f-role').value,
        employeeCode: document.getElementById('f-employee-code').value,
        fullName: document.getElementById('f-full-name').value,
        companyId: document.getElementById('f-company').value,
        branchId: document.getElementById('f-branch').value,
        departmentId: document.getElementById('f-department').value,
        positionId: document.getElementById('f-position').value,
        nik: document.getElementById('f-nik').value,
        npwp: document.getElementById('f-npwp').value || undefined,
        bankAccountNo: document.getElementById('f-bank-account').value,
        bankName: document.getElementById('f-bank-name').value,
        employmentType: document.getElementById('f-employment-type').value,
        joinDate: document.getElementById('f-join-date').value,
        maritalStatus: document.getElementById('f-marital-status').value,
        dependentsCount: Number(document.getElementById('f-dependents-count').value || 0),
      };
      await apiFetch('/employees', { method: 'POST', body: JSON.stringify(payload) });
    }

    closeForm();
    await loadEmployees(state.page);
  } catch (error) {
    formAlert.innerHTML = `${escapeHtml(error.message)}${
      error.details?.errors ? `<ul>${error.details.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>` : ''
    }`;
    formAlert.hidden = false;
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------
(async function init() {
  if (loadSession()) {
    try {
      await enterDashboard();
    } catch {
      logout();
    }
  }
})();
