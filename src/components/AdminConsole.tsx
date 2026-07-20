import { motion } from 'motion/react';
import { useState } from 'react';
import {
  Users,
  Activity,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Settings,
  Database,
  Server,
  Shield,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  UserPlus,
  Mail,
  Download,
  Upload,
  RefreshCw,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Network
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DhanIntegrationPanel } from './DhanIntegrationPanel';
import { McpProvidersModule } from '@web-admin/modules/mcp-providers';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface AdminConsoleProps {
  systemStats?: {
    totalUsers: number;
    activeUsers: number;
    totalRevenue: number;
    activeSubscriptions: number;
    apiCalls: number;
    systemUptime: number;
    avgResponseTime: number;
    errorRate: number;
  };
  revenueData?: Array<{ month: string; revenue: number; users: number }>;
  userActivityData?: Array<{ time: string; active: number }>;
  subscriptionDistribution?: Array<{ name: string; value: number; color: string }>;
  recentUsers?: Array<{
    id: number | string;
    name: string;
    email: string;
    plan: string;
    status: string;
    joined: string;
    revenue: number;
  }>;
  systemAlerts?: Array<{
    id: number | string;
    type: string;
    message: string;
    time: string;
    severity: string;
  }>;
  apiEndpoints?: Array<{
    endpoint: string;
    calls: number;
    avgTime: number;
    errorRate: number;
    status: string;
  }>;
}

const emptyStats = {
  totalUsers: 0,
  activeUsers: 0,
  totalRevenue: 0,
  activeSubscriptions: 0,
  apiCalls: 0,
  systemUptime: 0,
  avgResponseTime: 0,
  errorRate: 0
};

