import React from 'react';

const InventoryTabs = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'live', label: 'Live Inventory', count: null },
    { id: 'analytics', label: 'Stock Analytics', count: null },
    { id: 'catalog', label: 'Product Catalog', count: null },
    { id: 'movements', label: 'Stock Movements', count: null },
    { id: 'alerts', label: 'Alerts', count: 2 }, // Example count for alerts
  ];

  return (
    <div className="border-b border-gray-200">
      <div className="flex space-x-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap
              transition-colors duration-200
              ${activeTab === tab.id
                ? 'bg-emerald-500 text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }
            `}
          >
            {tab.label}
            {tab.count !== null && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs 
                ${activeTab === tab.id
                  ? 'bg-white bg-opacity-20 text-white'
                  : 'bg-gray-100 text-gray-600'
                }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default InventoryTabs;
