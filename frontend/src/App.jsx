import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Watchlist from './pages/Watchlist';
import Analytics from './pages/Analytics';
import SystemStatus from './pages/SystemStatus';
import FaceDetection from './pages/FaceDetection';
import DatabaseManagement from './pages/DatabaseManagement';
import Layout from './layouts/Layout';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/face-detection" element={<FaceDetection />} />
          <Route path="/database" element={<DatabaseManagement />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/status" element={<SystemStatus />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
