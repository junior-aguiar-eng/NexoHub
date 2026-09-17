import { Cloud, LayoutDashboard, LogOut, Monitor, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import { isTauriEnvironment } from "@/platform/document-core";
import { useAuth } from "./useAuth";

export function UserMenu() {
  const { user, isGuest, signOut, openAuthModal, openUserProfileModal } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isDesktop = isTauriEnvironment();

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  // Gera as iniciais do nome real do usuário
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  function handleOpenAuth(tab: "login" | "signup" | "pair") {
    setDropdownOpen(false);
    openAuthModal(tab);
  }

  function handleOpenProfile() {
    setDropdownOpen(false);
    openUserProfileModal();
  }

  return (
    <div className="user-menu-container" ref={menuRef}>
      {isGuest ? (
        <Button
          variant="secondary"
          className="user-menu-guest-btn"
          onClick={() => handleOpenAuth("login")}
          title="Fazer login ou criar conta gratuita para sincronizar preferências"
        >
          <User size={15} />
          <span>Entrar</span>
        </Button>
      ) : (
        <button
          type="button"
          className="user-avatar-btn"
          onClick={() => setDropdownOpen((prev) => !prev)}
          aria-expanded={dropdownOpen}
          aria-haspopup="true"
          aria-label={`Menu da conta de ${user?.name}`}
        >
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="user-avatar-img" />
          ) : (
            <span className="user-avatar-initials">{initials}</span>
          )}
        </button>
      )}

      {/* Menu Suspenso */}
      {dropdownOpen && !isGuest && user && (
        <div className="user-dropdown-menu" role="menu">
          <div className="user-dropdown-header">
            <strong className="user-dropdown-name">{user.name}</strong>
            <span className="user-dropdown-email">{user.email}</span>
            <div className="user-dropdown-sync-pill">
              <Cloud size={12} />
              <span>{translate("account.profile.syncActive")}</span>
            </div>
          </div>

          <div className="user-dropdown-divider" />

          <button
            type="button"
            className="user-dropdown-item"
            role="menuitem"
            onClick={handleOpenProfile}
          >
            <LayoutDashboard size={15} />
            <span>{translate("account.menu.profile")}</span>
          </button>

          <button
            type="button"
            className="user-dropdown-item"
            role="menuitem"
            onClick={() => handleOpenAuth("pair")}
          >
            <Monitor size={15} />
            <span>
              {isDesktop
                ? translate("account.menu.pairFromWeb")
                : translate("account.menu.pairForDesktop")}
            </span>
          </button>

          <div className="user-dropdown-divider" />

          <button
            type="button"
            className="user-dropdown-item user-dropdown-item--danger"
            role="menuitem"
            onClick={() => {
              signOut();
              setDropdownOpen(false);
            }}
          >
            <LogOut size={15} />
            <span>Sair da conta</span>
          </button>
        </div>
      )}
    </div>
  );
}
