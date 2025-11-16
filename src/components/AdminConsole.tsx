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
  Shield,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  UserPlus,
  Ban,
  Mail,
  Bell,
  Download,
  Upload,
  RefreshCw,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Lock,
  Unlock
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
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

// Mock data for admin dashboard
const systemStats = {
  totalUsers: 12847,
  activeUsers: 8234,
  totalRevenue: 45678900,
  activeSubscriptions: 9876,
  apiCalls: 2847392,
  systemUptime: 99.98,
  avgResponseTime: 145,
  errorRate: 0.02
};

const revenueData = [
  { month: 'Jan', revenue: 3200000, users: 1200 },
  { month: 'Feb', revenue: 3800000, users: 1450 },
  { month: 'Mar', revenue: 4200000, users: 1680 },
  { month: 'Apr', revenue: 3900000, users: 1590 },
  { month: 'May', revenue: 4500000, users: 1820 },
  { month: 'Jun', revenue: 4800000, users: 1950 }
];

const userActivityData = [
  { time: '00:00', active: 1200 },
  { time: '04:00', active: 800 },
  { time: '08:00', active: 3500 },
  { time: '12:00', active: 5200 },
  { time: '16:00', active: 4800 },
  { time: '20:00', active: 3200 }
];

const subscriptionDistribution = [
  { name: 'Free', value: 3500, color: '#6b7280' },
  { name: 'Basic', value: 4200, color: '#3b82f6' },
  { name: 'Pro', value: 2800, color: '#8b5cf6' },
  { name: 'Enterprise', value: 1376, color: '#06b6d4' }
];

const recentUsers = [
  { id: 1, name: 'Rajesh Kumar', email: 'rajesh.k@email.com', plan: 'Pro', status: 'active', joined: '2 hours ago', revenue: 2999 },
  { id: 2, name: 'Priya Sharma', email: 'priya.s@email.com', plan: 'Basic', status: 'active', joined: '5 hours ago', revenue: 999 },
  { id: 3, name: 'Amit Patel', email: 'amit.p@email.com', plan: 'Enterprise', status: 'active', joined: '1 day ago', revenue: 9999 },
  { id: 4, name: 'Sneha Reddy', email: 'sneha.r@email.com', plan: 'Pro', status: 'pending', joined: '2 days ago', revenue: 2999 },
  { id: 5, name: 'Vikram Singh', email: 'vikram.s@email.com', plan: 'Free', status: 'active', joined: '3 days ago', revenue: 0 }
];

const systemAlerts = [
  { id: 1, type: 'warning', message: 'High API usage detected on server-3', time: '5 mins ago', severity: 'medium' },
  { id: 2, type: 'error', message: 'Database backup failed', time: '15 mins ago', severity: 'high' },
  { id: 3, type: 'info', message: 'New feature deployed successfully', time: '1 hour ago', severity: 'low' },
  { id: 4, type: 'warning', message: 'SSL certificate expires in 7 days', time: '2 hours ago', severity: 'medium' }
];

const apiEndpoints = [
  { endpoint: '/api/portfolio/holdings', calls: 145678, avgTime: 120, errorRate: 0.01, status: 'healthy' },
  { endpoint: '/api/market/data', calls: 892341, avgTime: 85, errorRate: 0.02, status: 'healthy' },
  { endpoint: '/api/trading/orders', calls: 67234, avgTime: 210, errorRate: 0.05, status: 'warning' },
  { endpoint: '/api/user/profile', calls: 234567, avgTime: 95, errorRate: 0.01, status: 'healthy' },
  { endpoint: '/api/broker/connect', calls: 12456, avgTime: 450, errorRate: 0.15, status: 'critical' }
];

export function AdminConsole() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: systemStats.totalUsers.toLocaleString(), change: '+12.5%', icon: Users, color: 'cyan' },
          { label: 'Active Users', value: systemStats.activeUsers.toLocaleString(), change: '+8.3%', icon: Activity, color: 'green' },
          { label: 'Total Revenue', value: `₹${(systemStats.totalRevenue / 10000000).toFixed(2)}Cr`, change: '+15.7%', icon: DollarSign, color: 'purple' },
          { label: 'API Calls', value: `${(systemStats.apiCalls / 1000000).toFixed(2)}M`, change: '+23.1%', icon: BarChart3, color: 'blue' }
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
              <Badge className={`bg-${metric.color}-500/20 text-${metric.color}-400 border-${metric.color}-500/30`}>
                {metric.change}
              </Badge>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{metric.value}</div>
            <div className="text-sm text-gray-400">{metric.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Tabs */}
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
          <TabsTrigger value="alerts" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Alerts
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Revenue Chart */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
          >
            <h3 className="text-white text-xl mb-4">Revenue & User Growth</h3>
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
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Activity */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
            >
              <h3 className="text-white text-xl mb-4">User Activity (24h)</h3>
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
            </motion.div>

            {/* Subscription Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
            >
              <h3 className="text-white text-xl mb-4">Subscription Distribution</h3>
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
            </motion.div>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          {/* Search and Filters */}
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

          {/* Users Table */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/30 border border-gray-700 rounded-xl overflow-hidden"
          >
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
                  {recentUsers.map((user) => (
                    <tr key={user.id} className="border-t border-gray-700 hover:bg-gray-800/50">
                      <td className="p-4">
                        <div>
                          <div className="text-white font-medium">{user.name}</div>
                          <div className="text-sm text-gray-400">{user.email}</div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge className={`
                          ${user.plan === 'Enterprise' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : ''}
                          ${user.plan === 'Pro' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : ''}
                          ${user.plan === 'Basic' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : ''}
                          ${user.plan === 'Free' ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' : ''}
                        `}>
                          {user.plan}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge className={`
                          ${user.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/30' : ''}
                          ${user.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : ''}
                        `}>
                          {user.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-white">₹{user.revenue.toLocaleString()}</td>
                      <td className="p-4 text-gray-400">{user.joined}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="ghost">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'System Uptime', value: `${systemStats.systemUptime}%`, icon: CheckCircle, color: 'green' },
              { label: 'Avg Response Time', value: `${systemStats.avgResponseTime}ms`, icon: Clock, color: 'blue' },
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

          {/* System Actions */}
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

        {/* API Monitor Tab */}
        <TabsContent value="api" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/30 border border-gray-700 rounded-xl overflow-hidden"
          >
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-white text-xl">API Endpoints Performance</h3>
            </div>
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
                        <Badge className={`
                          ${endpoint.status === 'healthy' ? 'bg-green-500/20 text-green-400 border-green-500/30' : ''}
                          ${endpoint.status === 'warning' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : ''}
                          ${endpoint.status === 'critical' ? 'bg-red-500/20 text-red-400 border-red-500/30' : ''}
                        `}>
                          {endpoint.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          {systemAlerts.map((alert) => (
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
                  <Button size="sm" variant="ghost">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost">
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
