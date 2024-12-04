import React from 'react';
import './Header.css';

function Header() {
  return (
    <header className="header">
      <button className="star-btn" aria-label="Star">
        ★
      </button>
      <h1 className="header-title">
        Just<span className="header-highlight">A</span>Meeting
      </h1>
      <button className="settings-btn" aria-label="Settings">
        ⚙
      </button>
    </header>
  );
}

export default Header;
