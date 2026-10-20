async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const data = await response.json()
  if (!response.ok) {
    const error = new Error(data.error ?? '요청을 처리하지 못했습니다.')
    error.status = response.status
    error.details = data
    throw error
  }
  return data
}

export function getMenus() {
  return request('/menus')
}

export function getAdminMenus() {
  return request('/admin/menus')
}

export function getAdminOrders() {
  return request('/admin/orders')
}

export function createOrder(items) {
  return request('/orders', {
    method: 'POST',
    body: JSON.stringify({ items }),
  })
}

export function updateMenuStock(menuId, change) {
  return request(`/admin/menus/${menuId}/stock`, {
    method: 'PATCH',
    body: JSON.stringify({ change }),
  })
}

export function updateOrderStatus(orderId, status) {
  return request(`/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}
