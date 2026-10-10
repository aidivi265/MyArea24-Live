import React from 'react';

interface ServicesViewProps {
  selectedArea: string;
}

export const ServicesView: React.FC<ServicesViewProps> = ({ selectedArea }) => {
  const services = [
    {
      id: 1,
      name: 'BSES Rajdhani Power Limited (BRPL) Emergency Control',
      category: 'Electricity & Power',
      contact: '19123 / 011-39999707',
      address: 'Central Division, Connaught Place, New Delhi',
      timing: '24/7 Helpline',
    },
    {
      id: 2,
      name: 'Delhi Jal Board (DJB) Water Emergency Control Room',
      category: 'Water Supply',
      contact: '1916 / 011-23525555',
      address: 'Jhandewalan Headquarters, New Delhi',
      timing: '24/7 Water Tanker & Leakage Unit',
    },
    {
      id: 3,
      name: 'New Delhi Municipal Council (NDMC) Citizen Service Center',
      category: 'Civic Administration',
      contact: '1533 / 011-23360114',
      address: 'Palika Kendra, Sansad Marg, New Delhi',
      timing: 'Mon - Fri (09:30 - 18:00 IST)',
    },
    {
      id: 4,
      name: 'Delhi Police Traffic Control Room',
      category: 'Public Transit',
      contact: '1095 / 011-25844444',
      address: 'Todapur, New Delhi',
      timing: '24/7 Breakdown & Crane Assistance',
    },
  ];

  return (
    <div className="view-container services-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Essential Services & Civic Directory</h1>
          <p className="view-subtitle">
            Verified municipal utility offices, emergency maintenance helplines, and public administrative centers for {selectedArea || 'Pilot Corridors'}.
          </p>
        </div>
      </div>

      <div className="services-grid">
        {services.map((svc) => (
          <div key={svc.id} className="card service-card">
            <div className="service-category-tag">{svc.category}</div>
            <h3 className="service-name">{svc.name}</h3>
            <p className="service-address">📍 {svc.address}</p>
            <p className="service-timing">🕒 {svc.timing}</p>
            <div className="service-contact-box">
              <span>Helpline:</span>
              <a href={`tel:${svc.contact.split('/')[0].trim()}`} className="service-phone-link">
                {svc.contact} 📞
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
