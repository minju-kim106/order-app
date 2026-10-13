export function summarizeOrders(orders) {
  return orders.reduce(
    (summary, order) => {
      summary.total += 1
      if (order.status === '주문 접수') summary.received += 1
      if (order.status === '제조 중') summary.making += 1
      if (order.status === '제조 완료') summary.complete += 1
      return summary
    },
    { total: 0, received: 0, making: 0, complete: 0 },
  )
}

export function getStockStatus(quantity) {
  if (quantity === 0) return { key: 'soldout', label: '품절' }
  if (quantity < 5) return { key: 'warning', label: '주의' }
  return { key: 'normal', label: '정상' }
}

export function getNextOrderStatus(status) {
  if (status === '주문 접수') return '제조 중'
  if (status === '제조 중') return '제조 완료'
  return status
}

export function calculateCartTotal(items) {
  return items.reduce(
    (total, item) => total + item.unitPrice * item.quantity,
    0,
  )
}
