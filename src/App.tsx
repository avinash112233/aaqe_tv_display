import { Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import StationDisplay from './pages/StationDisplay';
import './styles/display.css';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/display" element={<StationDisplay />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
