import React from 'react';

const HomePage: React.FC = () => {
  return (
    <div className="page-content">
      <h1>Welcome to IonMC Manager</h1>
      <p>This is where the main content will go. The terminal, file manager, and other instance controls will be implemented here.</p>
      
      <div className="placeholder-content">
        <h2>Coming Soon:</h2>
        <ul>
          <li>Terminal Interface</li>
          <li>File Manager</li>
          <li>Server Configuration</li>
          <li>Player Management</li>
          <li>Plugin Manager</li>
        </ul>
      </div>
    </div>
  );
};

export default HomePage;