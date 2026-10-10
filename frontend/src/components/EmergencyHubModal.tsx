import React, { useEffect } from 'react';

interface EmergencyHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmergencyHubModal: React.FC<EmergencyHubModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="emergency-modal-title"
    >
      <div className="modal-container emergency-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header emergency-modal-header">
          <div className="modal-title-group">
            <span className="emergency-alert-tag">🚨 NATIONAL CIVIC SAFETY</span>
            <h2 id="emergency-modal-title" className="modal-headline">
              India Public Safety & Emergency Hub
            </h2>
            <p className="modal-subheading">
              Official 24/7 helplines and immediate response numbers for Delhi NCR, Bengaluru, and Pan-India.
            </p>
          </div>
          <button
            onClick={onClose}
            className="modal-close-btn"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Primary 112 Banner */}
          <div className="primary-helpline-card">
            <div className="primary-helpline-left">
              <span className="primary-dial-icon">📞</span>
              <div>
                <h3 className="primary-helpline-title">112 — National Emergency Service</h3>
                <p className="primary-helpline-desc">
                  Unified emergency response for Police, Fire, Ambulance, and Disaster Relief. Available toll-free nationwide.
                </p>
              </div>
            </div>
            <a href="tel:112" className="dial-btn primary-dial-btn">
              Dial 112
            </a>
          </div>

          {/* Grid of Key Helplines */}
          <div className="emergency-contacts-grid">
            <div className="contact-card">
              <div className="contact-meta">
                <span className="contact-badge">NDMA</span>
                <h4 className="contact-name">National Disaster Management</h4>
                <p className="contact-details">Disaster warnings, flood response, cyclonic alerts.</p>
              </div>
              <a href="tel:1078" className="dial-link">
                1078 →
              </a>
            </div>

            <div className="contact-card">
              <div className="contact-meta">
                <span className="contact-badge">DDMA</span>
                <h4 className="contact-name">District Disaster Helpline</h4>
                <p className="contact-details">District-level relief coordination and evacuation.</p>
              </div>
              <a href="tel:1077" className="dial-link">
                1077 →
              </a>
            </div>

            <div className="contact-card">
              <div className="contact-meta">
                <span className="contact-badge">State Relief</span>
                <h4 className="contact-name">State Disaster Control Room</h4>
                <p className="contact-details">State-level civic control centers and advisories.</p>
              </div>
              <a href="tel:1070" className="dial-link">
                1070 →
              </a>
            </div>

            <div className="contact-card">
              <div className="contact-meta">
                <span className="contact-badge">NHAI / Traffic</span>
                <h4 className="contact-name">National Highways Emergency</h4>
                <p className="contact-details">Highway breakdown, accident assistance, route blockages.</p>
              </div>
              <a href="tel:1033" className="dial-link">
                1033 →
              </a>
            </div>
          </div>

          {/* Advisory Guidelines */}
          <div className="emergency-guidelines-box">
            <h4 className="guidelines-title">⚠️ Monsoon & Road Waterlogging Safety Rules</h4>
            <ul className="guidelines-list">
              <li>
                <strong>Do not drive through submerged underpasses:</strong> Underpasses like Minto Bridge or Moolchand can flood rapidly within 15 minutes.
              </li>
              <li>
                <strong>Keep away from fallen powerlines:</strong> Stay at least 10 meters away from downed cables during thunderstorms.
              </li>
              <li>
                <strong>Follow official advisories:</strong> Monitor SACHET CAP emergency notifications before navigating flood-prone arterials.
              </li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-primary">
            Close Hub
          </button>
        </div>
      </div>
    </div>
  );
};
