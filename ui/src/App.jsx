import { useEffect, useState } from 'react'
import {
  createOrder as submitOrderRequest,
  getAdminMenus,
  getAdminOrders,
  getMenus,
  updateMenuStock,
  updateOrderStatus,
} from './api.js'
import {
  calculateCartTotal,
  getNextOrderStatus,
  getStockStatus,
  summarizeOrders,
} from './orderUtils.js'
import './App.css'

const formatPrice = (price) => `${price.toLocaleString('ko-KR')}원`

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
  const [menus, setMenus] = useState([])
  const [adminMenus, setAdminMenus] = useState([])
  const [orders, setOrders] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [refreshCount, setRefreshCount] = useState(0)
  const [loadedKey, setLoadedKey] = useState(null)
  const isLoading = loadedKey !== `${view}:${refreshCount}`

  const cartTotal = calculateCartTotal(cart)
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0)
  const orderCounts = summarizeOrders(orders)

  useEffect(() => {
    function syncView() {
      setView(window.location.hash === '#admin' ? 'admin' : 'order')
    }

    window.addEventListener('hashchange', syncView)
    return () => window.removeEventListener('hashchange', syncView)
  }, [])

  useEffect(() => {
    let active = true
    const loadData =
      view === 'admin'
        ? Promise.all([getAdminMenus(), getAdminOrders()]).then(
            ([menuData, orderData]) => {
              if (!active) return
              setAdminMenus(menuData.menus)
              setOrders(orderData.orders)
            },
          )
        : getMenus().then((menuData) => {
            if (active) setMenus(menuData.menus)
          })

    loadData
      .catch((error) => {
        if (active) {
          setNotice({
            type: 'error',
            text: `데이터를 불러오지 못했어요. (${error.message})`,
          })
        }
      })
      .finally(() => {
        if (active) setLoadedKey(`${view}:${refreshCount}`)
      })

    return () => {
      active = false
    }
  }, [view, refreshCount])

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
    const optionIds = [...(selectedOptions[menu.id] ?? [])].sort((a, b) => a - b)
    const options = menu.options.filter((option) => optionIds.includes(option.id))
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

  async function submitOrder() {
    if (cart.length === 0) return

    setIsSubmitting(true)
    try {
      const { order } = await submitOrderRequest(
        cart.map((item) => ({
          menuId: item.menuId,
          quantity: item.quantity,
          optionIds: item.options.map((option) => option.id),
        })),
      )
      setCart([])
      setSelectedOptions({})
      setNotice({
        type: 'success',
        text: `주문이 완료되었어요. 주문 번호 #${order.id} · ${formatPrice(order.totalAmount)}`,
      })
    } catch (error) {
      setNotice({
        type: 'error',
        text: `주문을 저장하지 못했어요. 장바구니를 유지했으니 다시 시도해 주세요. (${error.message})`,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function changeOrderStatus(order) {
    try {
      await updateOrderStatus(order.id, getNextOrderStatus(order.status))
      setRefreshCount((count) => count + 1)
      setNotice({ type: 'success', text: '주문 상태를 변경했어요.' })
    } catch (error) {
      setRefreshCount((count) => count + 1)
      setNotice({ type: 'error', text: `주문 상태를 변경하지 못했어요. (${error.message})` })
    }
  }

  async function changeInventory(menuId, amount) {
    try {
      await updateMenuStock(menuId, amount)
      setRefreshCount((count) => count + 1)
      setNotice({ type: 'success', text: '재고 수량을 변경했어요.' })
    } catch (error) {
      setRefreshCount((count) => count + 1)
      setNotice({ type: 'error', text: `재고를 변경하지 못했어요. (${error.message})` })
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
                {adminMenus.length} MENUS
              </span>
            </div>
            <div className="inventory-grid">
              {adminMenus.map((menu) => {
                const quantity = menu.stockQuantity
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
            {isLoading && <p className="admin-empty">재고를 불러오는 중이에요.</p>}
          </section>

          <section className="admin-section orders-section" aria-labelledby="orders-title">
            <div className="admin-section__heading">
              <div>
                <p className="eyebrow">LIVE ORDER QUEUE</p>
                <h2 id="orders-title">주문 현황</h2>
              </div>
              <div className="admin-section__actions">
                <span className="admin-section__meta">{orders.length} ORDERS</span>
                <button
                  className="admin-refresh"
                  type="button"
                  onClick={() => setRefreshCount((count) => count + 1)}
                  disabled={isLoading}
                >
                  새로고침
                </button>
              </div>
            </div>
            {isLoading && orders.length === 0 ? (
              <div className="admin-empty">주문 현황을 불러오는 중이에요.</div>
            ) : orders.length === 0 ? (
              <div className="admin-empty">
                <span className="admin-empty__icon" aria-hidden="true">☕</span>
                <strong>아직 접수된 주문이 없어요.</strong>
                <span>새 주문이 들어오면 이곳에서 확인할 수 있어요.</span>
              </div>
            ) : (
              <ul className="order-list">
                {orders.map((order) => (
                  <li className="order-row" key={order.id}>
                    <div className="order-row__date">
                      <span>{formatOrderDate(order.orderedAt)}</span>
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
                      {formatPrice(order.totalAmount)}
                    </strong>
                    <span className={`order-status order-status--${order.status === '제조 중' ? 'making' : order.status === '제조 완료' ? 'complete' : 'received'}`}>
                      {order.status}
                    </span>
                    {order.status !== '제조 완료' ? (
                      <button
                        className="button button--primary order-row__action"
                        type="button"
                        onClick={() => changeOrderStatus(order)}
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
            <span className="section-heading__meta">
              {String(menus.length).padStart(2, '0')} MENUS
            </span>
          </div>

          <div className="menu-grid">
            {menus.map((menu, index) => (
              <article className="menu-card" key={menu.id}>
                <div className="menu-card__image">
                  {menu.imageUrl ? (
                    <img className="menu-card__photo" src={menu.imageUrl} alt={menu.name} />
                  ) : (
                    <CoffeeIllustration
                      art={['americano', 'hot', 'latte', 'vanilla'][index % 4]}
                    />
                  )}
                  <span className="menu-card__index">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="menu-card__tag">
                    {['BEST', 'CLASSIC', 'MILK', 'SWEET'][index % 4]}
                  </span>
                </div>
                <div className="menu-card__body">
                  <div className="menu-card__title-row">
                    <h3>{menu.name}</h3>
                    <span className="menu-card__price">{formatPrice(menu.price)}</span>
                  </div>
                  <p className="menu-card__description">{menu.description}</p>
                  <fieldset className="option-list">
                    <legend className="sr-only">{menu.name} 추가 옵션</legend>
                    {menu.options.map((option) => (
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
                    disabled={menu.soldOut}
                    onClick={() => addToCart(menu)}
                  >
                    <span>{menu.soldOut ? '품절' : '장바구니 담기'}</span>
                    {!menu.soldOut && <span aria-hidden="true">+</span>}
                  </button>
                </div>
              </article>
            ))}
            {isLoading && <p className="menu-loading">메뉴를 불러오는 중이에요.</p>}
            {!isLoading && menus.length === 0 && (
              <p className="menu-loading">현재 주문할 수 있는 메뉴가 없어요.</p>
            )}
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
              disabled={cart.length === 0 || isSubmitting}
              onClick={submitOrder}
            >
              {isSubmitting ? '주문 접수 중…' : '주문하기'}{' '}
              <span aria-hidden="true">→</span>
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
