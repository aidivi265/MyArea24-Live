import React from 'react';

interface MarketViewProps {
  selectedArea: string;
}

export const MarketView: React.FC<MarketViewProps> = ({ selectedArea }) => {
  const commodities = [
    {
      commodity: 'Tomato (Local Hybrid)',
      mandi: 'Azadpur APMC Mandi, Delhi',
      modalPrice: '₹28 / kg',
      range: '₹22 - ₹34 / kg',
      trend: 'Steady',
      arrival: '1,420 Quintals',
    },
    {
      commodity: 'Onion (Nasik Red)',
      mandi: 'Azadpur APMC Mandi, Delhi',
      modalPrice: '₹38 / kg',
      range: '₹32 - ₹44 / kg',
      trend: 'Slight Rise (+₹2)',
      arrival: '2,100 Quintals',
    },
    {
      commodity: 'Potato (Jyoti)',
      mandi: 'Okhla Sabzi Mandi, Delhi',
      modalPrice: '₹24 / kg',
      range: '₹20 - ₹26 / kg',
      trend: 'Stable',
      arrival: '1,850 Quintals',
    },
    {
      commodity: 'Green Chilli',
      mandi: 'Ghazipur APMC Mandi, Delhi',
      modalPrice: '₹55 / kg',
      range: '₹48 - ₹62 / kg',
      trend: 'Decreasing (-₹4)',
      arrival: '320 Quintals',
    },
  ];

  return (
    <div className="view-container market-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Civic Market & Mandi Price Telemetry</h1>
          <p className="view-subtitle">
            Wholesale commodity arrivals and APMC market prices for {selectedArea || 'Delhi NCR Region'}.
          </p>
        </div>
      </div>

      <div className="market-source-notice card">
        <span className="source-tag">Source Attribution: Agmarknet / APMC Market Intelligence</span>
        <p>Official wholesale price monitoring. Retail neighborhood prices may reflect standard transportation margins.</p>
      </div>

      <div className="commodities-table-card card">
        <table className="mandi-table">
          <thead>
            <tr>
              <th>Commodity</th>
              <th>Mandi Hub</th>
              <th>Modal Wholesale Price</th>
              <th>Price Band</th>
              <th>Daily Trend</th>
              <th>Arrival Volume</th>
            </tr>
          </thead>
          <tbody>
            {commodities.map((c, i) => (
              <tr key={i}>
                <td><strong>{c.commodity}</strong></td>
                <td>{c.mandi}</td>
                <td><span className="price-pill">{c.modalPrice}</span></td>
                <td>{c.range}</td>
                <td><span className="trend-text">{c.trend}</span></td>
                <td>{c.arrival}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
