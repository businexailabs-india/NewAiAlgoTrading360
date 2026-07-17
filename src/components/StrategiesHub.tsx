import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { StrategyExplorer } from './StrategyExplorer';
import { JsonStrategyDashboard } from './JsonStrategyDashboard';
import { AdvisoryMarketplacePanel } from './AdvisoryMarketplacePanel';

export function StrategiesHub() {
  return (
    <Tabs defaultValue="advisory">
      <TabsList className="bg-gray-900 border border-gray-800 mb-4">
        <TabsTrigger value="advisory">AI Algo Advisory</TabsTrigger>
        <TabsTrigger value="rules">My Rule Strategies</TabsTrigger>
        <TabsTrigger value="marketplace">Strategy Marketplace</TabsTrigger>
      </TabsList>
      <TabsContent value="advisory">
        <AdvisoryMarketplacePanel />
      </TabsContent>
      <TabsContent value="rules">
        <JsonStrategyDashboard />
      </TabsContent>
      <TabsContent value="marketplace">
        <StrategyExplorer />
      </TabsContent>
    </Tabs>
  );
}
