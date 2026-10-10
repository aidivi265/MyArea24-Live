import React from 'react';

interface EmergencyViewProps {
  selectedArea: string;
}

export const EmergencyView: React.FC<EmergencyViewProps> = ({ selectedArea }) => {
  return (
    <div className="view-container emergency-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Health & Emergency Life Services (112)</h1>
          <p className="view-subtitle">
            Instant civic helplines, hospital casualty routing, and district disaster management hotlines.
          </p>
        </div>
        <div className="emergency-sos-badge">
          <span>Nationwide Emergency Number:</span>
          <strong>112</strong>
        </div>
      </div>

      {/* Primary Helplines Grid */}
      <div className="emergency-cards-grid">
        <a href="tel:112" className="card emergency-action-card emergency-primary">
          <div className="emergency-icon-circle">🚨</div>
          <div className="emergency-info">
            <span className="emergency-number">112</span>
            <span className="emergency-service-name">National Emergency Response (ERSS)</span>
            <span className="emergency-desc">All-in-one Police, Fire, Ambulance, & Disaster Response</span>
          </div>
          <span className="tap-to-call-pill">Tap to Call 📞</span>
        </a>

        <a href="tel:108" className="card emergency-action-card emergency-medical">
          <div className="emergency-icon-circle">🚑</div>
          <div className="emergency-info">
            <span className="emergency-number">108 / 102</span>
            <span className="emergency-service-name">Emergency Medical Ambulance</span>
            <span className="emergency-desc">Government Critical Care Transport Service</span>
          </div>
          <span className="tap-to-call-pill">Tap to Call 📞</span>
        </a>

        <a href="tel:101" className="card emergency-action-card emergency-fire">
          <div className="emergency-icon-circle">🚒</div>
          <div className="emergency-info">
            <span className="emergency-number">101</span>
            <span className="emergency-service-name">Fire & Rescue Service</span>
            <span className="emergency-desc">Municipal Fire Brigade & Structural Collapse Units</span>
          </div>
          <span className="tap-to-call-pill">Tap to Call 📞</span>
        </a>

        <a href="tel:1077" className="card emergency-action-card emergency-disaster">
          <div className="emergency-icon-circle">🏛️</div>
          <div className="emergency-info">
            <span className="emergency-number">1077</span>
            <span className="emergency-service-name">District Disaster Management (DDMA)</span>
            <span className="emergency-desc">Flood, Severe Storm, & Civic Hazard Helpline</span>
          </div>
          <span className="tap-to-call-pill">Tap to Call 📞</span>
        </a>
      </div>

      {/* Local Casualty Hospitals for Active Corridor */}
      <div className="card local-hospitals-card">
        <h2 className="card-heading">
          Verified Casualty & Trauma Centers ({selectedArea || 'Delhi NCR Pilot'})
        </h2>
        <div className="hospitals-list">
          <div className="hospital-row">
            <div className="hospital-main">
              <strong>AIIMS New Delhi — Apex Trauma Center</strong>
              <p>Ring Road, Safdarjung Enclave, New Delhi • 24/7 Level-1 Emergency Facility</p>
            </div>
            <a href="tel:01126588500" className="call-btn-sm">
              011-26588500 📞
            </a>
          </div>

          <div className="hospital-row">
            <div className="hospital-main">
              <strong>Safdarjung Hospital Emergency Care</strong>
              <p>Opposite AIIMS, Mahatma Gandhi Marg, New Delhi • 24/7 Emergency Wing</p>
            </div>
            <a href="tel:01126165060" className="call-btn-sm">
              011-26165060 📞
            </a>
          </div>

          <div className="hospital-row">
            <div className="hospital-main">
              <strong>Ram Manohar Lohia Hospital (RML)</strong>
              <p>Baba Kharak Singh Marg, Connaught Place, New Delhi • 24/7 Emergency Casualty</p>
            </div>
            <a href="tel:01123365525" className="call-btn-sm">
              011-23365525 📞
            </a>
          </div>
        </div>
      </div>

      {/* Offline Disaster Protocols */}
      <div className="card disaster-protocols-card">
        <h2 className="card-heading">Immediate Citizen Action Protocols</h2>
        <div className="protocols-grid">
          <div className="protocol-box">
            <h4>🌧️ Flash Flooding / Severe Waterlogging</h4>
            <ul>
              <li>Do not walk or drive through moving flood water deeper than 15 cm.</li>
              <li>Stay away from electrical transformers, submerged poles, and exposed cabling.</li>
              <li>Report sewer line backflow or manhole breaches immediately to municipal helplines.</li>
            </ul>
          </div>
          <div className="protocol-box">
            <h4>⚡ Severe Thunderstorm & Lightning</h4>
            <ul>
              <li>Seek shelter inside solid concrete structures; avoid isolated trees or metallic bus shelters.</li>
              <li>Disconnect delicate electrical appliances during active lightning ground strikes.</li>
              <li>If outdoors in open fields, crouch low on the balls of your feet with hands on knees.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
