import { useEffect, useState } from 'react'
import {
  calculateCartTotal,
  getNextOrderStatus,
  getStockStatus,
  summarizeOrders,
} from './orderUtils.js'
import './App.css'

const OPTIONS = [
  { id: 'shot', name: '샷 추가', price: 500 },
  { id: 'syrup', name: '시럽 추가', price: 0 },
]

const MENU = [
  {
    id: 'iced-americano',
    name: '아메리카노 (ICE)',
    price: 4000,
    description: '산뜻한 산미와 깔끔한 여운의 시그니처 블렌드',
    note: 'BEST',
    art: 'americano',
  },
  {
    id: 'hot-americano',
    name: '아메리카노 (HOT)',
    price: 4000,
    description: '고소한 향을 따뜻하게 즐기는 클래식 커피',
    note: 'CLASSIC',
    art: 'hot',
  },
  {
    id: 'cafe-latte',
    name: '카페라떼',
    price: 5000,
    description: '부드러운 우유와 에스프레소의 균형',
    note: 'MILK',
    art: 'latte',
  },
  {
    id: 'vanilla-latte',
    name: '바닐라 라떼',
    price: 5500,
    description: '은은한 바닐라 향을 더한 달콤한 라떼',
    note: 'SWEET',
    art: 'vanilla',
  },
]

const INVENTORY_MENU = MENU
const DEFAULT_INVENTORY = Object.fromEntries(
  INVENTORY_MENU.map((menu) => [menu.id, 10]),
)

const formatPrice = (price) => `${price.toLocaleString('ko-KR')}원`

function readOrders() {
  const savedOrders = localStorage.getItem('cozy-orders')
  if (!savedOrders) return []

  const orders = JSON.parse(savedOrders)
  if (!Array.isArray(orders)) {
    throw new Error('저장된 주문 정보를 읽을 수 없습니다.')
  }
  return orders
}

function readInventory() {
  const savedInventory = localStorage.getItem('cozy-inventory')
  if (!savedInventory) return DEFAULT_INVENTORY

  const inventory = JSON.parse(savedInventory)
  if (
    !inventory ||
    typeof inventory !== 'object' ||
    Array.isArray(inventory) ||
    INVENTORY_MENU.some(
      (menu) =>
        inventory[menu.id] !== undefined &&
        (!Number.isInteger(inventory[menu.id]) || inventory[menu.id] < 0),
    )
  ) {
    throw new Error('저장된 재고 정보를 읽을 수 없습니다.')
  }
  return { ...DEFAULT_INVENTORY, ...inventory }
}

function createOrderId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getCurrentTimestamp() {
  return new Date().toISOString()
}

