import { ALGOS_MENU_H } from '../../contexts/AlgosNavContext';
import { MARKET_TICKER_H } from './MarketTickerBar';
import { UserProfileHeader } from '../UserProfileHeader';
import { TOP_CHROME_H } from '../TopBar';

/**
 * Profile strip under ticker (Algos tabs live in TopBar with icon nav).
 */
export function AlgosMenuBar({
  onPortfolioChange,
  onManageAccounts,
  onSettings
}: {
  onNavigateAlgos?: () => void;
  onPortfolioChange: (portfolioId: string) => void;
  onManageAccounts: () => void;
  onSettings: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        top: TOP_CHROME_H + MARKET_TICKER_H,
        left: 80,
        right: 0,
        height: ALGOS_MENU_H,
        zIndex: 490,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 10,
        padding: '0 12px 0 16px',
        background:
          'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(2,6,23,0.96) 100%)',
        borderBottom: '1px solid rgba(34,211,238,0.28)',
        boxShadow: '0 6px 16px rgba(0,0,0,0.35)'
      }}
    >
      <UserProfileHeader
        compact
        onPortfolioChange={onPortfolioChange}
        onManageAccounts={onManageAccounts}
        onSettings={onSettings}
      />
    </div>
  );
}

export { ALGOS_MENU_H };
