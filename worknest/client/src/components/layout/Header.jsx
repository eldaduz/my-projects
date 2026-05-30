const publicNavigationItems = [
  { href: '/', label: 'בית' },
  { href: '/locations', label: 'מיקומים' },
];

export default function Header({
  currentPath,
  currentUser,
  isRestoringSession,
  onOpenLogin,
  onLogout,
}) {
  function handleAuthAction(event, openModal) {
    event.preventDefault();
    openModal();
  }

  const navigationItems = [...publicNavigationItems];

  if (currentUser) {
    navigationItems.push({ href: '/my-reservations', label: 'ההזמנות שלי' });

    if (currentUser.role === 'admin') {
      navigationItems.push({ href: '/admin', label: 'ניהול מערכת' });
    }
  }

  return (
    <header className="header-shell">
      <div className="page-container">
        <div className="header-bar">
          <a className="brand-mark" href="/" data-link>
            <span className="brand-wordmark">WorkNest</span>
          </a>

          <nav className="main-nav" aria-label="ניווט ראשי">
            {navigationItems.map((item) => {
              // The home route must match exactly. Other links can stay active for child paths.
              const isActive =
                item.href === '/'
                  ? currentPath === '/'
                  : currentPath === item.href || currentPath.startsWith(`${item.href}/`);

              return (
                <a
                  key={item.href}
                  className={isActive ? 'nav-link nav-link-active' : 'nav-link'}
                  href={item.href}
                  data-link
                >
                  {item.label}
                </a>
              );
            })}

            {!isRestoringSession && !currentUser ? (
              <button
                type="button"
                className={
                  currentPath === '/login' || currentPath === '/register'
                    ? 'nav-link nav-link-active'
                    : 'nav-link'
                }
                onClick={(event) => handleAuthAction(event, onOpenLogin)}
              >
                התחברות/הרשמה
              </button>
            ) : null}

            {!isRestoringSession && currentUser ? (
              <button type="button" className="nav-link" onClick={onLogout}>
                יציאה
              </button>
            ) : null}
          </nav>
        </div>
      </div>
    </header>
  );
}