export function AdminConsole({
  systemStats = emptyStats,
  revenueData = [],
  userActivityData = [],
  subscriptionDistribution = [],
  recentUsers = [],
  systemAlerts = [],
  apiEndpoints = []
}: AdminConsoleProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const filteredUsers = recentUsers.filter(u =>
    !searchQuery ||
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-purple-900/50 via-blue-900/50 to-cyan-900/50 backdrop-blur-sm border border-purple-500/30 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-xl border border-purple-500/30">
              <Shield className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Admin Console</h1>
              <p className="text-gray-400">System management & monitoring</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
              <SelectTrigger className="w-32 bg-gray-800 border-gray-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="border-gray-700"
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: systemStats.totalUsers.toLocaleString(), icon: Users, color: 'cyan' },
          { label: 'Active Users', value: systemStats.activeUsers.toLocaleString(), icon: Activity, color: 'green' },
          { label: 'Total Revenue', value: `₹${(systemStats.totalRevenue / 10000000).toFixed(2)}Cr`, icon: DollarSign, color: 'purple' },
          { label: 'API Calls', value: systemStats.apiCalls.toLocaleString(), icon: BarChart3, color: 'blue' }
        ].map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <metric.icon className={`w-8 h-8 text-${metric.color}-400`} />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{metric.value}</div>
            <div className="text-sm text-gray-400">{metric.label}</div>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-gray-800 mb-6">
          <TabsTrigger value="overview" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <Users className="w-4 h-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="system" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <Database className="w-4 h-4 mr-2" />
            System
          </TabsTrigger>
          <TabsTrigger value="api" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <Activity className="w-4 h-4 mr-2" />
            API Monitor
          </TabsTrigger>
          <TabsTrigger value="mcp-providers" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <Network className="w-4 h-4 mr-2" />
            MCP Providers
          </TabsTrigger>
          <TabsTrigger value="dhan" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <Server className="w-4 h-4 mr-2" />
            Dhan MCP
          </TabsTrigger>
          <TabsTrigger value="alerts" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Alerts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
          >
            <h3 className="text-white text-xl mb-4">Revenue & User Growth</h3>
            {revenueData.length === 0 ? (
              <div className="text-center py-16 text-gray-400">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={3} name="Revenue (₹)" />
                  <Line type="monotone" dataKey="users" stroke="#06b6d4" strokeWidth={3} name="New Users" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
            >
              <h3 className="text-white text-xl mb-4">User Activity (24h)</h3>
              {userActivityData.length === 0 ? (
                <div className="text-center py-16 text-gray-400">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={userActivityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="active" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
            >
              <h3 className="text-white text-xl mb-4">Subscription Distribution</h3>
              {subscriptionDistribution.length === 0 ? (
                <div className="text-center py-16 text-gray-400">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={subscriptionDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {subscriptionDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </motion.div>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search users by name, email, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700"
              />
            </div>
            <Button variant="outline" className="border-gray-700">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            <Button className="bg-gradient-to-r from-purple-500 to-cyan-500">
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/30 border border-gray-700 rounded-xl overflow-hidden"
          >
            {filteredUsers.length === 0 ? (
              <div className="text-center py-16 text-gray-400">No data available</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900/50">
                    <tr>
                      <th className="text-left p-4 text-gray-400 font-medium">User</th>
                      <th className="text-left p-4 text-gray-400 font-medium">Plan</th>
                      <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                      <th className="text-left p-4 text-gray-400 font-medium">Revenue</th>
                      <th className="text-left p-4 text-gray-400 font-medium">Joined</th>
                      <th className="text-right p-4 text-gray-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-t border-gray-700 hover:bg-gray-800/50">
                        <td className="p-4">
                          <div>
                            <div className="text-white font-medium">{user.name}</div>
                            <div className="text-sm text-gray-400">{user.email}</div>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">{user.plan}</Badge>
                        </td>
                        <td className="p-4">
                          <Badge className={
                            user.status === 'active'
                              ? 'bg-green-500/20 text-green-400 border-green-500/30'
                              : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          }>
                            {user.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-white">₹{user.revenue.toLocaleString()}</td>
                        <td className="p-4 text-gray-400">{user.joined}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="ghost"><Eye className="w-4 h-4" /></Button>
                            <Button size="sm" variant="ghost"><Edit className="w-4 h-4" /></Button>
                            <Button size="sm" variant="ghost"><MoreVertical className="w-4 h-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'System Uptime', value: systemStats.systemUptime ? `${systemStats.systemUptime}%` : '—', icon: CheckCircle, color: 'green' },
              { label: 'Avg Response Time', value: systemStats.avgResponseTime ? `${systemStats.avgResponseTime}ms` : '—', icon: Clock, color: 'blue' },
              { label: 'Error Rate', value: `${systemStats.errorRate}%`, icon: AlertTriangle, color: 'yellow' },
              { label: 'Active Subscriptions', value: systemStats.activeSubscriptions.toLocaleString(), icon: TrendingUp, color: 'purple' }
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <stat.icon className={`w-6 h-6 text-${stat.color}-400`} />
                  <span className="text-sm text-gray-400">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
          >
            <h3 className="text-white text-xl mb-4">System Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button variant="outline" className="border-gray-700 justify-start">
                <Database className="w-4 h-4 mr-2" />
                Backup Database
              </Button>
              <Button variant="outline" className="border-gray-700 justify-start">
                <Download className="w-4 h-4 mr-2" />
                Export Logs
              </Button>
              <Button variant="outline" className="border-gray-700 justify-start">
                <Upload className="w-4 h-4 mr-2" />
                Import Data
              </Button>
              <Button variant="outline" className="border-gray-700 justify-start">
                <RefreshCw className="w-4 h-4 mr-2" />
                Clear Cache
              </Button>
              <Button variant="outline" className="border-gray-700 justify-start">
                <Mail className="w-4 h-4 mr-2" />
                Send Bulk Email
              </Button>
              <Button variant="outline" className="border-gray-700 justify-start">
                <Settings className="w-4 h-4 mr-2" />
                System Config
              </Button>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="api" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/30 border border-gray-700 rounded-xl overflow-hidden"
          >
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-white text-xl">API Endpoints Performance</h3>
            </div>
            {apiEndpoints.length === 0 ? (
              <div className="text-center py-16 text-gray-400">No data available</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900/50">
                    <tr>
                      <th className="text-left p-4 text-gray-400 font-medium">Endpoint</th>
                      <th className="text-left p-4 text-gray-400 font-medium">Calls</th>
                      <th className="text-left p-4 text-gray-400 font-medium">Avg Time</th>
                      <th className="text-left p-4 text-gray-400 font-medium">Error Rate</th>
                      <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiEndpoints.map((endpoint, i) => (
                      <tr key={i} className="border-t border-gray-700 hover:bg-gray-800/50">
                        <td className="p-4 text-white font-mono text-sm">{endpoint.endpoint}</td>
                        <td className="p-4 text-gray-300">{endpoint.calls.toLocaleString()}</td>
                        <td className="p-4 text-gray-300">{endpoint.avgTime}ms</td>
                        <td className="p-4 text-gray-300">{(endpoint.errorRate * 100).toFixed(2)}%</td>
                        <td className="p-4">
                          <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                            {endpoint.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </TabsContent>

        <TabsContent value="mcp-providers" className="space-y-4">
          <McpProvidersModule />
        </TabsContent>

        <TabsContent value="dhan" className="space-y-4">
          <DhanIntegrationPanel />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {systemAlerts.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-gray-800/30 border border-gray-700 rounded-xl">
              No data available
            </div>
          ) : (
            systemAlerts.map((alert) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`bg-gray-800/30 border rounded-xl p-4 ${
                  alert.severity === 'high' ? 'border-red-500/50' :
                  alert.severity === 'medium' ? 'border-yellow-500/50' :
                  'border-blue-500/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                      alert.severity === 'high' ? 'text-red-400' :
                      alert.severity === 'medium' ? 'text-yellow-400' :
                      'text-blue-400'
                    }`} />
                    <div>
                      <p className="text-white font-medium">{alert.message}</p>
                      <p className="text-sm text-gray-400 mt-1">{alert.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost"><Eye className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost"><XCircle className="w-4 h-4" /></Button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