function formatOrderDate(timestamp) {
  return new Date(timestamp).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function CoffeeIllustration({ art }) {
  return (
    <div className={`coffee-art coffee-art--${art}`} aria-hidden="true">
      <span className="coffee-art__sun" />
      <span className="coffee-art__bean coffee-art__bean--one" />
      <span className="coffee-art__bean coffee-art__bean--two" />
      <svg className="coffee-art__cup" viewBox="0 0 180 150" fill="none">
        <path
          d="M45 54h81v43c0 19-15 34-34 34H79c-19 0-34-15-34-34V54Z"
          fill="var(--cup-color)"
        />
        <path
          d="M126 66h12a17 17 0 0 1 0 34h-13"
          stroke="var(--cup-color)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M39 136h105"
          stroke="var(--cup-color)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M54 58c13-9 48-9 63 0"
          stroke="var(--coffee-color)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M73 36c-8-8 8-13 0-22m25 22c-8-8 8-13 0-22"
          stroke="var(--steam-color)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      <span className="coffee-art__caption">COZY COFFEE</span>
    </div>
  )
}

function App() {
  const [view, setView] = useState(
    window.location.hash === '#admin' ? 'admin' : 'order',
  )
  const [selectedOptions, setSelectedOptions] = useState({})
  const [cart, setCart] = useState([])
  const [notice, setNotice] = useState(null)
  const [orders, setOrders] = useState([])
  const [inventory, setInventory] = useState(DEFAULT_INVENTORY)

  const cartTotal = calculateCartTotal(cart)
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0)
  const orderCounts = summarizeOrders(orders)

  useEffect(() => {
    function syncView() {
      setView(window.location.hash === '#admin' ? 'admin' : 'order')
      try {
        setOrders(readOrders())
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : '알 수 없는 오류가 발생했어요.'
        setNotice({ type: 'error', text: reason })
      }
    }

    function syncStorage(event) {
      try {
        if (!event || event.key === 'cozy-orders') setOrders(readOrders())
        if (!event || event.key === 'cozy-inventory') {
          setInventory(readInventory())
        }
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : '알 수 없는 오류가 발생했어요.'
        setNotice({ type: 'error', text: reason })
      }
    }

    window.addEventListener('hashchange', syncView)
    window.addEventListener('storage', syncStorage)
    syncStorage()
    return () => {
      window.removeEventListener('hashchange', syncView)
      window.removeEventListener('storage', syncStorage)
    }
  }, [])

  function toggleOption(menuId, optionId) {
    setSelectedOptions((current) => {
      const menuOptions = current[menuId] ?? []
      const nextOptions = menuOptions.includes(optionId)
        ? menuOptions.filter((id) => id !== optionId)
        : [...menuOptions, optionId]

      return { ...current, [menuId]: nextOptions }
    })
  }

  function addToCart(menu) {
    const optionIds = [...(selectedOptions[menu.id] ?? [])].sort()
    const options = OPTIONS.filter((option) => optionIds.includes(option.id))
    const unitPrice =
      menu.price + options.reduce((total, option) => total + option.price, 0)
    const cartId = `${menu.id}:${optionIds.join(',')}`

    setCart((current) => {
      const existingItem = current.find((item) => item.id === cartId)
      if (existingItem) {
        return current.map((item) =>
          item.id === cartId ? { ...item, quantity: item.quantity + 1 } : item,
        )
      }

      return [
        ...current,
        {
          id: cartId,
          menuId: menu.id,
          name: menu.name,
          options,
          unitPrice,
          quantity: 1,
        },
      ]
    })
    setNotice({ type: 'success', text: `${menu.name} 메뉴를 담았어요.` })
  }

  function changeQuantity(itemId, amount) {
    setCart((current) =>
      current
        .map((item) =>
          item.id === itemId
            ? { ...item, quantity: item.quantity + amount }
            : item,
        )
        .filter((item) => item.quantity > 0),
    )
  }

  function submitOrder() {
    if (cart.length === 0) return

    try {
      const currentOrders = readOrders()

      const order = {
        id: createOrderId(),
        createdAt: getCurrentTimestamp(),
        status: '주문 접수',
        items: cart.map((item) => ({
          menuId: item.menuId,
          name: item.name,
          options: item.options.map((option) => ({
            id: option.id,
            name: option.name,
            price: option.price,
          })),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.unitPrice * item.quantity,
        })),
        totalPrice: cartTotal,
      }

      const updatedOrders = [...currentOrders, order]
      localStorage.setItem('cozy-orders', JSON.stringify(updatedOrders))
      setOrders(updatedOrders)
      setCart([])
      setSelectedOptions({})
      setNotice({ type: 'success', text: '주문이 완료되었어요. 감사합니다!' })
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : '알 수 없는 오류가 발생했어요.'
      setNotice({
        type: 'error',
        text: `주문을 저장하지 못했어요. 장바구니를 유지했으니 다시 시도해 주세요. (${reason})`,
      })
    }
  }

  function changeOrderStatus(orderId) {
    const updatedOrders = orders.map((order) => {
      if (order.id !== orderId) return order
      return { ...order, status: getNextOrderStatus(order.status) }
    })

    try {
      localStorage.setItem('cozy-orders', JSON.stringify(updatedOrders))
      setOrders(updatedOrders)
      setNotice({ type: 'success', text: '주문 상태를 변경했어요.' })
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : '알 수 없는 오류가 발생했어요.'
      setNotice({ type: 'error', text: `주문 상태를 저장하지 못했어요. (${reason})` })
    }
  }

  function changeInventory(menuId, amount) {
    const nextQuantity = inventory[menuId] + amount
    if (nextQuantity < 0) return

    const updatedInventory = { ...inventory, [menuId]: nextQuantity }
    try {
      localStorage.setItem('cozy-inventory', JSON.stringify(updatedInventory))
      setInventory(updatedInventory)
      setNotice({ type: 'success', text: '재고 수량을 변경했어요.' })
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : '알 수 없는 오류가 발생했어요.'
      setNotice({ type: 'error', text: `재고를 저장하지 못했어요. (${reason})` })
    }
  }

  return (
    <div className="page-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="COZY 홈">
          COZY<span className="brand__dot">.</span>
        </a>
        <nav className="topbar__nav" aria-label="주요 메뉴">
          <a
            className={`topbar__link${view === 'order' ? ' topbar__link--active' : ''}`}
            href="#menu"
            aria-current={view === 'order' ? 'page' : undefined}
          >
            주문하기
          </a>
          <a
            className={`topbar__link${view === 'admin' ? ' topbar__link--active' : ''}`}
            href="#admin"
            aria-current={view === 'admin' ? 'page' : undefined}
          >
            관리자
          </a>
        </nav>
        {view === 'order' && (
          <a
            className="topbar__cart"
            href="#cart"
            aria-label={`장바구니 ${cartCount}개`}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 8h16l-1.4 12H5.4L4 8Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M9 9V6a3 3 0 0 1 6 0v3"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
            {cartCount > 0 && <span className="topbar__cart-count">{cartCount}</span>}
          </a>
        )}
      </header>

      {view === 'admin' ? (
        <main id="top" className="admin-content">
          <section className="admin-heading" aria-labelledby="admin-title">
            <div>
              <p className="eyebrow">COZY STORE MANAGEMENT</p>
              <h1 id="admin-title">관리자 대시보드</h1>
            </div>
          </section>

          {notice && (
            <div
              className={`notice notice--${notice.type}`}
              role={notice.type === 'error' ? 'alert' : 'status'}
            >
              <span>{notice.text}</span>
              <button
                className="notice__close"
                type="button"
                aria-label="안내 닫기"
                onClick={() => setNotice(null)}
              >
                ×
              </button>
            </div>
          )}

          <section className="admin-section" aria-labelledby="dashboard-title">
            <div className="admin-section__heading">
              <div>
                <p className="eyebrow">AT A GLANCE</p>
                <h2 id="dashboard-title">관리자 대시보드</h2>
              </div>
              <span className="admin-section__meta">ALL TIME</span>
            </div>
            <div className="dashboard-grid">
              {[
                { label: '총 주문', count: orderCounts.total, tone: 'total' },
                { label: '주문 접수', count: orderCounts.received, tone: 'received' },
                { label: '제조 중', count: orderCounts.making, tone: 'making' },
                { label: '제조 완료', count: orderCounts.complete, tone: 'complete' },
              ].map((stat) => (
                <article
                  className={`dashboard-card dashboard-card--${stat.tone}`}
                  key={stat.label}
                >
                  <span className="dashboard-card__label">{stat.label}</span>
                  <strong className="dashboard-card__count">{stat.count}</strong>
                  <span className="dashboard-card__unit">건</span>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-section" aria-labelledby="inventory-title">
            <div className="admin-section__heading">
              <div>
                <p className="eyebrow">STOCK CONTROL</p>
                <h2 id="inventory-title">재고 현황</h2>
              </div>
              <span className="admin-section__meta">
                {INVENTORY_MENU.length} MENUS
              </span>
            </div>
            <div className="inventory-grid">
              {INVENTORY_MENU.map((menu) => {
                const quantity = inventory[menu.id]
                const { key: stockStatus, label: stockLabel } =
                  getStockStatus(quantity)

                return (
                  <article className="inventory-card" key={menu.id}>
                    <div className="inventory-card__top">
                      <span className="inventory-card__category">COFFEE</span>
                      <span className={`stock-badge stock-badge--${stockStatus}`}>
                        {stockLabel}
                      </span>
                    </div>
                    <h3>{menu.name}</h3>
                    <div className="inventory-card__quantity">
                      <strong>{quantity}</strong>
                      <span>개 남음</span>
                    </div>
                    <div className="inventory-card__controls">
                      <button
                        className="inventory-control"
                        type="button"
                        aria-label={`${menu.name} 재고 늘리기`}
                        onClick={() => changeInventory(menu.id, 1)}
                      >
                        +
                      </button>
                      <button
                        className="inventory-control"
                        type="button"
                        aria-label={`${menu.name} 재고 줄이기`}
                        disabled={quantity === 0}
                        onClick={() => changeInventory(menu.id, -1)}
                      >
                        −
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="admin-section orders-section" aria-labelledby="orders-title">
            <div className="admin-section__heading">
              <div>
                <p className="eyebrow">LIVE ORDER QUEUE</p>
                <h2 id="orders-title">주문 현황</h2>
              </div>
              <span className="admin-section__meta">{orders.length} ORDERS</span>
            </div>
            {orders.length === 0 ? (
              <div className="admin-empty">
                <span className="admin-empty__icon" aria-hidden="true">☕</span>
                <strong>아직 접수된 주문이 없어요.</strong>
                <span>새 주문이 들어오면 이곳에서 확인할 수 있어요.</span>
              </div>
            ) : (
              <ul className="order-list">
                {[...orders].reverse().map((order) => (
                  <li className="order-row" key={order.id}>
                    <div className="order-row__date">
                      <span>{formatOrderDate(order.createdAt)}</span>
                      <span className="order-row__number">
                        ORDER #{String(order.id).slice(-6)}
                      </span>
                    </div>
                    <div className="order-row__items">
                      {order.items.map((item) => (
                        <span
                          key={`${order.id}-${item.menuId}-${item.options?.map((option) => option.id).join(',') ?? 'basic'}`}
                        >
                          {item.name} <b>× {item.quantity}</b>
                          {item.options?.length > 0 && (
                            <small>
                              {item.options.map((option) => option.name).join(' · ')}
                            </small>
                          )}
                        </span>
                      ))}
                    </div>
                    <strong className="order-row__total">
                      {formatPrice(order.totalPrice)}
                    </strong>
                    <span className={`order-status order-status--${order.status === '제조 중' ? 'making' : order.status === '제조 완료' ? 'complete' : 'received'}`}>
                      {order.status}
                    </span>
                    {order.status !== '제조 완료' ? (
                      <button
                        className="button button--primary order-row__action"
                        type="button"
                        onClick={() => changeOrderStatus(order.id)}
                      >
                        {order.status === '주문 접수' ? '제조 시작' : '제조 완료'}
                        <span aria-hidden="true">→</span>
                      </button>
                    ) : (
                      <span className="order-row__done">처리 완료</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      ) : (
      <main id="top" className="main-content">
        <section className="intro" aria-labelledby="menu-title">
          <div>
            <p className="eyebrow">YOUR DAILY PAUSE</p>
            <h1 id="menu-title">오늘의 커피</h1>
            <p className="intro__copy">
              천천히 골라보세요. 당신의 하루에 어울리는 한 잔을 준비할게요.
            </p>
          </div>
          <div className="intro__mark" aria-hidden="true">
            <span>매일 좋은 원두</span>
            <span className="intro__mark-icon">✳</span>
          </div>
        </section>

        {notice && (
          <div
            className={`notice notice--${notice.type}`}
            role={notice.type === 'error' ? 'alert' : 'status'}
          >
            <span>{notice.text}</span>
            <button
              className="notice__close"
              type="button"
              aria-label="안내 닫기"
              onClick={() => setNotice(null)}
            >
              ×
            </button>
          </div>
        )}

        <section id="menu" className="menu-section" aria-label="커피 메뉴">
          <div className="section-heading">
            <div>
              <p className="eyebrow">MADE FOR YOUR MOMENT</p>
              <h2>커피 메뉴</h2>
            </div>
            <span className="section-heading__meta">01 — 04</span>
          </div>

          <div className="menu-grid">
            {MENU.map((menu, index) => (
              <article className="menu-card" key={menu.id}>
                <div className="menu-card__image">
                  <CoffeeIllustration art={menu.art} />
                  <span className="menu-card__index">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="menu-card__tag">{menu.note}</span>
                </div>
                <div className="menu-card__body">
                  <div className="menu-card__title-row">
                    <h3>{menu.name}</h3>
                    <span className="menu-card__price">{formatPrice(menu.price)}</span>
                  </div>
                  <p className="menu-card__description">{menu.description}</p>
                  <fieldset className="option-list">
                    <legend className="sr-only">{menu.name} 추가 옵션</legend>
                    {OPTIONS.map((option) => (
                      <label className="option" key={option.id}>
                        <input
                          type="checkbox"
                          checked={(selectedOptions[menu.id] ?? []).includes(
                            option.id,
                          )}
                          onChange={() => toggleOption(menu.id, option.id)}
                        />
                        <span className="option__check" aria-hidden="true" />
                        <span>{option.name}</span>
                        <span className="option__price">
                          {option.price > 0 ? `+${formatPrice(option.price)}` : '+0원'}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  <button
                    className="button button--outline menu-card__add"
                    type="button"
                    onClick={() => addToCart(menu)}
                  >
                    <span>장바구니 담기</span>
                    <span aria-hidden="true">+</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="cart" className="cart-panel" aria-labelledby="cart-title">
          <div className="cart-panel__main">
            <div className="cart-panel__heading">
              <div>
                <p className="eyebrow">READY WHEN YOU ARE</p>
                <h2 id="cart-title">장바구니</h2>
              </div>
              <span className="cart-panel__count">{cartCount} ITEMS</span>
            </div>

            {cart.length === 0 ? (
              <div className="cart-empty">
                <span className="cart-empty__icon" aria-hidden="true">
                  +
                </span>
                <p>아직 담긴 메뉴가 없어요.</p>
                <span>마음에 드는 커피를 골라 담아보세요.</span>
              </div>
            ) : (
              <ul className="cart-list">
                {cart.map((item) => (
                  <li className="cart-item" key={item.id}>
                    <div className="cart-item__detail">
                      <span className="cart-item__name">{item.name}</span>
                      <span className="cart-item__options">
                        {item.options.length > 0
                          ? item.options.map((option) => option.name).join(' · ')
                          : '기본'}
                      </span>
                    </div>
                    <div
                      className="quantity-control"
                      aria-label={`${item.name} 수량`}
                    >
                      <button
                        type="button"
                        aria-label={`${item.name} 수량 줄이기`}
                        onClick={() => changeQuantity(item.id, -1)}
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        aria-label={`${item.name} 수량 늘리기`}
                        onClick={() => changeQuantity(item.id, 1)}
                      >
                        +
                      </button>
                    </div>
                    <strong className="cart-item__total">
                      {formatPrice(item.unitPrice * item.quantity)}
                    </strong>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <aside className="cart-summary" aria-label="주문 금액">
            <div className="cart-summary__row">
              <span>총 금액</span>
              <strong>{formatPrice(cartTotal)}</strong>
            </div>
            <p className="cart-summary__note">주문 내용을 확인해 주세요.</p>
            <button
              className="button button--primary cart-summary__submit"
              type="button"
              disabled={cart.length === 0}
              onClick={submitOrder}
            >
              주문하기 <span aria-hidden="true">→</span>
            </button>
            <span className="cart-summary__secure">결제 없이 주문이 접수됩니다</span>
          </aside>
        </section>
      </main>
      )}

      <footer className="footer">
        <a className="footer__brand" href="#top">
          COZY.
        </a>
        <span>Good coffee, good day.</span>
        <span>© 2026 COZY COFFEE</span>
      </footer>
    </div>
  )
}

export default App
