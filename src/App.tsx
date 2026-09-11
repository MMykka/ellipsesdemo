import { NavLink, Route, Routes } from 'react-router-dom'
import clsx from 'clsx'
import { TripsPage } from './features/trips/TripsPage'
import { RoutingPage } from './features/map/RoutingPage'

function NavTab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          'border-b-2 px-3 py-3 text-sm font-medium',
          isActive
            ? 'border-blue-600 text-blue-700'
            : 'border-transparent text-gray-500 hover:text-gray-700',
        )
      }
    >
      {label}
    </NavLink>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white px-6">
        <div className="mx-auto flex max-w-7xl gap-2">
          <NavTab to="/trips" label="Trips" />
          <NavTab to="/routing" label="Routing" />
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<TripsPage />} />
        <Route path="/trips" element={<TripsPage />} />
        <Route path="/routing" element={<RoutingPage />} />
      </Routes>
    </div>
  )
}
