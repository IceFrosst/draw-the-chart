import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';

const Reel = lazy(() =>
  import('./pages/Reel').then((module) => ({ default: module.Reel })),
);
const Landing = lazy(() =>
  import('./pages/Landing').then((module) => ({ default: module.Landing })),
);
const Game = lazy(() =>
  import('./pages/Game').then((module) => ({ default: module.Game })),
);
const FAQ = lazy(() =>
  import('./pages/FAQ').then((module) => ({ default: module.FAQ })),
);
const Leaderboard = lazy(() =>
  import('./pages/Leaderboard').then((module) => ({ default: module.Leaderboard })),
);
const Whitepaper = lazy(() =>
  import('./pages/Whitepaper').then((module) => ({ default: module.Whitepaper })),
);
const Validate = lazy(() =>
  import('./pages/Validate').then((module) => ({ default: module.Validate })),
);

const PAGE_TITLES: Record<string, string> = {
  '/': 'Draw The Chart',
  '/overview': 'Overview | Draw The Chart',
  '/play': 'Play | Draw The Chart',
  '/faq': 'How It Works | Draw The Chart',
  '/leaderboard': 'Journal | Draw The Chart',
  '/whitepaper': 'Whitepaper | Draw The Chart',
  '/validate': 'Validate Scoring | Draw The Chart',
};

const PAGE_DESCRIPTIONS: Record<string, string> = {
  '/': 'Bet on the shape of a price path. Draw what the market does next and get paid on how close you were.',
  '/overview': 'Draw The Chart overview: scoring components, payout curve, and timeframes.',
  '/play': 'Play the Draw The Chart sandbox, draw a BTC path, and see how the scoring and payout engine settle the round.',
  '/faq': 'Learn how Draw The Chart scoring, payout logic, sandbox rounds, and fairness model work.',
  '/leaderboard': 'Review locally saved Draw The Chart sandbox rounds, scores, multipliers, and payout outcomes in the round journal.',
  '/whitepaper': 'Read the Draw The Chart product paper covering the thesis, scoring engine, economics, and rollout design.',
  '/validate': 'Compare prediction pairs side-by-side and validate the DTC scoring algorithm against human judgment.',
};

function Layout() {
  const location = useLocation();

  useEffect(() => {
    document.title = PAGE_TITLES[location.pathname] || 'Draw The Chart';

    const description =
      PAGE_DESCRIPTIONS[location.pathname] ||
      'Draw The Chart is a BTC prediction game built around drawing the future price path.';

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', description);

    let themeMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.setAttribute('name', 'theme-color');
      document.head.appendChild(themeMeta);
    }
    themeMeta.setAttribute('content', '#0b0e0c');
  }, [location.pathname]);

  return (
    <>
      <Navbar />
      <Suspense fallback={<PageSkeleton />}>
        <div key={location.pathname} className="animate-fade-in">
          <Outlet />
        </div>
      </Suspense>
    </>
  );
}

// The sandbox is open while it is being shared for review. To gate it again,
// wrap <BrowserRouter> in <PasswordGate> (see components/PasswordGate.tsx) and
// set VITE_APP_PASSWORD — note that the value ships in the client bundle, so it
// deters casual visitors rather than actually restricting access.
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* The reel is full-screen with no chrome — it sits outside the navbar layout
            and is the only route with nothing clickable until the closing CTA. */}
        <Route
          path="/"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <Reel />
            </Suspense>
          }
        />
        <Route element={<Layout />}>
          <Route path="/overview" element={<Landing />} />
          <Route path="/play" element={<Game />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/whitepaper" element={<Whitepaper />} />
          <Route path="/validate" element={<Validate />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function PageSkeleton() {
  return (
    <div
      className="min-h-screen pt-20 px-4 sm:px-6"
      style={{
        background:
          'radial-gradient(circle at top left, rgba(212, 168, 92, 0.06), transparent 24%), radial-gradient(circle at bottom right, rgba(72, 183, 132, 0.06), transparent 16%), var(--bg-primary)',
      }}
    >
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="h-10 w-48 shimmer" />
        <div className="h-32 shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-32 shimmer" />
          <div className="h-32 shimmer" />
          <div className="h-32 shimmer" />
        </div>
      </div>
    </div>
  );
}
