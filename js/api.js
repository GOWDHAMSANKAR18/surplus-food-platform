const API_BASE = '';

function getToken() {
  return localStorage.getItem('token');
}

function setToken(token) {
  localStorage.setItem('token', token);
}

function clearToken() {
  localStorage.removeItem('token');
}

async function request(path, options = {}) {
  const headers = {
    ...(options.headers || {})
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body instanceof FormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined)
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || 'An error occurred during request execution');
  }

  return payload;
}

export async function signup(data) {
  return request('/api/auth/signup', {
    method: 'POST',
    body: data
  });
}

export async function login(email, password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: { email, password }
  });
}

export async function getCurrentUser() {
  return request('/api/auth/me');
}

export async function getImpactStats() {
  return request('/api/impact');
}

export async function getRecentCompleted() {
  return request('/api/dashboard/recent');
}

export async function getCityStats() {
  return request('/api/dashboard/cities');
}

export async function createListing(data) {
  return request('/api/donor/listings', {
    method: 'POST',
    body: data
  });
}

export async function getDonorListings() {
  return request('/api/donor/listings');
}

export async function getDonorRequests() {
  return request('/api/donor/requests');
}

export async function approveRequest(requestId) {
  return request(`/api/requests/${requestId}/approve`, {
    method: 'POST'
  });
}

export async function getDonorImpact() {
  return request('/api/donor/impact');
}

export async function getNGOAvailableListings() {
  return request('/api/ngo/listings');
}

export async function submitPickupRequest(listingId, data) {
  return request(`/api/listings/${listingId}/requests`, {
    method: 'POST',
    body: data
  });
}

export async function acceptListing(listingId) {
  return request(`/api/listings/${listingId}/accept`, {
    method: 'POST'
  });
}

export async function cancelListing(listingId, reason = '') {
  return request(`/api/donor/listings/${listingId}/cancel`, {
    method: 'PATCH',
    body: { reason }
  });
}

export async function completeListing(listingId, podData = {}) {
  return request(`/api/listings/${listingId}/complete`, {
    method: 'POST',
    body: podData
  });
}

export async function getNGOAcceptedListings() {
  return request('/api/ngo/accepted');
}

export async function getNGOImpact() {
  return request('/api/ngo/impact');
}

export async function getVolunteerListings() {
  return request('/api/volunteer/listings');
}

export async function getVolunteerAcceptedListings() {
  return request('/api/volunteer/accepted');
}

export async function getVolunteerImpact() {
  return request('/api/volunteer/impact');
}

// S3 Secure File Upload & Integrity Methods
export async function uploadListingFile(listingId, file) {
  const formData = new FormData();
  formData.append('file', file);
  return request(`/api/listings/${listingId}/files`, {
    method: 'POST',
    body: formData
  });
}

export async function getListingFiles(listingId) {
  return request(`/api/listings/${listingId}/files`);
}

export async function getFileDownloadUrl(fileId) {
  return request(`/api/files/${fileId}/download`);
}

export async function verifyFileIntegrity(fileId) {
  return request(`/api/files/${fileId}/verify`);
}

export async function getHealthStatus() {
  return request('/api/health');
}

export async function getAuditLogs() {
  return request('/api/audit-logs');
}

export async function getAdminUsers() {
  return request('/api/admin/users');
}

export async function getAdminOverview() {
  return request('/api/admin/overview');
}

export { setToken, clearToken };
