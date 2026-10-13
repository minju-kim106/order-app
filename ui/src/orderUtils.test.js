import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateCartTotal,
  getNextOrderStatus,
  getStockStatus,
  summarizeOrders,
} from './orderUtils.js'

test('summarizes all orders by current status', () => {
  assert.deepEqual(
    summarizeOrders([
      { status: '주문 접수' },
      { status: '제조 중' },
      { status: '제조 완료' },
      { status: 'unexpected' },
    ]),
    { total: 4, received: 1, making: 1, complete: 1 },
  )
})

test('maps inventory quantities to the configured stock thresholds', () => {
  assert.deepEqual(getStockStatus(0), { key: 'soldout', label: '품절' })
  assert.deepEqual(getStockStatus(4), { key: 'warning', label: '주의' })
  assert.deepEqual(getStockStatus(5), { key: 'normal', label: '정상' })
})

test('advances orders only through the supported status sequence', () => {
  assert.equal(getNextOrderStatus('주문 접수'), '제조 중')
  assert.equal(getNextOrderStatus('제조 중'), '제조 완료')
  assert.equal(getNextOrderStatus('제조 완료'), '제조 완료')
  assert.equal(getNextOrderStatus('unexpected'), 'unexpected')
})

test('calculates cart totals using each selected item price and quantity', () => {
  assert.equal(
    calculateCartTotal([
      { unitPrice: 4500, quantity: 2 },
      { unitPrice: 5000, quantity: 1 },
    ]),
    14000,
  )
})
