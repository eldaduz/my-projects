import Header from './Header.jsx';

export default function AppLayout({
  children,
  currentPath,
  currentUser,
  isRestoringSession,
  onOpenLogin,
  onOpenRegister,
  onLogout,
}) {
  return (
    <div className="app-shell">
      <Header
        currentPath={currentPath}
        currentUser={currentUser}
        isRestoringSession={isRestoringSession}
        onOpenLogin={onOpenLogin}
        onOpenRegister={onOpenRegister}
        onLogout={onLogout}
      />
      <main className="app-main">
        <div className="page-container app-layout-frame">
          <div className="page-shell">{children}</div>
        </div>
      </main>
    </div>
  );
}
